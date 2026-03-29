import bcrypt from "bcryptjs";
import { env } from "@/lib/config/env";

const DEFAULT_BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 200;

const BCRYPT_ROUNDS = resolveBcryptRounds(env.AUTH_BCRYPT_ROUNDS);

/* =========================
   NORMALIZAÇÃO / VALIDAÇÃO
========================= */

function assertString(value: unknown, errorCode: string): string {
  if (typeof value !== "string") {
    throw new Error(errorCode);
  }

  return value;
}

function validatePasswordStructure(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error("PASSWORD_TOO_LONG");
  }
}

/**
 * IMPORTANTE:
 * - NÃO usar trim()
 * - NÃO alterar a senha
 * - senha é tratada como valor opaco
 */
function normalizePassword(password: unknown): string {
  const value = assertString(password, "PASSWORD_INVALID_TYPE");

  return value;
}

/* =========================
   CONFIGURAÇÃO BCRYPT
========================= */

function resolveBcryptRounds(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return DEFAULT_BCRYPT_ROUNDS;
  }

  /**
   * Hardening:
   * - mínimo seguro
   * - máximo defensivo
   */
  if (value < 8) return 8;
  if (value > 15) return 15;

  return value;
}

/* =========================
   HASH
========================= */

export async function hashPassword(password: unknown): Promise<string> {
  const normalized = normalizePassword(password);

  validatePasswordStructure(normalized);

  try {
    return await bcrypt.hash(normalized, BCRYPT_ROUNDS);
  } catch (error) {
    throw new Error("PASSWORD_HASH_FAILED");
  }
}

/* =========================
   VERIFY
========================= */

export async function verifyPassword(
  password: unknown,
  passwordHash: unknown
): Promise<boolean> {
  if (typeof passwordHash !== "string" || passwordHash.length === 0) {
    return false;
  }

  let normalized: string;

  try {
    normalized = normalizePassword(password);
    validatePasswordStructure(normalized);
  } catch {
    return false;
  }

  try {
    return await bcrypt.compare(normalized, passwordHash);
  } catch {
    return false;
  }
}

/* =========================
   HELPERS FUTUROS (PREPARAÇÃO)
========================= */

/**
 * Permite futura migração de algoritmo (ex: argon2)
 */
export function isBcryptHash(hash: string): boolean {
  return typeof hash === "string" && hash.startsWith("$2");
}

/**
 * Permite upgrade transparente de hash no login
 */
export function needsRehash(): boolean {
  return BCRYPT_ROUNDS !== resolveBcryptRounds(env.AUTH_BCRYPT_ROUNDS);
}