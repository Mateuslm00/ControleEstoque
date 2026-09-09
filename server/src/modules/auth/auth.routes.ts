import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { verifyPassword } from "../../shared/security/password.js";
import { createSession, revokeSession, sessionCookieOptions, SESSION_COOKIE_NAME } from "../../shared/security/session.js";
import { Errors } from "../../shared/errors/AppError.js";
import { recordAudit } from "../audit/audit.service.js";
import { requireAuth } from "./auth.plugin.js";
import { env } from "../../config/env.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_LOGIN_MAX,
          timeWindow: `${env.RATE_LIMIT_LOGIN_WINDOW_MINUTES} minutes`,
        },
      },
    },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) throw Errors.badRequest("Dados de login invalidos");

      const { email, password } = parsed.data;
      const genericError = Errors.unauthorized("Email ou senha invalidos");

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.status !== "ACTIVE") {
        // Mensagem generica: nao revela se o email existe.
        throw genericError;
      }

      const valid = await verifyPassword(user.passwordHash, password);
      if (!valid) {
        await recordAudit(
          { actorUserId: user.id, ip: request.ip, userAgent: request.headers["user-agent"] },
          { action: "LOGIN_FAILED", entityType: "user", entityId: user.id }
        );
        throw genericError;
      }

      const { token, expiresAt } = await createSession({
        userId: user.id,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
      });

      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      await recordAudit(
        { actorUserId: user.id, ip: request.ip, userAgent: request.headers["user-agent"] },
        { action: "LOGIN_SUCCESS", entityType: "user", entityId: user.id }
      );

      reply.setCookie(sessionCookieOptions.name, token, {
        httpOnly: sessionCookieOptions.httpOnly,
        secure: sessionCookieOptions.secure,
        sameSite: sessionCookieOptions.sameSite,
        path: sessionCookieOptions.path,
        domain: sessionCookieOptions.domain,
        expires: expiresAt,
      });

      return reply.send({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      });
    }
  );

  app.post("/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
      const { hashToken } = await import("../../shared/security/session.js");
      await revokeSession(hashToken(token));
    }
    reply.clearCookie(sessionCookieOptions.name, { path: sessionCookieOptions.path });

    await recordAudit(
      { actorUserId: request.currentUser!.id, ip: request.ip, userAgent: request.headers["user-agent"] },
      { action: "LOGOUT", entityType: "user", entityId: request.currentUser!.id }
    );

    return reply.send({ ok: true });
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    return reply.send({ user: request.currentUser });
  });
};
