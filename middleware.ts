import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "proceit_session";

const LOGIN_ROUTE = "/login";
const DEFAULT_AUTHENTICATED_ROUTE = "/app";

const PUBLIC_ROUTES = new Set<string>([LOGIN_ROUTE]);

const PRIVATE_PREFIXES = [
  "/app",
  "/select-tenant",
  "/access",
  "/account",
  "/security",
  "/control-tower",
] as const;

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
   * Evita poluir a URL com retorno redundante para a própria rota de login.
   */
  if (returnTo !== LOGIN_ROUTE) {
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
   * Se o usuário já possui cookie de sessão e tentar voltar
   * para a rota pública de login, redirecionamos ao hub.
   *
   * O refinamento posterior entre /app e /select-tenant
   * continua sendo responsabilidade do runtime protegido.
   */
  if (publicRoute && hasSessionCookie) {
    return buildAuthenticatedRedirect(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};