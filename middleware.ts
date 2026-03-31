import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "proceit_session";

const ROOT_ROUTE = "/";
const LOGIN_ROUTE = "/login";
const DEFAULT_AUTHENTICATED_ROUTE = "/app";

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

  /**
   * Evita poluir a URL com retorno redundante para rotas públicas.
   */
  if (returnTo !== LOGIN_ROUTE && returnTo !== ROOT_ROUTE) {
    loginUrl.searchParams.set("return_to", returnTo);
  }

  return NextResponse.redirect(loginUrl);
}

function buildAuthenticatedRedirect(req: NextRequest): NextResponse {
  const redirectUrl = new URL(DEFAULT_AUTHENTICATED_ROUTE, req.url);

  return NextResponse.redirect(redirectUrl);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /**
   * Bypass explícito:
   * - rotas de API
   * - assets estáticos
   *
   * O runtime de autenticação profundo acontece no servidor
   * e nas rotas protegidas; aqui o middleware atua apenas
   * como barreira leve de navegação.
   */
  if (isApiRoute(pathname) || isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = hasUsableSessionCookie(req);
  const publicRoute = isPublicRoute(pathname);
  const privateRoute = isPrivateRoute(pathname);

  /**
   * Rotas privadas exigem presença do cookie de sessão.
   *
   * Observação:
   * - neste estágio o middleware valida apenas presença,
   *   não integridade criptográfica nem contexto;
   * - validação completa ocorre nas rotas/server runtime
   *   via session_token + get_session_context.
   */
  if (privateRoute && !hasSessionCookie) {
    return buildLoginRedirect(req);
  }

  /**
   * Se o usuário já possui cookie de sessão e tentar acessar
   * uma rota pública de entrada, redirecionamos ao hub protegido.
   *
   * O refinamento posterior entre /app e /select-tenant
   * continua sendo responsabilidade do runtime protegido.
   */
  if (publicRoute && hasSessionCookie) {
    return buildAuthenticatedRedirect(req);
  }

  /**
   * Rotas neutras/desconhecidas:
   * - mantém passagem normal;
   * - a proteção real continua no runtime/server;
   * - isso evita que o middleware invente regras excessivas
   *   para caminhos ainda não catalogados.
   */
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};