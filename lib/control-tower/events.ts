import { db } from "@/lib/db/server";
import type {
  AuthEventInput,
  AuthEventSeverity,
} from "@/lib/auth/types";

type ControlTowerEventInput = {
  event_code: string;
  event_type: string;
  severity?: AuthEventSeverity;
  message?: string;
  user_id?: string | null;
  tenant_id?: string | null;
  route?: string | null;
  method?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: Record<string, unknown> | null;
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

function safeSerializeMetadata(
  value: Record<string, unknown> | null | undefined
): string {
  try {
    return JSON.stringify(normalizeMetadata(value));
  } catch {
    return JSON.stringify({
      serialization_error: true,
    });
  }
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

export async function logControlTowerEvent(
  input: ControlTowerEventInput
): Promise<void> {
  try {
    const eventCode = requireNonEmptyString(
      input.event_code,
      "CONTROL_TOWER_EVENT_CODE_REQUIRED"
    );

    const eventType = requireNonEmptyString(
      input.event_type,
      "CONTROL_TOWER_EVENT_TYPE_REQUIRED"
    );

    const occurredAt = normalizeOccurredAt(input.occurred_at);

    await db`
      insert into control_tower.events (
        event_code,
        event_type,
        severity,
        message,
        user_id,
        tenant_id,
        route,
        method,
        ip_address,
        user_agent,
        metadata,
        occurred_at,
        created_at
      )
      values (
        ${eventCode},
        ${eventType},
        ${normalizeSeverity(input.severity)},
        ${normalizeOptionalString(input.message)},
        ${normalizeOptionalUuid(input.user_id)}::uuid,
        ${normalizeOptionalUuid(input.tenant_id)}::uuid,
        ${normalizeOptionalString(input.route)},
        ${normalizeHttpMethod(input.method)},
        ${normalizeOptionalIp(input.ip_address)}::inet,
        ${normalizeOptionalString(input.user_agent)},
        ${safeSerializeMetadata(input.metadata)}::jsonb,
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
  await logControlTowerEvent({
    ...input,
    severity: input.severity ?? "info",
  });
}