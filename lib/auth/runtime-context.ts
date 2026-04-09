import "server-only";

import { query } from "@/lib/db/server";
import { getSessionCookie } from "@/lib/auth/cookies";
import { getSessionContext } from "@/lib/auth/session";
import {
  buildNavigationTree,
  type NavigationTreeItem,
} from "@/lib/navigation/build-navigation-tree";

/* =========================
   TYPES
========================= */

export type RuntimeUser = {
  id: string;
  displayName: string | null;
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  documentNumber: string | null;
};

export type RuntimeTenant = {
  id: string;
  name: string;
  code: string | null;
};

export type RuntimeMembership = {
  id: string;
  tenantId: string;
  userId: string;
  roleCode: string | null;
  status: string;
  isDefault: boolean;
};

export type RuntimeNavigationItem = {
  code: string;
  parentCode: string | null;
  moduleCode: string | null;
  labelEs: string;
  labelPt: string;
  href: string | null;
  icon: string | null;
  itemType: "section" | "group" | "item";
  sortOrder: number;
  metadata: Record<string, unknown> | null;
};

export type RuntimeContext = {
  authenticated: boolean;
  sessionId: string | null;
  user: RuntimeUser | null;
  activeTenant: RuntimeTenant | null;
  membership: RuntimeMembership | null;
  platformRoles: string[];
  tenantRoles: string[];
  permissions: string[];
  modules: string[];
  navigationFlat: RuntimeNavigationItem[];
  navigation: NavigationTreeItem[];
  requiresTenantSelection: boolean;
  hasTenantScope: boolean;
  hasMasterAccess: boolean;
};

/* =========================
   INTERNAL DB ROW TYPES
========================= */

type TenantRow = {
  id: string;
  name: string;
  code: string | null;
};

type ActiveMembershipRow = {
  membership_id: string;
  user_id: string;
  tenant_id: string;
  role_code: string | null;
  status: string;
  is_default: boolean;
};

type PlatformRoleRow = {
  role_code: string;
};

type TenantRoleRow = {
  role_code: string;
};

type PermissionRow = {
  permission_code: string;
};

type ModuleRow = {
  module_code: string;
};

type NavigationRow = {
  code: string;
  parent_code: string | null;
  module_code: string | null;
  label_es: string;
  label_pt: string;
  href: string | null;
  icon: string | null;
  item_type: "section" | "group" | "item";
  sort_order: number;
  metadata: Record<string, unknown> | null;
};

/* =========================
   CONSTANTS
========================= */

const PLATFORM_MASTER_ROLE = "master";

const ACTIVE_MEMBERSHIP_STATUSES = new Set(["active", "enabled", "approved"]);

/* =========================
   GENERIC HELPERS
========================= */

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isUuidLike(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value && value.trim()))
        .map((value) => value.trim())
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function isActiveMembershipStatus(status: string | null | undefined): boolean {
  const normalizedStatus = normalizeString(status);

  if (!normalizedStatus) {
    return false;
  }

  return ACTIVE_MEMBERSHIP_STATUSES.has(normalizedStatus.toLowerCase());
}

function createEmptyRuntimeContext(
  overrides?: Partial<RuntimeContext>
): RuntimeContext {
  return {
    authenticated: false,
    sessionId: null,
    user: null,
    activeTenant: null,
    membership: null,
    platformRoles: [],
    tenantRoles: [],
    permissions: [],
    modules: [],
    navigationFlat: [],
    navigation: [],
    requiresTenantSelection: false,
    hasTenantScope: false,
    hasMasterAccess: false,
    ...overrides,
  };
}

function createAuthenticatedRuntimeContext(params: {
  sessionId: string;
  user: RuntimeUser;
  platformRoles?: string[];
  requiresTenantSelection?: boolean;
  hasMasterAccess?: boolean;
  activeTenant?: RuntimeTenant | null;
  membership?: RuntimeMembership | null;
  tenantRoles?: string[];
  permissions?: string[];
  modules?: string[];
  navigationFlat?: RuntimeNavigationItem[];
  navigation?: NavigationTreeItem[];
  hasTenantScope?: boolean;
}): RuntimeContext {
  return createEmptyRuntimeContext({
    authenticated: true,
    sessionId: params.sessionId,
    user: params.user,
    activeTenant: params.activeTenant ?? null,
    membership: params.membership ?? null,
    platformRoles: uniqueSorted(params.platformRoles ?? []),
    tenantRoles: uniqueSorted(params.tenantRoles ?? []),
    permissions: uniqueSorted(params.permissions ?? []),
    modules: uniqueSorted(params.modules ?? []),
    navigationFlat: params.navigationFlat ?? [],
    navigation: params.navigation ?? [],
    requiresTenantSelection: params.requiresTenantSelection ?? false,
    hasTenantScope: params.hasTenantScope ?? false,
    hasMasterAccess: params.hasMasterAccess ?? false,
  });
}

