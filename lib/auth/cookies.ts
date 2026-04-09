import { cookies } from "next/headers";
import { env } from "@/lib/config/env";

/* =========================
   DEBUG HELPERS
========================= */

const COOKIE_SCOPE = "AUTH_COOKIES";

type DebugPayload = Record<string, unknown>;

function buildDebugBase() {
  return {
    ts: new Date().toISOString(),
    scope: COOKIE_SCOPE,
    env: process.env.NODE_ENV ?? null,
  };
}

function cookieLog(step: string, payload?: DebugPayload) {
  console.log(
    JSON.stringify({
      ...buildDebugBase(),
      level: "info",
      step,
      ...(payload ?? {}),
    })
  );
}

function cookieWarn(step: string, payload?: DebugPayload) {
  console.warn(
    JSON.stringify({
      ...buildDebugBase(),
      level: "warn",
      step,
      ...(payload ?? {}),
    })
  );
}

function cookieError(
  step: string,
  error: unknown,
  payload?: DebugPayload
) {
  console.error(
    JSON.stringify({
      ...buildDebugBase(),
      level: "error",
      step,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { value: String(error) },
      ...(payload ?? {}),
    })
  );
}

function maskValue(value: string | null | undefined) {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (v.length <= 12) return v;
  return `${v.slice(0, 8)}...${v.slice(-4)}`;
}

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
    cookieError("requireNonEmptyString.invalid", new Error(errorCode), {
      value,
    });
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
    cookieError("requireReasonableToken.too_large", new Error(errorCode), {
      length: normalized.length,
    });
    throw new Error(`${errorCode}_TOO_LARGE`);
  }

  return normalized;
}

function requirePositiveInteger(
  value: number,
  errorCode: string
): number {
  if (!Number.isInteger(value) || value <= 0) {
    cookieError("requirePositiveInteger.invalid", new Error(errorCode), {
      value,
    });
    throw new Error(errorCode);
  }

  return value;
}

/* =========================
   ENV
========================= */

function getAuthCookieName(): string {
  const name = requireNonEmptyString(
    env.AUTH_COOKIE_NAME,
    "AUTH_COOKIE_NAME_INVALID"
  );

  cookieLog("getAuthCookieName.resolved", { name });

  return name;
}

function getRefreshCookieName(): string {
  const name = requireNonEmptyString(
    env.AUTH_REFRESH_COOKIE_NAME,
    "AUTH_REFRESH_COOKIE_NAME_INVALID"
  );

  cookieLog("getRefreshCookieName.resolved", { name });

  return name;
}

/* =========================
   NORMALIZADORES
========================= */

function normalizeOptionalDomain(domain?: string | null): string | undefined {
  const normalized = domain?.trim();

  cookieLog("normalizeOptionalDomain", {
    input: domain,
    output: normalized ?? null,
  });

  return normalized || undefined;
}

function normalizeSameSite(
  configuredValue?: string | null,
  fallback: CookieSameSite = "lax"
): CookieSameSite {
  const normalized = configuredValue?.trim().toLowerCase();

  const result =
    normalized === "lax" ||
    normalized === "strict" ||
    normalized === "none"
      ? normalized
      : fallback;

  cookieLog("normalizeSameSite", {
    input: configuredValue,
    normalized,
    result,
  });

  return result;
}

/* =========================
   STORE
========================= */

async function getCookieStore() {
  const store = await cookies();

  cookieLog("getCookieStore.obtained");

  return store;
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
  const sameSite = normalizeSameSite(params.sameSite);
  const domain = normalizeOptionalDomain(params.domain);

  if (sameSite === "none" && !params.secure) {
    const errorCode =
      params.kind === "session"
        ? "AUTH_SESSION_COOKIE_SAMESITE_NONE_REQUIRES_SECURE"
        : "AUTH_REFRESH_COOKIE_SAMESITE_NONE_REQUIRES_SECURE";

    cookieError("buildCookieSecurityOptions.invalid", new Error(errorCode), {
      sameSite,
      secure: params.secure,
    });

    throw new Error(errorCode);
  }

  const result = {
    httpOnly: true,
    secure: params.secure,
    sameSite,
    path: "/",
    domain,
  };

  cookieLog("buildCookieSecurityOptions.result", result);

  return result;
}

function buildSessionCookieDefinition(): CookieDefinition {
  const def = {
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

  cookieLog("buildSessionCookieDefinition", def);

  return def;
}

function buildRefreshCookieDefinition(): CookieDefinition {
  const def = {
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

  cookieLog("buildRefreshCookieDefinition", def);

  return def;
}

function buildExpiredCookieDefinition(
  definition: CookieDefinition
) {
  const expired = {
    ...definition,
    maxAge: 0,
    expires: new Date(0),
  };

  cookieLog("buildExpiredCookieDefinition", expired);

  return expired;
}

/* =========================
   LOW LEVEL
========================= */

async function getCookieValueByName(name: string): Promise<string | null> {
  const store = await getCookieStore();

  const value = store.get(name)?.value ?? null;

  cookieLog("getCookieValueByName", {
    name,
    found: Boolean(value),
    length: value?.length ?? 0,
    masked: maskValue(value),
  });

  return value;
}

async function setCookieValue(
  definition: CookieDefinition,
  value: string
): Promise<void> {
  const normalized = requireReasonableToken(
    value,
    `${definition.name.toUpperCase()}_VALUE_REQUIRED`
  );

  const store = await getCookieStore();

  store.set({
    ...definition,
    value: normalized,
  });

  cookieLog("setCookieValue.success", {
    name: definition.name,
    length: normalized.length,
    masked: maskValue(normalized),
    secure: definition.secure,
    sameSite: definition.sameSite,
    domain: definition.domain ?? null,
    maxAge: definition.maxAge,
  });
}

async function clearCookieValue(definition: CookieDefinition): Promise<void> {
  const store = await getCookieStore();

  store.set({
    ...buildExpiredCookieDefinition(definition),
    value: "",
  });

  cookieWarn("clearCookieValue.executed", {
    name: definition.name,
  });
}

/* =========================
   SESSION COOKIE
========================= */

export async function getSessionCookie(): Promise<string | null> {
  cookieLog("getSessionCookie.start");

  const value = await getCookieValueByName(getAuthCookieName());

  cookieLog("getSessionCookie.result", {
    exists: Boolean(value),
    masked: maskValue(value),
  });

  return value;
}

export async function setSessionCookie(sessionToken: string): Promise<void> {
  cookieLog("setSessionCookie.start");

  await setCookieValue(
    buildSessionCookieDefinition(),
    sessionToken
  );
}

export async function clearSessionCookie(): Promise<void> {
  cookieWarn("clearSessionCookie.start");

  await clearCookieValue(buildSessionCookieDefinition());
}

/* =========================
   REFRESH COOKIE
========================= */

export async function getRefreshCookie(): Promise<string | null> {
  cookieLog("getRefreshCookie.start");

  const value = await getCookieValueByName(getRefreshCookieName());

  return value;
}

export async function setRefreshCookie(refreshToken: string): Promise<void> {
  cookieLog("setRefreshCookie.start");

  await setCookieValue(
    buildRefreshCookieDefinition(),
    refreshToken
  );
}

export async function clearRefreshCookie(): Promise<void> {
  cookieWarn("clearRefreshCookie.start");

  await clearCookieValue(buildRefreshCookieDefinition());
}