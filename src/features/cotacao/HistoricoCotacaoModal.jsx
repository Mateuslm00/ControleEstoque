import { Award } from "lucide-react";
import Modal from "../../components/common/Modal.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import { brDate, brl } from "../../lib/format.js";

/**
 * HistoricoCotacaoModal
 * -----------------------------------------------------------------------
 * Mostra todas as cotações já registradas de um material específico
 * (dados vindos de GET /quotes/materials/:id/history), ordenadas da mais
 * recente para a mais antiga, com o preço de cada fornecedor e a
 * economia entre o melhor e o pior preço em cada rodada.
 *
 * Props:
 *  - material: objeto do material (para exibir o nome no título)
 *  - quotes: cotações desse material como vêm do backend
 *    (cada uma com `quoteDate` e `items: [{ price, supplier }]`)
 *  - onClose: () => void
 * -----------------------------------------------------------------------
 */
export default function HistoricoCotacaoModal({ material, quotes, onClose }) {
  return (
    <Modal title={`Histórico de cotações — ${material?.name || ""}`} onClose={onClose} wide>
      {quotes.length === 0 ? <EmptyState text="Nenhuma cotação registrada para este material." /> : (
        <div className="space-y-4">
          {quotes.map((q) => {
            const sorted = [...q.items].sort((a, b) => a.price - b.price);
            const best = sorted[0], worst = sorted[sorted.length - 1];
            const economia = best && worst && worst.price > 0 ? ((worst.price - best.price) / worst.price) * 100 : 0;
            return (
              <div key={q.id} className="card p-4" style={{ background: "#FAFBFB" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{brDate(q.quoteDate)}</span>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>{q.items.length} fornecedores</span>
                </div>
                <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                  <thead><tr><th>Fornecedor</th><th>Preço</th></tr></thead>
                  <tbody>
                    {sorted.map((item, idx) => (
                      <tr key={item.id}>
                        <td className="text-sm flex items-center gap-1 py-1.5">
                          {idx === 0 && <Award size={12} style={{ color: "var(--accent)" }} />}{item.supplier?.name}
                        </td>
                        <td className="text-sm mono">{brl(item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                <div className="text-right text-xs mt-2" style={{ color: "var(--primary-dark)" }}>
                  Economia entre fornecedores: <b>{economia.toFixed(1)}%</b>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
