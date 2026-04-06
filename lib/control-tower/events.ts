import { db } from "@/lib/db/server";
import type {
  AuthEventInput,
  AuthEventSeverity,
} from "@/lib/auth/types";

type ControlTowerEventStatus =
  | "success"
  | "failed"
  | "error"
  | "warning"
  | "pending";

type ControlTowerEventInput = {
  /**
   * Identidade oficial do evento.
   */
  event_code?: string | null;
  event_type: string;

  /**
   * Classificação operacional.
   */
  severity?: AuthEventSeverity;
  status?: ControlTowerEventStatus | string | null;

  /**
   * Mensagem / apresentação.
   */
  message?: string | null;
  title?: string | null;

  /**
   * Identidade contextual.
   */
  user_id?: string | null;
  tenant_id?: string | null;
  session_id?: string | null;

  /**
   * Origem da requisição / execução.
   */
  route?: string | null;
  method?: string | null;
  source?: string | null;

  /**
   * Telemetria de cliente / rede.
   */
  ip_address?: string | null;
  user_agent?: string | null;
  fingerprint?: string | null;
  trace_id?: string | null;

  /**
   * Contexto de domínio.
   */
  product_code?: string | null;
  module_code?: string | null;

  /**
   * Dados adicionais.
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Momento explícito do evento.
   */
  occurred_at?: string | Date | null;
};

const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);

function normalizeOptionalString(
  value: string | null | undefined
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function requireNonEmptyString(
  value: string | null | undefined,
  errorCode: string
): string {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    throw new Error(errorCode);
  }

  return normalized;
}

function normalizeSeverity(
  value: AuthEventSeverity | undefined
): AuthEventSeverity {
  return value ?? "info";
}

function normalizeMetadata(
  value: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return value ?? {};
}

