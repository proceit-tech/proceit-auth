import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { authenticateByDocument } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { logAuthEvent } from "@/lib/control-tower/events";

const AUTH_LOGIN_ROUTE = "/api/auth/login";
const AUTH_LOGIN_METHOD = "POST";

const AUTH_SESSION_HOURS = Math.max(
  1,
  Math.ceil(env.AUTH_SESSION_MAX_AGE_SECONDS / 3600)
);

const loginSchema = z.object({
  document: z
    .string()
    .trim()
    .min(3, "Documento inválido")
    .max(50, "Documento inválido"),
  password: z
    .string()
    .min(3, "Contraseña inválida")
    .max(200, "Contraseña inválida"),
});

type LoginSuccessNextStep =
  | "tenant_selection_required"
  | "access_hub_ready";

type ConsumerMetadata = {
  origin: string | null;
  referer: string | null;
  host: string | null;
};

type AuthenticateByDocumentResult = Awaited<
  ReturnType<typeof authenticateByDocument>
>;

function requireValidSessionToken(sessionToken: string): string {
  if (typeof sessionToken !== "string" || sessionToken.trim().length === 0) {
    throw new Error("AUTH_SESSION_TOKEN_INVALID");
  }

  const normalized = sessionToken.trim();

  if (normalized.length > 2048) {
    throw new Error("AUTH_SESSION_TOKEN_TOO_LARGE");
  }

  return normalized;
}

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

function normalizeDocument(raw: string): string {
  return raw.replace(/[.\-/\s]/g, "").trim();
}

function getConsumerMetadata(req: NextRequest): ConsumerMetadata {
  return {
    origin: req.headers.get("origin"),
    referer: req.headers.get("referer"),
    host: req.headers.get("host"),
  };
}

function buildLoginSuccessFlow(params: {
  requiresTenantSelection: boolean;
  activeTenantId: string | null;
}): {
  next_step: LoginSuccessNextStep;
  next_path: string;
  session_established: true;
} {
  if (params.requiresTenantSelection || !params.activeTenantId) {
    return {
      next_step: "tenant_selection_required",
      next_path: "/select-tenant",
      session_established: true,
    };
  }

  return {
    next_step: "access_hub_ready",
    next_path: "/app",
    session_established: true,
  };
}

function buildInvalidPayloadResponse(params: {
  traceId: string;
  details: unknown;
}) {
  return NextResponse.json(
    {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Datos de acceso inválidos.",
      trace_id: params.traceId,
      details: params.details,
    },
    { status: 400 }
  );
}

function buildInvalidDocumentResponse(traceId: string) {
  return NextResponse.json(
    {
      ok: false,
      code: "INVALID_DOCUMENT",
      message: "Documento inválido.",
      trace_id: traceId,
      details: null,
    },
    { status: 400 }
  );
}

function buildUnauthorizedResponse(params: {
  traceId: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown> | null;
}) {
  return NextResponse.json(
    {
      ok: false,
      code: params.code || "INVALID_CREDENTIALS",
      message: params.message || "Documento o contraseña inválidos.",
      trace_id: params.traceId,
      details: params.details ?? null,
    },
    { status: 401 }
  );
}

function buildSessionContractErrorResponse(params: {
  traceId: string;
  code?: string;
  message?: string;
  details?: Record<string, unknown> | null;
}) {
  return NextResponse.json(
    {
      ok: false,
      code: params.code || "LOGIN_SESSION_CONTRACT_ERROR",
      message:
        params.message ||
        "La autenticación fue validada, pero no se pudo establecer la sesión.",
      trace_id: params.traceId,
      details: params.details ?? null,
    },
    { status: 500 }
  );
}

function buildInternalErrorResponse(params: {
  traceId: string;
  details?: Record<string, unknown> | null;
}) {
  return NextResponse.json(
    {
      ok: false,
      code: "LOGIN_ERROR",
      message: "No fue posible iniciar sesión.",
      trace_id: params.traceId,
      details: params.details ?? null,
    },
    { status: 500 }
  );
}

