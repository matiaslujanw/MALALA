"use client";

import { useEffect, useRef, useState } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PendingAction {
  tool: string;
  args: Record<string, unknown>;
  resumen: string;
}

const SUGERENCIAS_GESTION = [
  "¿Cuánto se facturó hoy?",
  "Dame los 5 servicios más vendidos del mes",
  "¿Hay stock crítico?",
  "¿Cómo viene la ocupación de turnos esta semana?",
];

const SUGERENCIAS_EMPLEADO = [
  "¿Qué turnos hay hoy?",
  "Mostrame la agenda de mañana",
  "¿Qué servicios hay en el catálogo?",
];

type Rol = "superadmin" | "admin" | "encargada" | "empleado";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*([^\n*]+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[\s(])\*([^\n*]+?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
  html = html.replace(/`([^`\n]+?)`/g, '<code class="rounded bg-stone-100 px-1 text-xs">$1</code>');
  html = html.replace(/\n/g, "<br/>");
  return html;
}

// Web Speech API (no tipada en TS estándar)
type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AdminChat({
  rol,
  sucursalNombre,
}: {
  rol: Rol;
  sucursalNombre: string;
}) {
  const sugerencias = rol === "empleado" ? SUGERENCIAS_EMPLEADO : SUGERENCIAS_GESTION;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toolLabel, setToolLabel] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading, toolLabel, pending, open]);

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "es-AR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      setInput(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setToolLabel(null);
    setPending(null);

    try {
      const res = await fetch("/api/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let pendingAction: PendingAction | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const block of events) {
          const lines = block.split("\n");
          const evLine = lines.find((l) => l.startsWith("event: "));
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (!evLine || !dataLine) continue;
          const event = evLine.slice(7).trim();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let data: any;
          try {
            data = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }

          if (event === "tool_call") {
            setToolLabel(`Consultando ${data.name}...`);
          } else if (event === "text") {
            assistantText = data.content;
          } else if (event === "confirm_required") {
            pendingAction = {
              tool: data.tool,
              args: data.args,
              resumen: data.resumen,
            };
          } else if (event === "error") {
            assistantText = `Error: ${data.message}`;
          }
        }
      }

      if (assistantText) {
        setMessages([...next, { role: "assistant", content: assistantText }]);
      } else if (!pendingAction) {
        setMessages([...next, { role: "assistant", content: "(sin respuesta)" }]);
      } else {
        setMessages(next);
      }
      if (pendingAction) setPending(pendingAction);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
      setToolLabel(null);
    }
  }

  async function confirmAction() {
    if (!pending || loading) return;
    const action = pending;
    setPending(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin-chat/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: action.tool, args: action.args }),
      });
      const json = await res.json().catch(() => null);
      let content: string;
      if (!res.ok) {
        content = `No se pudo ejecutar: ${json?.error ?? `HTTP ${res.status}`}`;
      } else {
        const result = json?.result;
        if (result?.ok) {
          content = result.message ?? "✓ Acción realizada.";
        } else {
          const errs = result?.errors
            ? Object.values(result.errors as Record<string, string[]>)
                .flat()
                .join(" ")
            : result?.message;
          content = `No se pudo ejecutar: ${errs ?? "error desconocido"}`;
        }
      }
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function cancelAction() {
    setPending(null);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Acción cancelada." },
    ]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-brown-700"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="20" y1="4" x2="8.12" y2="15.88" />
            <line x1="14.47" y1="14.48" x2="20" y2="20" />
            <line x1="8.12" y1="8.12" x2="12" y2="12" />
          </svg>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[min(640px,80vh)] w-[min(420px,calc(100vw-3rem))] flex-col rounded-[1.5rem] border border-border bg-card shadow-2xl">
          <div className="flex items-start justify-between border-b border-border p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                Asistente IA
              </p>
              <h2 className="font-display text-lg tracking-[0.18em] uppercase">
                Asistente
              </h2>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setMessages([]);
                  setPending(null);
                }}
                className="text-xs uppercase tracking-wider text-muted-foreground hover:text-ink"
              >
                Limpiar
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {sucursalNombre} · Preguntale sobre turnos, ventas, stock o caja.
                </p>
                {sugerencias.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-stone-200 bg-cream/60 px-3 py-2 text-left text-sm text-ink transition hover:border-sage-700 hover:bg-cream disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div
                  key={i}
                  className="ml-auto max-w-[85%] rounded-2xl bg-sage-700 px-3 py-2 text-sm text-primary-foreground"
                >
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className="mr-auto max-w-[90%] rounded-2xl border border-stone-100 bg-cream/60 px-3 py-2 text-sm leading-relaxed text-ink [&_strong]:font-semibold [&_strong]:text-ink"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              ),
            )}

            {pending && (
              <div className="mr-auto w-full max-w-[95%] rounded-2xl border border-warning/40 bg-warning/10 px-3 py-3 text-sm text-ink">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-warning">
                  Confirmar acción
                </p>
                <p className="mb-3 leading-relaxed">{pending.resumen}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={confirmAction}
                    disabled={loading}
                    className="rounded-xl bg-primary px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-primary-foreground transition hover:bg-brown-700 disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={cancelAction}
                    disabled={loading}
                    className="rounded-xl border border-stone-300 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground transition hover:text-ink disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="mr-auto max-w-[90%] rounded-2xl border border-dashed border-stone-200 bg-cream/40 px-3 py-2 text-xs text-muted-foreground">
                {toolLabel ?? "Pensando..."}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="border-t border-border p-3"
          >
            <div className="flex gap-2">
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={loading}
                  aria-label={listening ? "Detener dictado" : "Dictar por voz"}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-50 ${
                    listening
                      ? "border-destructive/50 bg-destructive/10 text-destructive"
                      : "border-border bg-card text-muted-foreground hover:border-sage-700 hover:text-ink"
                  }`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                placeholder={listening ? "Escuchando..." : "Hacé tu pregunta..."}
                className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-sage-700 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition hover:bg-brown-700 disabled:opacity-50"
              >
                Enviar
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
