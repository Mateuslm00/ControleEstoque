import { brDate, brl, todayISO } from "../../lib/format.js";
import { EMITENTE, DISTRIMEDICAL_UNIT } from "../../data/constants.js";

/** Escapa caracteres especiais de HTML — nomes de material/tipo/grupo vêm de
 * cadastro do usuário e nunca devem ser interpolados crus na string HTML
 * (mesma regra aplicada no romaneio gerado pelo backend). */
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

/**
 * buildEstoqueHtml
 * -----------------------------------------------------------------------
 * Monta o HTML completo (página independente, com <style> embutido) do
 * relatório de Estoque Atual, usado no botão "Baixar HTML" em
 * RelatorioEstoqueModal.
 *
 * @param {Array} rows - linhas já processadas (ver EstoqueAtualTab)
 * @param {number} totalValue - valor total do estoque atual
 * @returns {string} HTML completo pronto para download/impressão
 * -----------------------------------------------------------------------
 */
export function buildEstoqueHtml(rows, totalValue) {
  const trs = rows.map((r) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${escapeHtml(r.materialName)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${escapeHtml(r.type)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;">${escapeHtml(r.group)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${brDate(r.validity)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:center;">${r.remaining} ${escapeHtml(r.measureUnit)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">${brl(r.purchasePrice)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #ddd;text-align:right;">${brl(r.totalValue)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Relatório de Estoque Atual</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1C2A2A;padding:32px;}
  h1{font-size:18px;margin:0 0 2px 0;}
  .sub{color:#667070;font-size:12px;margin-bottom:20px;}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
  th{background:#EAF3F1;color:#0A4F47;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;}
  .total{font-size:16px;font-weight:bold;text-align:right;margin-top:14px;border-top:2px solid #0A4F47;padding-top:10px;}
</style></head>
<body>
  <h1>Relatório de Estoque Atual</h1>
  <div class="sub">${EMITENTE.name} — Depósito: ${DISTRIMEDICAL_UNIT} — Gerado em ${brDate(todayISO())}</div>
  <table>
    <thead><tr><th>Material</th><th>Tipo</th><th>Grupo</th><th>Validade</th><th>Qtd.</th><th>Valor unitário</th><th>Valor total</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <div class="total">Valor total do estoque atual: ${brl(totalValue)}</div>
</body></html>`;
}
