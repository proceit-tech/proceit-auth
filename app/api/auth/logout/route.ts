import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/config/env";
import { getSessionContext, revokeSession } from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/control-tower/events";

const AUTH_LOGOUT_ROUTE = "/api/auth/logout";
const AUTH_LOGOUT_METHOD = "POST";
const LOGOUT_REASON = "user_logout";

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

function clearAuthCookies(response: NextResponse): NextResponse {
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

function buildLogoutResponse() {
  return NextResponse.json(
    {
      ok: true,
      code: "LOGOUT_OK",
      session_cleared: true,
      next_step: "login_required",
      next_path: "/login",
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent");
  const consumer = getConsumerMetadata(req);

  try {
    const sessionId =
      req.cookies.get(env.AUTH_COOKIE_NAME)?.value ?? null;

    if (!sessionId) {
      const response = buildLogoutResponse();

      await logAuthEvent({
        event_code: "auth.logout.no_session",
        event_type: "auth_logout_no_session",
        severity: "info",
        message: "Logout solicitado sin sesión activa.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGOUT_ROUTE,
        method: AUTH_LOGOUT_METHOD,
        metadata: {
          session_present: false,
          consumer,
        },
      });

      return clearAuthCookies(response);
    }

    let ctx: Awaited<ReturnType<typeof getSessionContext>> | null = null;

    try {
      ctx = await getSessionContext(sessionId);
    } catch {
      ctx = null;
    }

    const revokeResult = await revokeSession({
      sessionIdentifier: sessionId,
      reason: LOGOUT_REASON,
    });

    if (!revokeResult?.ok) {
      await logAuthEvent({
        event_code: "auth.logout.revoke_failed",
        event_type: "auth_logout_revoke_failed",
        severity: "warning",
        message: "No fue posible revocar la sesión durante logout.",
        user_id: ctx?.user?.id ?? null,
        tenant_id: ctx?.session?.active_tenant_id ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGOUT_ROUTE,
        method: AUTH_LOGOUT_METHOD,
        metadata: {
          session_id: sessionId,
          revoke_code: revokeResult?.code ?? "UNKNOWN",
          consumer,
        },
      });
    }

    const response = buildLogoutResponse();

    clearAuthCookies(response);

    await logAuthEvent({
      event_code: "auth.logout.success",
      event_type: "auth_logout_success",
      severity: "info",
      message: "Logout realizado con éxito.",
      user_id: ctx?.user?.id ?? null,
      tenant_id: ctx?.session?.active_tenant_id ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_LOGOUT_ROUTE,
      method: AUTH_LOGOUT_METHOD,
      metadata: {
        session_present: true,
        session_id: ctx?.session?.id ?? sessionId,
        active_tenant_id: ctx?.session?.active_tenant_id ?? null,
        logout_reason: LOGOUT_REASON,
        revoke_ok: revokeResult?.ok ?? false,
        revoke_code: revokeResult?.code ?? null,
        consumer,
      },
    });

    return response;
  } catch (error) {
    console.error("AUTH_LOGOUT_ROUTE_ERROR", error);

    const response = buildLogoutResponse();

    clearAuthCookies(response);

    await logAuthEvent({
      event_code: "auth.logout.error",
      event_type: "auth_logout_error",
      severity: "error",
      message: "Error interno durante logout.",
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_LOGOUT_ROUTE,
      method: AUTH_LOGOUT_METHOD,
      metadata: {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : {
                name: "UnknownError",
                message: "Unknown logout error",
              },
        consumer,
      },
    });

    return response;
  }
}