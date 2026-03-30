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

function buildInvalidPayloadResponse(details: unknown) {
  return NextResponse.json(
    {
      ok: false,
      code: "INVALID_PAYLOAD",
      message: "Datos de acceso inválidos.",
      errors: details,
    },
    { status: 400 }
  );
}

function buildInvalidDocumentResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "INVALID_DOCUMENT",
      message: "Documento inválido.",
    },
    { status: 400 }
  );
}

function buildUnauthorizedResponse(params: {
  code?: string;
  message?: string;
}) {
  return NextResponse.json(
    {
      ok: false,
      code: params.code || "INVALID_CREDENTIALS",
      message: params.message || "Documento o contraseña inválidos.",
    },
    { status: 401 }
  );
}

function buildInternalErrorResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "LOGIN_ERROR",
      message: "No fue posible iniciar sesión.",
    },
    { status: 500 }
  );
}

function buildSuccessResponse(params: {
  authResult: AuthenticateByDocumentResult;
  flow: ReturnType<typeof buildLoginSuccessFlow>;
}) {
  const { authResult, flow } = params;

  return NextResponse.json(
    {
      ok: true,
      code: authResult.code || "LOGIN_SUCCESS",
      message:
        flow.next_step === "tenant_selection_required"
          ? "Sesión iniciada. Seleccione el tenant operativo."
          : "Sesión iniciada correctamente.",
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
    },
    { status: 200 }
  );
}

async function applySuccessfulLoginCookie(
  response: NextResponse,
  sessionToken: string
): Promise<NextResponse> {
  await setSessionCookie(sessionToken);

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

export async function POST(req: NextRequest) {
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
        metadata: {
          consumer,
        },
      });

      return buildInvalidPayloadResponse({
        formErrors: ["JSON inválido"],
        fieldErrors: {},
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
        metadata: {
          validation_issues: parsed.error.flatten(),
          consumer,
        },
      });

      return buildInvalidPayloadResponse(parsed.error.flatten());
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
        metadata: {
          original_document: originalDocument,
          normalized_document: documentNormalized,
          consumer,
        },
      });

      return buildInvalidDocumentResponse();
    }

    const authResult = await authenticateByDocument({
      document: documentNormalized,
      password,
      ipAddress,
      userAgent,
      sessionHours: AUTH_SESSION_HOURS,
    });

    if (!authResult.ok || !authResult.session_token) {
      await logAuthEvent({
        event_code: "auth.login.failed",
        event_type: "auth_login_failed",
        severity: "warning",
        message: authResult.message || "Login fallido.",
        ip_address: ipAddress,
        user_agent: userAgent,
        route: AUTH_LOGIN_ROUTE,
        method: AUTH_LOGIN_METHOD,
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
        code: authResult.code || "INVALID_CREDENTIALS",
        message:
          authResult.message || "Documento o contraseña inválidos.",
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
    });

    await applySuccessfulLoginCookie(response, authResult.session_token);

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

    const response = buildInternalErrorResponse();

    return applyFailedLoginCleanup(response);
  }
}