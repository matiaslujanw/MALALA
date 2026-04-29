import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/dev/login", "/dev/styleguide"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir home y rutas publicas dev
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const userCookie = req.cookies.get("malala_user")?.value;
  if (!userCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/dev/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Excluir _next, assets de public (cualquier path con extension) y API routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api|.*\\.[^/]+$).*)"],
};
