import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/config/env";
import { getSessionCookie } from "@/lib/auth/cookies";
import { getSessionContext } from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/control-tower/events";

const AUTH_ME_ROUTE = "/api/auth/me";
const AUTH_ME_METHOD = "GET";

type MembershipLike = {
  membership_id?: string | null;
  tenant_id?: string | null;
  role_code?: string | null;
  status?: string | null;
  is_default?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  last_selected_at?: string | null;
  metadata?: unknown;
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

function normalizeMemberships(input: unknown): MembershipLike[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((item): item is MembershipLike => {
    return typeof item === "object" && item !== null;
  });
}

function isMembershipCurrentlyValid(membership: MembershipLike): boolean {
  if (
    typeof membership?.tenant_id !== "string" ||
    !membership.tenant_id.trim()
  ) {
    return false;
  }

  const normalizedStatus =
    typeof membership.status === "string" && membership.status.trim()
      ? membership.status.trim().toLowerCase()
      : "active";

  if (normalizedStatus !== "active") {
    return false;
  }

  const now = Date.now();

  if (membership.starts_at) {
    const startsAt = new Date(membership.starts_at).getTime();

    if (!Number.isNaN(startsAt) && startsAt > now) {
      return false;
    }
  }

  if (membership.ends_at) {
    const endsAt = new Date(membership.ends_at).getTime();

    if (!Number.isNaN(endsAt) && endsAt <= now) {
      return false;
    }
  }

  return true;
}

function buildUnauthorizedPayload(params: {
  code:
    | "SESSION_NOT_FOUND"
    | "INVALID_SESSION"
    | "SESSION_CONTEXT_ERROR"
    | "SESSION_CONTEXT_INCOMPLETE";
  message: string;
}) {
  return {
    ok: false,
    code: params.code,
    message: params.message,
    session: null,
    user: null,
    memberships: [],
    active_tenant_id: null,
    requires_tenant_selection: false,
    session_established: false,
    next_step: "login_required",
    next_path: "/login",
  };
}

function buildUnauthorizedResponse(params: {
  code:
    | "SESSION_NOT_FOUND"
    | "INVALID_SESSION"
    | "SESSION_CONTEXT_ERROR"
    | "SESSION_CONTEXT_INCOMPLETE";
  message: string;
  status: number;
}) {
  return NextResponse.json(
    buildUnauthorizedPayload({
      code: params.code,
      message: params.message,
    }),
    { status: params.status }
  );
}

export async function GET(req: NextRequest) {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent");
  const consumer = getConsumerMetadata(req);

  try {
    /**
     * Contrato oficial atualizado:
     * cookie -> session_token opaco
     *
     * Observação:
     * - o cookie já não transporta obrigatoriamente o session_id UUID;
     * - a resolução da sessão oficial acontece via getSessionContext(...),
     *   que suporta o identificador transportado pelo runtime atual.
     */
    const sessionToken = await getSessionCookie();

    if (!sessionToken) {
      await logAuthEvent({
        event_code: "auth.me.session_not_found",
        event_type: "auth_me_session_not_found",
        severity: "info",
        message: "No existe una sesión activa en /me.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_ME_ROUTE,
        method: AUTH_ME_METHOD,
        metadata: {
          session_present: false,
          consumer,
        },
      });

      return buildUnauthorizedResponse({
        code: "SESSION_NOT_FOUND",
        message: "No existe una sesión activa.",
        status: 401,
      });
    }

    const ctx = await getSessionContext(sessionToken);

    if (!ctx?.ok || !ctx.session || !ctx.user) {
      await logAuthEvent({
        event_code: "auth.me.invalid_session",
        event_type: "auth_me_invalid_session",
        severity: "warning",
        message: "Sesión inválida o expirada en /me.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_ME_ROUTE,
        method: AUTH_ME_METHOD,
        metadata: {
          session_present: true,
          session_identifier: sessionToken,
          response_code: ctx?.code ?? "INVALID_SESSION",
          consumer,
        },
      });

      const response = buildUnauthorizedResponse({
        code: "INVALID_SESSION",
        message: "La sesión actual no es válida.",
        status: 401,
      });

      return clearAuthCookies(response);
    }

    const memberships = normalizeMemberships(ctx.memberships);
    const validMemberships = memberships.filter(isMembershipCurrentlyValid);

    const activeTenantId =
      typeof ctx.session.active_tenant_id === "string"
        ? ctx.session.active_tenant_id
        : null;

    const hasActiveTenant = Boolean(activeTenantId);

    const requiresTenantSelection =
      !hasActiveTenant && validMemberships.length > 0;

    const sessionStatus =
      typeof ctx.session.session_status === "string"
        ? ctx.session.session_status
        : null;

    const membershipId =
      typeof ctx.session.membership_id === "string"
        ? ctx.session.membership_id
        : null;

    const roleCode =
      typeof ctx.session.role_code === "string"
        ? ctx.session.role_code
        : null;

    const permissionsVersion =
      typeof ctx.session.permissions_version === "number"
        ? ctx.session.permissions_version
        : null;

    const nextStep = requiresTenantSelection
      ? "tenant_selection_required"
      : "session_ready";

    const nextPath = requiresTenantSelection ? "/select-tenant" : "/app";

    if (!hasActiveTenant && validMemberships.length === 0) {
      await logAuthEvent({
        event_code: "auth.me.no_valid_memberships",
        event_type: "auth_me_no_valid_memberships",
        severity: "warning",
        message:
          "La sesión fue cargada, pero el usuario no tiene memberships vigentes.",
        user_id: ctx.user.id ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_ME_ROUTE,
        method: AUTH_ME_METHOD,
        metadata: {
          session_identifier: sessionToken,
          session_id: ctx.session.id ?? null,
          user_id: ctx.user.id ?? null,
          memberships_count: memberships.length,
          valid_memberships_count: validMemberships.length,
          consumer,
        },
      });

      const response = buildUnauthorizedResponse({
        code: "SESSION_CONTEXT_INCOMPLETE",
        message:
          "La sesión fue encontrada, pero no hay memberships válidas para continuar.",
        status: 403,
      });

      return clearAuthCookies(response);
    }

    return NextResponse.json(
      {
        ok: true,
        code: "SESSION_CONTEXT_OK",
        message: "Contexto de sesión cargado correctamente.",
        session_established: true,
        next_step: nextStep,
        next_path: nextPath,
        requires_tenant_selection: requiresTenantSelection,
        active_tenant_id: activeTenantId,

        user: {
          id: ctx.user.id,
          email: ctx.user.email ?? null,
          full_name: ctx.user.full_name ?? null,
          display_name: ctx.user.display_name ?? null,
          document_number: ctx.user.document_number ?? null,
        },

        session: {
          id: ctx.session.id,
          active_tenant_id: activeTenantId,
          membership_id: membershipId,
          role_code: roleCode,
          session_status: sessionStatus,
          permissions_version: permissionsVersion,
          expires_at: ctx.session.expires_at ?? null,
          last_seen_at: ctx.session.last_seen_at ?? null,
        },

        memberships: validMemberships,

        shell: {
          tenant_ready: hasActiveTenant,
          membership_ready: Boolean(membershipId),
          role_ready: Boolean(roleCode),
          permissions_version: permissionsVersion,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("AUTH_ME_ROUTE_ERROR", error);

    await logAuthEvent({
      event_code: "auth.me.error",
      event_type: "auth_me_error",
      severity: "error",
      message: "Error interno al cargar el contexto de sesión.",
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_ME_ROUTE,
      method: AUTH_ME_METHOD,
      metadata: {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : {
                name: "UnknownError",
                message: "Unknown /me route error",
              },
        consumer,
      },
    });

    const response = buildUnauthorizedResponse({
      code: "SESSION_CONTEXT_ERROR",
      message: "No fue posible cargar el contexto de la sesión.",
      status: 500,
    });

    return clearAuthCookies(response);
  }
}