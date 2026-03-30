import { db } from "@/lib/db/server";
import { env } from "@/lib/config/env";
import type {
  AuthContext,
  LoginResult,
  RefreshSessionResult,
  RevokeSessionResult,
} from "@/lib/auth/types";

type SqlFunctionResultRow<T> = {
  result: T | null;
};

type BulkSessionMutationResult = {
  ok: boolean;
  code: string;
  message?: string;
  affected_sessions?: number;
};

const DEFAULT_SESSION_HOURS = Math.max(
  1,
  Math.ceil(env.AUTH_SESSION_MAX_AGE_SECONDS / 3600)
);

const DEFAULT_REFRESH_HOURS = 168;

const LOGIN_RESULT_EMPTY: LoginResult = {
  ok: false,
  code: "LOGIN_RESULT_EMPTY",
  message: "No fue posible autenticar la sesión.",
};

const LOGIN_RESULT_FAILED: LoginResult = {
  ok: false,
  code: "LOGIN_RESULT_FAILED",
  message: "Ocurrió un error al autenticar la sesión.",
};

const SESSION_CONTEXT_EMPTY: AuthContext = {
  ok: false,
  code: "SESSION_CONTEXT_EMPTY",
  message: "No fue posible obtener el contexto de la sesión.",
};

const SESSION_CONTEXT_FAILED: AuthContext = {
  ok: false,
  code: "SESSION_CONTEXT_FAILED",
  message: "Ocurrió un error al obtener el contexto de la sesión.",
};

const TENANT_SELECTION_EMPTY: AuthContext = {
  ok: false,
  code: "TENANT_SELECTION_EMPTY",
  message: "No fue posible seleccionar el tenant.",
};

const TENANT_SELECTION_FAILED: AuthContext = {
  ok: false,
  code: "TENANT_SELECTION_FAILED",
  message: "Ocurrió un error al seleccionar el tenant.",
};

const SESSION_REVOKE_EMPTY: RevokeSessionResult = {
  ok: false,
  code: "SESSION_REVOKE_EMPTY",
  message: "No fue posible revocar la sesión.",
};

const SESSION_REVOKE_FAILED: RevokeSessionResult = {
  ok: false,
  code: "SESSION_REVOKE_FAILED",
  message: "Ocurrió un error al revocar la sesión.",
};

const SESSION_REFRESH_EMPTY: RefreshSessionResult = {
  ok: false,
  code: "SESSION_REFRESH_EMPTY",
  message: "No fue posible refrescar la sesión.",
};

const SESSION_REFRESH_FAILED: RefreshSessionResult = {
  ok: false,
  code: "SESSION_REFRESH_FAILED",
  message: "Ocurrió un error al refrescar la sesión.",
};

const BULK_REVOKE_EMPTY: BulkSessionMutationResult = {
  ok: false,
  code: "SESSION_BULK_REVOKE_EMPTY",
  message: "No fue posible revocar las sesiones.",
};

const BULK_REVOKE_FAILED: BulkSessionMutationResult = {
  ok: false,
  code: "SESSION_BULK_REVOKE_FAILED",
  message: "Ocurrió un error al revocar las sesiones.",
};

/* =========================
   VALIDADORES
========================= */

function isUuidLike(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function requireNonEmptyString(
  value: string | null | undefined,
  errorCode: string
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(errorCode);
  }

  return value;
}

function requireNonEmptyTrimmedString(
  value: string | null | undefined,
  errorCode: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorCode);
  }

  return value.trim();
}

function requireUuid(
  value: string | null | undefined,
  errorCode: string
): string {
  if (typeof value !== "string" || !isUuidLike(value)) {
    throw new Error(errorCode);
  }

  return value;
}

function resolveSessionId(
  sessionId: string | null | undefined
): string {
  return requireUuid(sessionId, "AUTH_SESSION_ID_REQUIRED");
}

function resolveTenantId(
  tenantId: string | null | undefined
): string {
  return requireUuid(tenantId, "AUTH_TENANT_ID_REQUIRED");
}

