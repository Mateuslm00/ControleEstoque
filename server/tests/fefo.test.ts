import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { makeApp, resetDb, createUser, loginAndGetCookie, getCsrfToken } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";
import { createStockEntry, createSaleWithFefo } from "../src/modules/stock/stock.service.js";

async function seedMaterialSupplierClient() {
  const supplier = await prisma.supplier.create({ data: { name: "Fornecedor Teste" } });
  const material = await prisma.material.create({ data: { name: "Item Teste", sku: "IT-1", unit: "UN" } });
  const client = await prisma.client.create({ data: { name: "Cliente Teste" } });
  return { supplier, material, client };
}

describe("FEFO (First Expire, First Out)", () => {
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

  it("consome primeiro o lote que vence mais cedo", async () => {
    const { supplier, material, client } = await seedMaterialSupplierClient();
    const user = await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });

    await createStockEntry({
      supplierId: supplier.id,
      invoiceNumber: "NF-1",
      entryDate: new Date("2026-01-01"),
      createdById: user.id,
      items: [
        { materialId: material.id, lotNumber: "L1-VENCE-DEPOIS", expiresAt: new Date("2026-12-01"), quantity: 10, unitCost: 2.5 },
        { materialId: material.id, lotNumber: "L2-VENCE-ANTES", expiresAt: new Date("2026-06-01"), quantity: 5, unitCost: 2.0 },
      ],
    });

    await createSaleWithFefo({
      docNumber: "V-1",
      clientId: client.id,
      saleDate: new Date("2026-09-01"),
      createdById: user.id,
      items: [{ materialId: material.id, quantity: 12, unitPrice: 5 }],
    });

    const lots = await prisma.stockLot.findMany({ where: { materialId: material.id }, orderBy: { expiresAt: "asc" } });
    const lot2 = lots.find((l) => l.lotNumber === "L2-VENCE-ANTES")!;
    const lot1 = lots.find((l) => l.lotNumber === "L1-VENCE-DEPOIS")!;

    // O lote que vence primeiro deve esgotar totalmente antes de tocar no outro.
    expect(Number(lot2.currentQuantity)).toBe(0);
    expect(lot2.status).toBe("DEPLETED");
    expect(Number(lot1.currentQuantity)).toBe(3); // 10 - (12 - 5)
    expect(lot1.status).toBe("ACTIVE");
  });

  it("rejeita venda com quantidade maior que o estoque disponivel", async () => {
    const { supplier, material, client } = await seedMaterialSupplierClient();
    const user = await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });

    await createStockEntry({
      supplierId: supplier.id,
      invoiceNumber: "NF-1",
      entryDate: new Date("2026-01-01"),
      createdById: user.id,
      items: [{ materialId: material.id, lotNumber: "L1", expiresAt: new Date("2026-12-01"), quantity: 3, unitCost: 2 }],
    });

    await expect(
      createSaleWithFefo({
        docNumber: "V-1",
        clientId: client.id,
        saleDate: new Date("2026-09-01"),
        createdById: user.id,
        items: [{ materialId: material.id, quantity: 10, unitPrice: 5 }],
      })
    ).rejects.toThrow(/Estoque insuficiente/);

    // Nenhum lote deve ter sido alterado (transacao revertida por completo).
    const lot = await prisma.stockLot.findFirst({ where: { materialId: material.id } });
    expect(Number(lot!.currentQuantity)).toBe(3);
  });

  it("endpoint POST /sales exige autenticacao e token CSRF, e persiste a venda", async () => {
    const { supplier, material, client } = await seedMaterialSupplierClient();
    const user = await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });
    await createStockEntry({
      supplierId: supplier.id,
      invoiceNumber: "NF-1",
      entryDate: new Date("2026-01-01"),
      createdById: user.id,
      items: [{ materialId: material.id, lotNumber: "L1", expiresAt: new Date("2026-12-01"), quantity: 10, unitCost: 2 }],
    });

    const cookie = await loginAndGetCookie(app, "op@teste.com", "SenhaForte12345");
    const { token, cookie: fullCookie } = await getCsrfToken(app, cookie);

    const res = await app.inject({
      method: "POST",
      url: "/sales",
      headers: { cookie: fullCookie, "x-csrf-token": token },
      payload: {
        docNumber: "V-API-1",
        clientId: client.id,
        saleDate: "2026-09-01",
        items: [{ materialId: material.id, quantity: 4, unitPrice: 10 }],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.sale.total).toBe("40");
  });
});
