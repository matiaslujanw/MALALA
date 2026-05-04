import './envConfig';
import { createServerClient } from '@supabase/ssr';

const cookies = new Map<string,string>();
const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  cookies: {
    getAll() {
      return Array.from(cookies.entries()).map(([name, value]) => ({ name, value }));
    },
    setAll(items) {
      for (const item of items) cookies.set(item.name, item.value);
    },
  },
});

const { error } = await client.auth.signInWithPassword({
  email: 'admin@malala.com',
  password: process.env.MALALA_SEED_PASSWORD!,
});
if (error) {
  console.error('LOGIN_ERROR', error);
  process.exit(1);
}
console.log('COOKIES', Array.from(cookies.keys()).join(','));
const cookieHeader = Array.from(cookies.entries()).map(([k,v]) => `${k}=${v}`).join('; ');
const res = await fetch('http://localhost:3000/dashboard', {
  headers: { cookie: cookieHeader },
  redirect: 'manual',
});
console.log('STATUS', res.status);
const text = await res.text();
console.log(text.slice(0, 500));
