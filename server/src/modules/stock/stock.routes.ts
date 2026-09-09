import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";
import { requireAuth, requireRole } from "../auth/auth.plugin.js";
import { recordAudit } from "../audit/audit.service.js";
import { createStockEntry } from "./stock.service.js";
import { queueAndSendEmailJob } from "../email/email.service.js";
import { env } from "../../config/env.js";

const entryItemSchema = z.object({
  materialId: z.string().uuid(),
  lotNumber: z.string().min(1).max(60),
  expiresAt: z.coerce.date(),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().nonnegative(),
});

const createEntrySchema = z.object({
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().min(1).max(60),
  entryDate: z.coerce.date(),
  items: z.array(entryItemSchema).min(1),
});

export const stockRoutes: FastifyPluginAsync = async (app) => {
  const writeGuard = { preHandler: requireRole("ADMIN", "OPERACIONAL") };
  const readGuard = { preHandler: requireAuth };

  app.post("/stock/entries", writeGuard, async (request, reply) => {
    const parsed = createEntrySchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados de entrada de estoque invalidos");

    const entry = await createStockEntry({
      ...parsed.data,
      createdById: request.currentUser!.id,
    });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "STOCK_ENTRY_CREATED", entityType: "stock_entry", entityId: entry.id, after: entry }
    );

    if (env.FINANCE_EMAIL) {
      await queueAndSendEmailJob({
        type: "STOCK_ENTRY_FINANCE",
        entityType: "stock_entry",
        entityId: entry.id,
        recipient: env.FINANCE_EMAIL,
        subject: `Nova entrada de estoque - NF ${entry.invoiceNumber}`,
        createdById: request.currentUser!.id,
        context: { entryId: entry.id },
      });
    }

    return reply.code(201).send({ entry });
  });

  app.get("/stock/current", readGuard, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        materialId: z.string().uuid().optional(),
      })
      .parse(request.query);

    const grouped = await prisma.stockLot.groupBy({
      by: ["materialId"],
      where: { status: "ACTIVE", ...(query.materialId ? { materialId: query.materialId } : {}) },
      _sum: { currentQuantity: true },
      orderBy: { materialId: "asc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });

    const materials = await prisma.material.findMany({
      where: { id: { in: grouped.map((g) => g.materialId) } },
    });
    const materialMap = new Map(materials.map((m) => [m.id, m]));

    const items = grouped.map((g) => ({
      material: materialMap.get(g.materialId),
      currentQuantity: g._sum.currentQuantity,
    }));

    return reply.send({ items, page: query.page, pageSize: query.pageSize });
  });

  app.get("/stock/lots", readGuard, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        materialId: z.string().uuid().optional(),
        status: z.enum(["ACTIVE", "DEPLETED", "BLOCKED"]).optional(),
      })
      .parse(request.query);

    const where = {
      ...(query.materialId ? { materialId: query.materialId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.stockLot.findMany({
        where,
        orderBy: { expiresAt: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { material: true, supplier: true },
      }),
      prisma.stockLot.count({ where }),
    ]);

    return reply.send({ items, total, page: query.page, pageSize: query.pageSize });
  });

  app.get("/reports/stock-entries", readGuard, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        materialId: z.string().uuid().optional(),
        supplierId: z.string().uuid().optional(),
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
      })
      .parse(request.query);

    const where = {
      ...(query.supplierId ? { supplierId: query.supplierId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            entryDate: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
      ...(query.materialId ? { items: { some: { materialId: query.materialId } } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        orderBy: { entryDate: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          supplier: true,
          createdBy: { select: { id: true, name: true } },
          items: { include: { material: true } },
        },
      }),
      prisma.stockEntry.count({ where }),
    ]);

    return reply.send({ items, total, page: query.page, pageSize: query.pageSize });
  });
};
