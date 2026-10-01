import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, resetDb, createUser, loginAndGetCookie, getCsrfToken } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";
import { createStockEntry, createSaleWithFefo } from "../src/modules/stock/stock.service.js";

describe("editar e excluir entrada de estoque", () => {
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
    const supplier = await prisma.supplier.create({ data: { name: "F1" } });
    const supplier2 = await prisma.supplier.create({ data: { name: "F2" } });
    const material = await prisma.material.create({ data: { name: "M1", sku: "M-1", unit: "un" } });
    const client = await prisma.client.create({ data: { name: "C1" } });
    const user = await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");
    const { token, cookie: full } = await getCsrfToken(app, cookie);
    const call = (method: "PATCH" | "DELETE", id: string, payload?: object) =>
      app.inject({ method, url: `/stock/entries/${id}`, headers: { cookie: full, "x-csrf-token": token }, payload });
    const entry = await createStockEntry({
      supplierId: supplier.id, invoiceNumber: "NF-1", entryDate: new Date("2026-01-01"), createdById: user.id,
      items: [{ materialId: material.id, lotNumber: "L1", expiresAt: new Date("2027-01-01"), quantity: 10, unitCost: 2 }],
    });
    const body = (over: object = {}, itemOver: object = {}) => ({
      supplierId: supplier.id, invoiceNumber: "NF-1", entryDate: "2026-01-01",
      items: [{ materialId: material.id, lotNumber: "L1", expiresAt: "2027-01-01", quantity: 10, unitCost: 2, ...itemOver }],
      ...over,
    });
    return { supplier, supplier2, material, client, user, entry, call, body };
  }

  it("edita entrada sem saidas: recria lote com novos valores e recalcula total", async () => {
    const { supplier2, entry, call, body } = await setup();
    const res = await call("PATCH", entry.id, body({ supplierId: supplier2.id, invoiceNumber: "NF-9" }, { lotNumber: "L9", quantity: 20, unitCost: 3 }));
    expect(res.statusCode).toBe(200);
    const updated = await prisma.stockEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(updated.invoiceNumber).toBe("NF-9");
    expect(Number(updated.totalValue)).toBe(60);
    const lots = await prisma.stockLot.findMany({});
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ lotNumber: "L9", supplierId: supplier2.id, status: "ACTIVE" });
    expect(Number(lots[0]!.currentQuantity)).toBe(20);
  });

  it("com saidas: permite mudar NFe/fornecedor, trava quantidade e bloqueia exclusao", async () => {
    const { supplier2, client, user, material, entry, call, body } = await setup();
    await createSaleWithFefo({
      docNumber: "V-1", clientId: client.id, saleDate: new Date("2026-02-01"), createdById: user.id,
      items: [{ materialId: material.id, quantity: 4, unitPrice: 5 }],
    });

    const locked = await call("PATCH", entry.id, body({}, { quantity: 99 }));
    expect(locked.statusCode).toBe(409);

    const header = await call("PATCH", entry.id, body({ supplierId: supplier2.id, invoiceNumber: "NF-2" }));
    expect(header.statusCode).toBe(200);
    const lot = await prisma.stockLot.findFirstOrThrow({});
    expect(lot.supplierId).toBe(supplier2.id);
    expect(Number(lot.currentQuantity)).toBe(6);

    const del = await call("DELETE", entry.id);
    expect(del.statusCode).toBe(409);
    expect(await prisma.stockEntry.count()).toBe(1);
  });

  it("exclui entrada sem saidas junto com seus lotes", async () => {
    const { entry, call } = await setup();
    const del = await call("DELETE", entry.id);
    expect(del.statusCode).toBe(204);
    expect(await prisma.stockEntry.count()).toBe(0);
    expect(await prisma.stockLot.count()).toBe(0);
    expect(await prisma.stockEntryItem.count()).toBe(0);
  });
});

describe("unidade que recebeu", () => {
  it("persiste e permite editar a unidade de recebimento", async () => {
    const app = await makeApp();
    await resetDb();
    const supplier = await prisma.supplier.create({ data: { name: "F" } });
    const material = await prisma.material.create({ data: { name: "M", sku: "M-9", unit: "un" } });
    await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");
    const { token, cookie: full } = await getCsrfToken(app, cookie);
    const headers = { cookie: full, "x-csrf-token": token };
    const payload = (receivingUnit?: string) => ({
      supplierId: supplier.id, invoiceNumber: "NF", entryDate: "2026-01-01", receivingUnit,
      items: [{ materialId: material.id, lotNumber: "L", expiresAt: "2027-01-01", quantity: 1, unitCost: 1 }],
    });
    const created = await app.inject({ method: "POST", url: "/stock/entries", headers, payload: payload("Unidade A") });
    expect(created.statusCode).toBe(201);
    const id = JSON.parse(created.body).entry.id;
    expect((await prisma.stockEntry.findUniqueOrThrow({ where: { id } })).receivingUnit).toBe("Unidade A");
    const upd = await app.inject({ method: "PATCH", url: `/stock/entries/${id}`, headers, payload: payload("Unidade B") });
    expect(upd.statusCode).toBe(200);
    expect((await prisma.stockEntry.findUniqueOrThrow({ where: { id } })).receivingUnit).toBe("Unidade B");
    await app.close();
  });
});
