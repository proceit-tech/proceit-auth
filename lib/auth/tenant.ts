import type { AuthContext, SessionMembership } from "@/lib/auth/types";

const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "enabled", "approved"]);

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeMemberships(
  ctx: AuthContext | null
): SessionMembership[] {
  if (!ctx || !Array.isArray(ctx.memberships)) {
    return [];
  }

  return ctx.memberships.filter((membership): membership is SessionMembership => {
    if (!membership || typeof membership !== "object") {
      return false;
    }

    const tenantId = normalizeString(membership.tenant_id);
    const userId = normalizeString(membership.user_id);
    const membershipId = normalizeString(membership.membership_id);

    return Boolean(tenantId && userId && membershipId);
  });
}

function isActiveMembership(membership: SessionMembership): boolean {
  const status = normalizeString(
    "status" in membership ? membership.status : null
  );

  if (!status) {
    /**
     * Compatibilidade:
     * se o tipo legado não expõe status, tratamos como utilizável
     * e deixamos a origem do AuthContext como fonte principal.
     */
    return true;
  }

  return ACTIVE_MEMBERSHIP_STATUSES.has(status.toLowerCase());
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values.filter((value): value is string => Boolean(value && value.trim()))
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function getMemberships(ctx: AuthContext | null): SessionMembership[] {
  return normalizeMemberships(ctx);
}

export function getActiveTenantId(ctx: AuthContext | null): string | null {
  const activeTenantId = normalizeString(ctx?.session?.active_tenant_id ?? null);
  return activeTenantId;
}

export function getActiveMembership(
  ctx: AuthContext | null
): SessionMembership | null {
  const activeTenantId = getActiveTenantId(ctx);

  if (!activeTenantId) {
    return null;
  }

  const memberships = getMemberships(ctx);

  return (
    memberships.find(
      (membership) =>
        membership.tenant_id === activeTenantId && isActiveMembership(membership)
    ) ?? null
  );
}

export function hasTenantAccess(
  ctx: AuthContext | null,
  tenantId: string
): boolean {
  const normalizedTenantId = normalizeString(tenantId);

  if (!normalizedTenantId) {
    return false;
  }

  const memberships = getMemberships(ctx);

  return memberships.some(
    (membership) =>
      membership.tenant_id === normalizedTenantId &&
      isActiveMembership(membership)
  );
}

export function hasActiveTenantAccess(ctx: AuthContext | null): boolean {
  const activeTenantId = getActiveTenantId(ctx);

  if (!activeTenantId) {
    return false;
  }

  return hasTenantAccess(ctx, activeTenantId);
}

export function getRoleCodes(ctx: AuthContext | null): string[] {
  const memberships = getMemberships(ctx);

  return uniqueSorted(
    memberships
      .filter((membership) => isActiveMembership(membership))
      .map((membership) => normalizeString(membership.role_code))
  );
}

export function getRoleCodesByTenant(
  ctx: AuthContext | null,
  tenantId: string
): string[] {
  const normalizedTenantId = normalizeString(tenantId);

  if (!normalizedTenantId) {
    return [];
  }

  const memberships = getMemberships(ctx);

  return uniqueSorted(
    memberships
      .filter(
        (membership) =>
          membership.tenant_id === normalizedTenantId &&
          isActiveMembership(membership)
      )
      .map((membership) => normalizeString(membership.role_code))
  );
}

export function hasRoleInTenant(
  ctx: AuthContext | null,
  tenantId: string,
  roleCode: string
): boolean {
  const normalizedRoleCode = normalizeString(roleCode);

  if (!normalizedRoleCode) {
    return false;
  }

  return getRoleCodesByTenant(ctx, tenantId).includes(normalizedRoleCode);
}

export function hasMultipleTenants(ctx: AuthContext | null): boolean {
  const memberships = getMemberships(ctx).filter((membership) =>
    isActiveMembership(membership)
  );

  const tenantIds = uniqueSorted(
    memberships.map((membership) => normalizeString(membership.tenant_id))
  );

  return tenantIds.length > 1;
}