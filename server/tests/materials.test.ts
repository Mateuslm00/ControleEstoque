import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, resetDb, createUser, loginAndGetCookie, getCsrfToken } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";

describe("edicao de materiais", () => {
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
    await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");
    const { token, cookie: fullCookie } = await getCsrfToken(app, cookie);
    const patch = (id: string, payload: object) =>
      app.inject({ method: "PATCH", url: `/materials/${id}`, headers: { cookie: fullCookie, "x-csrf-token": token }, payload });
    return { patch };
  }

  it("edita todos os campos, inclusive SKU, e permite limpar marca/tipo/grupo", async () => {
    const { patch } = await setup();
    const m = await prisma.material.create({
      data: { name: "Luva", sku: "LUV-1", unit: "un", brand: "X", type: "Enxoval", group: "G" },
    });
    const res = await patch(m.id, {
      name: "Luva M", sku: " LUV-2 ", unit: "cx", brand: null, type: null, group: null, markup: 45, minStock: 7,
    });
    expect(res.statusCode).toBe(200);
    const updated = await prisma.material.findUniqueOrThrow({ where: { id: m.id } });
    expect(updated).toMatchObject({ name: "Luva M", sku: "LUV-2", unit: "cx", brand: null, type: null, group: null });
    expect(Number(updated.markup)).toBe(45);
    expect(Number(updated.minStock)).toBe(7);
  });

  it("rejeita SKU que ja pertence a outro material (409) e aceita manter o proprio SKU", async () => {
    const { patch } = await setup();
    const a = await prisma.material.create({ data: { name: "A", sku: "A-1", unit: "un" } });
    await prisma.material.create({ data: { name: "B", sku: "B-1", unit: "un" } });

    const clash = await patch(a.id, { sku: "B-1" });
    expect(clash.statusCode).toBe(409);
    expect((await prisma.material.findUniqueOrThrow({ where: { id: a.id } })).sku).toBe("A-1");

    const same = await patch(a.id, { sku: "A-1", name: "A2" });
    expect(same.statusCode).toBe(200);
  });
});
