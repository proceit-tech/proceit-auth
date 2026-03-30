import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/config/env";
import {
  getRefreshCookie,
  getSessionCookie,
} from "@/lib/auth/cookies";
import {
  getSessionContext,
  refreshSessionWithToken,
} from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/control-tower/events";

const AUTH_REFRESH_ROUTE = "/api/auth/refresh";
const AUTH_REFRESH_METHOD = "POST";

type RefreshRouteResult = Awaited<
  ReturnType<typeof refreshSessionWithToken>
> & {
  refresh_token?: string | null;
  session_token?: string | null;
};

function getClientIp(req: NextRequest): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  const realIp = req.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  return null;
}

function getConsumerMetadata(req: NextRequest) {
  return {
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    host: req.headers.get("host"),
  };
}

function resolveCookieDomain(domain?: string | null): string | undefined {
  const normalized = domain?.trim();

  if (!normalized) {
    return undefined;
  }

  return normalized;
}

function resolveSameSite(
  configuredValue?: string | null
): "lax" | "strict" | "none" {
  const normalized = configuredValue?.trim().toLowerCase();

  if (
    normalized === "lax" ||
    normalized === "strict" ||
    normalized === "none"
  ) {
    return normalized;
  }

  return "lax";
}

function clearAuthCookiesOnResponse(response: NextResponse): NextResponse {
  response.cookies.set({
    name: env.AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: resolveSameSite(env.AUTH_COOKIE_SAME_SITE),
    path: "/",
    domain: resolveCookieDomain(env.AUTH_COOKIE_DOMAIN),
    expires: new Date(0),
    maxAge: 0,
  });

  response.cookies.set({
    name: env.AUTH_REFRESH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: env.AUTH_REFRESH_COOKIE_SECURE,
    sameSite: resolveSameSite(env.AUTH_REFRESH_COOKIE_SAME_SITE),
    path: "/",
    domain: resolveCookieDomain(env.AUTH_REFRESH_COOKIE_DOMAIN),
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}

function applyAuthCookiesToResponse(params: {
  response: NextResponse;
  sessionToken: string;
  refreshToken?: string | null;
}): NextResponse {
  const { response, sessionToken, refreshToken } = params;

  response.cookies.set({
    name: env.AUTH_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: resolveSameSite(env.AUTH_COOKIE_SAME_SITE),
    path: "/",
    domain: resolveCookieDomain(env.AUTH_COOKIE_DOMAIN),
    maxAge: env.AUTH_SESSION_MAX_AGE_SECONDS,
  });

  if (typeof refreshToken === "string" && refreshToken.trim().length > 0) {
    response.cookies.set({
      name: env.AUTH_REFRESH_COOKIE_NAME,
      value: refreshToken,
      httpOnly: true,
      secure: env.AUTH_REFRESH_COOKIE_SECURE,
      sameSite: resolveSameSite(env.AUTH_REFRESH_COOKIE_SAME_SITE),
      path: "/",
      domain: resolveCookieDomain(env.AUTH_REFRESH_COOKIE_DOMAIN),
      maxAge: env.AUTH_REFRESH_MAX_AGE_SECONDS,
    });
  } else {
    response.cookies.set({
      name: env.AUTH_REFRESH_COOKIE_NAME,
      value: "",
      httpOnly: true,
      secure: env.AUTH_REFRESH_COOKIE_SECURE,
      sameSite: resolveSameSite(env.AUTH_REFRESH_COOKIE_SAME_SITE),
      path: "/",
      domain: resolveCookieDomain(env.AUTH_REFRESH_COOKIE_DOMAIN),
      expires: new Date(0),
      maxAge: 0,
    });
  }

  return response;
}

function buildUnauthorizedPayload(message: string, code: string) {
  return {
    ok: false,
    code,
    message,
    session_established: false,
    next_step: "login_required",
    next_path: "/login",
  };
}

function buildSuccessResponse(result: RefreshRouteResult) {
  const requiresTenantSelection = result.requires_tenant_selection ?? false;

  return NextResponse.json(
    {
      ok: true,
      code: result.code,
      message: result.message,
      session_established: true,
      next_step: requiresTenantSelection
        ? "tenant_selection_required"
        : "session_ready",
      next_path: requiresTenantSelection ? "/select-tenant" : "/app",
      active_tenant_id: result.active_tenant_id ?? null,
      requires_tenant_selection: requiresTenantSelection,
      user: result.user ?? null,
      session: result.session ?? null,
      memberships: result.memberships ?? [],
      shell: {
        tenant_ready: !!result.active_tenant_id,
        membership_ready: !!result.session?.membership_id,
        role_ready: !!result.session?.role_code,
        permissions_version: result.session?.permissions_version ?? null,
      },
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent");
  const consumer = getConsumerMetadata(req);

  try {
    /**
     * Contrato oficial atualizado:
     * - cookie de sessão transporta session_token opaco
     * - cookie de refresh transporta refresh_token opaco
     */
    const sessionToken = await getSessionCookie();
    const refreshToken = await getRefreshCookie();

    if (!sessionToken || !refreshToken) {
      await logAuthEvent({
        event_code: "auth.refresh.missing_tokens",
        event_type: "auth_refresh_missing_tokens",
        severity: "warning",
        message: "Refresh sin cookies válidas.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_REFRESH_ROUTE,
        method: AUTH_REFRESH_METHOD,
        metadata: {
          has_session: !!sessionToken,
          has_refresh: !!refreshToken,
          consumer,
        },
      });

      const response = NextResponse.json(
        buildUnauthorizedPayload("Sesión no válida.", "SESSION_NOT_FOUND"),
        { status: 401 }
      );

      return clearAuthCookiesOnResponse(response);
    }

    /**
     * O refresh SQL ainda opera por session_id real.
     * Então primeiro resolvemos o contexto a partir do session_token.
     */
    const currentContext = await getSessionContext(sessionToken);

    if (!currentContext?.ok || !currentContext.session?.id) {
      await logAuthEvent({
        event_code: "auth.refresh.invalid_session_token",
        event_type: "auth_refresh_invalid_session_token",
        severity: "warning",
        message: "Session token inválido o no resolvible durante refresh.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_REFRESH_ROUTE,
        method: AUTH_REFRESH_METHOD,
        metadata: {
          session_identifier: sessionToken,
          has_refresh: !!refreshToken,
          response_code: currentContext?.code ?? "INVALID_SESSION",
          consumer,
        },
      });

      const response = NextResponse.json(
        buildUnauthorizedPayload(
          "La sesión actual no es válida.",
          "INVALID_SESSION"
        ),
        { status: 401 }
      );

      return clearAuthCookiesOnResponse(response);
    }

    const result = (await refreshSessionWithToken({
      sessionIdentifier: currentContext.session.id,
      refreshToken,
    })) as RefreshRouteResult;

    if (!result.ok) {
      await logAuthEvent({
        event_code: "auth.refresh.failed",
        event_type: "auth_refresh_failed",
        severity: "warning",
        message: result.message || "Refresh fallido.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_REFRESH_ROUTE,
        method: AUTH_REFRESH_METHOD,
        metadata: {
          session_identifier: sessionToken,
          session_id: currentContext.session.id,
          code: result.code,
          consumer,
        },
      });

      const response = NextResponse.json(
        buildUnauthorizedPayload(
          result.message || "Sesión inválida.",
          result.code || "SESSION_INVALID"
        ),
        { status: 401 }
      );

      return clearAuthCookiesOnResponse(response);
    }

    /**
     * Contrato desejado:
     * - manter session_token no cookie de sessão
     * - se a função SQL devolver novo refresh_token, rotacionar
     *
     * Como a sessão atual já foi resolvida pelo token opaco, e o runtime
     * do banco segue centrado no session_id internamente, preservamos o
     * token atual enquanto não houver rotação explícita do session_token.
     */
    const resolvedSessionToken = result.session_token ?? sessionToken;
    const newRefreshToken = result.refresh_token ?? null;

    const response = buildSuccessResponse(result);

    applyAuthCookiesToResponse({
      response,
      sessionToken: resolvedSessionToken,
      refreshToken: newRefreshToken,
    });

    await logAuthEvent({
      event_code: "auth.refresh.success",
      event_type: "auth_refresh_success",
      severity: "info",
      message: "Refresh realizado correctamente.",
      user_id: result.user?.id ?? null,
      tenant_id: result.active_tenant_id ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_REFRESH_ROUTE,
      method: AUTH_REFRESH_METHOD,
      metadata: {
        session_identifier: resolvedSessionToken,
        session_id: result.session?.id ?? currentContext.session.id,
        refresh_rotated: !!newRefreshToken,
        requires_tenant_selection:
          result.requires_tenant_selection ?? false,
        active_tenant_id: result.active_tenant_id ?? null,
        consumer,
      },
    });

    return response;
  } catch (error) {
    console.error("AUTH_REFRESH_ROUTE_ERROR", error);

    await logAuthEvent({
      event_code: "auth.refresh.error",
      event_type: "auth_refresh_error",
      severity: "error",
      message: "Error interno en refresh.",
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_REFRESH_ROUTE,
      method: AUTH_REFRESH_METHOD,
      metadata: {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "UnknownError", message: "Unknown error" },
        consumer,
      },
    });

    const response = NextResponse.json(
      buildUnauthorizedPayload(
        "Error en refresh.",
        "SESSION_REFRESH_ERROR"
      ),
      { status: 500 }
    );

    return clearAuthCookiesOnResponse(response);
  }
}