function resolveUserId(
  userId: string | null | undefined
): string {
  return requireUuid(userId, "AUTH_USER_ID_REQUIRED");
}

function resolveDocument(
  document: string | null | undefined
): string {
  return requireNonEmptyTrimmedString(document, "AUTH_DOCUMENT_REQUIRED");
}

function resolvePassword(
  password: string | null | undefined
): string {
  return requireNonEmptyString(password, "AUTH_PASSWORD_REQUIRED");
}

function resolveRefreshToken(
  token: string | null | undefined
): string {
  const resolved = requireNonEmptyString(
    token,
    "AUTH_REFRESH_TOKEN_REQUIRED"
  );

  if (resolved.length > 2000) {
    throw new Error("AUTH_REFRESH_TOKEN_INVALID");
  }

  return resolved;
}

function resolveReason(
  reason: string | null | undefined,
  fallback: string
): string {
  if (typeof reason !== "string" || reason.trim().length === 0) {
    return fallback;
  }

  return reason.trim();
}

function resolveSessionHours(
  sessionHours?: number
): number {
  if (
    typeof sessionHours === "number" &&
    Number.isFinite(sessionHours) &&
    sessionHours > 0
  ) {
    return Math.ceil(sessionHours);
  }

  return DEFAULT_SESSION_HOURS;
}

function resolveRefreshHours(
  refreshHours?: number
): number {
  if (
    typeof refreshHours === "number" &&
    Number.isFinite(refreshHours) &&
    refreshHours > 0
  ) {
    return Math.ceil(refreshHours);
  }

  return DEFAULT_REFRESH_HOURS;
}

function resolveSessionIdentifier(
  sessionIdentifier: string | null | undefined
): string {
  return requireNonEmptyTrimmedString(
    sessionIdentifier,
    "AUTH_SESSION_IDENTIFIER_REQUIRED"
  );
}

/* =========================
   CORE EXECUTOR
========================= */

async function runSingleResultFunction<T>(params: {
  queryFactory: () => Promise<unknown>;
  emptyFallback: T;
  errorFallback: T;
}): Promise<T> {
  try {
    const rows = (await params.queryFactory()) as SqlFunctionResultRow<T>[];
    return rows[0]?.result ?? params.emptyFallback;
  } catch {
    return params.errorFallback;
  }
}

/* =========================
   AUTH CORE FUNCTIONS
========================= */

/**
 * LOGIN POR DOCUMENTO
 *
 * Fluxo oficial atual:
 * - core_identity.login_with_document(...)
 * - cria sessão real
 * - gera session_token / refresh_token
 * - retorna contexto unificado
 */
export async function authenticateByDocument(params: {
  document: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionHours?: number;
  refreshHours?: number;
}): Promise<LoginResult> {
  const document = resolveDocument(params.document);
  const password = resolvePassword(params.password);
  const sessionHours = resolveSessionHours(params.sessionHours);
  const refreshHours = resolveRefreshHours(params.refreshHours);

  return runSingleResultFunction<LoginResult>({
    queryFactory: async () => {
      return db<SqlFunctionResultRow<LoginResult>[]>`
        select core_identity.login_with_document(
          ${document},
          ${password},
          ${params.ipAddress ?? null}::inet,
          ${params.userAgent ?? null},
          ${"auth.web"},
          ${sessionHours},
          ${refreshHours}
        ) as result
      `;
    },
    emptyFallback: LOGIN_RESULT_EMPTY,
    errorFallback: LOGIN_RESULT_FAILED,
  });
}

/**
 * CONTEXTO OFICIAL DE SESSÃO
 *
 * Aceita:
 * - session_id (uuid)
 * - session_token (texto)
 *
 * Isso é importante porque o cookie atual tende a carregar
 * session_token, não session_id interno.
 */
