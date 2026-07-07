/**
 * Worker de WhatsApp (Baileys) para MALALA — multi-sesión.
 *
 * Mantiene UNA sesión de WhatsApp por sucursal (un número por sucursal, igual
 * que la integración ManyChat anterior). Cada sesión es un "dispositivo
 * vinculado" de WhatsApp Web: se escanea el QR una sola vez y las credenciales
 * quedan persistidas en `auth/<sucursalId>/`, así reconecta sola en cada
 * reinicio sin re-escanear.
 *
 * Expone un servidor HTTP que la app Next.js consume:
 *   GET  /status?sucursal=<id>   estado de una sesión
 *   GET  /status                 estado de todas las sesiones
 *   GET  /qr?sucursal=<id>       QR (PNG data URL) para vincular esa sucursal
 *   POST /send                   { sucursalId, telefonoE164, mensaje }
 *   POST /logout?sucursal=<id>   desvincula y borra credenciales
 *
 * Auth: los endpoints de escritura (/send, /logout) requieren el header
 * `Authorization: Bearer ${WORKER_SECRET}`.
 *
 * IMPORTANTE (prod): este proceso debe estar prendido 24/7 y la carpeta `auth/`
 * debe vivir en disco persistente. Ver docs/turnos-whatsapp/PROGRESO.md.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_BASE = join(__dirname, "auth");

const PORT = Number(process.env.WORKER_PORT ?? 8787);
// Interfaz donde escucha el server. Default 0.0.0.0 (reachable por la plataforma
// en Railway/Fly). En una VPS con reverse proxy conviene 127.0.0.1 para no
// exponer el puerto crudo a internet (el proxy sí lo alcanza por loopback).
const HOST = process.env.WORKER_HOST ?? "0.0.0.0";
const SECRET = process.env.WORKER_SECRET ?? "";

const logger = pino({ level: process.env.WORKER_LOG_LEVEL ?? "silent" });

// libsignal imprime por su cuenta volcados enormes de "Closing session: ..."
// al renegociar el cifrado. Es ruido benigno; lo filtramos para no ensuciar.
const _consoleLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === "string" && args[0].startsWith("Closing session")) return;
  _consoleLog(...args);
};

type SessionStatus = "connecting" | "qr" | "connected" | "closed";

interface Session {
  sucursalId: string;
  sock: WASocket | null;
  status: SessionStatus;
  qrDataUrl: string | null;
  numero: string | null;
  /** Evita levantar dos sockets en paralelo para la misma sucursal. */
  starting: boolean;
}

const sessions = new Map<string, Session>();

/** Log con timestamp y sucursal, para seguir la vida de cada sesión. */
function log(sucursalId: string, ...args: unknown[]): void {
  console.log(`[${new Date().toISOString()}] [${sucursalId}]`, ...args);
}

// Espera de acuses: al enviar registramos el id del mensaje y resolvemos cuando
// llega su `messages.update` con status (o por timeout).
const pendingAcks = new Map<string, (status: number) => void>();
function waitForAck(id: string, ms: number): Promise<number | undefined> {
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      pendingAcks.delete(id);
      resolve(undefined);
    }, ms);
    pendingAcks.set(id, (status) => {
      clearTimeout(t);
      pendingAcks.delete(id);
      resolve(status);
    });
  });
}

/** Nombre legible del motivo de desconexión de Baileys. */
function disconnectLabel(code?: number): string {
  const M = DisconnectReason;
  switch (code) {
    case M.loggedOut:
      return "loggedOut (WhatsApp desvinculó el dispositivo)";
    case M.restartRequired:
      return "restartRequired (reinicio normal tras vincular)";
    case M.connectionClosed:
      return "connectionClosed";
    case M.connectionLost:
      return "connectionLost";
    case M.connectionReplaced:
      return "connectionReplaced (se abrió otra sesión con el mismo número)";
    case M.timedOut:
      return "timedOut";
    case M.badSession:
      return "badSession (credenciales corruptas)";
    case M.multideviceMismatch:
      return "multideviceMismatch";
    default:
      return `código ${code ?? "?"}`;
  }
}

