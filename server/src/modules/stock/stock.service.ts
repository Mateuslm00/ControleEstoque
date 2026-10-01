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
  receivingUnit?: string | null;
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
        receivingUnit: params.receivingUnit ?? null,
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

async function entryHasConsumption(tx: Prisma.TransactionClient, entryId: string): Promise<boolean> {
  const count = await tx.saleItemLotConsumption.count({
    where: { stockLot: { sourceEntryItem: { entryId } } },
  });
  return count > 0;
}

/**
 * Edita uma entrada. Se nenhum lote dela foi consumido por vendas, tudo pode mudar
 * (itens e lotes sao recriados). Se ja houve saidas, so cabecalho (fornecedor, NFe, data)
 * pode mudar; mexer em material, lote, validade, quantidade ou custo retorna 409.
 */
export async function updateStockEntry(
  entryId: string,
  params: { supplierId: string; invoiceNumber: string; entryDate: Date; receivingUnit?: string | null; items: EntryItemInput[] }
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.stockEntry.findUnique({
      where: { id: entryId },
      include: { items: { orderBy: { createdAt: "asc" } } },
    });
    if (!current) throw Errors.notFound("Entrada nao encontrada");

    if (params.supplierId !== current.supplierId) {
      const supplier = await tx.supplier.findUnique({ where: { id: params.supplierId } });
      if (!supplier || !supplier.active) throw Errors.unprocessable("Fornecedor invalido ou inativo");
    }

    const consumed = await entryHasConsumption(tx, entryId);

    if (consumed) {
      const sameItems =
        params.items.length === current.items.length &&
        params.items.every((it, i) => {
          const cur = current.items[i]!;
          return (
            it.materialId === cur.materialId &&
            it.lotNumber === cur.lotNumber &&
            it.expiresAt.getTime() === cur.expiresAt.getTime() &&
            cur.quantity.eq(it.quantity) &&
            cur.unitCost.eq(it.unitCost)
          );
        });
      if (!sameItems) {
        throw Errors.conflict(
          "Esta entrada ja teve saidas (vendas) e so permite alterar fornecedor, NFe e data. Material, lote, validade, quantidade e custo estao travados."
        );
      }
      await tx.stockLot.updateMany({
        where: { sourceEntryItem: { entryId } },
        data: { supplierId: params.supplierId },
      });
      return tx.stockEntry.update({
        where: { id: entryId },
        data: {
          supplierId: params.supplierId,
          invoiceNumber: params.invoiceNumber,
          entryDate: params.entryDate,
          receivingUnit: params.receivingUnit ?? null,
        },
      });
    }

    let totalValue = new Prisma.Decimal(0);
    for (const item of params.items) {
      const material = await tx.material.findUnique({ where: { id: item.materialId } });
      const wasUsed = current.items.some((c) => c.materialId === item.materialId);
      if (!material || (!material.active && !wasUsed)) {
        throw Errors.unprocessable(`Material invalido ou inativo: ${item.materialId}`);
      }
      totalValue = totalValue.add(new Prisma.Decimal(item.quantity).mul(item.unitCost));
    }

    await tx.stockLot.deleteMany({ where: { sourceEntryItem: { entryId } } });
    await tx.stockEntryItem.deleteMany({ where: { entryId } });

    for (const item of params.items) {
      const entryItem = await tx.stockEntryItem.create({
        data: {
          entryId,
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

    return tx.stockEntry.update({
      where: { id: entryId },
      data: {
        supplierId: params.supplierId,
        invoiceNumber: params.invoiceNumber,
        entryDate: params.entryDate,
        receivingUnit: params.receivingUnit ?? null,
        totalValue,
      },
    });
  });
}

/** Exclui uma entrada e seus lotes, desde que nenhum lote tenha saidas vinculadas. */
export async function deleteStockEntry(entryId: string) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.stockEntry.findUnique({ where: { id: entryId }, include: { items: true } });
    if (!entry) throw Errors.notFound("Entrada nao encontrada");

    if (await entryHasConsumption(tx, entryId)) {
      throw Errors.conflict("Esta entrada ja teve saidas (vendas) vinculadas ao seu estoque e nao pode ser excluida.");
    }

    await tx.stockLot.deleteMany({ where: { sourceEntryItem: { entryId } } });
    await tx.stockEntry.delete({ where: { id: entryId } });
    return entry;
  });
}