export async function getSessionContext(
  sessionIdentifier: string
): Promise<AuthContext> {
  const resolvedIdentifier = resolveSessionIdentifier(sessionIdentifier);

  return runSingleResultFunction<AuthContext>({
    queryFactory: async () => {
      if (isUuidLike(resolvedIdentifier)) {
        return db<SqlFunctionResultRow<AuthContext>[]>`
          select core_identity.get_session_context(
            ${resolvedIdentifier}::uuid
          ) as result
        `;
      }

      return db<SqlFunctionResultRow<AuthContext>[]>`
        select core_identity.get_session_context(
          ${resolvedIdentifier}
        ) as result
      `;
    },
    emptyFallback: SESSION_CONTEXT_EMPTY,
    errorFallback: SESSION_CONTEXT_FAILED,
  });
}

/**
 * SELEÇÃO DE TENANT NA SESSÃO OFICIAL
 *
 * Mantido por session_id (uuid), porque a função SQL atual
 * de seleção de tenant opera sobre a sessão persistida.
 */
export async function selectTenantForSession(params: {
  sessionIdentifier: string;
  tenantId: string;
}): Promise<AuthContext> {
  const sessionId = resolveSessionId(params.sessionIdentifier);
  const tenantId = resolveTenantId(params.tenantId);

  return runSingleResultFunction<AuthContext>({
    queryFactory: async () => {
      return db<SqlFunctionResultRow<AuthContext>[]>`
        select core_identity.select_session_tenant(
          ${sessionId}::uuid,
          ${tenantId}::uuid
        ) as result
      `;
    },
    emptyFallback: TENANT_SELECTION_EMPTY,
    errorFallback: TENANT_SELECTION_FAILED,
  });
}

/**
 * REVOGAÇÃO DIRETA DE SESSÃO
 *
 * Uso recomendado:
 * - ação administrativa
 * - invalidação técnica
 * - resposta a incidente
 */
export async function revokeSession(params: {
  sessionIdentifier: string;
  reason?: string;
}): Promise<RevokeSessionResult> {
  const sessionId = resolveSessionId(params.sessionIdentifier);
  const reason = resolveReason(params.reason, "session_revoked");

  return runSingleResultFunction<RevokeSessionResult>({
    queryFactory: async () => {
      return db<SqlFunctionResultRow<RevokeSessionResult>[]>`
        select core_identity.revoke_session(
          ${sessionId}::uuid,
          ${reason}
        ) as result
      `;
    },
    emptyFallback: SESSION_REVOKE_EMPTY,
    errorFallback: SESSION_REVOKE_FAILED,
  });
}

/**
 * LOGOUT
 *
 * Wrapper semântico para encerramento da sessão atual
 * iniciado pelo próprio usuário.
 */
export async function logoutSession(params: {
  sessionIdentifier: string;
  reason?: string;
}): Promise<RevokeSessionResult> {
  const sessionId = resolveSessionId(params.sessionIdentifier);
  const reason = resolveReason(params.reason, "user_logout");

  return runSingleResultFunction<RevokeSessionResult>({
    queryFactory: async () => {
      return db<SqlFunctionResultRow<RevokeSessionResult>[]>`
        select core_identity.logout_session(
          ${sessionId}::uuid,
          ${reason}
        ) as result
      `;
    },
    emptyFallback: SESSION_REVOKE_EMPTY,
    errorFallback: SESSION_REVOKE_FAILED,
  });
}

/**
 * REFRESH REAL DE SESSÃO COM ROTAÇÃO DE REFRESH TOKEN
 */
export async function refreshSessionWithToken(params: {
  sessionIdentifier: string;
  refreshToken: string;
}): Promise<RefreshSessionResult> {
  const sessionId = resolveSessionId(params.sessionIdentifier);
  const refreshToken = resolveRefreshToken(params.refreshToken);

  return runSingleResultFunction<RefreshSessionResult>({
    queryFactory: async () => {
      return db<SqlFunctionResultRow<RefreshSessionResult>[]>`
        select core_identity.refresh_session_with_token(
          ${sessionId}::uuid,
          ${refreshToken}
        ) as result
      `;
    },
    emptyFallback: SESSION_REFRESH_EMPTY,
    errorFallback: SESSION_REFRESH_FAILED,
  });
}

