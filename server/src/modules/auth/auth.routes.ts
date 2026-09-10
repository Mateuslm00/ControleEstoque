import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../../db/prisma.js";
import { verifyPassword, hashPassword } from "../../shared/security/password.js";
import {
  createSession,
  revokeSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
  hashToken,
} from "../../shared/security/session.js";
import { Errors } from "../../shared/errors/AppError.js";
import { recordAudit } from "../audit/audit.service.js";
import { requireAuth } from "./auth.plugin.js";
import { env } from "../../config/env.js";

// "identifier" aceita tanto o email quanto o nome de exibicao do usuario —
// ambos sao @unique no schema (ver User.name em schema.prisma).
const loginSchema = z.object({
  identifier: z.string().min(1).max(160),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(128),
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

      const { identifier, password, rememberMe } = parsed.data;
      const genericError = Errors.unauthorized("Credenciais invalidas");

      const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { name: identifier }] } });
      if (!user || user.status !== "ACTIVE") {
        // Mensagem generica: nao revela se o email/nome existe.
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
        rememberMe,
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
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
      });
    }
  );

  app.post("/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (token) {
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

  // Troca de senha pelo proprio usuario logado — nao existia nenhuma forma
  // de trocar senha no sistema ate aqui (nem essa, nem reset pelo admin).
  // Isso e obrigatorio em producao: sem isso o ADMIN nunca consegue trocar
  // a senha aleatoria gerada no bootstrap (ver prisma/seed.ts).
  app.post(
    "/auth/change-password",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
    },
    async (request, reply) => {
      const parsed = changePasswordSchema.safeParse(request.body);
      if (!parsed.success) throw Errors.badRequest("Dados invalidos");
      const { currentPassword, newPassword } = parsed.data;

      const user = await prisma.user.findUnique({ where: { id: request.currentUser!.id } });
      if (!user) throw Errors.unauthorized();

      const valid = await verifyPassword(user.passwordHash, currentPassword);
      if (!valid) {
        await recordAudit(
          { actorUserId: user.id, ip: request.ip, userAgent: request.headers["user-agent"] },
          { action: "CHANGE_PASSWORD_FAILED", entityType: "user", entityId: user.id }
        );
        throw Errors.unauthorized("Senha atual incorreta");
      }
      if (newPassword === currentPassword) {
        throw Errors.badRequest("A nova senha deve ser diferente da atual");
      }

      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      });

      // Derruba todas as OUTRAS sessoes (ex.: sessao roubada num outro
      // dispositivo) mas mantem a sessao atual logada, senao o usuario
      // trocaria a senha e seria deslogado no mesmo instante.
      const currentToken = request.cookies[SESSION_COOKIE_NAME];
      const currentTokenHash = currentToken ? hashToken(currentToken) : null;
      await prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null, ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}) },
        data: { revokedAt: new Date() },
      });

      await recordAudit(
        { actorUserId: user.id, ip: request.ip, userAgent: request.headers["user-agent"] },
        { action: "PASSWORD_CHANGED", entityType: "user", entityId: user.id }
      );

      return reply.send({ ok: true });
    }
  );
};
