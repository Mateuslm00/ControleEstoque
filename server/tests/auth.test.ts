import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, resetDb, createUser, loginAndGetCookie } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";

describe("autenticacao", () => {
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

  it("rejeita login com senha errada com mensagem generica", async () => {
    await createUser({ email: "admin@teste.com", password: "SenhaForte12345", role: "ADMIN" });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@teste.com", password: "senha-errada" },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error.message).toBe("Email ou senha invalidos");
  });

  it("rejeita login de email inexistente com a MESMA mensagem generica (nao revela se o email existe)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nao-existe@teste.com", password: "qualquer" },
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error.message).toBe("Email ou senha invalidos");
  });

  it("aceita login correto e seta cookie HttpOnly", async () => {
    await createUser({ email: "admin@teste.com", password: "SenhaForte12345", role: "ADMIN" });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@teste.com", password: "SenhaForte12345" },
    });
    expect(res.statusCode).toBe(200);
    const sidCookie = res.cookies.find((c) => c.name === "sid");
    expect(sidCookie).toBeDefined();
    expect(sidCookie?.httpOnly).toBe(true);
    expect(sidCookie?.sameSite).toBe("Strict");
  });

  it("GET /auth/me sem sessao retorna 401", async () => {
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("GET /auth/me com sessao valida retorna o usuario sem password_hash", async () => {
    await createUser({ email: "admin@teste.com", password: "SenhaForte12345", role: "ADMIN" });
    const cookie = await loginAndGetCookie(app, "admin@teste.com", "SenhaForte12345");
    const res = await app.inject({ method: "GET", url: "/auth/me", headers: { cookie } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.user.email).toBe("admin@teste.com");
    expect(body.user.passwordHash).toBeUndefined();
  });

  it("usuario inativo nao consegue logar", async () => {
    const user = await createUser({ email: "inativo@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    await prisma.user.update({ where: { id: user.id }, data: { status: "INACTIVE" } });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "inativo@teste.com", password: "SenhaForte12345" },
    });
    expect(res.statusCode).toBe(401);
  });
});
