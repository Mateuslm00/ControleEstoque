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
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
});

const updateSchema = createSchema.partial().extend({ active: z.boolean().optional() });

export const clientsRoutes: FastifyPluginAsync = async (app) => {
  const writeGuard = { preHandler: requireRole("ADMIN", "OPERACIONAL") };
  const readGuard = { preHandler: requireAuth };

  app.get("/clients", readGuard, async (request, reply) => {
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
      prisma.client.findMany({
        where,
        orderBy: { [sort]: direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.client.count({ where }),
    ]);

    return reply.send({ items, total, page: query.page, pageSize: query.pageSize });
  });

  app.post("/clients", writeGuard, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados de cliente/unidade invalidos");

    const client = await prisma.client.create({ data: parsed.data });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "CLIENT_CREATED", entityType: "client", entityId: client.id, after: client }
    );

    return reply.code(201).send({ client });
  });

  app.patch("/clients/:id", writeGuard, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados invalidos");

    const before = await prisma.client.findUnique({ where: { id: params.id } });
    if (!before) throw Errors.notFound("Cliente/unidade nao encontrado");

    const client = await prisma.client.update({ where: { id: params.id }, data: parsed.data });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "CLIENT_UPDATED", entityType: "client", entityId: client.id, before, after: client }
    );

    return reply.send({ client });
  });
};
