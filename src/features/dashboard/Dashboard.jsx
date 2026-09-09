import { useMemo } from "react";
import { Package, ShoppingCart, Tag, AlertTriangle } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import StatCard from "../../components/common/StatCard.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import { brl, brDate, daysUntil } from "../../lib/format.js";
import { useCollection } from "../../lib/useApi.js";

/**
 * Dashboard
 * -----------------------------------------------------------------------
 * Painel geral: indicadores consolidados, lotes próximos do vencimento,
 * materiais com estoque baixo e os últimos romaneios de venda emitidos.
 *
 * Busca os próprios dados do backend (lotes ativos, materiais e vendas)
 * em vez de receber tudo pronto via props de App.jsx — cada tela agora é
 * dona da sua própria consulta, o que evita que App.jsx precise conhecer
 * o formato de dados de todas as telas.
 *
 * "Lucro acumulado" saiu do painel: o custo de cada lote consumido numa
 * venda é informação sensível (mesma regra do romaneio — nunca sai para
 * fora do backend sem controle de perfil) e a rota GET /sales atual não
 * agrega esse dado por venda. Fica como possível evolução futura de
 * relatório, não como cálculo aproximado no frontend.
 * -----------------------------------------------------------------------
 */
export default function Dashboard() {
  const { items: lots } = useCollection("/stock/lots?pageSize=200&status=ACTIVE");
  const { items: materials } = useCollection("/materials?pageSize=200");
  const { items: sales } = useCollection("/sales?pageSize=8");

  const expiringSoon = useMemo(() => {
    return lots
      .map((l) => ({ ...l, days: daysUntil(l.expiresAt) }))
      .filter((l) => Number(l.currentQuantity) > 0 && l.days !== null && l.days <= 30)
      .sort((a, b) => a.days - b.days);
  }, [lots]);

  const lowStock = useMemo(() => {
    const byMaterial = {};
    lots.forEach((l) => {
      const id = l.material?.id;
      byMaterial[id] = (byMaterial[id] || 0) + Number(l.currentQuantity);
    });
    return materials
      .filter((m) => m.active)
      .map((m) => ({ ...m, qty: byMaterial[m.id] || 0 }))
      .filter((m) => m.qty <= 5);
  }, [materials, lots]);

  const totalStockValue = lots.reduce((acc, l) => acc + Number(l.currentQuantity) * Number(l.unitCost), 0);
  const totalSalesValue = sales.reduce((acc, s) => acc + Number(s.total || 0), 0);

  return (
    <div>
      <PageHeader title="Painel Geral" subtitle="Visão consolidada do estoque, validades e vendas" />
      <div className="px-4 sm:px-8 flex flex-wrap gap-4">
        <StatCard label="Valor em estoque" value={brl(totalStockValue)} sub="custo dos lotes disponíveis" icon={Package} />
        <StatCard label="Total vendido (últimas 8)" value={brl(totalSalesValue)} sub={`${sales.length} romaneio(s)`} icon={ShoppingCart} />
        <StatCard label="Materiais ativos" value={materials.filter((m) => m.active).length} sub="cadastrados no sistema" icon={Tag} tone="var(--accent)" />
        <StatCard label="Itens vencendo" value={expiringSoon.length} sub="próximos 30 dias" icon={AlertTriangle} tone="var(--danger)" />
      </div>

      <div className="px-4 sm:px-8 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: "var(--danger)" }} />
            <h3 className="font-bold text-sm">Lotes próximos do vencimento</h3>
          </div>
          {expiringSoon.length === 0 ? <EmptyState text="Nenhum lote vencendo nos próximos 30 dias." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Material</th><th>Lote</th><th>Validade</th><th>Qtd.</th></tr></thead>
              <tbody>
                {expiringSoon.slice(0, 8).map((l) => (
                  <tr key={l.id}>
                    <td className="text-sm">{l.material?.name || "—"}</td>
                    <td className="text-sm mono">{l.lotNumber}</td>
                    <td className="text-sm">
                      <span style={{ color: l.days < 0 ? "var(--danger)" : l.days <= 7 ? "var(--accent)" : "var(--text)" }}>
                        {brDate(l.expiresAt)} {l.days < 0 ? "(vencido)" : `(${l.days}d)`}
                      </span>
                    </td>
                    <td className="text-sm mono">{Number(l.currentQuantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package size={16} style={{ color: "var(--primary)" }} />
            <h3 className="font-bold text-sm">Estoque baixo (≤ 5 unidades)</h3>
          </div>
          {lowStock.length === 0 ? <EmptyState text="Nenhum material com estoque baixo." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Material</th><th>Tipo</th><th>Qtd. total</th></tr></thead>
              <tbody>
                {lowStock.map((m) => (
                  <tr key={m.id}>
                    <td className="text-sm">{m.name}</td>
                    <td className="text-sm">{m.type || "-"}</td>
                    <td className="text-sm mono" style={{ color: m.qty === 0 ? "var(--danger)" : "var(--text)" }}>{m.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-8 mt-5 mb-8">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart size={16} style={{ color: "var(--primary)" }} />
            <h3 className="font-bold text-sm">Últimos romaneios de venda</h3>
          </div>
          {sales.length === 0 ? <EmptyState text="Nenhuma venda registrada ainda." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Nº Romaneio</th><th>Data</th><th>Cliente / Unidade</th><th>Venda</th></tr></thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="text-sm mono">{s.docNumber}</td>
                    <td className="text-sm">{brDate(s.saleDate)}</td>
                    <td className="text-sm">{s.client?.name}</td>
                    <td className="text-sm mono font-semibold">{s.total !== undefined ? brl(s.total) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>
    </div>
  );
}
