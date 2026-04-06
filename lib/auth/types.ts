/**
 * Tipos centrais do núcleo auth PROCEIT.
 *
 * Regras oficiais atuais:
 * - o cliente transporta `session_token` via cookie httpOnly;
 * - a sessão persistida em banco possui ID estrutural UUID (`session_id`);
 * - o runtime opera internamente sobre session_id / user_id / tenant_id / membership_id;
 * - session_token é o contrato oficial atual entre browser e backend;
 * - session_id permanece como identificador estrutural interno e de observabilidade;
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
   */
  id: Uuid;

  user_id: Uuid;

  active_tenant_id: Uuid | null;

  membership_id?: Uuid | null;

  role_code?: string | null;

  session_status?: SessionStatus | null;
  permissions_version?: number | null;

  expires_at: IsoDateTimeString | null;
  issued_at?: IsoDateTimeString | null;
  last_seen_at: IsoDateTimeString | null;
};

export type AuthContextSuccess = {
  ok: true;
  code: string;
  message?: string;
  session: SessionRecord;
  user: SessionUser;
  memberships?: SessionMembership[];
  requires_tenant_selection?: boolean;
  active_tenant_id?: Uuid | null;
  context?: Record<string, unknown> | null;
};

export type AuthContextFailure = {
  ok: false;
  code: string;
  message?: string;
  session?: SessionRecord;
  user?: SessionUser;
  memberships?: SessionMembership[];
  requires_tenant_selection?: boolean;
  active_tenant_id?: Uuid | null;
  context?: Record<string, unknown> | null;
};

export type AuthContext = AuthContextSuccess | AuthContextFailure;

export type LoginResult = {
  ok: boolean;
  code: string;
  message?: string;

  session_id?: Uuid;

  session_token?: string | null;
  refresh_token?: string | null;

  expires_at?: IsoDateTimeString | null;
  refresh_expires_at?: IsoDateTimeString | null;

  requires_tenant_selection?: boolean;

  active_tenant_id?: Uuid | null;

  membership_id?: Uuid | null;
  role_code?: string | null;

  session?: SessionRecord | null;

  user?: SessionUser | null;
  memberships?: SessionMembership[];
  context?: Record<string, unknown> | null;
};

export type RefreshSessionResult = {
  ok: boolean;
  code: string;
  message?: string;

  session?: SessionRecord;

  user?: SessionUser;
  memberships?: SessionMembership[];
  requires_tenant_selection?: boolean;

  active_tenant_id?: Uuid | null;

  session_token?: string | null;
  refresh_token?: string | null;
  refresh_expires_at?: IsoDateTimeString | null;
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

export type AuthEventStatus =
  | "success"
  | "failed"
  | "error"
  | "warning"
  | "pending";

export type AuthEventMetadata = Record<string, unknown> | null;

/**
 * Contrato oficial de eventos de auth / observabilidade.
 *
 * Este tipo é o ponto central entre:
 * - rotas auth
 * - session lifecycle
 * - audit log
 * - Control Tower
 *
 * Regras:
 * - `event_code` e `event_type` são obrigatórios;
 * - `session_id` é o identificador estrutural;
 * - `session_token` nunca deve ser persistido;
 * - campos críticos devem existir como colunas (não só metadata);
 * - metadata é complementar, não substituto de colunas.
 */
export type AuthEventInput = {
  /**
   * Identidade do evento
   */
  event_code: string;
  event_type: string;

  /**
   * Classificação
   */
  severity?: AuthEventSeverity;
  status?: AuthEventStatus;

  /**
   * Mensagem e apresentação
   */
  message?: string;
  title?: string | null;

  /**
   * Identidade
   */
  user_id?: Uuid | null;
  tenant_id?: Uuid | null;
  session_id?: Uuid | null;

  /**
   * Origem HTTP / runtime
   */
  route?: string | null;
  method?: string | null;
  source?: string | null;

  /**
   * Telemetria de cliente
   */
  ip_address?: string | null;
  user_agent?: string | null;
  fingerprint?: string | null;

  /**
   * Observabilidade distribuída
   */
  trace_id?: string | null;

  /**
   * Contexto de domínio (sobrescrito no runtime)
   */
  product_code?: string | null;
  module_code?: string | null;

  /**
   * Dados adicionais
   */
  metadata?: AuthEventMetadata;
};