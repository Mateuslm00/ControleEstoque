/**
 * StatCard
 * -----------------------------------------------------------------------
 * Cartão usado nos painéis de resumo (Dashboard, Estoque Atual, Cotação)
 * para exibir um indicador numérico com rótulo, ícone e texto de apoio.
 *
 * Props:
 *  - label: string — rótulo curto (ex: "Valor em estoque")
 *  - value: string|number — valor em destaque
 *  - sub?: string — texto pequeno de apoio abaixo do valor
 *  - icon?: componente de ícone (lucide-react)
 *  - tone?: string — cor customizada do ícone (CSS var ou hex)
 * -----------------------------------------------------------------------
 */
export default function StatCard({ label, value, sub, icon: Icon, tone }) {
  return (
    <div className="card p-5 flex-1 min-w-[200px]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
        {Icon && <Icon size={16} style={{ color: tone || "var(--primary)" }} />}
      </div>
      <div className="mono text-2xl font-bold mt-2" style={{ color: "var(--text)" }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}
