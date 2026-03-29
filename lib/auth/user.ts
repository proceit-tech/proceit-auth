import type { AuthContext, SessionUser } from "@/lib/auth/types";

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeUser(user: SessionUser | null | undefined): SessionUser | null {
  if (!user || typeof user !== "object") {
    return null;
  }

  const id = normalizeText(user.id);

  if (!id) {
    return null;
  }

  return {
    ...user,
    id,
    document_number: normalizeText(user.document_number),
    first_name: normalizeText(user.first_name),
    last_name: normalizeText(user.last_name),
    full_name: normalizeText(user.full_name),
    display_name: normalizeText(user.display_name),
    email: normalizeText(user.email),
  };
}

export function getCurrentUser(ctx: AuthContext | null): SessionUser | null {
  return normalizeUser(ctx?.user ?? null);
}

export function getCurrentUserId(ctx: AuthContext | null): string | null {
  return getCurrentUser(ctx)?.id ?? null;
}

export function getCurrentUserEmail(ctx: AuthContext | null): string | null {
  return getCurrentUser(ctx)?.email ?? null;
}

export function getCurrentUserDocumentNumber(
  ctx: AuthContext | null
): string | null {
  return getCurrentUser(ctx)?.document_number ?? null;
}

export function hasCurrentUser(ctx: AuthContext | null): boolean {
  return Boolean(getCurrentUserId(ctx));
}

export function getDisplayName(
  ctx: AuthContext | null,
  fallback = "Usuario"
): string {
  const user = getCurrentUser(ctx);

  if (!user) {
    return fallback;
  }

  if (user.display_name) {
    return user.display_name;
  }

  if (user.full_name) {
    return user.full_name;
  }

  const composedName = [user.first_name, user.last_name]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  if (composedName) {
    return composedName;
  }

  if (user.email) {
    return user.email;
  }

  return fallback;
}

export function getShortName(
  ctx: AuthContext | null,
  fallback = "Usuario"
): string {
  const user = getCurrentUser(ctx);

  if (!user) {
    return fallback;
  }

  if (user.display_name) {
    return user.display_name;
  }

  if (user.first_name) {
    return user.first_name;
  }

  if (user.full_name) {
    return user.full_name;
  }

  if (user.email) {
    return user.email;
  }

  return fallback;
}

export function getFullName(ctx: AuthContext | null): string | null {
  const user = getCurrentUser(ctx);

  if (!user) {
    return null;
  }

  if (user.full_name) {
    return user.full_name;
  }

  const composedName = [user.first_name, user.last_name]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  return composedName || null;
}

export function isUserActive(ctx: AuthContext | null): boolean {
  const user = getCurrentUser(ctx);

  if (!user) {
    return false;
  }

  /**
   * Compatibilidade atual:
   * - se `is_active` vier explicitamente boolean, respeitar o valor;
   * - se não vier informado, assumir ativo para não quebrar runtimes legados.
   */
  if (typeof user.is_active === "boolean") {
    return user.is_active;
  }

  return true;
}