/* =========================
   SESSION CONTROL EXPANDIDO
========================= */

/**
 * Revoga TODAS as sessões ativas de um usuário.
 *
 * Observação:
 * - mantém o padrão atual da arquitetura;
 * - usa update direto na tabela oficial;
 * - não apaga histórico;
 * - preserva compatibilidade com o runtime atual.
 *
 * Débito arquitetural:
 * - idealmente migrar para função SQL oficial dedicada,
 *   para unificar auditoria, regras e efeitos colaterais.
 */
export async function revokeAllSessionsForUser(params: {
  userId: string;
  reason?: string;
}): Promise<BulkSessionMutationResult> {
  const userId = resolveUserId(params.userId);
  const reason = resolveReason(params.reason, "user_logout_all");

  try {
    const rows = await db<{ affected_sessions: number }[]>`
      with updated as (
        update core_identity.sessions
        set
          revoked_at = now(),
          revoke_reason = ${reason},
          session_status = 'revoked',
          updated_at = now()
        where user_id = ${userId}::uuid
          and revoked_at is null
          and coalesce(session_status, 'active') = 'active'
        returning id
      )
      select count(*)::int as affected_sessions
      from updated
    `;

    return {
      ok: true,
      code: "SESSIONS_REVOKED",
      message: "Las sesiones del usuario fueron revocadas correctamente.",
      affected_sessions: rows[0]?.affected_sessions ?? 0,
    };
  } catch (error) {
    console.error("AUTH_REVOKE_ALL_SESSIONS_FOR_USER_ERROR", error);

    return BULK_REVOKE_FAILED;
  }
}

/**
 * Revoga todas as sessões ativas pertencentes a um tenant.
 *
 * Útil para:
 * - isolamento operacional
 * - resposta a incidente
 * - corte administrativo por tenant
 *
 * Débito arquitetural:
 * - idealmente migrar para função SQL oficial dedicada.
 */
export async function revokeSessionsByTenant(params: {
  tenantId: string;
  reason?: string;
}): Promise<BulkSessionMutationResult> {
  const tenantId = resolveTenantId(params.tenantId);
  const reason = resolveReason(params.reason, "tenant_forced_logout");

  try {
    const rows = await db<{ affected_sessions: number }[]>`
      with updated as (
        update core_identity.sessions
        set
          revoked_at = now(),
          revoke_reason = ${reason},
          session_status = 'revoked',
          updated_at = now()
        where active_tenant_id = ${tenantId}::uuid
          and revoked_at is null
          and coalesce(session_status, 'active') = 'active'
        returning id
      )
      select count(*)::int as affected_sessions
      from updated
    `;

    return {
      ok: true,
      code: "TENANT_SESSIONS_REVOKED",
      message: "Las sesiones del tenant fueron revocadas correctamente.",
      affected_sessions: rows[0]?.affected_sessions ?? 0,
    };
  } catch (error) {
    console.error("AUTH_REVOKE_SESSIONS_BY_TENANT_ERROR", error);

    return BULK_REVOKE_FAILED;
  }
}

/**
 * Wrapper semântico para revogação administrativa de sessão individual.
 */
export async function revokeSessionByAdmin(params: {
  sessionIdentifier: string;
  reason?: string;
}): Promise<RevokeSessionResult> {
  return revokeSession({
    sessionIdentifier: params.sessionIdentifier,
    reason: resolveReason(params.reason, "admin_forced_logout"),
  });
}

/**
 * Wrapper semântico para "logout all" iniciado pelo próprio usuário.
 */
export async function logoutAllSessionsForUser(params: {
  userId: string;
  reason?: string;
}): Promise<BulkSessionMutationResult> {
  return revokeAllSessionsForUser({
    userId: params.userId,
    reason: resolveReason(params.reason, "user_logout_all"),
  });
}