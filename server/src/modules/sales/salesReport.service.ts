import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";

type SaleWithItems = Prisma.SaleGetPayload<{
  include: {
    client: true;
    items: { include: { material: true; consumptions: true } };
  };
}>;

/**
 * Custo medio ponderado do item, a partir dos lotes de fato consumidos por
 * essa venda (SaleItemLotConsumption.unitCostSnapshot) — nao o custo atual
 * do material, que pode ter mudado desde a venda. E' o mesmo dado que
 * server/src/modules/stock/stock.service.ts grava no momento do FEFO.
 */
function weightedAvgCost(item: SaleWithItems["items"][number]): number {
  const totalQty = item.consumptions.reduce((acc, c) => acc + Number(c.quantity), 0);
  if (totalQty <= 0) return 0;
  const totalCost = item.consumptions.reduce((acc, c) => acc + Number(c.quantity) * Number(c.unitCostSnapshot), 0);
  return totalCost / totalQty;
}

/**
 * Gera o relatorio de saidas como .xlsx de verdade (nao CSV).
 *
 * Motivo: um CSV nao carrega largura de coluna nem formato de celula —
 * o Excel decide sozinho como exibir cada valor, e ao reconhecer a coluna
 * de data como data de verdade (por causa do formato DD/MM/AAAA) ele passa
 * a exigir espaco de data, mostrando "####" quando a coluna (estreita por
 * padrao em CSV) nao cabe o valor. Um .xlsx real controla largura de
 * coluna, altura de linha e formato numerico direto na celula, entao o
 * problema nao acontece.
 *
 * canSeeCost controla as colunas de custo/markup: elas so existem aqui,
 * neste relatorio interno — o romaneio do cliente (romaneio.service.ts)
 * nunca inclui essa informacao, por regra de negocio.
 */
