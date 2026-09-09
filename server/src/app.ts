import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import csrfProtection from "@fastify/csrf-protection";
import { env, corsOrigins, isProduction } from "./config/env.js";
import { AppError } from "./shared/errors/AppError.js";
import { authPlugin } from "./modules/auth/auth.plugin.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { materialsRoutes } from "./modules/materials/materials.routes.js";
import { suppliersRoutes } from "./modules/suppliers/suppliers.routes.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { stockRoutes } from "./modules/stock/stock.routes.js";
import { quotesRoutes } from "./modules/quotes/quotes.routes.js";
import { salesRoutes } from "./modules/sales/sales.routes.js";
import { auditRoutes } from "./modules/audit/audit.routes.js";
import { emailRoutes } from "./modules/email/email.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "test" ? "silent" : isProduction ? "info" : "debug",
      redact: ["req.headers.cookie", "req.headers.authorization", "*.password", "*.passwordHash"],
    },
    trustProxy: true,
  });

  // IMPORTANTE: setErrorHandler precisa ser registrado ANTES dos plugins de
  // rota (app.register(authRoutes) etc). O modelo de encapsulamento do
  // Fastify faz cada plugin herdar o error handler vigente NO MOMENTO em
  // que é registrado — se setErrorHandler for chamado depois, os plugins
  // já registrados continuam presos ao handler padrão do Fastify (que
  // vaza `{statusCode, error, message}` cru, sem a redação/formato que
  // este handler garante). Erro real encontrado durante teste manual desta
  // implementação: com o setErrorHandler no fim do arquivo, toda rota (login,
  // RBAC 403, validação Zod) respondia com o shape default do Fastify em vez
  // do JSON padronizado abaixo.
  app.setErrorHandler((error: FastifyError | AppError | ZodError, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code, message: error.message } });
    }

    // Rotas que usam z.parse() direto (params/query) lancam ZodError, que
    // nao deve nunca virar 500 nem vazar o detalhe de validacao interno.
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Parametros invalidos" } });
    }

    if (error.validation) {
      return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "Dados invalidos" } });
    }

    if (error.statusCode === 429) {
      return reply.code(429).send({ error: { code: "TOO_MANY_REQUESTS", message: "Muitas requisicoes" } });
    }

    // Erros com statusCode 4xx vindos de plugins (ex.: @fastify/csrf-protection
    // recusando token ausente/invalido) devem manter o status original em vez
    // de virar 500 generico — mas a mensagem interna do plugin nao e exposta.
    if (typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 500) {
      return reply
        .code(error.statusCode)
        .send({ error: { code: error.code || "BAD_REQUEST", message: "Requisicao invalida" } });
    }

    request.log.error(error);
    // Nunca vazar stack trace em producao.
    return reply.code(500).send({ error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" } });
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  });

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });

  await app.register(cookie, {
    secret: env.SESSION_SECRET,
  });

  await app.register(rateLimit, {
    global: true,
    max: 200,
    timeWindow: "1 minute",
  });

  await app.register(csrfProtection, {
    cookieOpts: { signed: false, path: "/", httpOnly: true, sameSite: env.COOKIE_SAMESITE, secure: env.COOKIE_SECURE },
    getToken: (request) => request.headers["x-csrf-token"] as string | undefined,
  });

  await app.register(authPlugin);

  // CSRF exigido em toda mutacao que usa cookie de sessao (login/logout ficam de fora do check de token
  // pois login ainda nao tem sessao; logout usa apenas o cookie de sessao ja autenticado).
  app.addHook("onRequest", (request, reply, done) => {
    const mutating = ["POST", "PATCH", "PUT", "DELETE"].includes(request.method);
    const exempt = request.url === "/auth/login";
    if (mutating && !exempt) {
      app.csrfProtection(request, reply, done);
      return;
    }
    done();
  });

  app.get("/auth/csrf-token", async (request, reply) => {
    return reply.send({ csrfToken: await reply.generateCsrf() });
  });

  // Enquanto mustChangePassword estiver true (senha de bootstrap/reset por
  // ADMIN ainda nao trocada), bloqueia qualquer rota que nao seja a de
  // trocar senha, sair ou ver o proprio perfil — nao basta so a tela
  // "sugerir" a troca, senao um usuario poderia so ignorar o aviso.
  const MUST_CHANGE_PASSWORD_ALLOWLIST = new Set([
    "/auth/login",
    "/auth/logout",
    "/auth/me",
    "/auth/change-password",
    "/auth/csrf-token",
    "/health",
  ]);
  app.addHook("preHandler", async (request, reply) => {
    if (!request.currentUser?.mustChangePassword) return;
    const path = request.url.split("?")[0] ?? request.url;
    if (MUST_CHANGE_PASSWORD_ALLOWLIST.has(path)) return;
    return reply.code(403).send({
      error: { code: "MUST_CHANGE_PASSWORD", message: "E necessario trocar a senha antes de continuar" },
    });
  });

  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(materialsRoutes);
  await app.register(suppliersRoutes);
  await app.register(clientsRoutes);
  await app.register(stockRoutes);
  await app.register(quotesRoutes);
  await app.register(salesRoutes);
  await app.register(auditRoutes);
  await app.register(emailRoutes);

  app.get("/health", async () => ({ ok: true }));

  return app;
}