/** Sólo permitimos ids "seguros" para usarlos como nombre de carpeta. */
function safeSucursalId(raw: string): string | null {
  return /^[A-Za-z0-9_-]+$/.test(raw) ? raw : null;
}

function getOrInitSession(sucursalId: string): Session {
  let s = sessions.get(sucursalId);
  if (!s) {
    s = {
      sucursalId,
      sock: null,
      status: "closed",
      qrDataUrl: null,
      numero: null,
      starting: false,
    };
    sessions.set(sucursalId, s);
  }
  return s;
}

async function startSession(sucursalId: string): Promise<Session> {
  const session = getOrInitSession(sucursalId);
  if (session.starting) return session;
  session.starting = true;

  const authDir = join(AUTH_BASE, sucursalId);
  mkdirSync(authDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    // El QR lo manejamos a mano (printQRInTerminal está deprecado).
    browser: ["MALALA Turnos", "Chrome", "120.0.0"],
  });
  log(sucursalId, `Iniciando socket (Baileys WA v${version.join(".")}).`);

  session.sock = sock;
  session.status = "connecting";
  session.starting = false;

  sock.ev.on("creds.update", saveCreds);

  // Acuses de entrega: nos dice si el mensaje realmente llegó al teléfono del
  // destinatario (DELIVERY_ACK) o sólo fue aceptado por el server (SERVER_ACK).
  sock.ev.on("messages.update", (updates) => {
    for (const u of updates) {
      const st = u.update?.status;
      if (st != null) {
        const id = u.key?.id;
        log(sucursalId, `↪ acuse ${id ?? "?"} → ${RECEIPT_STATUS[st] ?? `status ${st}`}`);
        if (id) pendingAcks.get(id)?.(st);
      }
    }
  });

  // Mensajes ENTRANTES: sirve para verificar que la sesión está viva en ambos
  // sentidos. Si mandás un WhatsApp AL número del local y esto loguea, la
  // sesión funciona; si no, está rota aunque diga "Conectado".
  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      if (m.key.fromMe) continue;
      const from = m.key.remoteJid ?? "?";
      const text =
        m.message?.conversation ??
        m.message?.extendedTextMessage?.text ??
        "[no-texto]";
      log(sucursalId, `📥 Entrante de ${from}: ${text.slice(0, 60)}`);
    }
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.status = "qr";
      log(sucursalId, "QR generado — esperando escaneo.");
      console.log(`\n[${sucursalId}] Escaneá este QR con WhatsApp:\n`);
      qrcodeTerminal.generate(qr, { small: true });
      QRCode.toDataURL(qr)
        .then((url) => {
          session.qrDataUrl = url;
        })
        .catch(() => {
          /* el QR de terminal sigue sirviendo */
        });
    }

    if (connection === "open") {
      session.status = "connected";
      session.qrDataUrl = null;
      session.numero = sock.user?.id?.split(":")[0] ?? null;
      log(sucursalId, `✅ Conectado (${session.numero ?? "?"}).`);
    }

    if (connection === "close") {
      const statusCode = (
        lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
      )?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      log(
        sucursalId,
        `⚠ Conexión cerrada — ${disconnectLabel(statusCode)}.`,
      );

      if (loggedOut) {
        // WhatsApp desvinculó el dispositivo: hay que re-escanear. Limpiamos
        // credenciales para que el próximo /qr genere uno nuevo.
        session.status = "closed";
        session.numero = null;
        session.sock = null;
        try {
          rmSync(authDir, { recursive: true, force: true });
        } catch {
          /* noop */
        }
        log(sucursalId, "Credenciales borradas. Re-escaneá el QR para vincular.");
      } else {
        // Caída transitoria: reconectar.
        session.status = "connecting";
        log(sucursalId, "Reconectando…");
        startSession(sucursalId).catch((e) =>
          console.error(`[${sucursalId}] Error al reconectar:`, e),
        );
      }
    }
  });

  return session;
}

/** Al arrancar, reconecta toda sucursal que ya tenga credenciales en disco. */
async function restoreSessions(): Promise<void> {
  if (!existsSync(AUTH_BASE)) return;
  const dirs = readdirSync(AUTH_BASE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const sucursalId of dirs) {
    if (!safeSucursalId(sucursalId)) continue;
    console.log(`[${sucursalId}] Restaurando sesión guardada…`);
    await startSession(sucursalId).catch((e) =>
      console.error(`[${sucursalId}] No se pudo restaurar:`, e),
    );
  }
}

