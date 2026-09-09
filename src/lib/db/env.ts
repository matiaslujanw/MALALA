const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DATABASE_URL;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;

export function isSupabaseConfigured() {
  return Boolean(publicUrl && publicAnonKey && serviceRoleKey && databaseUrl);
}

/** Largo en bytes de un valor base64url, sin decodificarlo. */
function bytesDeBase64Url(valor: string): number {
  const limpio = valor.replace(/=+$/, "");
  return Math.floor((limpio.length * 3) / 4);
}

/**
 * Las claves VAPID tienen que ser un par P-256 de verdad, no cualquier string.
 *
 * Chequear sólo que la variable no estuviera vacía nos costó caro: en .env.local
 * había texto de relleno (27 bytes en la pública en vez de 65), la app mostraba
 * el botón de suscribirse como si estuviera todo configurado, y recién fallaba
 * cuando alguien lo apretaba. Un formato inválido acá es indistinguible de "no
 * configurado", así que se trata igual.
 *
 * La pública es un punto sin comprimir: 65 bytes que arrancan con 0x04 (que en
 * base64url es siempre una "B"). La privada es el escalar: 32 bytes.
 */
export function isWebPushConfigured() {
  if (!vapidPublicKey || !vapidPrivateKey) return false;
  if (bytesDeBase64Url(vapidPublicKey) !== 65) return false;
  if (!vapidPublicKey.startsWith("B")) return false;
  if (bytesDeBase64Url(vapidPrivateKey) !== 32) return false;
  return true;
}

export function requireSupabaseRuntime(context?: string) {
  if (!isSupabaseConfigured()) {
    const base = "Supabase no esta configurado en este entorno.";
    throw new Error(context ? `${base} ${context}` : base);
  }
}

export function getSupabaseUrl() {
  if (!publicUrl) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  }
  return publicUrl;
}

export function getSupabaseAnonKey() {
  if (!publicAnonKey) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return publicAnonKey;
}

export function getSupabaseServiceRoleKey() {
  if (!serviceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY");
  }
  return serviceRoleKey;
}

export function getSupabaseDatabaseUrl() {
  if (!databaseUrl) {
    throw new Error("Falta SUPABASE_DATABASE_URL");
  }
  return databaseUrl;
}

export function requireWebPushRuntime(context?: string) {
  if (!isWebPushConfigured()) {
    const base = "Web push no esta configurado en este entorno.";
    throw new Error(context ? `${base} ${context}` : base);
  }
}

export function getVapidPublicKey() {
  if (!vapidPublicKey) {
    throw new Error("Falta NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  }
  return vapidPublicKey;
}

export function getVapidPrivateKey() {
  if (!vapidPrivateKey) {
    throw new Error("Falta VAPID_PRIVATE_KEY");
  }
  return vapidPrivateKey;
}

export function getVapidSubject() {
  return vapidSubject ?? "mailto:notificaciones@malala.local";
}
