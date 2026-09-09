import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";
import { requireAuth, requireRole } from "../auth/auth.plugin.js";
import { recordAudit } from "../audit/audit.service.js";
import { resolveSort, resolveDirection } from "../../shared/validation/sort.js";

const SORT_ALLOWLIST = ["name", "createdAt"] as const;

const createSchema = z.object({
  name: z.string().min(1).max(160),
  cnpj: z.string().max(20).optional(),
  email: z
    .union([z.string().email(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  phone: z.string().max(30).optional(),
  contactPerson: z.string().max(120).optional(),
});

const updateSchema = createSchema.partial().extend({ active: z.boolean().optional() });

export const suppliersRoutes: FastifyPluginAsync = async (app) => {
  const writeGuard = { preHandler: requireRole("ADMIN", "OPERACIONAL") };
  const readGuard = { preHandler: requireAuth };

  app.get("/suppliers", readGuard, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        sort: z.string().optional(),
        direction: z.string().optional(),
        active: z.enum(["true", "false"]).optional(),
      })
      .parse(request.query);

    const sort = resolveSort(query.sort, SORT_ALLOWLIST, "name");
    const direction = resolveDirection(query.direction);
    const where = query.active ? { active: query.active === "true" } : {};

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { [sort]: direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.supplier.count({ where }),
    ]);

    return reply.send({ items, total, page: query.page, pageSize: query.pageSize });
  });

  app.post("/suppliers", writeGuard, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados de fornecedor invalidos");

    const supplier = await prisma.supplier.create({ data: parsed.data });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "SUPPLIER_CREATED", entityType: "supplier", entityId: supplier.id, after: supplier }
    );

    return reply.code(201).send({ supplier });
  });

  app.patch("/suppliers/:id", writeGuard, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados invalidos");

    const before = await prisma.supplier.findUnique({ where: { id: params.id } });
    if (!before) throw Errors.notFound("Fornecedor nao encontrado");

    const supplier = await prisma.supplier.update({ where: { id: params.id }, data: parsed.data });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "SUPPLIER_UPDATED", entityType: "supplier", entityId: supplier.id, before, after: supplier }
    );

    return reply.send({ supplier });
  });
};