function isUuidLike(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function normalizeOptionalUuid(
  value: string | null | undefined
): string | null {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  return isUuidLike(normalized) ? normalized : null;
}

function isIpv4Like(value: string): boolean {
  const normalized = value.trim();

  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  return ipv4.test(normalized);
}

function isIpv6Like(value: string): boolean {
  const normalized = value.trim();

  const ipv6 =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

  return ipv6.test(normalized);
}

function extractFirstForwardedIp(
  value: string | null | undefined
): string | null {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  const first = normalized.split(",")[0]?.trim() ?? "";
  return first.length > 0 ? first : null;
}

function normalizeOptionalIp(
  value: string | null | undefined
): string | null {
  const firstIp = extractFirstForwardedIp(value);

  if (!firstIp) {
    return null;
  }

  if (isIpv4Like(firstIp) || isIpv6Like(firstIp)) {
    return firstIp;
  }

  return null;
}

function normalizeHttpMethod(
  value: string | null | undefined
): string | null {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  const upper = normalized.toUpperCase();

  if (HTTP_METHODS.has(upper)) {
    return upper;
  }

  return upper;
}

function normalizeOccurredAt(
  value: string | Date | null | undefined
): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferProductCode(input: ControlTowerEventInput): string {
  return normalizeOptionalString(input.product_code) ?? "auth";
}

function inferModuleCode(input: ControlTowerEventInput): string {
  return normalizeOptionalString(input.module_code) ?? "identity";
}

function inferSource(input: ControlTowerEventInput): string {
  const explicitSource = normalizeOptionalString(input.source);

  if (explicitSource) {
    return explicitSource;
  }

  const method = normalizeHttpMethod(input.method);
  const route = normalizeOptionalString(input.route);

  if (method && route) {
    return `api:${method} ${route}`;
  }

  if (route) {
    return `api:${route}`;
  }

  return "runtime:node";
}

function inferTitle(input: ControlTowerEventInput): string {
  return (
    normalizeOptionalString(input.title) ??
    normalizeOptionalString(input.event_code) ??
    input.event_type
  );
}

function inferFingerprint(input: ControlTowerEventInput): string | null {
  const explicitFingerprint = normalizeOptionalString(input.fingerprint);

  if (explicitFingerprint) {
    return explicitFingerprint;
  }

  const eventCode = normalizeOptionalString(input.event_code);
  const route = normalizeOptionalString(input.route);
  const method = normalizeHttpMethod(input.method);

  if (eventCode && method && route) {
    return `${eventCode}:${method}:${route}`;
  }

  if (eventCode && route) {
    return `${eventCode}:${route}`;
  }

  return eventCode ?? input.event_type;
}

function inferStatus(input: {
  explicitStatus?: string | null;
  severity: AuthEventSeverity;
  eventCode?: string | null;
  eventType: string;
}): ControlTowerEventStatus {
  const explicit = normalizeOptionalString(input.explicitStatus);

  if (
    explicit === "success" ||
    explicit === "failed" ||
    explicit === "error" ||
    explicit === "warning" ||
    explicit === "pending"
  ) {
    return explicit;
  }

  const code = (input.eventCode ?? "").toLowerCase();
  const type = input.eventType.toLowerCase();

  if (
    code.includes(".success") ||
    code.includes("_success") ||
    type.includes("success")
  ) {
    return "success";
  }

  if (
    code.includes(".failed") ||
    code.includes("_failed") ||
    type.includes("failed")
  ) {
    return "failed";
  }

  if (
    code.includes(".error") ||
    code.includes("_error") ||
    type.includes("error")
  ) {
    return "error";
  }

  if (input.severity === "warning") {
    return "warning";
  }

  if (input.severity === "error" || input.severity === "critical") {
    return "error";
  }

  return "success";
}

function extractMetadataSessionId(
  metadata: Record<string, unknown>
): string | null {
  const value = metadata.session_id;

  if (typeof value !== "string") {
    return null;
  }

  return isUuidLike(value) ? value : null;
}

function extractTraceId(
  input: ControlTowerEventInput,
  metadata: Record<string, unknown>
): string | null {
  const explicitTraceId = normalizeOptionalString(input.trace_id);

  if (explicitTraceId) {
    return explicitTraceId;
  }

  const metadataTraceId = metadata.trace_id;
  if (typeof metadataTraceId === "string") {
    const normalized = normalizeOptionalString(metadataTraceId);
    if (normalized) {
      return normalized;
    }
  }

  const metadataRequestId = metadata.request_id;
  if (typeof metadataRequestId === "string") {
    const normalized = normalizeOptionalString(metadataRequestId);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function buildPayload(
  input: ControlTowerEventInput
): Record<string, unknown> {
  const metadata = normalizeMetadata(input.metadata);

  return {
    event_code: normalizeOptionalString(input.event_code),
    event_type: normalizeOptionalString(input.event_type),
    route: normalizeOptionalString(input.route),
    method: normalizeHttpMethod(input.method),
    ip_address: normalizeOptionalIp(input.ip_address),
    user_agent: normalizeOptionalString(input.user_agent),
    source: normalizeOptionalString(input.source),
    trace_id: normalizeOptionalString(input.trace_id),
    fingerprint: normalizeOptionalString(input.fingerprint),
    metadata,
  };
}

function buildAuthControlTowerInput(
  input: AuthEventInput
): ControlTowerEventInput {
  const metadata = normalizeMetadata(input.metadata);

  const normalizedSessionId =
    normalizeOptionalUuid(input.session_id) ??
    extractMetadataSessionId(metadata);

  return {
    event_code: input.event_code,
    event_type: input.event_type,

    severity: input.severity ?? "info",
    status: input.status ?? null,

    message: input.message ?? null,
    title: input.title ?? null,

    user_id: normalizeOptionalUuid(input.user_id),
    tenant_id: normalizeOptionalUuid(input.tenant_id),
    session_id: normalizedSessionId,

    route: input.route ?? null,
    method: input.method ?? null,
    source: input.source ?? null,

    ip_address: input.ip_address ?? null,
    user_agent: input.user_agent ?? null,
    fingerprint: input.fingerprint ?? null,
    trace_id: input.trace_id ?? null,

    /**
     * Auth events sempre caem no produto/módulo oficial.
     * Não aceitar sobrescrita externa aqui para manter governança.
     */
    product_code: "auth",
    module_code: "identity",

    metadata,
    occurred_at: null,
  };
}

export async function logControlTowerEvent(
  input: ControlTowerEventInput
): Promise<void> {
  try {
    const eventType = requireNonEmptyString(
      input.event_type,
      "CONTROL_TOWER_EVENT_TYPE_REQUIRED"
    );

    const eventCode = normalizeOptionalString(input.event_code);
    const severity = normalizeSeverity(input.severity);
    const occurredAt = normalizeOccurredAt(input.occurred_at);
    const metadata = normalizeMetadata(input.metadata);
    const payload = buildPayload(input);

    const sessionId =
      normalizeOptionalUuid(input.session_id) ??
      extractMetadataSessionId(metadata);

    await db`
      insert into control_tower.events (
        tenant_id,
        user_id,
        product_code,
        module_code,
        event_type,
        severity,
        status,
        source,
        title,
        message,
        fingerprint,
        trace_id,
        session_id,
        payload,
        event_at,
        created_at
      )
      values (
        ${normalizeOptionalUuid(input.tenant_id)}::uuid,
        ${normalizeOptionalUuid(input.user_id)}::uuid,
        ${inferProductCode(input)},
        ${inferModuleCode(input)},
        ${eventType},
        ${severity},
        ${inferStatus({
          explicitStatus: input.status,
          severity,
          eventCode,
          eventType,
        })},
        ${inferSource(input)},
        ${inferTitle(input)},
        ${normalizeOptionalString(input.message)},
        ${inferFingerprint(input)},
        ${extractTraceId(input, metadata)},
        ${sessionId}::uuid,
        ${JSON.stringify(payload)}::jsonb,
        ${occurredAt ?? new Date()},
        now()
      )
    `;
  } catch (error) {
    console.error("CONTROL_TOWER_EVENT_ERROR", {
      event_code: normalizeOptionalString(input.event_code),
      event_type: normalizeOptionalString(input.event_type),
      severity: input.severity ?? "info",
      route: normalizeOptionalString(input.route),
      method: normalizeHttpMethod(input.method),
      user_id: normalizeOptionalUuid(input.user_id),
      tenant_id: normalizeOptionalUuid(input.tenant_id),
      session_id: normalizeOptionalUuid(input.session_id),
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : {
              name: "UnknownError",
              message: "Unknown control tower event error",
            },
    });
  }
}

export async function logAuthEvent(input: AuthEventInput): Promise<void> {
  const controlTowerInput = buildAuthControlTowerInput(input);
  await logControlTowerEvent(controlTowerInput);
}