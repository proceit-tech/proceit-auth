

import "server-only";

import { db } from "@/lib/db/server";
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
const RUNTIME_SCOPE = "AUTH_RUNTIME_CONTEXT";

/* =========================
   DEBUG HELPERS
========================= */

type DebugPayload = Record<string, unknown>;

function buildDebugBase() {
  return {
    ts: new Date().toISOString(),
    scope: RUNTIME_SCOPE,
  };
}

function runtimeLog(step: string, payload?: DebugPayload) {
  console.log(
    JSON.stringify({
      ...buildDebugBase(),
      level: "info",
      step,
      ...(payload ?? {}),
    })
  );
}

function runtimeWarn(step: string, payload?: DebugPayload) {
  console.warn(
    JSON.stringify({
      ...buildDebugBase(),
      level: "warn",
      step,
      ...(payload ?? {}),
    })
  );
}

function runtimeError(
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
          : {
              value: String(error),
            },
      ...(payload ?? {}),
    })
  );
}

function summarizeArray(values: unknown[] | null | undefined, max = 10) {
  if (!Array.isArray(values)) {
    return {
      count: 0,
      items: [],
    };
  }

  return {
    count: values.length,
    items: values.slice(0, max),
  };
}

function maskIdentifier(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

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
    runtimeWarn("isActiveMembershipStatus.empty", {
      status,
    });
    return false;
  }

  const result = ACTIVE_MEMBERSHIP_STATUSES.has(normalizedStatus.toLowerCase());

  runtimeLog("isActiveMembershipStatus.evaluated", {
    original_status: status,
    normalized_status: normalizedStatus.toLowerCase(),
    accepted_statuses: Array.from(ACTIVE_MEMBERSHIP_STATUSES),
    result,
  });

  return result;
}

