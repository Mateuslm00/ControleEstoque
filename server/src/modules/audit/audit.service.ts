import { prisma } from "../../db/prisma.js";

export interface AuditContext {
  actorUserId: string | null;
  ip?: string;
  userAgent?: string;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "tokenHash",
  "token_hash",
  "token",
  "secret",
  "apiKey",
  "cookie",
]);

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  // Prisma.Decimal e outros objetos com toJSON/toString (evita falha de serializacao no Postgres JSON).
  if (typeof value === "object" && typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return (value as { toJSON: () => unknown }).toJSON();
  }
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : redact(v);
    }
    return out;
  }
  return value;
}

export async function recordAudit(
  ctx: AuditContext,
  params: {
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  }
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: ctx.actorUserId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      beforeJson: redact(params.before) as never,
      afterJson: redact(params.after) as never,
      metadataJson: redact(params.metadata) as never,
    },
  });
}

/** Uso especifico para eventos de seguranca: 401/403, tentativa de escalonamento etc. */
export async function recordSecurityEvent(
  ctx: AuditContext,
  action: string,
  metadata?: unknown
): Promise<void> {
  await recordAudit(ctx, {
    action,
    entityType: "security",
    metadata,
  });
}
