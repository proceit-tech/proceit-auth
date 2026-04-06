import { cookies } from "next/headers";
import { env } from "@/lib/config/env";

/* =========================
   TYPES
========================= */

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
   HELPERS ENV LAZY
========================= */

function getAuthCookieName(): string {
  return requireNonEmptyString(
    env.AUTH_COOKIE_NAME,
    "AUTH_COOKIE_NAME_INVALID"
  );
}

function getRefreshCookieName(): string {
  return requireNonEmptyString(
    env.AUTH_REFRESH_COOKIE_NAME,
    "AUTH_REFRESH_COOKIE_NAME_INVALID"
  );
}

/* =========================
   NORMALIZADORES
========================= */

function normalizeOptionalDomain(domain?: string | null): string | undefined {
  const normalizedDomain = domain?.trim();

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
    name: getAuthCookieName(),
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
    name: getRefreshCookieName(),
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
   LOW LEVEL
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

  store.set({
    ...buildExpiredCookieDefinition(definition),
    value: "",
  });
}

/* =========================
   SESSION COOKIE
========================= */

export async function getSessionCookie(): Promise<string | null> {
  return getCookieValueByName(getAuthCookieName());
}

export async function setSessionCookie(sessionToken: string): Promise<void> {
  await setCookieValue(
    buildSessionCookieDefinition(),
    sessionToken
  );
}

export async function clearSessionCookie(): Promise<void> {
  await clearCookieValue(buildSessionCookieDefinition());
}

/* =========================
   REFRESH COOKIE
========================= */

export async function getRefreshCookie(): Promise<string | null> {
  return getCookieValueByName(getRefreshCookieName());
}

export async function setRefreshCookie(refreshToken: string): Promise<void> {
  await setCookieValue(
    buildRefreshCookieDefinition(),
    refreshToken
  );
}

export async function clearRefreshCookie(): Promise<void> {
  await clearCookieValue(buildRefreshCookieDefinition());
}