import { Resend } from "resend";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { Errors } from "../../shared/errors/AppError.js";
import type { EmailJobType } from "@prisma/client";

const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** Bloqueia header injection: quebras de linha e tentativa de manipular cabecalhos. */
function sanitizeHeaderValue(value: string): string {
  if (/[\r\n]/.test(value)) {
    throw Errors.badRequest("Valor de email contem caracteres invalidos");
  }
  if (/\b(bcc|cc|to)\s*:/i.test(value)) {
    throw Errors.badRequest("Valor de email contem cabecalho nao permitido");
  }
  return value.trim();
}

export function assertValidRecipient(email: string): string {
  const clean = sanitizeHeaderValue(email);
  if (!EMAIL_REGEX.test(clean)) {
    throw Errors.badRequest("Email de destinatario invalido");
  }
  return clean;
}

const resendClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

/** Apenas cria o registro em email_jobs (PENDING). Nao envia — chame sendEmailJob em seguida. */
export async function queueEmailJob(params: {
  type: EmailJobType;
  entityType: string;
  entityId: string;
  recipient: string;
  subject: string;
  createdById: string;
  context: Record<string, unknown>;
}) {
  const recipient = assertValidRecipient(params.recipient);
  const subject = sanitizeHeaderValue(params.subject);

  const job = await prisma.emailJob.create({
    data: {
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      recipient,
      subject,
      status: "PENDING",
      createdById: params.createdById,
    },
  });

  return job;
}

/** Cria o job e envia imediatamente em sequencia (fluxo sincrono simples). */
export async function queueAndSendEmailJob(
  params: Parameters<typeof queueEmailJob>[0],
  htmlOverride?: string
) {
  const job = await queueEmailJob(params);
  await sendEmailJob(job.id, params.context, htmlOverride);
  return job;
}

async function renderHtml(type: EmailJobType, context: Record<string, unknown>): Promise<string> {
  const { escapeHtml } = await import("../romaneio/htmlEscape.js");
  if (type === "STOCK_ENTRY_FINANCE") {
    return `<p>Nova entrada de estoque registrada. ID: ${escapeHtml(String(context.entryId ?? ""))}</p>`;
  }
  // SALE_ROMANEIO usa o template dedicado do modulo romaneio.
  return `<p>${escapeHtml(JSON.stringify(context))}</p>`;
}

export async function sendEmailJob(jobId: string, context: Record<string, unknown>, htmlOverride?: string) {
  const job = await prisma.emailJob.findUnique({ where: { id: jobId } });
  if (!job) throw Errors.notFound("Job de email nao encontrado");

  try {
    const html = htmlOverride ?? (await renderHtml(job.type, context));

    if (env.EMAIL_MODE === "dev" || !resendClient) {
      // eslint-disable-next-line no-console
      console.log(`[email-dev] to=${job.recipient} subject="${job.subject}"`);
    } else {
      const result = await resendClient.emails.send({
        from: env.EMAIL_FROM,
        to: job.recipient,
        subject: job.subject,
        html,
      });
      if (result.error) throw new Error(result.error.message);
    }

    await prisma.emailJob.update({
      where: { id: jobId },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 } },
    });
  } catch (err) {
    // Nunca expor erro bruto do provedor: guarda so uma mensagem segura.
    await prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastErrorSafe: "Falha ao enviar email. Verifique o provedor configurado.",
      },
    });
    throw err;
  }
}
