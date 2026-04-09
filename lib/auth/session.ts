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

type UnknownRecord = Record<string, unknown>;

const DEFAULT_SESSION_HOURS = Math.max(
  1,
  Math.ceil(env.AUTH_SESSION_MAX_AGE_SECONDS / 3600)
);

const DEFAULT_REFRESH_HOURS = Math.max(
  1,
  Math.ceil(env.AUTH_REFRESH_MAX_AGE_SECONDS / 3600)
);

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
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorCode);
  }

  return value.trim();
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

function resolveSessionId(sessionId: string | null | undefined): string {
  return requireUuid(sessionId, "AUTH_SESSION_ID_REQUIRED");
}

function resolveTenantId(tenantId: string | null | undefined): string {
  return requireUuid(tenantId, "AUTH_TENANT_ID_REQUIRED");
}

function resolveUserId(userId: string | null | undefined): string {
  return requireUuid(userId, "AUTH_USER_ID_REQUIRED");
}

function resolveDocument(document: string | null | undefined): string {
  return requireNonEmptyTrimmedString(document, "AUTH_DOCUMENT_REQUIRED");
}

function resolvePassword(password: string | null | undefined): string {
  return requireNonEmptyString(password, "AUTH_PASSWORD_REQUIRED");
}

function resolveRefreshToken(token: string | null | undefined): string {
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

function resolveSessionHours(sessionHours?: number): number {
  if (
    typeof sessionHours === "number" &&
    Number.isFinite(sessionHours) &&
    sessionHours > 0
  ) {
    return Math.ceil(sessionHours);
  }

  return DEFAULT_SESSION_HOURS;
}

function resolveRefreshHours(refreshHours?: number): number {
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
   NORMALIZAÇÃO / TYPE GUARDS
========================= */

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseUnknownJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function toRecord(value: unknown): UnknownRecord | null {
  const parsed = parseUnknownJson(value);

  if (isRecord(parsed)) {
    return parsed;
  }

  return null;
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return null;
}

function readArray(value: unknown): unknown[] | null {
  const parsed = parseUnknownJson(value);
  return Array.isArray(parsed) ? parsed : null;
}

function readRecord(value: unknown): UnknownRecord | null {
  return toRecord(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    const normalized = readString(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function pickOptionalString(...values: unknown[]): string | undefined {
  return pickString(...values) ?? undefined;
}

function pickBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    const normalized = readBoolean(value);

    if (normalized !== null) {
      return normalized;
    }
  }

  return null;
}

function pickArray(...values: unknown[]): unknown[] | null {
  for (const value of values) {
    const normalized = readArray(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function pickRecord(...values: unknown[]): UnknownRecord | null {
  for (const value of values) {
    const normalized = readRecord(value);

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeLoginResult(raw: unknown): LoginResult {
  const root = toRecord(raw);

  if (!root) {
    return LOGIN_RESULT_EMPTY;
  }

  const ok = pickBoolean(root.ok) ?? false;
  const context = pickRecord(root.context);
  const contextSession = pickRecord(context?.session);
  const contextUser = pickRecord(context?.user);

  const resolvedCode =
    pickOptionalString(root.code) ?? "LOGIN_RESULT_INVALID";

  const resolvedMessage =
    pickOptionalString(root.message, root.detail) ??
    "No fue posible autenticar la sesión.";

  const contextRecord = context as unknown as UnknownRecord;
  const sessionRecord = toRecord(contextRecord.session);

  const resolvedSessionId = pickOptionalString(
    contextRecord.session_id,
    sessionRecord?.id,
    sessionRecord?.session_id
  );

  const resolvedSessionToken = pickOptionalString(
    root.session_token,
    root.sessionToken,
    contextSession?.session_token,
    contextSession?.token,
    context?.session_token
  );

  const resolvedRefreshToken = pickOptionalString(
    root.refresh_token,
    root.refreshToken,
    contextSession?.refresh_token,
    context?.refresh_token
  );

  const resolvedExpiresAt = pickOptionalString(
    root.expires_at,
    root.expiresAt,
    contextSession?.expires_at,
    context?.expires_at
  );

  const resolvedRefreshExpiresAt = pickOptionalString(
    root.refresh_expires_at,
    root.refreshExpiresAt,
    contextSession?.refresh_expires_at,
    context?.refresh_expires_at
  );

  const resolvedActiveTenantId = pickOptionalString(
    root.active_tenant_id,
    root.activeTenantId,
    contextSession?.active_tenant_id,
    context?.active_tenant_id
  );

  const resolvedMembershipId = pickOptionalString(
    root.membership_id,
    root.membershipId,
    contextSession?.membership_id,
    context?.membership_id
  );

  const resolvedRoleCode = pickOptionalString(
    root.role_code,
    root.roleCode,
    contextSession?.role_code,
    context?.role_code
  );

  const resolvedRequiresTenantSelection =
    pickBoolean(
      root.requires_tenant_selection,
      root.requiresTenantSelection,
      context?.requires_tenant_selection
    ) ?? false;

  const resolvedUser =
    (pickRecord(root.user, contextUser) as LoginResult["user"]) ?? undefined;

  const resolvedMemberships =
    (pickArray(
      root.memberships,
      context?.memberships
    ) as LoginResult["memberships"]) ?? [];

  const resolvedContext = (context as LoginResult["context"]) ?? undefined;

  if (!ok) {
    return {
      ok: false,
      code: resolvedCode,
      message: resolvedMessage,
      session_id: resolvedSessionId,
      session_token: resolvedSessionToken,
      refresh_token: resolvedRefreshToken,
      expires_at: resolvedExpiresAt,
      refresh_expires_at: resolvedRefreshExpiresAt,
      active_tenant_id: resolvedActiveTenantId,
      membership_id: resolvedMembershipId,
      role_code: resolvedRoleCode,
      requires_tenant_selection: resolvedRequiresTenantSelection,
      user: resolvedUser,
      memberships: resolvedMemberships,
      context: resolvedContext,
    };
  }

  if (!resolvedSessionToken) {
    return {
      ok: false,
      code: "AUTH_SESSION_TOKEN_MISSING",
      message:
        "Autenticación válida, pero no se recibió session_token.",
      session_id: resolvedSessionId,
      refresh_token: resolvedRefreshToken,
      expires_at: resolvedExpiresAt,
      refresh_expires_at: resolvedRefreshExpiresAt,
      active_tenant_id: resolvedActiveTenantId,
      membership_id: resolvedMembershipId,
      role_code: resolvedRoleCode,
      requires_tenant_selection: resolvedRequiresTenantSelection,
      user: resolvedUser,
      memberships: resolvedMemberships,
      context: resolvedContext,
    };
  }

  return {
    ...(root as unknown as LoginResult),
    ok: true,
    code: pickOptionalString(root.code) ?? "AUTHENTICATED",
    message:
      pickOptionalString(root.message, root.detail) ??
      "Sesión autenticada correctamente.",
    session_id: resolvedSessionId,
    session_token: resolvedSessionToken,
    refresh_token: resolvedRefreshToken,
    expires_at: resolvedExpiresAt,
    refresh_expires_at: resolvedRefreshExpiresAt,
    active_tenant_id: resolvedActiveTenantId,
    membership_id: resolvedMembershipId,
    role_code: resolvedRoleCode,
    requires_tenant_selection: resolvedRequiresTenantSelection,
    user: resolvedUser,
    memberships: resolvedMemberships,
    context: resolvedContext,
  } as LoginResult;
}

function normalizeAuthContext(raw: unknown): AuthContext {
  const record = toRecord(raw);

  if (!record) {
    return SESSION_CONTEXT_EMPTY;
  }

  const context = pickRecord(record.context);
  const data = pickRecord(record.data);
  const payload = pickRecord(record.payload);

  const mergedRoot: UnknownRecord = {
    ...(payload ?? {}),
    ...(data ?? {}),
    ...(context ?? {}),
    ...record,
  };

  const resolvedOk =
    pickBoolean(
      mergedRoot.ok,
      record.ok,
      context?.ok,
      data?.ok,
      payload?.ok
    ) ?? false;

  if (!resolvedOk) {
    return {
      ok: false,
      code:
        pickOptionalString(
          mergedRoot.code,
          record.code,
          context?.code,
          data?.code,
          payload?.code
        ) ?? "SESSION_CONTEXT_INVALID",
      message:
        pickOptionalString(
          mergedRoot.message,
          mergedRoot.detail,
          record.message,
          record.detail,
          context?.message,
          context?.detail,
          data?.message,
          data?.detail,
          payload?.message,
          payload?.detail
        ) ?? "No fue posible obtener el contexto de la sesión.",
    };
  }

  const resolvedSession = pickRecord(
    record.session,
    context?.session,
    data?.session,
    payload?.session
  );

  const resolvedUser = pickRecord(
    record.user,
    context?.user,
    data?.user,
    payload?.user
  );

  if (!resolvedSession || !resolvedUser) {
    return SESSION_CONTEXT_FAILED;
  }

  return {
    ...(mergedRoot as unknown as AuthContext),
    ok: true,
    session: resolvedSession as AuthContext["session"],
    user: resolvedUser as AuthContext["user"],
    memberships:
      (pickArray(
        record.memberships,
        context?.memberships,
        data?.memberships,
        payload?.memberships
      ) as AuthContext["memberships"]) ??
      ((mergedRoot as unknown as AuthContext).memberships ?? []),
  } as AuthContext;
}

function normalizeRevokeSessionResult(raw: unknown): RevokeSessionResult {
  const record = toRecord(raw);

  if (!record) {
    return SESSION_REVOKE_EMPTY;
  }

  const ok = pickBoolean(record.ok) ?? false;

  if (!ok) {
    return {
      ok: false,
      code: pickOptionalString(record.code) ?? "SESSION_REVOKE_INVALID",
      message:
        pickOptionalString(record.message, record.detail) ??
        "No fue posible revocar la sesión.",
    };
  }

  return {
    ...(record as unknown as RevokeSessionResult),
    ok: true,
    code: pickOptionalString(record.code) ?? "SESSION_REVOKED",
    message:
      pickOptionalString(record.message, record.detail) ??
      "La sesión fue revocada correctamente.",
  } as RevokeSessionResult;
}

function normalizeRefreshSessionResult(raw: unknown): RefreshSessionResult {
  const record = toRecord(raw);

  if (!record) {
    return SESSION_REFRESH_EMPTY;
  }

  const ok = pickBoolean(record.ok) ?? false;

  if (!ok) {
    return {
      ok: false,
      code: pickOptionalString(record.code) ?? "SESSION_REFRESH_INVALID",
      message:
        pickOptionalString(record.message, record.detail) ??
        "No fue posible refrescar la sesión.",
    };
  }

  return {
    ...(record as unknown as RefreshSessionResult),
    ok: true,
    code: pickOptionalString(record.code) ?? "SESSION_REFRESHED",
    message:
      pickOptionalString(record.message, record.detail) ??
      "La sesión fue refrescada correctamente.",
  } as RefreshSessionResult;
}

/* =========================
   CORE EXECUTOR
========================= */

async function runSingleResultFunction<TRaw, TNormalized>(params: {
  queryFactory: () => Promise<unknown>;
  emptyFallback: TNormalized;
  errorFallback: TNormalized;
  normalize: (value: TRaw | null) => TNormalized;
  errorLabel: string;
}): Promise<TNormalized> {
  try {
    const rows = (await params.queryFactory()) as SqlFunctionResultRow<TRaw>[];

    if (!Array.isArray(rows) || rows.length === 0) {
      return params.emptyFallback;
    }

    const rawResult = rows[0]?.result ?? null;

    return params.normalize(rawResult);
  } catch (error) {
    console.error(params.errorLabel, error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown database runtime error";

    const errorCode =
      error instanceof Error && error.name
        ? `${params.errorLabel}:${error.name}`
        : `${params.errorLabel}:UnknownError`;

    if (
      params.errorFallback &&
      typeof params.errorFallback === "object" &&
      params.errorFallback !== null
    ) {
      return {
        ...(params.errorFallback as Record<string, unknown>),
        code: errorCode,
        message: errorMessage,
      } as TNormalized;
    }

    return params.errorFallback;
  }
}

async function resolveStructuralSessionIdFromIdentifier(
  sessionIdentifier: string
): Promise<string> {
  const resolvedIdentifier = resolveSessionIdentifier(sessionIdentifier);

  if (isUuidLike(resolvedIdentifier)) {
    return resolvedIdentifier;
  }

  const context = await getSessionContext(resolvedIdentifier);

  if (!context.ok) {
    throw new Error(
      pickOptionalString(context.code) ?? "AUTH_SESSION_CONTEXT_NOT_RESOLVED"
    );
  }

  const contextRecord = context as unknown as UnknownRecord;
  const sessionRecord = toRecord(contextRecord.session);

  const resolvedSessionId = pickOptionalString(
    contextRecord.session_id,
    sessionRecord?.id,
    sessionRecord?.session_id
  );

  return resolveSessionId(resolvedSessionId);
}

/* =========================
   AUTH CORE FUNCTIONS
========================= */

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

  return runSingleResultFunction<LoginResult, LoginResult>({
    queryFactory: async () => {
      return db`
        select
          core_identity.login_with_document(
            ${document}::text,
            ${password}::text,
            ${params.ipAddress ?? null}::inet,
            ${params.userAgent ?? null}::text,
            ${"auth.web"}::text,
            ${sessionHours}::integer,
            ${refreshHours}::integer
          ) as result
      `;
    },
    emptyFallback: LOGIN_RESULT_EMPTY,
    errorFallback: LOGIN_RESULT_FAILED,
    normalize: normalizeLoginResult,
    errorLabel: "AUTH_AUTHENTICATE_BY_DOCUMENT_ERROR",
  });
}

export async function getSessionContext(
  sessionIdentifier: string
): Promise<AuthContext> {
  const resolvedIdentifier = resolveSessionIdentifier(sessionIdentifier);

  return runSingleResultFunction<AuthContext, AuthContext>({
    queryFactory: async () => {
      if (isUuidLike(resolvedIdentifier)) {
        return db`
          select core_identity.get_session_context(
            ${resolvedIdentifier}::uuid
          ) as result
        `;
      }

      return db`
        select core_identity.get_session_context(
          ${resolvedIdentifier}
        ) as result
      `;
    },
    emptyFallback: SESSION_CONTEXT_EMPTY,
    errorFallback: SESSION_CONTEXT_FAILED,
    normalize: normalizeAuthContext,
    errorLabel: "AUTH_GET_SESSION_CONTEXT_ERROR",
  });
}

export async function selectTenantForSession(params: {
  sessionIdentifier: string;
  tenantId: string;
}): Promise<AuthContext> {
  const sessionId = await resolveStructuralSessionIdFromIdentifier(
    params.sessionIdentifier
  );
  const tenantId = resolveTenantId(params.tenantId);

  return runSingleResultFunction<AuthContext, AuthContext>({
    queryFactory: async () => {
      return db`
        select core_identity.select_session_tenant(
          ${sessionId}::uuid,
          ${tenantId}::uuid
        ) as result
      `;
    },
    emptyFallback: TENANT_SELECTION_EMPTY,
    errorFallback: TENANT_SELECTION_FAILED,
    normalize: normalizeAuthContext,
    errorLabel: "AUTH_SELECT_TENANT_FOR_SESSION_ERROR",
  });
}

export async function revokeSession(params: {
  sessionIdentifier: string;
  reason?: string;
}): Promise<RevokeSessionResult> {
  const sessionId = await resolveStructuralSessionIdFromIdentifier(
    params.sessionIdentifier
  );
  const reason = resolveReason(params.reason, "session_revoked");

  return runSingleResultFunction<RevokeSessionResult, RevokeSessionResult>({
    queryFactory: async () => {
      return db`
        select core_identity.revoke_session(
          ${sessionId}::uuid,
          ${reason}
        ) as result
      `;
    },
    emptyFallback: SESSION_REVOKE_EMPTY,
    errorFallback: SESSION_REVOKE_FAILED,
    normalize: normalizeRevokeSessionResult,
    errorLabel: "AUTH_REVOKE_SESSION_ERROR",
  });
}

export async function logoutSession(params: {
  sessionIdentifier: string;
  reason?: string;
}): Promise<RevokeSessionResult> {
  const sessionId = await resolveStructuralSessionIdFromIdentifier(
    params.sessionIdentifier
  );
  const reason = resolveReason(params.reason, "user_logout");

  return runSingleResultFunction<RevokeSessionResult, RevokeSessionResult>({
    queryFactory: async () => {
      return db`
        select core_identity.logout_session(
          ${sessionId}::uuid,
          ${reason}
        ) as result
      `;
    },
    emptyFallback: SESSION_REVOKE_EMPTY,
    errorFallback: SESSION_REVOKE_FAILED,
    normalize: normalizeRevokeSessionResult,
    errorLabel: "AUTH_LOGOUT_SESSION_ERROR",
  });
}

export async function refreshSessionWithToken(params: {
  sessionIdentifier: string;
  refreshToken: string;
}): Promise<RefreshSessionResult> {
  const sessionId = await resolveStructuralSessionIdFromIdentifier(
    params.sessionIdentifier
  );
  const refreshToken = resolveRefreshToken(params.refreshToken);

  return runSingleResultFunction<RefreshSessionResult, RefreshSessionResult>({
    queryFactory: async () => {
      return db`
        select core_identity.refresh_session_with_token(
          ${sessionId}::uuid,
          ${refreshToken}
        ) as result
      `;
    },
    emptyFallback: SESSION_REFRESH_EMPTY,
    errorFallback: SESSION_REFRESH_FAILED,
    normalize: normalizeRefreshSessionResult,
    errorLabel: "AUTH_REFRESH_SESSION_WITH_TOKEN_ERROR",
  });
}

/* =========================
   SESSION CONTROL EXPANDIDO
========================= */

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

export async function revokeSessionByAdmin(params: {
  sessionIdentifier: string;
  reason?: string;
}): Promise<RevokeSessionResult> {
  return revokeSession({
    sessionIdentifier: params.sessionIdentifier,
    reason: resolveReason(params.reason, "admin_forced_logout"),
  });
}

export async function logoutAllSessionsForUser(params: {
  userId: string;
  reason?: string;
}): Promise<BulkSessionMutationResult> {
  return revokeAllSessionsForUser({
    userId: params.userId,
    reason: resolveReason(params.reason, "user_logout_all"),
  });
}