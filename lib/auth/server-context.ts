import "server-only";

import {
  withDbTransaction,
  type DbTransactionClient,
} from "@/lib/db/server";

import { getSessionCookie } from "@/lib/auth/cookies";
import { getSessionContext } from "@/lib/auth/session";
import type {
  AuthContext,
  AuthContextSuccess,
} from "@/lib/auth/types";

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

/**
 * Contexto autorizado real:
 * - ok=true
 * - session presente
 * - user presente
 * - session.id resolvido como UUID estrutural interno
 */
function isAuthorizedContext(
  ctx: AuthContext | null | undefined
): ctx is AuthContextSuccess {
  return Boolean(
    ctx?.ok &&
      ctx.session &&
      ctx.user &&
      typeof ctx.session.id === "string" &&
      isUuidLike(ctx.session.id)
  );
}

function assertAuthorizedContext(
  ctx: AuthContext | null | undefined
): AuthContextSuccess {
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

/**
 * Lê o cookie oficial e exige presença de identificador opaco utilizável.
 * Não assume UUID aqui porque o contrato atual do browser é session_token.
 */
async function requireSessionIdentifier(): Promise<string> {
  const sessionIdentifier = await getSessionCookie();
  return assertSessionIdentifier(sessionIdentifier);
}

/**
 * Resolve o contexto auth oficial a partir do session_token/session_identifier.
 *
 * Regras:
 * - qualquer erro de resolução retorna null;
 * - não limpa cookie aqui;
 * - não faz redirect aqui;
 * - exige que o contexto final seja realmente autorizado.
 */
async function resolveSessionContext(
  sessionIdentifier: string
): Promise<AuthContextSuccess | null> {
  try {
    const validatedSessionIdentifier =
      assertSessionIdentifier(sessionIdentifier);

    const ctx = await getSessionContext(validatedSessionIdentifier);

    if (!isAuthorizedContext(ctx)) {
      return null;
    }

    return ctx;
  } catch {
    return null;
  }
}

/**
 * Resolve a sessão corrente diretamente do cookie oficial.
 *
 * Não tenta mutar cookie aqui; a responsabilidade de limpar cookie
 * pertence às rotas HTTP que devolvem response ao cliente.
 */
async function resolveCurrentAuthContext(): Promise<AuthContextSuccess | null> {
  const sessionIdentifier = await getSessionCookie();
  const normalizedSessionIdentifier = normalizeString(sessionIdentifier);

  if (!normalizedSessionIdentifier) {
    return null;
  }

  return resolveSessionContext(normalizedSessionIdentifier);
}

/**
 * Retorna o contexto auth se a sessão atual for válida.
 * Caso contrário, retorna null.
 */
export async function getAuthContext(): Promise<AuthContextSuccess | null> {
  return resolveCurrentAuthContext();
}

/**
 * Exige contexto auth válido.
 * Se não houver sessão válida, lança UNAUTHORIZED.
 */
export async function requireAuthContext(): Promise<AuthContextSuccess> {
  const ctx = await resolveCurrentAuthContext();
  return assertAuthorizedContext(ctx);
}

/**
 * Aplica o contexto auth oficial no banco e executa a callback
 * dentro de uma transação já contextualizada.
 *
 * Fluxo:
 * - resolve a sessão corrente a partir do cookie oficial (session_token)
 * - obtém o session_id real via getSessionContext(...)
 * - chama core_identity.apply_session_context(session_id)
 * - valida novamente o contexto aplicado pelo banco
 * - só então executa a callback transacional
 *
 * Importante:
 * - o callback recebe o tx já contextualizado no banco
 * - o callback também recebe o AuthContext já validado
 */
export async function withSqlAuthContext<T>(
  callback: (
    tx: CallableDbTransactionClient,
    ctx: AuthContextSuccess
  ) => Promise<T>
): Promise<T> {
  const sessionIdentifier = await requireSessionIdentifier();
  const resolvedContext = await resolveSessionContext(sessionIdentifier);
  const ctx = assertAuthorizedContext(resolvedContext);
  const sessionId = assertSessionIdFromContext(ctx.session.id);

  return withDbTransaction(async (tx) => {
    const callableTx = tx as CallableDbTransactionClient;

    const rows = (await callableTx`
      select core_identity.apply_session_context(${sessionId}::uuid) as result
    `) as ApplySessionContextRow[];

    const appliedContext = assertAuthorizedContext(rows[0]?.result ?? null);

    return callback(callableTx, appliedContext);
  });
}