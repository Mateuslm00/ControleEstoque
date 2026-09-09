import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { resetDb, createUser } from "./helpers.js";
import { prisma } from "../src/db/prisma.js";
import { createStockEntry, createSaleWithFefo } from "../src/modules/stock/stock.service.js";
import { renderRomaneioHtml } from "../src/modules/romaneio/romaneio.service.js";

describe("romaneio", () => {
  beforeAll(async () => {});
  afterAll(async () => {
    await prisma.$disconnect();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it("nunca inclui custo unitario ou markup no HTML gerado", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "Fornecedor" } });
    const material = await prisma.material.create({ data: { name: "Item", sku: "IT-1", unit: "UN" } });
    const client = await prisma.client.create({ data: { name: "Cliente X" } });
    const user = await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });

    await createStockEntry({
      supplierId: supplier.id,
      invoiceNumber: "NF-1",
      entryDate: new Date("2026-01-01"),
      createdById: user.id,
      items: [{ materialId: material.id, lotNumber: "L1", expiresAt: new Date("2026-12-01"), quantity: 10, unitCost: 2.5 }],
    });

    const sale = await createSaleWithFefo({
      docNumber: "V-1",
      clientId: client.id,
      saleDate: new Date("2026-09-01"),
      createdById: user.id,
      items: [{ materialId: material.id, quantity: 4, unitPrice: 9.99 }],
    });

    const html = await renderRomaneioHtml(sale.id);

    // O custo de compra (2.5, ou "2.5") nunca deve aparecer no romaneio do cliente.
    expect(html).not.toMatch(/2[.,]5/);
    expect(html.toLowerCase()).not.toContain("markup");
    expect(html.toLowerCase()).not.toContain("custo");
    // Mas o preco de venda e o total devem estar presentes.
    expect(html).toContain("9.99");
  });

  it("escapa nomes com caracteres HTML para evitar XSS", async () => {
    const supplier = await prisma.supplier.create({ data: { name: "Fornecedor" } });
    const material = await prisma.material.create({ data: { name: '<script>alert(1)</script>', sku: "IT-XSS", unit: "UN" } });
    const client = await prisma.client.create({ data: { name: 'Cliente & "Especial"' } });
    const user = await createUser({ email: "op@teste.com", password: "SenhaForte12345", role: "OPERACIONAL" });

    await createStockEntry({
      supplierId: supplier.id,
      invoiceNumber: "NF-1",
      entryDate: new Date("2026-01-01"),
      createdById: user.id,
      items: [{ materialId: material.id, lotNumber: "L1", expiresAt: new Date("2026-12-01"), quantity: 5, unitCost: 1 }],
    });

    const sale = await createSaleWithFefo({
      docNumber: "V-XSS",
      clientId: client.id,
      saleDate: new Date("2026-09-01"),
      createdById: user.id,
      items: [{ materialId: material.id, quantity: 1, unitPrice: 5 }],
    });

    const html = await renderRomaneioHtml(sale.id);

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;Especial&quot;");
  });
});