export async function buildSalesReportXlsx(
  sales: SaleWithItems[],
  opts: { canSeeTotals: boolean; canSeeCost: boolean; periodoStr: string }
): Promise<Buffer> {
  const { canSeeTotals, canSeeCost, periodoStr } = opts;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Estoque Pimentel";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Saídas", {
    views: [{ state: "frozen", ySplit: 6 }],
  });

  const columns = [
    { header: "Data", key: "data", width: 14 },
    { header: "Romaneio", key: "romaneio", width: 18 },
    { header: "Cliente/Unidade", key: "cliente", width: 30 },
    { header: "Material", key: "material", width: 32 },
    { header: "Quantidade", key: "quantidade", width: 14 },
    { header: "Unidade", key: "unidade", width: 12 },
    ...(canSeeTotals
      ? [
          { header: "Preço unitário", key: "precoUnit", width: 16 },
          { header: "Subtotal", key: "subtotal", width: 16 },
        ]
      : []),
    ...(canSeeCost
      ? [
          { header: "Custo unitário", key: "custoUnit", width: 16 },
          { header: "Custo total", key: "custoTotal", width: 16 },
          { header: "Markup (%)", key: "markup", width: 14 },
        ]
      : []),
  ];

  sheet.columns = columns;
  const lastCol = columns.length;
  const lastColLetter = sheet.getColumn(lastCol).letter;
  // Onde entra a linha de "Total da venda X" / "TOTAL GERAL": a última
  // coluna monetária que existir (subtotal, ou custo total se não houver
  // colunas de venda visíveis para este perfil).
  const totalAnchorCol = canSeeTotals
    ? columns.findIndex((c) => c.key === "subtotal") + 1
    : canSeeCost
      ? columns.findIndex((c) => c.key === "custoTotal") + 1
      : 0;

  // ---------- Cabeçalho do relatório (título + período + gerado em) ----------
  sheet.mergeCells(1, 1, 1, lastCol);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = "Relatório de Saídas — Estoque Pimentel";
  titleCell.font = { bold: true, size: 15, color: { argb: "FF0F5B52" } };
  sheet.getRow(1).height = 26;

  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getCell(2, 1).value = `Período: ${periodoStr}`;
  sheet.getCell(2, 1).font = { size: 11, color: { argb: "FF5B6B68" } };

  sheet.mergeCells(3, 1, 3, lastCol);
  sheet.getCell(3, 1).value = `Gerado em: ${new Date().toLocaleString("pt-BR")}`;
  sheet.getCell(3, 1).font = { size: 11, color: { argb: "FF5B6B68" } };

  // Linha 4 fica em branco de propósito (respiro visual antes da tabela).
  sheet.getRow(4).height = 10;

  // ---------- Cabeçalho da tabela ----------
  const headerRow = sheet.getRow(5);
  headerRow.values = columns.map((c) => c.header);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5B52" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const moneyFmt = '"R$" #,##0.00';

  let rowIndex = 6;
  let grandTotal = 0;

  for (const sale of sales) {
    for (const item of sale.items) {
      const row = sheet.getRow(rowIndex);
      const values: Record<string, ExcelJS.CellValue> = {
        data: sale.saleDate,
        romaneio: sale.docNumber,
        cliente: sale.client.name,
        material: item.material.name,
        quantidade: Number(item.quantity),
        unidade: item.material.unit,
      };
      if (canSeeTotals) {
        values.precoUnit = Number(item.unitPrice);
        values.subtotal = Number(item.subtotal);
      }
      if (canSeeCost) {
        const avgCost = weightedAvgCost(item);
        const custoTotal = avgCost * Number(item.quantity);
        values.custoUnit = avgCost;
        values.custoTotal = custoTotal;
        values.markup = avgCost > 0 ? ((Number(item.unitPrice) - avgCost) / avgCost) * 100 : null;
      }
      row.values = values;
      row.height = 20;
      row.getCell("data").numFmt = "dd/mm/yyyy";
      row.getCell("quantidade").alignment = { horizontal: "center" };
      if (canSeeTotals) {
        row.getCell("precoUnit").numFmt = moneyFmt;
        row.getCell("subtotal").numFmt = moneyFmt;
      }
      if (canSeeCost) {
        row.getCell("custoUnit").numFmt = moneyFmt;
        row.getCell("custoTotal").numFmt = moneyFmt;
        row.getCell("markup").numFmt = '0.00"%"';
      }
      // Zebra: facilita acompanhar a linha visualmente quando há muitos itens.
      if (rowIndex % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F6F5" } };
        });
      }
      rowIndex += 1;
    }

    // Linha de total por venda: com muitos itens/romaneios no período,
    // fica claro onde cada venda termina e quanto ela somou, sem precisar
    // somar manualmente linha por linha na planilha. Só existe se há algo
    // monetário visível para este perfil (venda ou custo).
    if (totalAnchorCol > 0) {
      grandTotal += Number(sale.total);
      const totalRow = sheet.getRow(rowIndex);
      totalRow.getCell(3).value = `Total da venda ${sale.docNumber}`;
      totalRow.getCell(3).font = { bold: true };
      if (canSeeTotals) {
        const totalCell = totalRow.getCell(totalAnchorCol);
        totalCell.value = Number(sale.total);
        totalCell.numFmt = moneyFmt;
        totalCell.font = { bold: true };
      }
      totalRow.height = 20;
      rowIndex += 1;
    }

    // Linha em branco separando cada venda.
    sheet.getRow(rowIndex).height = 8;
    rowIndex += 1;
  }

  if (canSeeTotals) {
    const grandRow = sheet.getRow(rowIndex);
    grandRow.getCell(3).value = "TOTAL GERAL DO PERÍODO";
    grandRow.getCell(3).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    const grandCell = grandRow.getCell(totalAnchorCol);
    grandCell.value = grandTotal;
    grandCell.numFmt = moneyFmt;
    grandCell.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    grandRow.height = 24;
    for (let c = 1; c <= lastCol; c++) {
      grandRow.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5B52" } };
    }
  }

  sheet.autoFilter = { from: "A5", to: `${lastColLetter}5` };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