function toRuntimeUser(input: {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  document_number: string | null;
}): RuntimeUser {
  return {
    id: input.id,
    displayName: input.display_name,
    fullName: input.full_name,
    firstName: input.first_name,
    lastName: input.last_name,
    email: input.email,
    documentNumber: input.document_number,
  };
}

function hasConsistentTenantScope(params: {
  user: RuntimeUser;
  activeTenant: RuntimeTenant | null;
  membership: RuntimeMembership | null;
}): boolean {
  const { user, activeTenant, membership } = params;

  if (!activeTenant || !membership) {
    return false;
  }

  if (!isUuidLike(user.id)) {
    return false;
  }

  if (!isUuidLike(activeTenant.id) || !isUuidLike(membership.id)) {
    return false;
  }

  if (!isUuidLike(membership.userId) || !isUuidLike(membership.tenantId)) {
    return false;
  }

  if (membership.userId !== user.id) {
    return false;
  }

  if (membership.tenantId !== activeTenant.id) {
    return false;
  }

  if (!isActiveMembershipStatus(membership.status)) {
    return false;
  }

  return true;
}

/* =========================
   DB HELPERS
========================= */

async function getTenantById(tenantId: string): Promise<RuntimeTenant | null> {
  const result = await query<TenantRow>(
    `
      select id, name, code
      from core_identity.tenants
      where id = $1::uuid
      limit 1
    `,
    [tenantId]
  );

  const row = result.rows[0] as TenantRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    code: row.code,
  };
}

async function getActiveMembership(
  userId: string,
  tenantId: string
): Promise<RuntimeMembership | null> {
  const result = await query<ActiveMembershipRow>(
    `
      select
        m.membership_id,
        m.user_id,
        m.tenant_id,
        m.role_code,
        m.status,
        coalesce(tm.is_default, false) as is_default
      from core_identity.get_active_membership($1::uuid, $2::uuid) m
      join core_identity.tenant_memberships tm
        on tm.id = m.membership_id
      limit 1
    `,
    [userId, tenantId]
  );

  const row = result.rows[0] as ActiveMembershipRow | undefined;

  if (!row) {
    return null;
  }

  return {
    id: row.membership_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    roleCode: row.role_code,
    status: row.status,
    isDefault: row.is_default,
  };
}

async function getPlatformRoles(userId: string): Promise<string[]> {
  const result = await query<PlatformRoleRow>(
    `
      select distinct r.code as role_code
      from core_rbac.user_platform_roles upr
      join core_rbac.roles r on r.id = upr.role_id
      where upr.user_id = $1::uuid
        and upr.is_active = true
        and r.is_active = true
      order by r.code asc
    `,
    [userId]
  );

  return uniqueSorted(result.rows.map((row: PlatformRoleRow) => row.role_code));
}

async function getTenantRoles(
  userId: string,
  tenantId: string
): Promise<string[]> {
  const result = await query<TenantRoleRow>(
    `
      select distinct role_code
      from core_rbac.v_membership_permissions
      where user_id = $1::uuid
        and tenant_id = $2::uuid
    `,
    [userId, tenantId]
  );

  return uniqueSorted(result.rows.map((row: TenantRoleRow) => row.role_code));
}

async function getPermissions(
  userId: string,
  tenantId: string
): Promise<string[]> {
  const result = await query<PermissionRow>(
    `
      select permission_code
      from core_rbac.get_membership_permission_codes($1::uuid, $2::uuid)
    `,
    [userId, tenantId]
  );

  return uniqueSorted(
    result.rows.map((row: PermissionRow) => row.permission_code)
  );
}

/**
 * Observação:
 * este helper mantém a regra atual de módulos ativos por tenant.
 * Se a regra oficial passar a exigir interseção direta por usuário,
 * este método deve ser substituído por uma função baseada em membership.
 */
async function getModules(tenantId: string): Promise<string[]> {
  const result = await query<ModuleRow>(
    `
      select module_code
      from core_catalog.get_tenant_module_codes($1::uuid)
    `,
    [tenantId]
  );

  return uniqueSorted(result.rows.map((row: ModuleRow) => row.module_code));
}

async function getNavigation(
  userId: string,
  tenantId: string
): Promise<RuntimeNavigationItem[]> {
  const result = await query<NavigationRow>(
    `
      select *
      from core_navigation.get_navigation_for_membership($1::uuid, $2::uuid)
    `,
    [userId, tenantId]
  );

  return result.rows.map((row: NavigationRow) => ({
    code: row.code,
    parentCode: row.parent_code,
    moduleCode: row.module_code,
    labelEs: row.label_es,
    labelPt: row.label_pt,
    href: row.href,
    icon: row.icon,
    itemType: row.item_type,
    sortOrder: row.sort_order,
    metadata: row.metadata,
  }));
}

/* =========================
   MAIN FUNCTION
========================= */

