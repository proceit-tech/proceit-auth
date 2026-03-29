/**
 * Tipos centrais do núcleo auth PROCEIT.
 *
 * Regras oficiais atuais:
 * - o cliente transporta `session_id` via cookie httpOnly;
 * - a sessão persistida em banco possui ID estrutural UUID;
 * - o runtime opera sobre session_id / user_id / tenant_id / membership_id;
 * - session_id é o contrato oficial atual entre app e backend;
 * - não serializar contexto, user_id ou tenant_id dentro do cookie.
 */

export type Uuid = string;
export type IsoDateTimeString = string;

export type MembershipStatus =
  | "active"
  | "enabled"
  | "approved"
  | "pending"
  | "suspended"
  | "revoked"
  | "inactive"
  | string;

export type SessionStatus =
  | "active"
  | "expired"
  | "revoked"
  | "locked"
  | "pending"
  | string;

export type SessionUser = {
  id: Uuid;
  document_number: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  display_name: string | null;
  email: string | null;
  is_active?: boolean | null;
};

export type SessionMembership = {
  membership_id: Uuid;
  tenant_id: Uuid;
  user_id?: Uuid | null;
  role_code: string | null;
  status?: MembershipStatus | null;
  is_default?: boolean | null;
  starts_at?: IsoDateTimeString | null;
  ends_at?: IsoDateTimeString | null;
  last_selected_at?: IsoDateTimeString | null;
  metadata?: Record<string, unknown> | null;
};

export type SessionRecord = {
  /**
   * UUID estrutural da sessão persistida.
   * Este é o valor transportado no cookie httpOnly como `session_id`.
   */
  id: Uuid;

  user_id: Uuid;

  /**
   * Tenant ativo no contexto atual da sessão.
   * Campo de runtime/sessão, não substitui memberships.
   */
  active_tenant_id: Uuid | null;

  /**
   * Membership ativa/principal no momento da sessão, quando aplicável.
   * Não substitui a lista de memberships do usuário.
   */
  membership_id?: Uuid | null;

  /**
   * Role principal associada ao contexto ativo da sessão.
   * Não é a fonte única de autorização.
   */
  role_code?: string | null;

  session_status?: SessionStatus | null;
  permissions_version?: number | null;
  expires_at: IsoDateTimeString | null;
  issued_at?: IsoDateTimeString | null;
  last_seen_at: IsoDateTimeString | null;
};

export type AuthContext = {
  ok: boolean;
  code: string;
  message?: string;

  /**
   * Quando `ok = true`, espera-se sessão válida.
   */
  session?: SessionRecord;

  /**
   * Quando `ok = true`, espera-se usuário válido.
   */
  user?: SessionUser;

  /**
   * Memberships conhecidas/retornadas pelo backend para o usuário autenticado.
   */
  memberships?: SessionMembership[];

  /**
   * Campo espelhado de conveniência.
   * A fonte primária continua sendo `session.active_tenant_id`.
   */
  requires_tenant_selection?: boolean;

  /**
   * Campo espelhado de conveniência.
   * A fonte primária continua sendo `session.active_tenant_id`.
   */
  active_tenant_id?: Uuid | null;

  /**
   * Espaço para informações adicionais devolvidas por funções SQL do auth.
   * Não deve substituir os campos principais do contrato.
   */
  context?: Record<string, unknown> | null;
};

export type LoginResult = {
  ok: boolean;
  code: string;
  message?: string;

  /**
   * Contrato oficial do login:
   * - session_id é o identificador retornado ao app;
   * - o cookie httpOnly transporta este valor.
   */
  session_id?: Uuid;

  /**
   * Compatibilidade legada temporária.
   * Não deve ser usada como contrato principal.
   * Manter apenas enquanto existir alguma integração antiga.
   */
  session_token?: string;

  expires_at?: IsoDateTimeString;
  requires_tenant_selection?: boolean;

  /**
   * Campo espelhado de conveniência.
   * Não substitui `session.active_tenant_id` quando houver `session`.
   */
  active_tenant_id?: Uuid | null;

  membership_id?: Uuid | null;
  role_code?: string | null;
  user?: SessionUser;
  memberships?: SessionMembership[];
};

export type RefreshSessionResult = {
  ok: boolean;
  code: string;
  message?: string;
  session?: SessionRecord;
  user?: SessionUser;
  memberships?: SessionMembership[];
  requires_tenant_selection?: boolean;

  /**
   * Campo espelhado de conveniência.
   * A fonte primária continua sendo `session.active_tenant_id`.
   */
  active_tenant_id?: Uuid | null;
};

export type RevokeSessionResult = {
  ok: boolean;
  code: string;
  message?: string;
};

export type AuthEventSeverity =
  | "info"
  | "warning"
  | "error"
  | "critical";

export type AuthEventInput = {
  event_code: string;
  event_type: string;
  severity?: AuthEventSeverity;
  message?: string;
  user_id?: Uuid | null;
  tenant_id?: Uuid | null;
  route?: string | null;
  method?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
};