function buildSuccessResponse(params: {
  authResult: AuthenticateByDocumentResult;
  flow: ReturnType<typeof buildLoginSuccessFlow>;
  traceId: string;
}) {
  const { authResult, flow, traceId } = params;

  return NextResponse.json(
    {
      ok: true,
      code: authResult.code || "LOGIN_SUCCESS",
      message:
        flow.next_step === "tenant_selection_required"
          ? "Sesión iniciada. Seleccione el tenant operativo."
          : "Sesión iniciada correctamente.",
      trace_id: traceId,
      session_established: true,
      next_step: flow.next_step,
      next_path: flow.next_path,
      requires_tenant_selection:
        authResult.requires_tenant_selection ?? false,
      active_tenant_id: authResult.active_tenant_id ?? null,
      expires_at: authResult.expires_at ?? null,
      refresh_expires_at: authResult.refresh_expires_at ?? null,
      session: {
        id: authResult.session_id ?? null,
        token_present: Boolean(authResult.session_token),
        active_tenant_id: authResult.active_tenant_id ?? null,
        membership_id: authResult.membership_id ?? null,
        role_code: authResult.role_code ?? null,
      },
      user: {
        id: authResult.user?.id ?? null,
        email: authResult.user?.email ?? null,
        full_name: authResult.user?.full_name ?? null,
        display_name: authResult.user?.display_name ?? null,
        document_number: authResult.user?.document_number ?? null,
      },
      memberships: authResult.memberships ?? [],
      details: null,
    },
    { status: 200 }
  );
}

async function applySuccessfulLoginCookie(
  response: NextResponse,
  sessionToken: string
): Promise<NextResponse> {
  const validatedSessionToken = requireValidSessionToken(sessionToken);

  await setSessionCookie(validatedSessionToken);

  /**
   * A rota devolve o response normal ao cliente.
   * O cookie é persistido via cookies() no runtime server-side.
   */
  return response;
}

async function applyFailedLoginCleanup(
  response: NextResponse
): Promise<NextResponse> {
  await clearSessionCookie();
  return response;
}

function isAuthenticatedWithoutSessionToken(
  authResult: AuthenticateByDocumentResult
): boolean {
  return Boolean(authResult.ok) && !authResult.session_token;
}

