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

export function isWebPushConfigured() {
  return Boolean(vapidPublicKey && vapidPrivateKey);
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
