import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "proceit_session";

const ROOT_ROUTE = "/";
const LOGIN_ROUTE = "/login";

const PUBLIC_ROUTES = new Set<string>([
  ROOT_ROUTE,
  LOGIN_ROUTE,
]);

const PRIVATE_PREFIXES = [
  "/app",
  "/select-tenant",
  "/access",
  "/account",
  "/security",
] as const;

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/")
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasUsableSessionCookie(req: NextRequest): boolean {
  const rawValue = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (typeof rawValue !== "string") {
    return false;
  }

  return rawValue.trim().length > 0;
}

function buildReturnToValue(req: NextRequest): string {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

  return `${pathname}${search}`;
}

function buildLoginRedirect(req: NextRequest): NextResponse {
  const loginUrl = new URL(LOGIN_ROUTE, req.url);
  const returnTo = buildReturnToValue(req);

  if (returnTo !== LOGIN_ROUTE && returnTo !== ROOT_ROUTE) {
    loginUrl.searchParams.set("return_to", returnTo);
  }

  return NextResponse.redirect(loginUrl);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /**
   * Bypass explícito:
   * - API
   * - assets
   */
  if (isApiRoute(pathname) || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = hasUsableSessionCookie(req);
  const privateRoute = isPrivateRoute(pathname);

  /**
   * Regra única do middleware:
   *
   * - NÃO decide autenticação real
   * - NÃO decide tenant
   * - NÃO redireciona baseado apenas em cookie
   *
   * Apenas impede acesso a rotas privadas SEM cookie
   */
  if (privateRoute && !hasSessionCookie) {
    return buildLoginRedirect(req);
  }

  /**
   * Todas as outras decisões:
   * - sessão válida
   * - tenant ativo
   * - contexto SQL
   *
   * são responsabilidade do runtime server-side
   */
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};