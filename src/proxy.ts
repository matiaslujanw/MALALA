import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/dev/login", "/dev/styleguide"];

function hasSupabaseSessionCookie(req: NextRequest) {
  return req.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-") && name.includes("auth-token"));
}

function hasSupabasePublicConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!hasSupabasePublicConfig()) {
    const url = req.nextUrl.clone();
    url.pathname = "/dev/login";
    url.searchParams.set(
      "error",
      "Supabase no esta configurado. El back office solo funciona con auth real.",
    );
    return NextResponse.redirect(url);
  }

  const isAuthenticated = hasSupabaseSessionCookie(req);

  if (!isAuthenticated) {
    const url = req.nextUrl.clone();
    url.pathname = "/dev/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.[^/]+$).*)"],
};
