import { Download, Printer } from "lucide-react";
import Modal from "../../components/common/Modal.jsx";
import { brDate, brl, todayISO } from "../../lib/format.js";
import { EMITENTE, DISTRIMEDICAL_UNIT } from "../../data/constants.js";
import { buildEstoqueHtml } from "./relatorioEstoqueHtml.js";

/**
 * RelatorioEstoqueModal
 * -----------------------------------------------------------------------
 * Exibe o relatório de Estoque Atual em um modal, com opção de imprimir
 * (usa a classe .print-area / @media print definida em index.css) ou
 * baixar como um arquivo HTML independente.
 *
 * Props:
 *  - rows: linhas já processadas (ver EstoqueAtualTab)
 *  - totalValue: valor total do estoque atual
 *  - onClose: () => void
 * -----------------------------------------------------------------------
 */
export default function RelatorioEstoqueModal({ rows, totalValue, onClose }) {
  const doPrint = () => window.print();
  const doDownload = () => {
    const html = buildEstoqueHtml(rows, totalValue);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-atual-${todayISO()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title="Relatório de Estoque Atual" onClose={onClose} wide noPad>
      <div className="flex justify-end gap-2 px-5 pt-1 pb-3 no-print">
        <button onClick={doDownload} className="btn-outline rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2"><Download size={14} />Baixar HTML</button>
        <button onClick={doPrint} className="btn-primary rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2"><Printer size={14} />Imprimir</button>
      </div>
      <div className="print-area px-6 pb-6">
        <div className="mb-1">
          <div className="font-extrabold text-lg">Relatório de Estoque Atual</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{EMITENTE.name} — Depósito: {DISTRIMEDICAL_UNIT} — Gerado em {brDate(todayISO())}</div>
        </div>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] mt-3">
          <thead><tr><th>Material</th><th>Tipo</th><th>Grupo</th><th>Validade</th><th>Qtd.</th><th>Valor unitário</th><th>Valor total</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-sm">{r.materialName}</td>
                <td className="text-sm">{r.type}</td>
                <td className="text-sm">{r.group}</td>
                <td className="text-sm">{brDate(r.validity)}</td>
                <td className="text-sm mono">{r.remaining} {r.measureUnit}</td>
                <td className="text-sm mono">{brl(r.purchasePrice)}</td>
                <td className="text-sm mono font-semibold">{brl(r.totalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="text-right mt-4 pt-3 text-lg font-extrabold" style={{ borderTop: "2px solid var(--primary-dark)", color: "var(--primary-dark)" }}>
          Valor total do estoque atual: {brl(totalValue)}
        </div>
      </div>
    </Modal>
  );
}
