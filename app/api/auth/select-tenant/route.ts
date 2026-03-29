import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/config/env";
import { getSessionCookie } from "@/lib/auth/cookies";
import { selectTenantForSession } from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/control-tower/events";

const AUTH_SELECT_TENANT_ROUTE = "/api/auth/select-tenant";
const AUTH_SELECT_TENANT_METHOD = "POST";

const selectTenantSchema = z.object({
  tenantId: z.string().uuid("Tenant inválido"),
});

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

function buildUnauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Sesión no encontrada.",
      session_established: false,
      next_step: "login_required",
      next_path: "/login",
    },
    { status: 401 }
  );
}

function buildInvalidPayloadResponse(details: unknown) {
  return NextResponse.json(
    {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Tenant inválido.",
      errors: details,
      session_established: true,
      next_step: "tenant_selection_required",
      next_path: "/select-tenant",
    },
    { status: 400 }
  );
}

function buildSelectionFailureResponse(params: {
  code?: string;
  message?: string;
}) {
  const code = params.code || "TENANT_SELECTION_FAILED";
  const sessionInvalid = code === "SESSION_INVALID";

  return NextResponse.json(
    {
      ok: false,
      code,
      message:
        params.message || "No fue posible seleccionar el tenant.",
      session_established: !sessionInvalid,
      next_step: sessionInvalid
        ? "login_required"
        : "tenant_selection_required",
      next_path: sessionInvalid ? "/login" : "/select-tenant",
    },
    {
      status:
        code === "SESSION_INVALID"
          ? 401
          : code === "TENANT_ACCESS_DENIED"
          ? 403
          : 400,
    }
  );
}

function buildSuccessResponse(params: {
  result: Awaited<ReturnType<typeof selectTenantForSession>>;
  sessionId: string;
}) {
  const { result, sessionId } = params;

  return NextResponse.json(
    {
      ok: true,
      code: "TENANT_SELECTED",
      message: "Tenant activo definido correctamente.",
      session_established: true,
      next_step: "session_ready",
      next_path: "/app",
      session: {
        id: result.session?.id ?? sessionId,
        active_tenant_id: result.session?.active_tenant_id ?? null,
        membership_id: result.session?.membership_id ?? null,
        role_code: result.session?.role_code ?? null,
      },
      membership_count: result.memberships?.length ?? 0,
    },
    { status: 200 }
  );
}

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent");
  const consumer = getConsumerMetadata(req);

  try {
    const sessionId = await getSessionCookie();

    if (!sessionId) {
      await logAuthEvent({
        event_code: "auth.tenant.no_session",
        event_type: "auth_tenant_no_session",
        severity: "warning",
        message: "Selección de tenant sin sesión activa.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_SELECT_TENANT_ROUTE,
        method: AUTH_SELECT_TENANT_METHOD,
        metadata: {
          session_present: false,
          consumer,
        },
      });

      return buildUnauthorizedResponse();
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      await logAuthEvent({
        event_code: "auth.tenant.invalid_json",
        event_type: "auth_tenant_invalid_json",
        severity: "warning",
        message: "JSON inválido en selección de tenant.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_SELECT_TENANT_ROUTE,
        method: AUTH_SELECT_TENANT_METHOD,
        metadata: {
          session_id: sessionId,
          consumer,
        },
      });

      return buildInvalidPayloadResponse({
        formErrors: ["JSON inválido"],
        fieldErrors: {},
      });
    }

    const parsed = selectTenantSchema.safeParse(body);

    if (!parsed.success) {
      await logAuthEvent({
        event_code: "auth.tenant.invalid_payload",
        event_type: "auth_tenant_invalid_payload",
        severity: "warning",
        message: "Payload inválido en selección de tenant.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_SELECT_TENANT_ROUTE,
        method: AUTH_SELECT_TENANT_METHOD,
        metadata: {
          validation_issues: parsed.error.flatten(),
          session_id: sessionId,
          consumer,
        },
      });

      return buildInvalidPayloadResponse(parsed.error.flatten());
    }

    const tenantId = parsed.data.tenantId;

    const result = await selectTenantForSession({
      sessionIdentifier: sessionId,
      tenantId,
    });

    if (!result.ok) {
      await logAuthEvent({
        event_code: "auth.tenant.selection_failed",
        event_type: "auth_tenant_selection_failed",
        severity:
          result.code === "SESSION_INVALID" ? "warning" : "error",
        message:
          result.message || "No fue posible seleccionar el tenant.",
        user_id: result.user?.id ?? null,
        tenant_id: result.session?.active_tenant_id ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_SELECT_TENANT_ROUTE,
        method: AUTH_SELECT_TENANT_METHOD,
        metadata: {
          selected_tenant_id: tenantId,
          session_id: sessionId,
          auth_code: result.code,
          consumer,
        },
      });

      const response = buildSelectionFailureResponse({
        code: result.code || "TENANT_SELECTION_FAILED",
        message:
          result.message || "No fue posible seleccionar el tenant.",
      });

      if (result.code === "SESSION_INVALID") {
        return clearAuthCookies(response);
      }

      return response;
    }

    if (!result.session?.active_tenant_id) {
      throw new Error("AUTH_TENANT_ACTIVE_TENANT_NOT_APPLIED");
    }

    await logAuthEvent({
      event_code: "auth.tenant.selected",
      event_type: "auth_tenant_selected",
      severity: "info",
      message: "Tenant seleccionado con éxito.",
      user_id: result.user?.id ?? null,
      tenant_id: result.session.active_tenant_id,
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_SELECT_TENANT_ROUTE,
      method: AUTH_SELECT_TENANT_METHOD,
      metadata: {
        selected_tenant_id: tenantId,
        membership_id: result.session?.membership_id ?? null,
        role_code: result.session?.role_code ?? null,
        session_id: result.session?.id ?? sessionId,
        consumer,
      },
    });

    return buildSuccessResponse({
      result,
      sessionId,
    });
  } catch (error) {
    console.error("AUTH_SELECT_TENANT_ROUTE_ERROR", error);

    await logAuthEvent({
      event_code: "auth.tenant.error",
      event_type: "auth_tenant_error",
      severity: "error",
      message: "Error interno al seleccionar tenant.",
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_SELECT_TENANT_ROUTE,
      method: AUTH_SELECT_TENANT_METHOD,
      metadata: {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "UnknownError", message: "Unknown error" },
        consumer,
      },
    });

    return NextResponse.json(
      {
        ok: false,
        code: "TENANT_SELECTION_ERROR",
        message: "No fue posible definir el tenant activo.",
        session_established: true,
        next_step: "tenant_selection_required",
        next_path: "/select-tenant",
      },
      { status: 500 }
    );
  }
}