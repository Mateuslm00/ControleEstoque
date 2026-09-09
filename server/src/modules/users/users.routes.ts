import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { hashPassword } from "../../shared/security/password.js";
import { revokeAllUserSessions } from "../../shared/security/session.js";
import { Errors } from "../../shared/errors/AppError.js";
import { requireRole } from "../auth/auth.plugin.js";
import { recordAudit } from "../audit/audit.service.js";
import { resolveSort, resolveDirection } from "../../shared/validation/sort.js";

const USER_SORT_ALLOWLIST = ["name", "email", "role", "status", "createdAt", "lastLoginAt"] as const;

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(128),
  role: z.enum(["ADMIN", "OPERACIONAL", "LEITURA"]),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  role: z.enum(["ADMIN", "OPERACIONAL", "LEITURA"]).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

function toPublicUser(u: {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
  // password_hash nunca incluido aqui de proposito.
}

export const usersRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = { preHandler: requireRole("ADMIN") };

  app.get("/users", adminOnly, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        sort: z.string().optional(),
        direction: z.string().optional(),
      })
      .parse(request.query);

    const sort = resolveSort(query.sort, USER_SORT_ALLOWLIST, "createdAt");
    const direction = resolveDirection(query.direction);

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        orderBy: { [sort]: direction },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.user.count(),
    ]);

    return reply.send({
      items: items.map(toPublicUser),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  });

  app.post("/users", adminOnly, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados de usuario invalidos");
    const { name, email, password, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw Errors.conflict("Email ja cadastrado");

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "USER_CREATED", entityType: "user", entityId: user.id, after: toPublicUser(user) }
    );

    return reply.code(201).send({ user: toPublicUser(user) });
  });

  app.patch("/users/:id", adminOnly, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Dados invalidos");

    const before = await prisma.user.findUnique({ where: { id: params.id } });
    if (!before) throw Errors.notFound("Usuario nao encontrado");

    const roleChanged = parsed.data.role && parsed.data.role !== before.role;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: parsed.data,
    });

    if (roleChanged) {
      await revokeAllUserSessions(user.id);
    }

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      {
        action: "USER_UPDATED",
        entityType: "user",
        entityId: user.id,
        before: toPublicUser(before),
        after: toPublicUser(user),
      }
    );

    return reply.send({ user: toPublicUser(user) });
  });

  app.patch("/users/:id/status", adminOnly, async (request, reply) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);
    const parsed = updateStatusSchema.safeParse(request.body);
    if (!parsed.success) throw Errors.badRequest("Status invalido");

    const before = await prisma.user.findUnique({ where: { id: params.id } });
    if (!before) throw Errors.notFound("Usuario nao encontrado");

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { status: parsed.data.status },
    });

    if (parsed.data.status === "INACTIVE") {
      await revokeAllUserSessions(user.id);
    }

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      {
        action: "USER_STATUS_CHANGED",
        entityType: "user",
        entityId: user.id,
        before: { status: before.status },
        after: { status: user.status },
      }
    );

    return reply.send({ user: toPublicUser(user) });
  });
};