function createEmptyRuntimeContext(
  overrides?: Partial<RuntimeContext>
): RuntimeContext {
  const context: RuntimeContext = {
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

  runtimeLog("createEmptyRuntimeContext.created", {
    authenticated: context.authenticated,
    sessionId: context.sessionId,
    userId: context.user?.id ?? null,
    activeTenantId: context.activeTenant?.id ?? null,
    membershipId: context.membership?.id ?? null,
    requiresTenantSelection: context.requiresTenantSelection,
    hasTenantScope: context.hasTenantScope,
    hasMasterAccess: context.hasMasterAccess,
  });

  return context;
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
  const context = createEmptyRuntimeContext({
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

  runtimeLog("createAuthenticatedRuntimeContext.created", {
    sessionId: context.sessionId,
    userId: context.user?.id ?? null,
    activeTenantId: context.activeTenant?.id ?? null,
    membershipId: context.membership?.id ?? null,
    membershipStatus: context.membership?.status ?? null,
    platformRoles: context.platformRoles,
    tenantRoles: context.tenantRoles,
    permissions_count: context.permissions.length,
    modules_count: context.modules.length,
    navigationFlat_count: context.navigationFlat.length,
    navigation_count: context.navigation.length,
    requiresTenantSelection: context.requiresTenantSelection,
    hasTenantScope: context.hasTenantScope,
    hasMasterAccess: context.hasMasterAccess,
  });

  return context;
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
  const user: RuntimeUser = {
    id: input.id,
    displayName: input.display_name,
    fullName: input.full_name,
    firstName: input.first_name,
    lastName: input.last_name,
    email: input.email,
    documentNumber: input.document_number,
  };

  runtimeLog("toRuntimeUser.mapped", {
    userId: user.id,
    displayName: user.displayName,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    documentNumber: user.documentNumber,
  });

  return user;
}

function hasConsistentTenantScope(params: {
  user: RuntimeUser;
  activeTenant: RuntimeTenant | null;
  membership: RuntimeMembership | null;
}): boolean {
  const { user, activeTenant, membership } = params;

  runtimeLog("hasConsistentTenantScope.start", {
    userId: user?.id ?? null,
    activeTenantId: activeTenant?.id ?? null,
    membershipId: membership?.id ?? null,
    membershipUserId: membership?.userId ?? null,
    membershipTenantId: membership?.tenantId ?? null,
    membershipStatus: membership?.status ?? null,
  });

  if (!activeTenant || !membership) {
    runtimeWarn("hasConsistentTenantScope.missing_required_entities", {
      hasActiveTenant: Boolean(activeTenant),
      hasMembership: Boolean(membership),
    });
    return false;
  }

  if (!isUuidLike(user.id)) {
    runtimeWarn("hasConsistentTenantScope.invalid_user_uuid", {
      userId: user.id,
    });
    return false;
  }

  if (!isUuidLike(activeTenant.id) || !isUuidLike(membership.id)) {
    runtimeWarn("hasConsistentTenantScope.invalid_tenant_or_membership_uuid", {
      activeTenantId: activeTenant.id,
      membershipId: membership.id,
      activeTenantIsUuid: isUuidLike(activeTenant.id),
      membershipIsUuid: isUuidLike(membership.id),
    });
    return false;
  }

  if (!isUuidLike(membership.userId) || !isUuidLike(membership.tenantId)) {
    runtimeWarn("hasConsistentTenantScope.invalid_membership_scope_uuid", {
      membershipUserId: membership.userId,
      membershipTenantId: membership.tenantId,
      membershipUserIdIsUuid: isUuidLike(membership.userId),
      membershipTenantIdIsUuid: isUuidLike(membership.tenantId),
    });
    return false;
  }

  if (membership.userId !== user.id) {
    runtimeWarn("hasConsistentTenantScope.user_mismatch", {
      userId: user.id,
      membershipUserId: membership.userId,
    });
    return false;
  }

  if (membership.tenantId !== activeTenant.id) {
    runtimeWarn("hasConsistentTenantScope.tenant_mismatch", {
      activeTenantId: activeTenant.id,
      membershipTenantId: membership.tenantId,
    });
    return false;
  }

  if (!isActiveMembershipStatus(membership.status)) {
    runtimeWarn("hasConsistentTenantScope.invalid_membership_status", {
      membershipStatus: membership.status,
      acceptedStatuses: Array.from(ACTIVE_MEMBERSHIP_STATUSES),
    });
    return false;
  }

  runtimeLog("hasConsistentTenantScope.success", {
    userId: user.id,
    activeTenantId: activeTenant.id,
    membershipId: membership.id,
    membershipStatus: membership.status,
  });

  return true;
}

/* =========================
   DB HELPERS
========================= */

async function getTenantById(tenantId: string): Promise<RuntimeTenant | null> {
  runtimeLog("getTenantById.start", {
    tenantId,
  });

  const rows = await db<TenantRow[]>`
    select id, name, code
    from core_identity.tenants
    where id = ${tenantId}::uuid
    limit 1
  `;

  runtimeLog("getTenantById.query_result", {
    tenantId,
    rowCount: rows.length,
    firstRow: rows[0] ?? null,
  });

  const row = rows[0] as TenantRow | undefined;

  if (!row) {
    runtimeWarn("getTenantById.not_found", {
      tenantId,
    });
    return null;
  }

  const mapped: RuntimeTenant = {
    id: row.id,
    name: row.name,
    code: row.code,
  };

  runtimeLog("getTenantById.success", {
    tenantId,
    mapped,
  });

  return mapped;
}

async function getActiveMembership(
  userId: string,
  tenantId: string
): Promise<RuntimeMembership | null> {
  runtimeLog("getActiveMembership.start", {
    userId,
    tenantId,
  });

  const rows = await db<ActiveMembershipRow[]>`
    select
      m.membership_id,
      m.user_id,
      m.tenant_id,
      m.role_code,
      m.status,
      coalesce(tm.is_default, false) as is_default
    from core_identity.get_active_membership(
      ${userId}::uuid,
      ${tenantId}::uuid
    ) m
    join core_identity.tenant_memberships tm
      on tm.id = m.membership_id
    limit 1
  `;

  runtimeLog("getActiveMembership.query_result", {
    userId,
    tenantId,
    rowCount: rows.length,
    firstRow: rows[0] ?? null,
  });

  const row = rows[0] as ActiveMembershipRow | undefined;

  if (!row) {
    runtimeWarn("getActiveMembership.not_found", {
      userId,
      tenantId,
    });
    return null;
  }

  const mapped: RuntimeMembership = {
    id: row.membership_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    roleCode: row.role_code,
    status: row.status,
    isDefault: row.is_default,
  };

  runtimeLog("getActiveMembership.success", {
    userId,
    tenantId,
    membershipId: mapped.id,
    membershipStatus: mapped.status,
    roleCode: mapped.roleCode,
    isDefault: mapped.isDefault,
    mapped,
  });

  return mapped;
}

async function getPlatformRoles(userId: string): Promise<string[]> {
  runtimeLog("getPlatformRoles.start", {
    userId,
  });

  const rows = await db<PlatformRoleRow[]>`
    select distinct r.code as role_code
    from core_rbac.user_platform_roles upr
    join core_rbac.roles r on r.id = upr.role_id
    where upr.user_id = ${userId}::uuid
      and upr.is_active = true
      and r.is_active = true
    order by r.code asc
  `;

  const normalized = uniqueSorted(
    rows.map((row: PlatformRoleRow) => row.role_code)
  );

  runtimeLog("getPlatformRoles.success", {
    userId,
    rowCount: rows.length,
    roles: normalized,
  });

  return normalized;
}

async function getTenantRoles(
  userId: string,
  tenantId: string
): Promise<string[]> {
  runtimeLog("getTenantRoles.start", {
    userId,
    tenantId,
  });

  const rows = await db<TenantRoleRow[]>`
    select distinct role_code
    from core_rbac.v_membership_permissions
    where user_id = ${userId}::uuid
      and tenant_id = ${tenantId}::uuid
  `;

  const normalized = uniqueSorted(
    rows.map((row: TenantRoleRow) => row.role_code)
  );

  runtimeLog("getTenantRoles.success", {
    userId,
    tenantId,
    rowCount: rows.length,
    roles: normalized,
  });

  return normalized;
}

async function getPermissions(
  userId: string,
  tenantId: string
): Promise<string[]> {
  runtimeLog("getPermissions.start", {
    userId,
    tenantId,
  });

  const rows = await db<PermissionRow[]>`
    select permission_code
    from core_rbac.get_membership_permission_codes(
      ${userId}::uuid,
      ${tenantId}::uuid
    )
  `;

  const normalized = uniqueSorted(
    rows.map((row: PermissionRow) => row.permission_code)
  );

  runtimeLog("getPermissions.success", {
    userId,
    tenantId,
    rowCount: rows.length,
    permissions_count: normalized.length,
    permissions_preview: normalized.slice(0, 20),
  });

  return normalized;
}

/**
 * Observação:
 * este helper mantém a regra atual de módulos ativos por tenant.
 * Se a regra oficial passar a exigir interseção direta por usuário,
 * este método deve ser substituído por uma função baseada em membership.
 */
async function getModules(tenantId: string): Promise<string[]> {
  runtimeLog("getModules.start", {
    tenantId,
  });

  const rows = await db<ModuleRow[]>`
    select module_code
    from core_catalog.get_tenant_module_codes(${tenantId}::uuid)
  `;

  const normalized = uniqueSorted(
    rows.map((row: ModuleRow) => row.module_code)
  );

  runtimeLog("getModules.success", {
    tenantId,
    rowCount: rows.length,
    modules_count: normalized.length,
    modules: normalized,
  });

  return normalized;
}

async function getNavigation(
  userId: string,
  tenantId: string
): Promise<RuntimeNavigationItem[]> {
  runtimeLog("getNavigation.start", {
    userId,
    tenantId,
  });

  const rows = await db<NavigationRow[]>`
    select *
    from core_navigation.get_navigation_for_membership(
      ${userId}::uuid,
      ${tenantId}::uuid
    )
  `;

  const mapped: RuntimeNavigationItem[] = rows.map((row: NavigationRow) => ({
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

  runtimeLog("getNavigation.success", {
    userId,
    tenantId,
    rowCount: rows.length,
    navigation_count: mapped.length,
    navigation_preview: mapped.slice(0, 20),
  });

  return mapped;
}

/* =========================
   MAIN FUNCTION
========================= */

export async function getRuntimeContext(): Promise<RuntimeContext> {
  runtimeLog("getRuntimeContext.start", {
    nodeEnv: process.env.NODE_ENV ?? null,
  });

  try {
    const sessionIdentifier = await getSessionCookie();

    runtimeLog("getRuntimeContext.cookie_read", {
      sessionIdentifier_present: Boolean(sessionIdentifier),
      sessionIdentifier_masked: maskIdentifier(sessionIdentifier),
      sessionIdentifier_length: sessionIdentifier?.length ?? 0,
    });

    if (!sessionIdentifier || !normalizeString(sessionIdentifier)) {
      runtimeWarn("getRuntimeContext.no_session_cookie", {
        sessionIdentifier,
      });

      return createEmptyRuntimeContext();
    }

    let authContext;

    try {
      runtimeLog("getRuntimeContext.session_context_resolve_start", {
        sessionIdentifier_masked: maskIdentifier(sessionIdentifier),
      });

      authContext = await getSessionContext(sessionIdentifier);

      runtimeLog("getRuntimeContext.session_context_resolve_success", {
        authContext_ok: authContext?.ok ?? null,
        authContext_code: authContext?.code ?? null,
        sessionId: authContext?.session?.id ?? null,
        activeTenantId: authContext?.session?.active_tenant_id ?? null,
        userId: authContext?.user?.id ?? null,
        memberships_count: Array.isArray(authContext?.memberships)
          ? authContext.memberships.length
          : 0,
        authContext_snapshot: authContext,
      });
    } catch (error) {
      runtimeError("getRuntimeContext.session_context_resolve_error", error, {
        sessionIdentifier_masked: maskIdentifier(sessionIdentifier),
      });

      return createEmptyRuntimeContext();
    }

    if (!authContext?.ok || !authContext.session || !authContext.user) {
      runtimeWarn("getRuntimeContext.invalid_auth_context_shape", {
        authContext_ok: authContext?.ok ?? null,
        authContext_code: authContext?.code ?? null,
        hasSession: Boolean(authContext?.session),
        hasUser: Boolean(authContext?.user),
        authContext_snapshot: authContext,
      });

      return createEmptyRuntimeContext();
    }

    runtimeLog("getRuntimeContext.auth_context_validated", {
      sessionId: authContext.session.id,
      activeTenantId: authContext.session.active_tenant_id ?? null,
      userId: authContext.user.id,
      userEmail: authContext.user.email ?? null,
      userDisplayName: authContext.user.display_name ?? null,
    });

    if (!isUuidLike(authContext.session.id) || !isUuidLike(authContext.user.id)) {
      runtimeWarn("getRuntimeContext.invalid_uuid_contract", {
        sessionId: authContext.session.id,
        userId: authContext.user.id,
        sessionIdIsUuid: isUuidLike(authContext.session.id),
        userIdIsUuid: isUuidLike(authContext.user.id),
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

    runtimeLog("getRuntimeContext.identity_layer_ready", {
      sessionId: authContext.session.id,
      userId: runtimeUser.id,
      activeTenantId,
      platformRoles,
      hasMasterAccess,
    });

    if (!activeTenantId || !isUuidLike(activeTenantId)) {
      runtimeWarn("getRuntimeContext.missing_or_invalid_active_tenant", {
        sessionId: authContext.session.id,
        userId: runtimeUser.id,
        activeTenantId,
        activeTenantIdIsUuid: isUuidLike(activeTenantId),
      });

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
      runtimeLog("getRuntimeContext.tenant_scope_loading_start", {
        sessionId: authContext.session.id,
        userId: runtimeUser.id,
        activeTenantId,
      });

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

      runtimeLog("getRuntimeContext.tenant_scope_loading_success", {
        sessionId: authContext.session.id,
        userId: runtimeUser.id,
        activeTenantId,
        activeTenant,
        membership,
        tenantRoles,
        permissions_count: permissions.length,
        permissions_preview: permissions.slice(0, 20),
        modules,
        navigationFlat_count: navigationFlat.length,
        navigationFlat_preview: navigationFlat.slice(0, 20),
      });
    } catch (error) {
      runtimeError("getRuntimeContext.tenant_scope_loading_error", error, {
        sessionId: authContext.session.id,
        userId: runtimeUser.id,
        activeTenantId,
      });

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

    runtimeLog("getRuntimeContext.tenant_scope_evaluated", {
      sessionId: authContext.session.id,
      userId: runtimeUser.id,
      activeTenantId: activeTenant?.id ?? null,
      membershipId: membership?.id ?? null,
      membershipStatus: membership?.status ?? null,
      membershipUserId: membership?.userId ?? null,
      membershipTenantId: membership?.tenantId ?? null,
      hasTenantScope,
    });

    const normalizedTenantRoles = hasTenantScope ? uniqueSorted(tenantRoles) : [];
    const normalizedPermissions = hasTenantScope ? uniqueSorted(permissions) : [];
    const normalizedModules = hasTenantScope ? uniqueSorted(modules) : [];
    const normalizedNavigationFlat = hasTenantScope ? navigationFlat : [];
    const navigation = hasTenantScope
      ? buildNavigationTree(normalizedNavigationFlat)
      : [];

    runtimeLog("getRuntimeContext.navigation_built", {
      hasTenantScope,
      tenantRoles: normalizedTenantRoles,
      permissions_count: normalizedPermissions.length,
      modules_count: normalizedModules.length,
      navigationFlat_count: normalizedNavigationFlat.length,
      navigation_count: navigation.length,
      navigation_tree_preview: summarizeArray(navigation as unknown[]),
    });

    const finalContext = createAuthenticatedRuntimeContext({
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

    runtimeLog("getRuntimeContext.final_context_ready", {
      authenticated: finalContext.authenticated,
      sessionId: finalContext.sessionId,
      userId: finalContext.user?.id ?? null,
      activeTenantId: finalContext.activeTenant?.id ?? null,
      membershipId: finalContext.membership?.id ?? null,
      membershipStatus: finalContext.membership?.status ?? null,
      requiresTenantSelection: finalContext.requiresTenantSelection,
      hasTenantScope: finalContext.hasTenantScope,
      hasMasterAccess: finalContext.hasMasterAccess,
      platformRoles: finalContext.platformRoles,
      tenantRoles: finalContext.tenantRoles,
      permissions_count: finalContext.permissions.length,
      modules_count: finalContext.modules.length,
      navigation_count: finalContext.navigation.length,
    });

    return finalContext;
  } catch (error) {
    runtimeError("getRuntimeContext.fatal_error", error);
    return createEmptyRuntimeContext();
  }
}