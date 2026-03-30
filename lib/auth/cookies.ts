import { cookies } from "next/headers";

import { env } from "@/lib/config/env";

const AUTH_COOKIE_NAME = requireNonEmptyString(
  env.AUTH_COOKIE_NAME,
  "AUTH_COOKIE_NAME_INVALID"
);

const AUTH_REFRESH_COOKIE_NAME = requireNonEmptyString(
  env.AUTH_REFRESH_COOKIE_NAME,
  "AUTH_REFRESH_COOKIE_NAME_INVALID"
);

type CookieSameSite = "lax" | "strict" | "none";

type AuthCookieKind = "session" | "refresh";

type CookieSecurityOptions = {
  secure: boolean;
  sameSite: CookieSameSite;
  domain?: string;
  path: string;
  httpOnly: boolean;
};

type CookieLifetimeOptions = {
  maxAge: number;
};

type CookieDefinition = CookieSecurityOptions &
  CookieLifetimeOptions & {
    name: string;
  };

function requireNonEmptyString(
  value: string | null | undefined,
  errorCode: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorCode);
  }

  return value.trim();
}

function normalizeOptionalDomain(domain?: string | null): string | undefined {
  const normalizedDomain = domain?.trim();

  /**
   * Regra oficial:
   * - usar domínio explícito quando configurado;
   * - se não estiver configurado, operar em host-only cookie;
   * - nunca inferir domínio automaticamente.
   */
  if (!normalizedDomain) {
    return undefined;
  }

  return normalizedDomain;
}

function normalizeSameSite(
  configuredValue?: string | null,
  fallback: CookieSameSite = "lax"
): CookieSameSite {
  const normalized = configuredValue?.trim().toLowerCase();

  if (
    normalized === "lax" ||
    normalized === "strict" ||
    normalized === "none"
  ) {
    return normalized;
  }

  return fallback;
}

function requirePositiveInteger(
  value: number,
  errorCode: string
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(errorCode);
  }

  return value;
}

function buildCookieSecurityOptions(params: {
  kind: AuthCookieKind;
  secure: boolean;
  sameSite: string | null | undefined;
  domain?: string | null;
}): CookieSecurityOptions {
  const normalizedSameSite = normalizeSameSite(params.sameSite, "lax");
  const normalizedDomain = normalizeOptionalDomain(params.domain);

  /**
   * Regra de compatibilidade de navegador:
   * SameSite=None exige Secure=true.
   */
  if (normalizedSameSite === "none" && !params.secure) {
    throw new Error(
      params.kind === "session"
        ? "AUTH_SESSION_COOKIE_SAMESITE_NONE_REQUIRES_SECURE"
        : "AUTH_REFRESH_COOKIE_SAMESITE_NONE_REQUIRES_SECURE"
    );
  }

  return {
    httpOnly: true,
    secure: params.secure,
    sameSite: normalizedSameSite,
    path: "/",
    domain: normalizedDomain,
  };
}

function buildSessionCookieDefinition(): CookieDefinition {
  return {
    name: AUTH_COOKIE_NAME,
    ...buildCookieSecurityOptions({
      kind: "session",
      secure: env.AUTH_COOKIE_SECURE,
      sameSite: env.AUTH_COOKIE_SAME_SITE,
      domain: env.AUTH_COOKIE_DOMAIN,
    }),
    maxAge: requirePositiveInteger(
      env.AUTH_SESSION_MAX_AGE_SECONDS,
      "AUTH_SESSION_MAX_AGE_INVALID"
    ),
  };
}

function buildRefreshCookieDefinition(): CookieDefinition {
  return {
    name: AUTH_REFRESH_COOKIE_NAME,
    ...buildCookieSecurityOptions({
      kind: "refresh",
      secure: env.AUTH_REFRESH_COOKIE_SECURE,
      sameSite: env.AUTH_REFRESH_COOKIE_SAME_SITE,
      domain: env.AUTH_REFRESH_COOKIE_DOMAIN,
    }),
    maxAge: requirePositiveInteger(
      env.AUTH_REFRESH_MAX_AGE_SECONDS,
      "AUTH_REFRESH_MAX_AGE_INVALID"
    ),
  };
}

function buildExpiredCookieDefinition(
  definition: CookieDefinition
): CookieDefinition & { expires: Date } {
  return {
    ...definition,
    maxAge: 0,
    expires: new Date(0),
  };
}

async function getCookieValueByName(name: string): Promise<string | null> {
  const store = await cookies();
  return store.get(name)?.value ?? null;
}

