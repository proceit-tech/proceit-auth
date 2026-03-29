import "server-only";

import { redirect } from "next/navigation";

import {
  getRuntimeContext,
  type RuntimeContext,
} from "@/lib/auth/runtime-context";

const ROUTES = {
  login: "/login",
  selectTenant: "/select-tenant",
  appHome: "/app",
} as const;

const PLATFORM_ROLES = {
  master: "master",
} as const;

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function hasMasterAccess(platformRoles: unknown): boolean {
  const roles = normalizeStringArray(platformRoles);
  return roles.includes(PLATFORM_ROLES.master);
}

function hasAuthenticatedUser(ctx: RuntimeContext): boolean {
  return Boolean(ctx?.authenticated && ctx?.user);
}

function hasValidTenantSelectionState(ctx: RuntimeContext): boolean {
  return typeof ctx?.requiresTenantSelection === "boolean";
}

function hasResolvedTenantScope(ctx: RuntimeContext): boolean {
  if (!hasAuthenticatedUser(ctx)) {
    return false;
  }

  if (!hasValidTenantSelectionState(ctx)) {
    return false;
  }

  return Boolean(
    ctx.user &&
      ctx.activeTenant &&
      ctx.membership &&
      ctx.hasTenantScope &&
      ctx.requiresTenantSelection === false
  );
}

function hasPermission(
  ctx: RuntimeContext,
  permissionCode: string
): boolean {
  const normalizedPermissionCode = normalizeString(permissionCode);

  if (!normalizedPermissionCode) {
    return false;
  }

  const permissions = normalizeStringArray(ctx?.permissions);
  return permissions.includes(normalizedPermissionCode);
}

function hasModule(
  ctx: RuntimeContext,
  moduleCode: string
): boolean {
  const normalizedModuleCode = normalizeString(moduleCode);

  if (!normalizedModuleCode) {
    return false;
  }

  const modules = normalizeStringArray(ctx?.modules);
  return modules.includes(normalizedModuleCode);
}

function redirectToLogin(): never {
  redirect(ROUTES.login);
}

function redirectToTenantSelection(): never {
  redirect(ROUTES.selectTenant);
}

function redirectToAppHome(): never {
  redirect(ROUTES.appHome);
}

function assertNonEmptyGuardInput(
  value: string,
  errorCode: string
): string {
  const normalized = normalizeString(value);

  if (!normalized) {
    throw new Error(errorCode);
  }

  return normalized;
}

export async function requireAuthenticated(): Promise<RuntimeContext> {
  const ctx = await getRuntimeContext();

  if (!hasAuthenticatedUser(ctx)) {
    redirectToLogin();
  }

  return ctx;
}

export async function requireTenantContext(): Promise<RuntimeContext> {
  const ctx = await requireAuthenticated();

  if (!hasResolvedTenantScope(ctx)) {
    redirectToTenantSelection();
  }

  return ctx;
}

export async function requirePermission(
  permissionCode: string
): Promise<RuntimeContext> {
  const normalizedPermissionCode = assertNonEmptyGuardInput(
    permissionCode,
    "AUTH_GUARD_PERMISSION_CODE_REQUIRED"
  );

  const ctx = await requireTenantContext();

  if (hasMasterAccess(ctx.platformRoles)) {
    return ctx;
  }

  if (!hasPermission(ctx, normalizedPermissionCode)) {
    redirectToAppHome();
  }

  return ctx;
}

export async function requireModule(
  moduleCode: string
): Promise<RuntimeContext> {
  const normalizedModuleCode = assertNonEmptyGuardInput(
    moduleCode,
    "AUTH_GUARD_MODULE_CODE_REQUIRED"
  );

  const ctx = await requireTenantContext();

  if (hasMasterAccess(ctx.platformRoles)) {
    return ctx;
  }

  if (!hasModule(ctx, normalizedModuleCode)) {
    redirectToAppHome();
  }

  return ctx;
}

export async function requirePermissions(
  permissionCodes: string[]
): Promise<RuntimeContext> {
  const normalizedPermissionCodes = normalizeStringArray(permissionCodes);

  if (normalizedPermissionCodes.length === 0) {
    throw new Error("AUTH_GUARD_PERMISSION_CODES_REQUIRED");
  }

  const ctx = await requireTenantContext();

  if (hasMasterAccess(ctx.platformRoles)) {
    return ctx;
  }

  const granted = normalizedPermissionCodes.every((permissionCode) =>
    hasPermission(ctx, permissionCode)
  );

  if (!granted) {
    redirectToAppHome();
  }

  return ctx;
}

export async function requireAnyPermission(
  permissionCodes: string[]
): Promise<RuntimeContext> {
  const normalizedPermissionCodes = normalizeStringArray(permissionCodes);

  if (normalizedPermissionCodes.length === 0) {
    throw new Error("AUTH_GUARD_ANY_PERMISSION_CODES_REQUIRED");
  }

  const ctx = await requireTenantContext();

  if (hasMasterAccess(ctx.platformRoles)) {
    return ctx;
  }

  const granted = normalizedPermissionCodes.some((permissionCode) =>
    hasPermission(ctx, permissionCode)
  );

  if (!granted) {
    redirectToAppHome();
  }

  return ctx;
}

export async function requireModules(
  moduleCodes: string[]
): Promise<RuntimeContext> {
  const normalizedModuleCodes = normalizeStringArray(moduleCodes);

  if (normalizedModuleCodes.length === 0) {
    throw new Error("AUTH_GUARD_MODULE_CODES_REQUIRED");
  }

  const ctx = await requireTenantContext();

  if (hasMasterAccess(ctx.platformRoles)) {
    return ctx;
  }

  const granted = normalizedModuleCodes.every((moduleCode) =>
    hasModule(ctx, moduleCode)
  );

  if (!granted) {
    redirectToAppHome();
  }

  return ctx;
}

export async function requireAnyModule(
  moduleCodes: string[]
): Promise<RuntimeContext> {
  const normalizedModuleCodes = normalizeStringArray(moduleCodes);

  if (normalizedModuleCodes.length === 0) {
    throw new Error("AUTH_GUARD_ANY_MODULE_CODES_REQUIRED");
  }

  const ctx = await requireTenantContext();

  if (hasMasterAccess(ctx.platformRoles)) {
    return ctx;
  }

  const granted = normalizedModuleCodes.some((moduleCode) =>
    hasModule(ctx, moduleCode)
  );

  if (!granted) {
    redirectToAppHome();
  }

  return ctx;
}

export async function requireMasterAccess(): Promise<RuntimeContext> {
  const ctx = await requireAuthenticated();

  if (!hasMasterAccess(ctx.platformRoles)) {
    redirectToAppHome();
  }

  return ctx;
}