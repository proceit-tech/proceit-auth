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

/* =========================
   VALIDADORES
========================= */

function requireNonEmptyString(
  value: string | null | undefined,
  errorCode: string
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorCode);
  }

  return value.trim();
}

function requireReasonableToken(
  value: string | null | undefined,
  errorCode: string
): string {
  const normalized = requireNonEmptyString(value, errorCode);

  /**
   * Hardening:
   * - evita header overflow
   * - evita payload malicioso exagerado
   */
  if (normalized.length > 2048) {
    throw new Error(`${errorCode}_TOO_LARGE`);
  }

  return normalized;
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

/* =========================
   NORMALIZADORES
========================= */

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

/* =========================
   COOKIE STORE
========================= */

async function getCookieStore() {
  return await cookies();
}

/* =========================
   BUILDERS
========================= */

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

/* =========================
   LOW LEVEL OPERATIONS
========================= */

async function getCookieValueByName(name: string): Promise<string | null> {
  const store = await getCookieStore();
  return store.get(name)?.value ?? null;
}

async function setCookieValue(
  definition: CookieDefinition,
  value: string
): Promise<void> {
  const normalizedValue = requireReasonableToken(
    value,
    `${definition.name.toUpperCase()}_VALUE_REQUIRED`
  );

  const store = await getCookieStore();

  store.set({
    ...definition,
    value: normalizedValue,
  });
}

async function clearCookieValue(definition: CookieDefinition): Promise<void> {
  const store = await getCookieStore();

  /**
   * IMPORTANTE:
   * - domain/path devem ser idênticos ao cookie original
   * - senão o browser não remove o cookie
   */
  store.set({
    ...buildExpiredCookieDefinition(definition),
    value: "",
  });
}

/* =========================
   SESSION COOKIE
========================= */

export async function getSessionCookie(): Promise<string | null> {
  return getCookieValueByName(AUTH_COOKIE_NAME);
}

export async function setSessionCookie(sessionToken: string): Promise<void> {
  const normalizedSessionToken = requireReasonableToken(
    sessionToken,
    "AUTH_SESSION_TOKEN_REQUIRED"
  );

  await setCookieValue(
    buildSessionCookieDefinition(),
    normalizedSessionToken
  );
}

export async function clearSessionCookie(): Promise<void> {
  await clearCookieValue(buildSessionCookieDefinition());
}

/* =========================
   REFRESH COOKIE
========================= */

export async function getRefreshCookie(): Promise<string | null> {
  return getCookieValueByName(AUTH_REFRESH_COOKIE_NAME);
}

export async function setRefreshCookie(refreshToken: string): Promise<void> {
  const normalizedRefreshToken = requireReasonableToken(
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
  sessionToken: string;
  refreshToken?: string | null;
}): Promise<void> {
  const sessionToken = requireReasonableToken(
    params.sessionToken,
    "AUTH_SESSION_TOKEN_REQUIRED"
  );

  const hasValidRefresh =
    typeof params.refreshToken === "string" &&
    params.refreshToken.trim().length > 0;

  await setSessionCookie(sessionToken);

  if (hasValidRefresh) {
    await setRefreshCookie(params.refreshToken!);
  } else {
    await clearRefreshCookie();
  }
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

/* =========================
   COMPATIBILIDADE LEGADA
========================= */

export async function setSessionIdCookie(
  sessionToken: string
): Promise<void> {
  await setSessionCookie(sessionToken);
}