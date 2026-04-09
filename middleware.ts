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

/* =========================
   DEBUG HELPERS
========================= */

const MIDDLEWARE_SCOPE = "AUTH_MIDDLEWARE";

type DebugPayload = Record<string, unknown>;

function buildDebugBase(req?: NextRequest) {
  return {
    ts: new Date().toISOString(),
    scope: MIDDLEWARE_SCOPE,
    method: req?.method ?? null,
    pathname: req?.nextUrl.pathname ?? null,
    search: req?.nextUrl.search ?? null,
    full_path: req
      ? `${req.nextUrl.pathname}${req.nextUrl.search}`
      : null,
    host: req?.headers.get("host") ?? null,
    origin: req?.nextUrl.origin ?? null,
    cookie_name: AUTH_COOKIE_NAME,
  };
}

function middlewareLog(
  step: string,
  payload?: DebugPayload,
  req?: NextRequest
) {
  console.log(
    JSON.stringify({
      ...buildDebugBase(req),
      level: "info",
      step,
      ...(payload ?? {}),
    })
  );
}

function middlewareWarn(
  step: string,
  payload?: DebugPayload,
  req?: NextRequest
) {
  console.warn(
    JSON.stringify({
      ...buildDebugBase(req),
      level: "warn",
      step,
      ...(payload ?? {}),
    })
  );
}

function middlewareError(
  step: string,
  error: unknown,
  payload?: DebugPayload,
  req?: NextRequest
) {
  console.error(
    JSON.stringify({
      ...buildDebugBase(req),
      level: "error",
      step,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : {
              value: String(error),
            },
      ...(payload ?? {}),
    })
  );
}

function maskCookieValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

/* =========================
   ROUTE CLASSIFICATION
========================= */

function isStaticAsset(pathname: string): boolean {
  const result =
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/icons/");

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: MIDDLEWARE_SCOPE,
      level: "info",
      step: "isStaticAsset.evaluated",
      pathname,
      result,
    })
  );

  return result;
}

function isApiRoute(pathname: string): boolean {
  const result = pathname.startsWith("/api/");

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: MIDDLEWARE_SCOPE,
      level: "info",
      step: "isApiRoute.evaluated",
      pathname,
      result,
    })
  );

  return result;
}

function isPublicRoute(pathname: string): boolean {
  const result = PUBLIC_ROUTES.has(pathname);

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: MIDDLEWARE_SCOPE,
      level: "info",
      step: "isPublicRoute.evaluated",
      pathname,
      result,
      public_routes: Array.from(PUBLIC_ROUTES),
    })
  );

  return result;
}

function isPrivateRoute(pathname: string): boolean {
  const matchedPrefix =
    PRIVATE_PREFIXES.find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ?? null;

  const result = Boolean(matchedPrefix);

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: MIDDLEWARE_SCOPE,
      level: "info",
      step: "isPrivateRoute.evaluated",
      pathname,
      result,
      matched_prefix: matchedPrefix,
      private_prefixes: [...PRIVATE_PREFIXES],
    })
  );

  return result;
}

function hasUsableSessionCookie(req: NextRequest): boolean {
  const rawValue = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  const result =
    typeof rawValue === "string" && rawValue.trim().length > 0;

  middlewareLog(
    "hasUsableSessionCookie.evaluated",
    {
      cookie_present: typeof rawValue === "string",
      cookie_length: rawValue?.length ?? 0,
      cookie_masked: maskCookieValue(rawValue ?? null),
      result,
    },
    req
  );

  return result;
}

function buildReturnToValue(req: NextRequest): string {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;
  const returnTo = `${pathname}${search}`;

  middlewareLog(
    "buildReturnToValue.computed",
    {
      return_to: returnTo,
    },
    req
  );

  return returnTo;
}

function buildLoginRedirect(req: NextRequest): NextResponse {
  const loginUrl = new URL(LOGIN_ROUTE, req.url);
  const returnTo = buildReturnToValue(req);

  if (returnTo !== LOGIN_ROUTE && returnTo !== ROOT_ROUTE) {
    loginUrl.searchParams.set("return_to", returnTo);
  }

  middlewareWarn(
    "buildLoginRedirect.redirecting",
    {
      redirect_to: loginUrl.toString(),
      return_to: returnTo,
    },
    req
  );

  return NextResponse.redirect(loginUrl);
}

export function middleware(req: NextRequest) {
  middlewareLog("middleware.start", undefined, req);

  try {
    const { pathname } = req.nextUrl;

    const apiRoute = isApiRoute(pathname);
    const staticAsset = isStaticAsset(pathname);
    const publicRoute = isPublicRoute(pathname);
    const privateRoute = isPrivateRoute(pathname);

    middlewareLog(
      "middleware.route_classification",
      {
        apiRoute,
        staticAsset,
        publicRoute,
        privateRoute,
      },
      req
    );

    /**
     * Bypass explícito:
     * - API
     * - assets
     */
    if (apiRoute || staticAsset) {
      middlewareLog(
        "middleware.bypass_next",
        {
          reason: apiRoute ? "api_route" : "static_asset",
        },
        req
      );

      return NextResponse.next();
    }

    const hasSessionCookie = hasUsableSessionCookie(req);

    middlewareLog(
      "middleware.cookie_evaluation",
      {
        hasSessionCookie,
      },
      req
    );

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
      middlewareWarn(
        "middleware.redirect_login_missing_cookie",
        {
          decision: "redirect_login",
          reason: "private_route_without_cookie",
        },
        req
      );

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
    middlewareLog(
      "middleware.allow_next",
      {
        decision: "next",
        reason: privateRoute
          ? "private_route_with_cookie"
          : publicRoute
          ? "public_route"
          : "non_private_route",
      },
      req
    );

    return NextResponse.next();
  } catch (error) {
    middlewareError(
      "middleware.fatal_error",
      error,
      {
        decision: "fail_open_next",
      },
      req
    );

    /**
     * Em caso de erro inesperado no middleware, manter fail-open
     * para não mascarar o problema com bloqueio total.
     */
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};