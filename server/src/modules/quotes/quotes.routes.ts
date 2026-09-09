import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";
import { requireAuth, requireRole } from "../auth/auth.plugin.js";
import { recordAudit } from "../audit/audit.service.js";

const MIN_QUOTES = 3;
const BIMESTER_DAYS = 60;
const DUE_SOON_DAYS = 10;

const quoteItemSchema = z.object({
  supplierId: z.string().uuid(),
  price: z.coerce.number().positive(),
  notes: z.string().max(300).optional(),
});

const createQuoteSchema = z.object({
  materialId: z.string().uuid(),
  quoteDate: z.coerce.date(),
  items: z.array(quoteItemSchema).min(MIN_QUOTES),
});

function computeStatus(quoteDate: Date | null): "SEM_COTACAO" | "VENCIDA" | "VENCE_EM_BREVE" | "EM_DIA" {
  if (!quoteDate) return "SEM_COTACAO";
  const dueDate = new Date(quoteDate.getTime() + BIMESTER_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLeft < 0) return "VENCIDA";
  if (daysLeft <= DUE_SOON_DAYS) return "VENCE_EM_BREVE";
  return "EM_DIA";
}

export const quotesRoutes: FastifyPluginAsync = async (app) => {
  const writeGuard = { preHandler: requireRole("ADMIN", "OPERACIONAL") };
  const readGuard = { preHandler: requireAuth };

  app.post("/quotes", writeGuard, async (request, reply) => {
    const parsed = createQuoteSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados de cotacao invalidos");

    const { materialId, quoteDate, items } = parsed.data;

    const supplierIds = items.map((i) => i.supplierId);
    if (new Set(supplierIds).size !== supplierIds.length) {
      throw Errors.badRequest("Fornecedores duplicados na mesma cotacao");
    }

    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material || !material.active) throw Errors.unprocessable("Material invalido ou inativo");

    const suppliers = await prisma.supplier.findMany({ where: { id: { in: supplierIds } } });
    if (suppliers.length !== supplierIds.length || suppliers.some((s) => !s.active)) {
      throw Errors.unprocessable("Um ou mais fornecedores invalidos ou inativos");
    }

    const quote = await prisma.quote.create({
      data: {
        materialId,
        quoteDate,
        periodStart: quoteDate,
        periodEnd: new Date(quoteDate.getTime() + BIMESTER_DAYS * 24 * 60 * 60 * 1000),
        createdById: request.currentUser!.id,
        items: { create: items },
      },
      include: { items: true },
    });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "QUOTE_CREATED", entityType: "quote", entityId: quote.id, after: quote }
    );

    return reply.code(201).send({ quote });
  });

  app.get("/quotes/latest", readGuard, async (request, reply) => {
    const quotes = await prisma.quote.findMany({
      orderBy: { quoteDate: "desc" },
      take: 15,
      include: { material: true, items: { include: { supplier: true } } },
    });
    return reply.send({ items: quotes });
  });

  app.get("/quotes/materials/status", readGuard, async (request, reply) => {
    const materials = await prisma.material.findMany({ where: { active: true } });
    const lastQuotes = await prisma.quote.findMany({
      orderBy: { quoteDate: "desc" },
      distinct: ["materialId"],
    });
    const lastByMaterial = new Map(lastQuotes.map((q) => [q.materialId, q]));

    const items = materials.map((m) => {
      const last = lastByMaterial.get(m.id) ?? null;
      return {
        material: m,
        lastQuoteDate: last?.quoteDate ?? null,
        status: computeStatus(last?.quoteDate ?? null),
      };
    });

    const stats = {
      emDia: items.filter((i) => i.status === "EM_DIA").length,
      venceEmBreve: items.filter((i) => i.status === "VENCE_EM_BREVE").length,
      vencidas: items.filter((i) => i.status === "VENCIDA").length,
      semCotacao: items.filter((i) => i.status === "SEM_COTACAO").length,
    };

    return reply.send({ items, stats });
  });

  app.get("/quotes/materials/:materialId/history", readGuard, async (request, reply) => {
    const params = z.object({ materialId: z.string().uuid() }).parse(request.params);
    const items = await prisma.quote.findMany({
      where: { materialId: params.materialId },
      orderBy: { quoteDate: "desc" },
      include: { items: { include: { supplier: true } } },
    });
    return reply.send({ items });
  });
};