// ─────────────────────────────── HTTP ───────────────────────────────

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

function isAuthorized(req: IncomingMessage): boolean {
  if (!SECRET) return false;
  return req.headers.authorization === `Bearer ${SECRET}`;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(); // guard
    });
    req.on("end", () => {
      try {
        resolve(data ? (JSON.parse(data) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function statusPayload(s: Session) {
  return { sucursalId: s.sucursalId, status: s.status, numero: s.numero };
}

/**
 * Direcciones candidatas a probar, en orden. En Argentina un mismo número puede
 * ser entregable por el JID con "9", sin "9", o por su LID — y cuál funciona
 * varía por contacto (sobre todo en el primer mensaje, cuando se arma la sesión
 * Signal). Probamos varias y nos quedamos con la que WhatsApp acepte.
 */
async function candidateJids(
  sock: WASocket,
  telefonoE164: string,
  sucursalId: string,
): Promise<string[]> {
  const numero = telefonoE164.replace(/\D/g, "");
  const cands: string[] = [];
  try {
    const found = await sock.onWhatsApp(numero);
    const hit = found?.[0] as
      | { exists?: boolean; jid?: string; lid?: string }
      | undefined;
    log(sucursalId, `onWhatsApp(${numero}) → ${JSON.stringify(hit ?? null)}`);
    if (hit?.exists) {
      if (hit.jid) cands.push(hit.jid);
      if (hit.lid) cands.push(hit.lid);
    }
  } catch (e) {
    log(sucursalId, `onWhatsApp falló (${e instanceof Error ? e.message : e})`);
  }
  // Respaldo: variantes AR con/sin el "9".
  cands.push(`${numero}@s.whatsapp.net`);
  if (numero.startsWith("549")) cands.push(`54${numero.slice(3)}@s.whatsapp.net`);
  else if (numero.startsWith("54")) cands.push(`549${numero.slice(2)}@s.whatsapp.net`);
  return Array.from(new Set(cands));
}

const RECEIPT_STATUS: Record<number, string> = {
  0: "ERROR",
  1: "PENDING",
  2: "SERVER_ACK (llegó al server de WhatsApp)",
  3: "DELIVERY_ACK (entregado al teléfono)",
  4: "READ (leído)",
  5: "PLAYED",
};

async function handleSend(req: IncomingMessage, res: ServerResponse) {
  if (!isAuthorized(req)) return json(res, 401, { ok: false, error: "Unauthorized" });

  const body = await readJsonBody(req);
  const sucursalId = safeSucursalId(String(body.sucursalId ?? ""));
  const telefonoE164 = String(body.telefonoE164 ?? "");
  const mensaje = String(body.mensaje ?? "");

  if (!sucursalId || !telefonoE164 || !mensaje) {
    return json(res, 400, {
      ok: false,
      error: "Faltan campos: sucursalId, telefonoE164, mensaje",
    });
  }

  const session = sessions.get(sucursalId);
  if (!session || session.status !== "connected" || !session.sock) {
    const estado = session?.status ?? "inexistente";
    log(sucursalId, `✖ Envío rechazado: sesión no conectada (estado: ${estado}).`);
    return json(res, 409, {
      ok: false,
      error: `Sesión de la sucursal "${sucursalId}" no está conectada (estado: ${estado})`,
    });
  }

  try {
    // Probamos las variantes de dirección (JID onWhatsApp / LID / con-sin 9) y
    // nos quedamos con la primera que WhatsApp acepte (SERVER/DELIVERY ack). Un
    // intento por variante: si da ERROR, ese destino no es entregable en frío
    // (típico de un contacto que nunca escribió al negocio).
    const cands = await candidateJids(session.sock, telefonoE164, sucursalId);

    for (const jid of cands) {
      const sent = await session.sock.sendMessage(jid, { text: mensaje });
      const id = sent?.key?.id;
      log(sucursalId, `✉ Intento a ${telefonoE164} → ${jid} (id: ${id ?? "?"}). Esperando acuse…`);
      const ack = id ? await waitForAck(id, 5000) : undefined;

      if (ack != null && ack >= 2) {
        log(sucursalId, `✅ Aceptado a ${telefonoE164} vía ${jid} (${RECEIPT_STATUS[ack]}).`);
        return json(res, 200, { ok: true, jid, id, ack });
      }

      const motivo = ack === 0 ? "ERROR" : ack === undefined ? "sin acuse" : `status ${ack}`;
      log(sucursalId, `✖ ${jid} no aceptado (${motivo}). Probando siguiente variante…`);
    }

    const msg = `No se pudo entregar a ${telefonoE164}: WhatsApp rechazó todas las variantes (${cands.join(", ")}). Suele pasar si el número nunca escribió al negocio.`;
    log(sucursalId, `✖ ${msg}`);
    return json(res, 502, { ok: false, error: msg, tried: cands });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al enviar";
    log(sucursalId, `✖ Error al enviar a ${telefonoE164}: ${msg}`);
    return json(res, 500, { ok: false, error: msg });
  }
}

async function handleQr(res: ServerResponse, sucursalId: string) {
  let session = sessions.get(sucursalId);
  if (!session || (session.status === "closed" && !session.sock)) {
    session = await startSession(sucursalId);
  }
  // Damos un instante para que el evento de QR llegue si recién arrancó.
  if (!session.qrDataUrl && session.status !== "connected") {
    await new Promise((r) => setTimeout(r, 1500));
    session = sessions.get(sucursalId) ?? session;
  }

  if (session.status === "connected") return json(res, 204, {});
  if (!session.qrDataUrl) {
    return json(res, 202, { ok: false, status: session.status, error: "QR aún no disponible, reintentá" });
  }
  return json(res, 200, { ok: true, status: session.status, qr: session.qrDataUrl });
}

async function handleLogout(req: IncomingMessage, res: ServerResponse, sucursalId: string) {
  if (!isAuthorized(req)) return json(res, 401, { ok: false, error: "Unauthorized" });
  const session = sessions.get(sucursalId);
  try {
    await session?.sock?.logout();
  } catch {
    /* noop */
  }
  try {
    rmSync(join(AUTH_BASE, sucursalId), { recursive: true, force: true });
  } catch {
    /* noop */
  }
  sessions.delete(sucursalId);
  return json(res, 200, { ok: true });
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const sucursalParam = url.searchParams.get("sucursal");
  const sucursalId = sucursalParam ? safeSucursalId(sucursalParam) : null;

  void (async () => {
    try {
      if (req.method === "GET" && url.pathname === "/status") {
        if (sucursalParam && !sucursalId) {
          return json(res, 400, { ok: false, error: "sucursal inválida" });
        }
        if (sucursalId) {
          const s = sessions.get(sucursalId);
          return json(res, 200, s ? statusPayload(s) : { sucursalId, status: "closed", numero: null });
        }
        return json(res, 200, {
          sessions: Array.from(sessions.values()).map(statusPayload),
        });
      }

      if (req.method === "GET" && url.pathname === "/qr") {
        if (!sucursalId) return json(res, 400, { ok: false, error: "Falta ?sucursal=<id>" });
        return await handleQr(res, sucursalId);
      }

      if (req.method === "POST" && url.pathname === "/send") {
        return await handleSend(req, res);
      }

      if (req.method === "POST" && url.pathname === "/logout") {
        if (!sucursalId) return json(res, 400, { ok: false, error: "Falta ?sucursal=<id>" });
        return await handleLogout(req, res, sucursalId);
      }

      return json(res, 404, { ok: false, error: "Not found" });
    } catch (err) {
      return json(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : "Error interno",
      });
    }
  })();
});

server.listen(PORT, HOST, () => {
  console.log(`MALALA WhatsApp worker escuchando en http://${HOST}:${PORT}`);
  if (!SECRET) {
    console.warn(
      "⚠  WORKER_SECRET no está seteado: /send y /logout responderán 401. Seteá WORKER_SECRET.",
    );
  }
  restoreSessions().catch((e) => console.error("Error restaurando sesiones:", e));
});
