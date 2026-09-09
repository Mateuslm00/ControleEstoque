import { useState, useMemo } from "react";
import { Search, FileBarChart, Warehouse, Package, Tag, AlertTriangle } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import StatCard from "../../components/common/StatCard.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import { brDate, brl, daysUntil } from "../../lib/format.js";
import { useCollection } from "../../lib/useApi.js";
import RelatorioEstoqueModal from "./RelatorioEstoqueModal.jsx";

/**
 * EstoqueAtualTab
 * -----------------------------------------------------------------------
 * Mostra o saldo atual por lote, com validade e valor individual/total.
 * Busca direto de GET /stock/lots?status=ACTIVE — o saldo (currentQuantity)
 * já vem calculado pelo backend a partir do consumo real por FEFO, então
 * não há mais nenhuma derivação de "entradas − saídas" no frontend.
 * -----------------------------------------------------------------------
 */
export default function EstoqueAtualTab() {
  const { items: lots, loading, error } = useCollection("/stock/lots?pageSize=200&status=ACTIVE");
  const [filter, setFilter] = useState("");
  const [showReport, setShowReport] = useState(false);

  const rows = useMemo(() => {
    return lots
      .filter((l) => Number(l.currentQuantity) > 0)
      .map((l) => ({
        id: l.id,
        materialId: l.material?.id,
        materialName: l.material?.name || "—",
        type: l.material?.type || "-",
        group: l.material?.group || "-",
        measureUnit: l.material?.unit || "un",
        validity: l.expiresAt,
        remaining: Number(l.currentQuantity),
        purchasePrice: Number(l.unitCost),
        totalValue: Number(l.currentQuantity) * Number(l.unitCost),
        days: daysUntil(l.expiresAt),
      }))
      .filter((r) => r.materialName.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => a.materialName.localeCompare(b.materialName) || (a.validity || "9999").localeCompare(b.validity || "9999"));
  }, [lots, filter]);

  const totalValue = rows.reduce((acc, r) => acc + r.totalValue, 0);
  const totalQty = rows.reduce((acc, r) => acc + r.remaining, 0);
  const distinctMaterials = new Set(rows.map((r) => r.materialId)).size;
  const expiringCount = rows.filter((r) => r.days !== null && r.days <= 30).length;

  return (
    <div>
      <PageHeader
        title="Estoque Atual"
        subtitle="Saldo por lote, com validades e valores individuais e totais"
        action={
          <button onClick={() => setShowReport(true)} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2">
            <FileBarChart size={16} />Gerar relatório
          </button>
        }
      />

      <div className="px-4 sm:px-8 flex flex-wrap gap-4">
        <StatCard label="Valor total em estoque" value={brl(totalValue)} sub="soma de todos os lotes disponíveis" icon={Warehouse} />
        <StatCard label="Quantidade total" value={totalQty} sub="unidades/caixas/litros somados" icon={Package} />
        <StatCard label="Materiais distintos" value={distinctMaterials} sub="com saldo em estoque" icon={Tag} />
        <StatCard label="Lotes vencendo" value={expiringCount} sub="próximos 30 dias" icon={AlertTriangle} tone="var(--danger)" />
      </div>

      <div className="px-4 sm:px-8 mt-6 mb-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input className="pl-9" placeholder="Buscar material..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando estoque...</div>
          ) : rows.length === 0 ? <EmptyState text="Nenhum lote em estoque no momento." /> : (
            <>
              <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>Material</th><th>Tipo</th><th>Grupo</th><th>Validade</th>
                    <th>Quantidade</th><th>Valor individual</th><th>Valor total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="text-sm font-medium">{r.materialName}</td>
                      <td className="text-sm">{r.type}</td>
                      <td className="text-sm">{r.group}</td>
                      <td className="text-sm">
                        <span style={{ color: r.days !== null && r.days < 0 ? "var(--danger)" : r.days !== null && r.days <= 30 ? "var(--accent)" : "var(--text)" }}>
                          {brDate(r.validity)}
                        </span>
                      </td>
                      <td className="text-sm mono">{r.remaining} {r.measureUnit}</td>
                      <td className="text-sm mono">{brl(r.purchasePrice)}</td>
                      <td className="text-sm mono font-semibold">{brl(r.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <div className="flex justify-end px-4 py-4" style={{ borderTop: "2px solid var(--border)" }}>
                <div className="text-right">
                  <div className="text-xs uppercase font-bold" style={{ color: "var(--muted)" }}>Valor total do estoque atual</div>
                  <div className="mono text-xl font-extrabold" style={{ color: "var(--primary-dark)" }}>{brl(totalValue)}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showReport && (
        <RelatorioEstoqueModal rows={rows} totalValue={totalValue} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}
