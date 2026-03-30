import "server-only";

import {
  withDbTransaction,
  type DbTransactionClient,
} from "@/lib/db/server";

import { getSessionCookie } from "@/lib/auth/cookies";
import { getSessionContext } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/auth/types";

const AUTH_ERROR_UNAUTHORIZED = "UNAUTHORIZED";

type ApplySessionContextRow = {
  result: AuthContext | null;
};

type CallableDbTransactionClient =
  DbTransactionClient & ((...args: any[]) => any);

function isUuidLike(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : null;
}

function isAuthorizedContext(
  ctx: AuthContext | null | undefined
): ctx is AuthContext {
  return Boolean(ctx?.ok && ctx.session && ctx.user);
}

function assertAuthorizedContext(
  ctx: AuthContext | null | undefined
): AuthContext {
  if (!isAuthorizedContext(ctx)) {
    throw new Error(AUTH_ERROR_UNAUTHORIZED);
  }

  return ctx;
}

/**
 * No runtime atual, o cookie oficial carrega session_token opaco,
 * não necessariamente o UUID interno da sessão.
 *
 * Portanto:
 * - não validar UUID na borda do cookie;
 * - validar o contexto resolvido retornado pela função oficial;
 * - só exigir UUID quando for necessário operar diretamente
 *   sobre session_id já resolvido no contexto.
 */
function assertSessionIdentifier(
  sessionIdentifier: string | null | undefined
): string {
  const normalized = normalizeString(sessionIdentifier);

  if (!normalized) {
    throw new Error(AUTH_ERROR_UNAUTHORIZED);
  }

  return normalized;
}

function assertSessionIdFromContext(
  sessionId: string | null | undefined
): string {
  const normalized = normalizeString(sessionId);

  if (!normalized || !isUuidLike(normalized)) {
    throw new Error(AUTH_ERROR_UNAUTHORIZED);
  }

  return normalized;
}

async function requireSessionIdentifier(): Promise<string> {
  const sessionIdentifier = await getSessionCookie();
  return assertSessionIdentifier(sessionIdentifier);
}

async function resolveSessionContext(
  sessionIdentifier: string
): Promise<AuthContext | null> {
  try {
    const validatedSessionIdentifier =
      assertSessionIdentifier(sessionIdentifier);

    const ctx = await getSessionContext(validatedSessionIdentifier);

    if (!isAuthorizedContext(ctx)) {
      return null;
    }

    if (!ctx.session?.id || !isUuidLike(ctx.session.id)) {
      return null;
    }

    return ctx;
  } catch {
    return null;
  }
}

/**
 * Retorna o contexto auth se a sessão atual for válida.
 * Não tenta mutar cookie aqui; a responsabilidade de limpar cookie
 * pertence às rotas HTTP que devolvem response ao cliente.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const sessionIdentifier = await getSessionCookie();

  if (!normalizeString(sessionIdentifier)) {
    return null;
  }

  return resolveSessionContext(sessionIdentifier);
}

/**
 * Exige contexto auth válido.
 * Se não houver sessão válida, lança UNAUTHORIZED.
 */
export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  return assertAuthorizedContext(ctx);
}

/**
 * Abre transação SQL aplicando o contexto auth oficial no banco.
 *
 * Uso:
 * - resolve a sessão corrente a partir do cookie oficial
 * - obtém o session_id real via getSessionContext(...)
 * - chama core_identity.apply_session_context(session_id)
 * - só então executa a callback transacional
 */
export async function withSqlAuthContext<T>(
  callback: (
    tx: CallableDbTransactionClient,
    ctx: AuthContext
  ) => Promise<T>
): Promise<T> {
  const sessionIdentifier = await requireSessionIdentifier();
  const resolvedContext = await resolveSessionContext(sessionIdentifier);
  const ctx = assertAuthorizedContext(resolvedContext);
  const sessionId = assertSessionIdFromContext(ctx.session?.id);

  const result = await withDbTransaction(async (tx) => {
    const callableTx = tx as CallableDbTransactionClient;

    const rows = (await callableTx`
      select core_identity.apply_session_context(${sessionId}::uuid) as result
    `) as ApplySessionContextRow[];

    const appliedContext = assertAuthorizedContext(rows[0]?.result ?? null);

    return callback(callableTx, appliedContext);
  });

  return result as T;
}