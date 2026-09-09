import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";

export interface EntryItemInput {
  materialId: string;
  lotNumber: string;
  expiresAt: Date;
  quantity: number;
  unitCost: number;
}

export async function createStockEntry(params: {
  supplierId: string;
  invoiceNumber: string;
  entryDate: Date;
  createdById: string;
  items: EntryItemInput[];
}) {
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: params.supplierId } });
    if (!supplier || !supplier.active) throw Errors.unprocessable("Fornecedor invalido ou inativo");

    let totalValue = new Prisma.Decimal(0);
    for (const item of params.items) {
      const material = await tx.material.findUnique({ where: { id: item.materialId } });
      if (!material || !material.active) {
        throw Errors.unprocessable(`Material invalido ou inativo: ${item.materialId}`);
      }
      totalValue = totalValue.add(new Prisma.Decimal(item.quantity).mul(item.unitCost));
    }

    const entry = await tx.stockEntry.create({
      data: {
        supplierId: params.supplierId,
        invoiceNumber: params.invoiceNumber,
        entryDate: params.entryDate,
        totalValue,
        createdById: params.createdById,
      },
    });

    for (const item of params.items) {
      const entryItem = await tx.stockEntryItem.create({
        data: {
          entryId: entry.id,
          materialId: item.materialId,
          lotNumber: item.lotNumber,
          expiresAt: item.expiresAt,
          quantity: item.quantity,
          unitCost: item.unitCost,
        },
      });

      await tx.stockLot.create({
        data: {
          materialId: item.materialId,
          supplierId: params.supplierId,
          lotNumber: item.lotNumber,
          expiresAt: item.expiresAt,
          initialQuantity: item.quantity,
          currentQuantity: item.quantity,
          unitCost: item.unitCost,
          sourceEntryItemId: entryItem.id,
          status: "ACTIVE",
        },
      });
    }

    return entry;
  });
}

export interface SaleItemInput {
  materialId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Consome lotes por FEFO (vence primeiro, sai primeiro) dentro de uma transacao
 * com lock otimista via campo `version`, evitando estoque negativo em concorrencia.
 */
export async function createSaleWithFefo(params: {
  docNumber: string;
  clientId: string;
  saleDate: Date;
  createdById: string;
  recipientEmail?: string;
  items: SaleItemInput[];
}) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({ where: { id: params.clientId } });
    if (!client || !client.active) throw Errors.unprocessable("Cliente/unidade invalido ou inativo");

    let total = new Prisma.Decimal(0);
    const sale = await tx.sale.create({
      data: {
        docNumber: params.docNumber,
        clientId: params.clientId,
        saleDate: params.saleDate,
        total: 0,
        createdById: params.createdById,
        recipientEmail: params.recipientEmail,
      },
    });

    for (const item of params.items) {
      if (item.quantity <= 0) throw Errors.badRequest("Quantidade deve ser positiva");

      const material = await tx.material.findUnique({ where: { id: item.materialId } });
      if (!material || !material.active) {
        throw Errors.unprocessable(`Material invalido ou inativo: ${item.materialId}`);
      }

      const subtotal = new Prisma.Decimal(item.quantity).mul(item.unitPrice);
      total = total.add(subtotal);

      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          materialId: item.materialId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal,
        },
      });

      let remaining = new Prisma.Decimal(item.quantity);

      // FEFO: lotes ativos do material, ordenados por data de vencimento.
      const lots = await tx.stockLot.findMany({
        where: { materialId: item.materialId, status: "ACTIVE" },
        orderBy: { expiresAt: "asc" },
      });

      for (const lot of lots) {
        if (remaining.lte(0)) break;
        if (lot.currentQuantity.lte(0)) continue;

        const take = Prisma.Decimal.min(remaining, lot.currentQuantity);
        const newQuantity = lot.currentQuantity.sub(take);

        // Lock otimista: so aplica se ninguem mais alterou o lote nesse meio-tempo.
        const updateResult = await tx.stockLot.updateMany({
          where: { id: lot.id, version: lot.version },
          data: {
            currentQuantity: newQuantity,
            status: newQuantity.eq(0) ? "DEPLETED" : "ACTIVE",
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw Errors.conflict("Lote alterado concorrentemente, tente novamente");
        }

        await tx.saleItemLotConsumption.create({
          data: {
            saleItemId: saleItem.id,
            stockLotId: lot.id,
            quantity: take,
            unitCostSnapshot: lot.unitCost,
          },
        });

        remaining = remaining.sub(take);
      }

      if (remaining.gt(0)) {
        throw Errors.unprocessable(
          `Estoque insuficiente para o material ${material.name}: faltam ${remaining.toString()} ${material.unit}`
        );
      }
    }

    return tx.sale.update({ where: { id: sale.id }, data: { total } });
  });
}
