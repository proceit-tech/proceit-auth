import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const cookieSameSiteSchema = z.enum(["lax", "strict", "none"]);

const POSTGRES_URL_PREFIXES = ["postgres://", "postgresql://"] as const;

/* =========================
   HELPERS
========================= */

const positiveIntegerFromString = (fieldName: string) =>
  z.string().transform((value, ctx) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a positive integer`,
      });
      return z.NEVER;
    }

    return parsed;
  });

const rangedPositiveIntegerFromString = (
  fieldName: string,
  params: { min: number; max: number }
) =>
  z.string().transform((value, ctx) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be a positive integer`,
      });
      return z.NEVER;
    }

    if (parsed < params.min || parsed > params.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${fieldName} must be between ${params.min} and ${params.max}`,
      });
      return z.NEVER;
    }

    return parsed;
  });

const booleanFromString = (fieldName: string) =>
  z.string().transform((value, ctx) => {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") return true;
    if (normalized === "false") return false;

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${fieldName} must be "true" or "false"`,
    });

    return z.NEVER;
  });

const optionalNormalizedString = z
  .string()
  .transform((value) => {
    const normalized = value.trim();
    return normalized.length > 0 ? undefined : undefined;
  })
  .optional();

/* =========================
   DATABASE
========================= */

const databaseUrlSchema = z
  .string()
  .min(1, "DATABASE_URL is required")
  .refine(
    (value) =>
      POSTGRES_URL_PREFIXES.some((prefix) => value.startsWith(prefix)),
    "DATABASE_URL must start with postgres:// or postgresql://"
  );

/* =========================
   SUPABASE (NOVO BLOCO)
========================= */

const supabaseUrlSchema = z.string().min(1, "SUPABASE_URL is required");
const supabaseKeySchema = z
  .string()
  .min(1, "SUPABASE_SERVICE_ROLE_KEY is required");

/* =========================
   ENV SCHEMA
========================= */

const rawEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  NODE_ENV: nodeEnvSchema.default("development"),

  /* =========================
     SUPABASE
  ========================= */

  SUPABASE_URL: supabaseUrlSchema,
  SUPABASE_SERVICE_ROLE_KEY: supabaseKeySchema,

  /* =========================
     AUTH COOKIE
  ========================= */

  AUTH_COOKIE_NAME: z.string().min(1).default("proceit_session"),
  AUTH_COOKIE_DOMAIN: optionalNormalizedString,
  AUTH_COOKIE_SECURE: booleanFromString("AUTH_COOKIE_SECURE").default("true"),
  AUTH_COOKIE_SAME_SITE: cookieSameSiteSchema.default("lax"),

  AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default("proceit_refresh"),
  AUTH_REFRESH_COOKIE_DOMAIN: optionalNormalizedString,
  AUTH_REFRESH_COOKIE_SECURE: booleanFromString(
    "AUTH_REFRESH_COOKIE_SECURE"
  ).default("true"),
  AUTH_REFRESH_COOKIE_SAME_SITE: cookieSameSiteSchema.default("lax"),

  AUTH_SESSION_MAX_AGE_SECONDS: positiveIntegerFromString(
    "AUTH_SESSION_MAX_AGE_SECONDS"
  ).default(String(60 * 60 * 24 * 30)),

  AUTH_REFRESH_MAX_AGE_SECONDS: positiveIntegerFromString(
    "AUTH_REFRESH_MAX_AGE_SECONDS"
  ).default(String(60 * 60 * 24 * 7)),

  AUTH_BCRYPT_ROUNDS: rangedPositiveIntegerFromString(
    "AUTH_BCRYPT_ROUNDS",
    { min: 8, max: 15 }
  ).default("10"),
});

/* =========================
   PARSE
========================= */

const parsedEnv = rawEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
  AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
  AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
  AUTH_COOKIE_SAME_SITE: process.env.AUTH_COOKIE_SAME_SITE,

  AUTH_REFRESH_COOKIE_NAME: process.env.AUTH_REFRESH_COOKIE_NAME,
  AUTH_REFRESH_COOKIE_DOMAIN: process.env.AUTH_REFRESH_COOKIE_DOMAIN,
  AUTH_REFRESH_COOKIE_SECURE: process.env.AUTH_REFRESH_COOKIE_SECURE,
  AUTH_REFRESH_COOKIE_SAME_SITE: process.env.AUTH_REFRESH_COOKIE_SAME_SITE,

  AUTH_SESSION_MAX_AGE_SECONDS: process.env.AUTH_SESSION_MAX_AGE_SECONDS,
  AUTH_REFRESH_MAX_AGE_SECONDS: process.env.AUTH_REFRESH_MAX_AGE_SECONDS,

  AUTH_BCRYPT_ROUNDS: process.env.AUTH_BCRYPT_ROUNDS,
});

/* =========================
   FINAL EXPORT
========================= */

export const env = {
  ...parsedEnv,

  isProduction: parsedEnv.NODE_ENV === "production",
  isDevelopment: parsedEnv.NODE_ENV === "development",
  isTest: parsedEnv.NODE_ENV === "test",
} as const;