export async function POST(req: NextRequest) {
  const traceId = crypto.randomUUID();
  const ipAddress = getClientIp(req);
  const userAgent = req.headers.get("user-agent");
  const consumer = getConsumerMetadata(req);

  try {
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      await logAuthEvent({
        event_code: "auth.login.invalid_json",
        event_type: "auth_login_invalid_json",
        severity: "warning",
        message: "Payload JSON inválido en login.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGIN_ROUTE,
        method: AUTH_LOGIN_METHOD,
        trace_id: traceId,
        metadata: {
          consumer,
        },
      });

      return buildInvalidPayloadResponse({
        traceId,
        details: {
          formErrors: ["JSON inválido"],
          fieldErrors: {},
        },
      });
    }

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      await logAuthEvent({
        event_code: "auth.login.invalid_payload",
        event_type: "auth_login_invalid_payload",
        severity: "warning",
        message: "Payload inválido en login.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGIN_ROUTE,
        method: AUTH_LOGIN_METHOD,
        trace_id: traceId,
        metadata: {
          validation_issues: parsed.error.flatten(),
          consumer,
        },
      });

      return buildInvalidPayloadResponse({
        traceId,
        details: parsed.error.flatten(),
      });
    }

    const originalDocument = parsed.data.document;
    const documentNormalized = normalizeDocument(originalDocument);
    const password = parsed.data.password;

    if (!documentNormalized || documentNormalized.length < 3) {
      await logAuthEvent({
        event_code: "auth.login.invalid_document",
        event_type: "auth_login_invalid_document",
        severity: "warning",
        message: "Documento inválido tras normalización.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGIN_ROUTE,
        method: AUTH_LOGIN_METHOD,
        trace_id: traceId,
        metadata: {
          original_document: originalDocument,
          normalized_document: documentNormalized,
          consumer,
        },
      });

      return buildInvalidDocumentResponse(traceId);
    }

    const authResult = await authenticateByDocument({
      document: documentNormalized,
      password,
      ipAddress,
      userAgent,
      sessionHours: AUTH_SESSION_HOURS,
    });

    if (!authResult.ok) {
      await logAuthEvent({
        event_code: "auth.login.failed",
        event_type: "auth_login_failed",
        severity: "warning",
        message: authResult.message || "Login fallido.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGIN_ROUTE,
        method: AUTH_LOGIN_METHOD,
        trace_id: traceId,
        metadata: {
          original_document: originalDocument,
          normalized_document: documentNormalized,
          auth_code: authResult.code || "INVALID_CREDENTIALS",
          session_id: authResult.session_id ?? null,
          session_token_present: Boolean(authResult.session_token),
          requires_tenant_selection:
            authResult.requires_tenant_selection ?? false,
          consumer,
        },
      });

      const response = buildUnauthorizedResponse({
        traceId,
        code: authResult.code || "INVALID_CREDENTIALS",
        message:
          authResult.message || "Documento o contraseña inválidos.",
        details: {
          requires_tenant_selection:
            authResult.requires_tenant_selection ?? false,
          session_id: authResult.session_id ?? null,
        },
      });

      return applyFailedLoginCleanup(response);
    }

    if (isAuthenticatedWithoutSessionToken(authResult)) {
      await logAuthEvent({
        event_code: "auth.login.session_contract_error",
        event_type: "auth_login_session_contract_error",
        severity: "error",
        message:
          "Login autenticado sin session_token utilizable en la capa Node.",
        user_id: authResult.user?.id ?? null,
        tenant_id: authResult.active_tenant_id ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGIN_ROUTE,
        method: AUTH_LOGIN_METHOD,
        trace_id: traceId,
        metadata: {
          original_document: originalDocument,
          normalized_document: documentNormalized,
          auth_code: authResult.code || "AUTHENTICATED_WITHOUT_SESSION_TOKEN",
          session_id: authResult.session_id ?? null,
          session_token_present: false,
          active_tenant_id: authResult.active_tenant_id ?? null,
          membership_id: authResult.membership_id ?? null,
          role_code: authResult.role_code ?? null,
          requires_tenant_selection:
            authResult.requires_tenant_selection ?? false,
          expires_at: authResult.expires_at ?? null,
          refresh_expires_at: authResult.refresh_expires_at ?? null,
          consumer,
          auth_result_snapshot: authResult,
        },
      });

      const response = buildSessionContractErrorResponse({
        traceId,
        code: "LOGIN_SESSION_TOKEN_MISSING",
        message:
          "La autenticación fue validada, pero no se recibió un session_token válido.",
        details: {
          session_id: authResult.session_id ?? null,
          active_tenant_id: authResult.active_tenant_id ?? null,
          membership_id: authResult.membership_id ?? null,
          role_code: authResult.role_code ?? null,
          requires_tenant_selection:
            authResult.requires_tenant_selection ?? false,
        },
      });

      return applyFailedLoginCleanup(response);
    }

    const flow = buildLoginSuccessFlow({
      requiresTenantSelection:
        authResult.requires_tenant_selection ?? false,
      activeTenantId: authResult.active_tenant_id ?? null,
    });

    const response = buildSuccessResponse({
      authResult,
      flow,
      traceId,
    });

    await applySuccessfulLoginCookie(response, authResult.session_token!);

    await logAuthEvent({
      event_code: "auth.login.success",
      event_type: "auth_login_success",
      severity: "info",
      message: "Login realizado con éxito.",
      user_id: authResult.user?.id ?? null,
      tenant_id: authResult.active_tenant_id ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_LOGIN_ROUTE,
      method: AUTH_LOGIN_METHOD,
      trace_id: traceId,
      metadata: {
        original_document: originalDocument,
        normalized_document: documentNormalized,
        session_id: authResult.session_id ?? null,
        session_token_present: true,
        active_tenant_id: authResult.active_tenant_id ?? null,
        membership_id: authResult.membership_id ?? null,
        role_code: authResult.role_code ?? null,
        membership_count: authResult.memberships?.length ?? 0,
        requires_tenant_selection:
          authResult.requires_tenant_selection ?? false,
        next_step: flow.next_step,
        next_path: flow.next_path,
        session_expires_at: authResult.expires_at ?? null,
        refresh_expires_at: authResult.refresh_expires_at ?? null,
        consumer,
      },
    });

    return response;
  } catch (error) {
    console.error("AUTH_LOGIN_ROUTE_ERROR", error);

    await logAuthEvent({
      event_code: "auth.login.error",
      event_type: "auth_login_error",
      severity: "error",
      message: "Error interno durante login.",
      ip_address: ipAddress,
      user_agent: userAgent,
      route: AUTH_LOGIN_ROUTE,
      method: AUTH_LOGIN_METHOD,
      trace_id: traceId,
      metadata: {
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : {
                name: "UnknownError",
                message: "Unknown login route error",
              },
        consumer,
      },
    });

    const response = buildInternalErrorResponse({
      traceId,
      details:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : {
              name: "UnknownError",
              message: "Unknown login route error",
            },
    });

    return applyFailedLoginCleanup(response);
  }
}