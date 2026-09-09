import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, resetDb, createUser, loginAndGetCookie, getCsrfToken } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";

describe("cotacao de precos", () => {
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

  async function setup() {
    const material = await prisma.material.create({ data: { name: "Item", sku: "IT-1", unit: "UN" } });
    const suppliers = await Promise.all(
      [1, 2, 3].map((i) => prisma.supplier.create({ data: { name: `Fornecedor ${i}` } }))
    );
    await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");
    const { token, cookie: fullCookie } = await getCsrfToken(app, cookie);
    return { material, suppliers, cookie: fullCookie, token };
  }

  it("rejeita cotacao com menos de MIN_QUOTES fornecedores", async () => {
    const { material, suppliers, cookie, token } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/quotes",
      headers: { cookie, "x-csrf-token": token },
      payload: {
        materialId: material.id,
        quoteDate: "2026-09-01",
        items: [
          { supplierId: suppliers[0].id, price: 10 },
          { supplierId: suppliers[1].id, price: 12 },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejeita fornecedor duplicado na mesma cotacao", async () => {
    const { material, suppliers, cookie, token } = await setup();
    const res = await app.inject({
      method: "POST",
      url: "/quotes",
      headers: { cookie, "x-csrf-token": token },
      payload: {
        materialId: material.id,
        quoteDate: "2026-09-01",
        items: [
          { supplierId: suppliers[0].id, price: 10 },
          { supplierId: suppliers[0].id, price: 12 },
          { supplierId: suppliers[1].id, price: 11 },
        ],
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it("aceita cotacao valida com MIN_QUOTES fornecedores distintos e calcula status", async () => {
    const { material, suppliers, cookie, token } = await setup();
    const create = await app.inject({
      method: "POST",
      url: "/quotes",
      headers: { cookie, "x-csrf-token": token },
      payload: {
        materialId: material.id,
        quoteDate: new Date().toISOString(),
        items: [
          { supplierId: suppliers[0].id, price: 10 },
          { supplierId: suppliers[1].id, price: 12 },
          { supplierId: suppliers[2].id, price: 9 },
        ],
      },
    });
    expect(create.statusCode).toBe(201);

    const status = await app.inject({ method: "GET", url: "/quotes/materials/status", headers: { cookie } });
    const body = JSON.parse(status.body);
    const row = body.items.find((i: { material: { id: string } }) => i.material.id === material.id);
    expect(row.status).toBe("EM_DIA");
  });
});
