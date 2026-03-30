import "server-only";

import {
  db,
  type DbTransactionClient,
} from "@/lib/db/server";

import { getSessionCookie } from "@/lib/auth/cookies";
import { getSessionContext } from "@/lib/auth/session";
import type { AuthContext } from "@/lib/auth/types";

const AUTH_ERROR_UNAUTHORIZED = "UNAUTHORIZED";

type ApplySessionContextRow = {
  result: AuthContext | null;
};

function isUuidLike(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
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

function assertSessionId(sessionId: string | null | undefined): string {
  if (typeof sessionId !== "string") {
    throw new Error(AUTH_ERROR_UNAUTHORIZED);
  }

  if (!isUuidLike(sessionId)) {
    throw new Error(AUTH_ERROR_UNAUTHORIZED);
  }

  return sessionId;
}

async function requireSessionId(): Promise<string> {
  const sessionId = await getSessionCookie();
  return assertSessionId(sessionId);
}

async function resolveSessionContext(
  sessionId: string
): Promise<AuthContext | null> {
  try {
    const validatedSessionId = assertSessionId(sessionId);
    const ctx = await getSessionContext(validatedSessionId);

    if (!isAuthorizedContext(ctx)) {
      return null;
    }

    return ctx;
  } catch {
    return null;
  }
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const sessionId = await getSessionCookie();

  if (!sessionId || !isUuidLike(sessionId)) {
    return null;
  }

  return resolveSessionContext(sessionId);
}

export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  return assertAuthorizedContext(ctx);
}

/**
 * CORE: SQL AUTH CONTEXT
 */
export async function withSqlAuthContext<T>(
  callback: (
    tx: DbTransactionClient & ((...args: any[]) => any),
    ctx: AuthContext
  ) => Promise<T>
): Promise<T> {
  const sessionId = await requireSessionId();

  const result = await db.begin(async (tx) => {
    const callableTx = tx as DbTransactionClient & ((...args: any[]) => any);

    const rows = (await callableTx`
      select core_identity.apply_session_context(${sessionId}::uuid) as result
    `) as ApplySessionContextRow[];

    const ctx = assertAuthorizedContext(rows[0]?.result ?? null);

    return callback(callableTx, ctx);
  });

  return result as T;
}