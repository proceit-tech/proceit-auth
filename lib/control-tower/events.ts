import { db } from "@/lib/db/server";
import type {
  AuthEventInput,
  AuthEventSeverity,
} from "@/lib/auth/types";

type ControlTowerEventInput = {
  event_code?: string | null;
  event_type: string;
  severity?: AuthEventSeverity;
  message?: string | null;

  user_id?: string | null;
  tenant_id?: string | null;

  route?: string | null;
  method?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;

  metadata?: Record<string, unknown> | null;
  occurred_at?: string | Date | null;

  product_code?: string | null;
  module_code?: string | null;
  status?: string | null;
  source?: string | null;
  title?: string | null;
  fingerprint?: string | null;
  trace_id?: string | null;
  session_id?: string | null;
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

function isIpLike(value: string): boolean {
  const normalized = value.trim();

  const ipv4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

  const ipv6 =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;

  return ipv4.test(normalized) || ipv6.test(normalized);
}

function normalizeOptionalIp(
  value: string | null | undefined
): string | null {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  return isIpLike(normalized) ? normalized : null;
}

function normalizeHttpMethod(
  value: string | null | undefined
): string | null {
  const normalized = normalizeOptionalString(value);

  if (!normalized) {
    return null;
  }

  const upper = normalized.toUpperCase();
  return HTTP_METHODS.has(upper) ? upper : upper;
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
}): string {
  const explicit = normalizeOptionalString(input.explicitStatus);

  if (explicit) {
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
    route: normalizeOptionalString(input.route),
    method: normalizeHttpMethod(input.method),
    ip_address: normalizeOptionalIp(input.ip_address),
    user_agent: normalizeOptionalString(input.user_agent),
    metadata,
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
  const metadata = normalizeMetadata(input.metadata);

  await logControlTowerEvent({
    ...input,
    severity: input.severity ?? "info",
    product_code: "auth",
    module_code: "identity",
    session_id:
      typeof metadata.session_id === "string"
        ? metadata.session_id
        : null,
  });
}