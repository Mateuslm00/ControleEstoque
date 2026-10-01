import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";
import { requireAuth, requireRole } from "../auth/auth.plugin.js";
import { recordAudit } from "../audit/audit.service.js";
import { resolveSort, resolveDirection } from "../../shared/validation/sort.js";

const SORT_ALLOWLIST = ["name", "sku", "createdAt", "minStock"] as const;

const createSchema = z.object({
  name: z.string().min(1).max(160),
  brand: z.string().max(120).optional(),
  sku: z.string().trim().min(1).max(60),
  unit: z.string().min(1).max(20),
  type: z.string().max(80).optional(),
  group: z.string().max(80).optional(),
  markup: z.coerce.number().min(0).max(1000).default(30),
  minStock: z.coerce.number().min(0).default(0),
});

const updateSchema = createSchema.partial().extend({
  brand: z.string().max(120).nullable().optional(),
  type: z.string().max(80).nullable().optional(),
  group: z.string().max(80).nullable().optional(),
  active: z.boolean().optional(),
});

export const materialsRoutes: FastifyPluginAsync = async (app) => {
  const writeGuard = { preHandler: requireRole("ADMIN", "OPERACIONAL") };
  const readGuard = { preHandler: requireAuth };

  app.get("/materials", readGuard, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        sort: z.string().optional(),
        direction: z.string().optional(),
        active: z.enum(["true", "false"]).optional(),
        search: z.string().max(120).optional(),
      })
      .parse(request.query);

    const sort = resolveSort(query.sort, SORT_ALLOWLIST, "name");
    const direction = resolveDirection(query.direction);

    const where = {
      ...(query.active ? { active: query.active === "true" } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: "insensitive" as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.material.findMany({
        where,
        orderBy: { [sort]: direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.material.count({ where }),
    ]);

    return reply.send({ items, total, page: query.page, pageSize: query.pageSize });
  });

  app.post("/materials", writeGuard, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados de material invalidos");

    const existing = await prisma.material.findUnique({ where: { sku: parsed.data.sku } });
    if (existing) throw Errors.conflict("SKU ja cadastrado");

    const material = await prisma.material.create({ data: parsed.data });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "MATERIAL_CREATED", entityType: "material", entityId: material.id, after: material }
    );

    return reply.code(201).send({ material });
  });

  app.patch("/materials/:id", writeGuard, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados invalidos");

    const before = await prisma.material.findUnique({ where: { id: params.id } });
    if (!before) throw Errors.notFound("Material nao encontrado");

    if (parsed.data.sku && parsed.data.sku !== before.sku) {
      const clash = await prisma.material.findUnique({ where: { sku: parsed.data.sku } });
      if (clash && clash.id !== params.id) throw Errors.conflict("SKU ja cadastrado");
    }

    const material = await prisma.material.update({ where: { id: params.id }, data: parsed.data });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "MATERIAL_UPDATED", entityType: "material", entityId: material.id, before, after: material }
    );

    return reply.send({ material });
  });

  app.delete("/materials/:id", writeGuard, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);

    const material = await prisma.material.findUnique({ where: { id: params.id } });
    if (!material) throw Errors.notFound("Material nao encontrado");

    const [entryCount, lotCount, saleCount, quoteCount] = await Promise.all([
      prisma.stockEntryItem.count({ where: { materialId: params.id } }),
      prisma.stockLot.count({ where: { materialId: params.id } }),
      prisma.saleItem.count({ where: { materialId: params.id } }),
      prisma.quote.count({ where: { materialId: params.id } }),
    ]);
    if (entryCount || lotCount || saleCount || quoteCount) {
      throw Errors.conflict(
        "Este material tem entradas, lotes, vendas ou cotacoes vinculadas e nao pode ser excluido. Desative-o em vez de excluir."
      );
    }

    await prisma.material.delete({ where: { id: params.id } });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "MATERIAL_DELETED", entityType: "material", entityId: material.id, before: material }
    );

    return reply.code(204).send();
  });
};
