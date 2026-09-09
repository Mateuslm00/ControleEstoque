import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";
import { requireAuth, requireRole } from "../auth/auth.plugin.js";
import { recordAudit } from "../audit/audit.service.js";
import { createSaleWithFefo } from "../stock/stock.service.js";
import { renderRomaneioHtml, getRomaneioData } from "../romaneio/romaneio.service.js";
import { assertValidRecipient, queueAndSendEmailJob } from "../email/email.service.js";
import { buildSalesReportXlsx } from "./salesReport.service.js";

const saleItemSchema = z.object({
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
});

const createSaleSchema = z.object({
  docNumber: z.string().min(1).max(60),
  clientId: z.string().uuid(),
  saleDate: z.coerce.date(),
  items: z.array(saleItemSchema).min(1),
});

const sendEmailSchema = z.object({
  recipientEmail: z.string().email(),
});

export const salesRoutes: FastifyPluginAsync = async (app) => {
  const writeGuard = { preHandler: requireRole("ADMIN", "OPERACIONAL") };
  const readGuard = { preHandler: requireAuth };

  app.post("/sales", writeGuard, async (request, reply) => {
    const parsed = createSaleSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados de venda invalidos");

    const sale = await createSaleWithFefo({
      ...parsed.data,
      createdById: request.currentUser!.id,
    });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "SALE_CREATED", entityType: "sale", entityId: sale.id, after: sale }
    );

    return reply.code(201).send({ sale });
  });

  app.get("/sales", readGuard, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        clientId: z.string().uuid().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      })
      .parse(request.query);

    const where = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            saleDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        orderBy: { saleDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { client: true, createdBy: { select: { id: true, name: true } } },
      }),
      prisma.sale.count({ where }),
    ]);

    return reply.send({ items, total, page: query.page, pageSize: query.pageSize });
  });

  app.get("/sales/report", readGuard, async (request, reply) => {
    const query = z
      .object({
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        clientId: z.string().uuid().optional(),
      })
      .parse(request.query);

    // Unica exclusividade de ADMIN no sistema e a aba Usuarios e a troca de
    // senha de outros usuarios (ver users.routes.ts) — todo o resto,
    // incluindo valores de venda, custo e markup deste relatorio, e visivel
    // para qualquer perfil autenticado. O romaneio do cliente (documento
    // que sai da empresa) continua sem custo/markup, sempre — ver
    // romaneio.service.ts.
    const canSeeTotals = true;
    const canSeeCost = true;

    const where = {
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            saleDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { saleDate: "asc" },
      include: {
        client: true,
        items: { include: { material: true, consumptions: true } },
      },
    });

    const fmtPeriodo = (d: Date | undefined) => (d ? d.toLocaleDateString("pt-BR") : null);
    const periodoStr =
      fmtPeriodo(query.dateFrom) || fmtPeriodo(query.dateTo)
        ? `${fmtPeriodo(query.dateFrom) ?? "início"} a ${fmtPeriodo(query.dateTo) ?? "hoje"}`
        : "todo o período";

    const xlsx = await buildSalesReportXlsx(sales, { canSeeTotals, canSeeCost, periodoStr });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "SALES_REPORT_EXPORTED", entityType: "sale", entityId: "report", metadata: { dateFrom: query.dateFrom, dateTo: query.dateTo } }
    );

    reply.header("Content-Disposition", `attachment; filename="relatorio-saidas.xlsx"`);
    reply.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return reply.send(xlsx);
  });

  app.get("/sales/:id", readGuard, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const sale = await getRomaneioData(params.id);
    return reply.send({ sale });
  });

  app.get("/sales/:id/romaneio", readGuard, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const html = await renderRomaneioHtml(params.id);
    reply.type("text/html");
    return reply.send(html);
  });

  app.post(
    "/sales/:id/send-romaneio-email",
    { preHandler: requireRole("ADMIN", "OPERACIONAL"), config: { rateLimit: { max: 10, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const parsed = sendEmailSchema.safeParse(request.body);
      if (!parsed.success) throw Errors.badRequest("Email de destinatario invalido");

      const recipient = assertValidRecipient(parsed.data.recipientEmail);
      const sale = await getRomaneioData(params.id);
      const html = await renderRomaneioHtml(params.id);

      await queueAndSendEmailJob(
        {
          type: "SALE_ROMANEIO",
          entityType: "sale",
          entityId: sale.id,
          recipient,
          subject: `Romaneio ${sale.docNumber}`,
          createdById: request.currentUser!.id,
          context: { saleId: sale.id },
        },
        html
      );

      await prisma.sale.update({ where: { id: sale.id }, data: { recipientEmail: recipient } });

      await recordAudit(
        { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
        { action: "ROMANEIO_EMAIL_SENT", entityType: "sale", entityId: sale.id, metadata: { recipient } }
      );

      return reply.send({ ok: true });
    }
  );
};
