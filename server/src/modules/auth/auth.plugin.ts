import fp from "fastify-plugin";
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { findValidSession, SESSION_COOKIE_NAME } from "../../shared/security/session.js";
import { Errors } from "../../shared/errors/AppError.js";
import { recordSecurityEvent } from "../audit/audit.service.js";
import type { UserRole } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: {
      id: string;
      role: UserRole;
      name: string;
      email: string;
      mustChangePassword: boolean;
    };
  }
}

export const authPlugin: FastifyPluginAsync = fp(async (app) => {
  app.decorateRequest("currentUser", undefined);

  app.addHook("preHandler", async (request: FastifyRequest) => {
    const token = request.cookies[SESSION_COOKIE_NAME];
    if (!token) return;

    const session = await findValidSession(token);
    if (!session) return;

    request.currentUser = {
      id: session.user.id,
      role: session.user.role,
      name: session.user.name,
      email: session.user.email,
      mustChangePassword: session.user.mustChangePassword,
    };
  });
}) as FastifyPluginAsync;

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  if (!request.currentUser) {
    throw Errors.unauthorized();
  }
}

export function requireRole(...roles: UserRole[]) {
  return async function roleGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    if (!request.currentUser) {
      throw Errors.unauthorized();
    }
    if (!roles.includes(request.currentUser.role)) {
      await recordSecurityEvent(
        { actorUserId: request.currentUser.id, ip: request.ip, userAgent: request.headers["user-agent"] },
        "FORBIDDEN_ACCESS_ATTEMPT",
        { path: request.url, method: request.method, requiredRoles: roles, actualRole: request.currentUser.role }
      );
      throw Errors.forbidden();
    }
  };
}