export async function getRuntimeContext(): Promise<RuntimeContext> {
  try {
    const sessionIdentifier = await getSessionCookie();

    console.log("[RUNTIME] cookie sessionIdentifier:", sessionIdentifier);

    if (!sessionIdentifier || !normalizeString(sessionIdentifier)) {
      console.log("[RUNTIME] no session cookie");
      return createEmptyRuntimeContext();
    }

    let authContext;

    try {
      authContext = await getSessionContext(sessionIdentifier);
      console.log(
        "[RUNTIME] authContext:",
        JSON.stringify(authContext, null, 2)
      );
    } catch (error) {
      console.error("[RUNTIME] getSessionContext ERROR:", error);
      return createEmptyRuntimeContext();
    }

    if (!authContext.ok || !authContext.session || !authContext.user) {
      console.warn("[RUNTIME] invalid authContext shape");
      return createEmptyRuntimeContext();
    }

    console.log("[RUNTIME] session.id:", authContext.session.id);
    console.log("[RUNTIME] user.id:", authContext.user.id);

    if (!isUuidLike(authContext.session.id) || !isUuidLike(authContext.user.id)) {
      console.error("[RUNTIME] INVALID UUID", {
        sessionId: authContext.session.id,
        userId: authContext.user.id,
      });

      return createEmptyRuntimeContext();
    }

    const runtimeUser = toRuntimeUser({
      id: authContext.user.id,
      display_name: authContext.user.display_name ?? null,
      full_name: authContext.user.full_name ?? null,
      first_name: authContext.user.first_name ?? null,
      last_name: authContext.user.last_name ?? null,
      email: authContext.user.email ?? null,
      document_number: authContext.user.document_number ?? null,
    });

    const platformRoles = await getPlatformRoles(runtimeUser.id);
    const hasMasterAccess = platformRoles.includes(PLATFORM_MASTER_ROLE);
    const activeTenantId = authContext.session.active_tenant_id ?? null;

    console.log("[RUNTIME] activeTenantId:", activeTenantId);

    if (!activeTenantId || !isUuidLike(activeTenantId)) {
      console.warn("[RUNTIME] missing tenant → forcing selection");

      return createAuthenticatedRuntimeContext({
        sessionId: authContext.session.id,
        user: runtimeUser,
        platformRoles,
        requiresTenantSelection: true,
        hasMasterAccess,
      });
    }

    let activeTenant: RuntimeTenant | null = null;
    let membership: RuntimeMembership | null = null;
    let tenantRoles: string[] = [];
    let permissions: string[] = [];
    let modules: string[] = [];
    let navigationFlat: RuntimeNavigationItem[] = [];

    try {
      [
        activeTenant,
        membership,
        tenantRoles,
        permissions,
        modules,
        navigationFlat,
      ] = await Promise.all([
        getTenantById(activeTenantId),
        getActiveMembership(runtimeUser.id, activeTenantId),
        getTenantRoles(runtimeUser.id, activeTenantId),
        getPermissions(runtimeUser.id, activeTenantId),
        getModules(activeTenantId),
        getNavigation(runtimeUser.id, activeTenantId),
      ]);

      console.log("[RUNTIME] tenant scope loaded:", {
        activeTenant,
        membership,
      });
    } catch (error) {
      console.error("[RUNTIME] tenant load ERROR:", error);

      return createAuthenticatedRuntimeContext({
        sessionId: authContext.session.id,
        user: runtimeUser,
        platformRoles,
        requiresTenantSelection: true,
        hasMasterAccess,
      });
    }

    const hasTenantScope = hasConsistentTenantScope({
      user: runtimeUser,
      activeTenant,
      membership,
    });

    console.log("[RUNTIME] hasTenantScope:", hasTenantScope);

    const normalizedTenantRoles = hasTenantScope ? uniqueSorted(tenantRoles) : [];
    const normalizedPermissions = hasTenantScope ? uniqueSorted(permissions) : [];
    const normalizedModules = hasTenantScope ? uniqueSorted(modules) : [];
    const normalizedNavigationFlat = hasTenantScope ? navigationFlat : [];
    const navigation = hasTenantScope
      ? buildNavigationTree(normalizedNavigationFlat)
      : [];

    return createAuthenticatedRuntimeContext({
      sessionId: authContext.session.id,
      user: runtimeUser,
      activeTenant: hasTenantScope ? activeTenant : null,
      membership: hasTenantScope ? membership : null,
      platformRoles,
      tenantRoles: normalizedTenantRoles,
      permissions: normalizedPermissions,
      modules: normalizedModules,
      navigationFlat: normalizedNavigationFlat,
      navigation,
      requiresTenantSelection: !hasTenantScope,
      hasTenantScope,
      hasMasterAccess,
    });
  } catch (error) {
    console.error("[RUNTIME] FATAL ERROR:", error);
    return createEmptyRuntimeContext();
  }
}