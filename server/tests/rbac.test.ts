import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, resetDb, createUser, loginAndGetCookie, getCsrfToken } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";

describe("autorizacao por perfil (RBAC)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeApp();
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("usuario LEITURA recebe 403 ao chamar rota administrativa de usuarios, mesmo direto pela API", async () => {
    await createUser({ email: "leitor@teste.com", password: "SenhaForte12345", role: "LEITURA" });
    const cookie = await loginAndGetCookie(app, "leitor@teste.com", "SenhaForte12345");
    const res = await app.inject({ method: "GET", url: "/users", headers: { cookie } });
    expect(res.statusCode).toBe(403);
  });

  it("tentativa de acesso negado gera registro de auditoria de seguranca", async () => {
    await createUser({ email: "leitor@teste.com", password: "SenhaForte12345", role: "LEITURA" });
    const cookie = await loginAndGetCookie(app, "leitor@teste.com", "SenhaForte12345");
    await app.inject({ method: "GET", url: "/users", headers: { cookie } });

    const logs = await prisma.auditLog.findMany({ where: { action: "FORBIDDEN_ACCESS_ATTEMPT" } });
    expect(logs.length).toBe(1);
    expect(logs[0].entityType).toBe("security");
  });

  it("usuario OPERACIONAL nao consegue criar material sem token CSRF", async () => {
    await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");
    const res = await app.inject({
      method: "POST",
      url: "/materials",
      headers: { cookie },
      payload: { name: "X", sku: "X-1", unit: "UN" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("usuario OPERACIONAL com CSRF valido consegue criar material", async () => {
    await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");
    const { token, cookie: fullCookie } = await getCsrfToken(app, cookie);
    const res = await app.inject({
      method: "POST",
      url: "/materials",
      headers: { cookie: fullCookie, "x-csrf-token": token },
      payload: { name: "Luva M", sku: "LUV-M", unit: "UN" },
    });
    expect(res.statusCode).toBe(201);
  });

  it("trocar o perfil (role) de um usuario revoga todas as sessoes ativas dele", async () => {
    const user = await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");

    const admin = await createUser({ email: "admin@teste.com", password: "SenhaForte12345", role: "ADMIN" });
    const adminCookie = await loginAndGetCookie(app, "admin@teste.com", "SenhaForte12345");
    const { token, cookie: adminFullCookie } = await getCsrfToken(app, adminCookie);

    await app.inject({
      method: "PATCH",
      url: `/users/${user.id}`,
      headers: { cookie: adminFullCookie, "x-csrf-token": token },
      payload: { role: "ADMIN" },
    });

    const res = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(res.statusCode).toBe(401);
    void admin;
  });
});
