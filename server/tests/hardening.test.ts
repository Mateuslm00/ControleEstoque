import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, resetDb, createUser, loginAndGetCookie, getCsrfToken } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";

describe("correcoes de robustez", () => {
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

  async function asAdmin() {
    const admin = await createUser({ email: "a@t.com", password: "SenhaForte12345", role: "ADMIN" });
    const cookie = await loginAndGetCookie(app, "a@t.com", "SenhaForte12345");
    const { token, cookie: full } = await getCsrfToken(app, cookie);
    const headers = { cookie: full, "x-csrf-token": token };
    const call = (method: "POST" | "PATCH", url: string, payload: object) =>
      app.inject({ method, url, headers, payload });
    return { admin, call };
  }

  it("CNPJ repetido em unidade retorna 409 (nao 500) e permite limpar o CNPJ", async () => {
    const { call } = await asAdmin();
    await call("POST", "/clients", { name: "U1", cnpj: "11" });
    const dup = await call("POST", "/clients", { name: "U2", cnpj: "11" });
    expect(dup.statusCode).toBe(409);

    const other = await prisma.client.create({ data: { name: "U3", cnpj: "22" } });
    const clash = await call("PATCH", `/clients/${other.id}`, { cnpj: "11" });
    expect(clash.statusCode).toBe(409);

    const cleared = await call("PATCH", `/clients/${other.id}`, { cnpj: null });
    expect(cleared.statusCode).toBe(200);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: other.id } })).cnpj).toBeNull();
  });

  it("numero de venda repetido retorna 409 com mensagem clara", async () => {
    const { call } = await asAdmin();
    const supplier = await prisma.supplier.create({ data: { name: "F" } });
    const material = await prisma.material.create({ data: { name: "M", sku: "S1", unit: "un" } });
    const client = await prisma.client.create({ data: { name: "C" } });
    await call("POST", "/stock/entries", {
      supplierId: supplier.id, invoiceNumber: "N", entryDate: "2026-01-01",
      items: [{ materialId: material.id, lotNumber: "L", expiresAt: "2027-01-01", quantity: 10, unitCost: 1 }],
    });
    const sale = { docNumber: "V1", clientId: client.id, saleDate: "2026-02-01", items: [{ materialId: material.id, quantity: 1, unitPrice: 2 }] };
    expect((await call("POST", "/sales", sale)).statusCode).toBe(201);
    const dup = await call("POST", "/sales", sale);
    expect(dup.statusCode).toBe(409);
    expect(JSON.parse(dup.body).error.message).toMatch(/numero/i);
    // a venda duplicada nao pode ter consumido estoque
    expect(Number((await prisma.stockLot.findFirstOrThrow({})).currentQuantity)).toBe(9);
  });

  it("fornecedor: limpa telefone/contato/notas/email ao editar", async () => {
    const { call } = await asAdmin();
    const s = await prisma.supplier.create({
      data: { name: "F", phone: "1", contactPerson: "x", notes: "n", email: "f@f.com", cnpj: "9" },
    });
    const res = await call("PATCH", `/suppliers/${s.id}`, { phone: null, contactPerson: null, notes: null, email: "", cnpj: null });
    expect(res.statusCode).toBe(200);
    expect(await prisma.supplier.findUniqueOrThrow({ where: { id: s.id } })).toMatchObject({
      phone: null, contactPerson: null, notes: null, email: null, cnpj: null,
    });
  });

  it("admin nao desativa a propria conta nem o ultimo admin ativo", async () => {
    const { admin, call } = await asAdmin();
    const self = await call("PATCH", `/users/${admin.id}/status`, { status: "INACTIVE" });
    expect(self.statusCode).toBe(409);

    const demote = await call("PATCH", `/users/${admin.id}`, { role: "OPERACIONAL" });
    expect(demote.statusCode).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role).toBe("ADMIN");

    // com outro admin ativo, rebaixar/desativar o outro e permitido
    const other = await createUser({ email: "b@t.com", password: "SenhaForte12345", role: "ADMIN" });
    expect((await call("PATCH", `/users/${other.id}/status`, { status: "INACTIVE" })).statusCode).toBe(200);
    // ...mas agora o primeiro e o unico ativo de novo
    const again = await call("PATCH", `/users/${admin.id}`, { role: "LEITURA" });
    expect(again.statusCode).toBe(409);
  });

  it("/stock/current informa o total de materiais para paginar", async () => {
    const { call } = await asAdmin();
    const supplier = await prisma.supplier.create({ data: { name: "F" } });
    for (const i of [1, 2, 3]) {
      const m = await prisma.material.create({ data: { name: `M${i}`, sku: `S${i}`, unit: "un" } });
      await call("POST", "/stock/entries", {
        supplierId: supplier.id, invoiceNumber: `N${i}`, entryDate: "2026-01-01",
        items: [{ materialId: m.id, lotNumber: "L", expiresAt: "2027-01-01", quantity: 5, unitCost: 1 }],
      });
    }
    const cookie = (await app.inject({ method: "POST", url: "/auth/login", payload: { identifier: "a@t.com", password: "SenhaForte12345" } }))
      .cookies.find((c) => c.name === "sid")!;
    const res = await app.inject({ method: "GET", url: "/stock/current?pageSize=2", headers: { cookie: `sid=${cookie.value}` } });
    const body = JSON.parse(res.body);
    expect(body.items).toHaveLength(2);
    expect(body.total).toBe(3);
  });
});
