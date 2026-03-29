import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "proceit_session";

const PUBLIC_ROUTES = ["/login"];
const PRIVATE_PREFIXES = ["/app", "/select-tenant", "/access", "/account", "/security", "/control-tower"];

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isApiRoute(pathname) || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const sessionCookieValue = req.cookies.get(AUTH_COOKIE_NAME)?.value ?? null;
  const hasSessionCookie = Boolean(sessionCookieValue);

  const publicRoute = isPublicRoute(pathname);
  const privateRoute = isPrivateRoute(pathname);

  // 🔒 bloqueio leve de rotas privadas
  if (privateRoute && !hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 🔁 evitar retorno ao login quando já existe cookie de sessão
  if (publicRoute && hasSessionCookie) {
    return NextResponse.redirect(new URL("/app", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};