async function setCookieValue(
  definition: CookieDefinition,
  value: string
): Promise<void> {
  const normalizedValue = requireNonEmptyString(
    value,
    `${definition.name.toUpperCase()}_VALUE_REQUIRED`
  );

  const store = await cookies();

  store.set({
    ...definition,
    value: normalizedValue,
  });
}

async function clearCookieValue(definition: CookieDefinition): Promise<void> {
  const store = await cookies();

  store.set({
    ...buildExpiredCookieDefinition(definition),
    value: "",
  });
}

/* =========================
   SESSION COOKIE
========================= */

/**
 * Contrato oficial:
 * - o cookie de sessão transporta exclusivamente o `session_id`;
 * - o valor esperado pelo runtime atual é o UUID da sessão;
 * - nunca transportar user_id, tenant_id, roles, claims ou contexto serializado.
 */
export async function getSessionCookie(): Promise<string | null> {
  return getCookieValueByName(AUTH_COOKIE_NAME);
}

export async function setSessionCookie(sessionId: string): Promise<void> {
  const normalizedSessionId = requireNonEmptyString(
    sessionId,
    "AUTH_SESSION_ID_REQUIRED"
  );

  await setCookieValue(buildSessionCookieDefinition(), normalizedSessionId);
}

export async function clearSessionCookie(): Promise<void> {
  await clearCookieValue(buildSessionCookieDefinition());
}

/* =========================
   REFRESH COOKIE
========================= */

/**
 * Contrato oficial de refresh:
 * - o cookie de refresh transporta exclusivamente o refresh token opaco;
 * - nunca transportar user_id, tenant_id ou contexto derivado;
 * - o refresh existe apenas para rotação segura e renovação controlada de sessão.
 */
export async function getRefreshCookie(): Promise<string | null> {
  return getCookieValueByName(AUTH_REFRESH_COOKIE_NAME);
}

export async function setRefreshCookie(refreshToken: string): Promise<void> {
  const normalizedRefreshToken = requireNonEmptyString(
    refreshToken,
    "AUTH_REFRESH_TOKEN_REQUIRED"
  );

  await setCookieValue(
    buildRefreshCookieDefinition(),
    normalizedRefreshToken
  );
}

export async function clearRefreshCookie(): Promise<void> {
  await clearCookieValue(buildRefreshCookieDefinition());
}

/* =========================
   HELPERS COMBINADOS
========================= */

export async function clearAuthCookies(): Promise<void> {
  const sessionDefinition = buildSessionCookieDefinition();
  const refreshDefinition = buildRefreshCookieDefinition();

  await clearCookieValue(sessionDefinition);
  await clearCookieValue(refreshDefinition);
}

export async function setAuthCookies(params: {
  sessionId: string;
  refreshToken?: string | null;
}): Promise<void> {
  const normalizedSessionId = requireNonEmptyString(
    params.sessionId,
    "AUTH_SESSION_ID_REQUIRED"
  );

  await setSessionCookie(normalizedSessionId);

  /**
   * Regra de consistência:
   * - se o chamador enviar refresh token válido, persistir;
   * - se enviar null/undefined/vazio, limpar cookie legado/preexistente
   *   para evitar estado híbrido entre sessão nova e refresh antigo.
   */
  if (typeof params.refreshToken === "string" && params.refreshToken.trim()) {
    await setRefreshCookie(params.refreshToken);
    return;
  }

  await clearRefreshCookie();
}

/* =========================
   HELPERS DE INSPEÇÃO
========================= */

export function getSessionCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getRefreshCookieName(): string {
  return AUTH_REFRESH_COOKIE_NAME;
}

export function getSessionCookieDefinition(): Readonly<CookieDefinition> {
  return Object.freeze(buildSessionCookieDefinition());
}

export function getRefreshCookieDefinition(): Readonly<CookieDefinition> {
  return Object.freeze(buildRefreshCookieDefinition());
}

/* =========================
   COMPATIBILIDADE TEMPORÁRIA
========================= */

/**
 * Compatibilidade legada temporária.
 *
 * Observação:
 * - "session token" aqui é apenas nomenclatura legada;
 * - o contrato oficial do sistema é `sessionId` transportado por cookie httpOnly.
 * - remover estes aliases quando todos os imports antigos forem saneados.
 */
export async function getSessionTokenFromCookie(): Promise<string | null> {
  return getSessionCookie();
}

export async function setSessionTokenCookie(
  sessionToken: string
): Promise<void> {
  await setSessionCookie(sessionToken);
}

export async function clearSessionTokenCookie(): Promise<void> {
  await clearSessionCookie();
}