import { prisma } from "../../db/prisma.js";
import { Errors } from "../../shared/errors/AppError.js";
import { escapeHtml } from "./htmlEscape.js";

export async function getRomaneioData(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      client: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { material: true } },
    },
  });
  if (!sale) throw Errors.notFound("Venda nao encontrada");
  return sale;
}

/**
 * Gera o HTML do romaneio. NUNCA inclui custo unitario ou markup —
 * apenas preco de venda, quantidade e subtotal, conforme regra de negocio.
 * Todo valor dinamico (nomes, observacoes) e escapado para evitar XSS.
 */
export async function renderRomaneioHtml(saleId: string): Promise<string> {
  const sale = await getRomaneioData(saleId);

  const rows = sale.items
    .map(
      (item) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${escapeHtml(item.material.name)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${item.quantity.toString()} ${escapeHtml(item.material.unit)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">R$ ${item.unitPrice.toString()}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">R$ ${item.subtotal.toString()}</td>
    </tr>`
    )
    .join("");

  const dataEmissao = sale.saleDate.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Romaneio ${escapeHtml(sale.docNumber)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1C2A2A;padding:32px;}
  h1{font-size:18px;margin:0 0 2px 0;}
  .sub{color:#667070;font-size:12px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
  th{background:#EAF3F1;color:#0A4F47;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;}
  .box{border:1px solid #E1E7E6;border-radius:8px;padding:14px;margin-top:14px;}
  .total{font-size:16px;font-weight:bold;text-align:right;margin-top:10px;}
  .sig{margin-top:60px;display:flex;gap:40px;}
  .sig div{flex:1;border-top:1px solid #333;text-align:center;padding-top:6px;font-size:12px;}
</style></head>
<body>
  <h1>Romaneio de Venda Nº ${escapeHtml(sale.docNumber)}</h1>
  <div class="sub">Estoque Pimentel — Emitido em ${dataEmissao}</div>
  <div class="box">
    <b>Cliente / Unidade:</b> ${escapeHtml(sale.client.name)}<br/>
    <b>CNPJ:</b> ${escapeHtml(sale.client.cnpj ?? "não informado")}
  </div>
  <table>
    <thead><tr><th>Material</th><th style="text-align:center;">Qtd.</th><th style="text-align:right;">Preço unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total do romaneio: R$ ${sale.total.toString()}</div>
  <div class="sig">
    <div>Responsável pela entrega</div>
    <div>Recebido por (${escapeHtml(sale.client.name)})</div>
  </div>
</body></html>`;
}
