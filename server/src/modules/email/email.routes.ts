import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";
import { requireRole } from "../auth/auth.plugin.js";
import { sendEmailJob } from "./email.service.js";
import { recordAudit } from "../audit/audit.service.js";

export const emailRoutes: FastifyPluginAsync = async (app) => {
  app.get("/email-jobs", { preHandler: requireRole("ADMIN") }, async (request, reply) => {
    const query = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(200).default(20),
        status: z.enum(["PENDING", "SENT", "FAILED"]).optional(),
      })
      .parse(request.query);

    const where = query.status ? { status: query.status } : {};

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.emailJob.count({ where }),
    ]);

    return reply.send({ items, total, page: query.page, pageSize: query.pageSize });
  });

  app.post(
    "/email-jobs/:id/retry",
    { preHandler: requireRole("ADMIN"), config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const job = await prisma.emailJob.findUnique({ where: { id: params.id } });
      if (!job) throw Errors.notFound("Job de email nao encontrado");

      await sendEmailJob(job.id, { entityId: job.entityId });

      await recordAudit(
        { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
        { action: "EMAIL_JOB_RETRIED", entityType: "email_job", entityId: job.id }
      );

      return reply.send({ ok: true });
    }
  );
};
