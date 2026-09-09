import { useEffect, useState } from "react";
import { Plus, CheckCircle2, Clock, AlertTriangle, BarChart3, Award, History } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import StatCard from "../../components/common/StatCard.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import { brDate, brl } from "../../lib/format.js";
import { apiFetch } from "../../lib/api.js";
import { useCollection } from "../../lib/useApi.js";
import { MIN_QUOTES } from "../../data/constants.js";
import NovaCotacaoModal from "./NovaCotacaoModal.jsx";
import HistoricoCotacaoModal from "./HistoricoCotacaoModal.jsx";

const STATUS_LABEL = {
  EM_DIA: "Em dia",
  VENCE_EM_BREVE: "Vence em breve",
  VENCIDA: "Cotação vencida",
  SEM_COTACAO: "Nunca cotado",
};
const STATUS_BADGE = {
  EM_DIA: { bg: "#E4F3EC", color: "#1E7A4C" },
  VENCE_EM_BREVE: { bg: "#FBF0E0", color: "#8A5A11" },
  VENCIDA: { bg: "#FBEAE8", color: "var(--danger)" },
  SEM_COTACAO: { bg: "#EDEFEF", color: "var(--muted)" },
};

/**
 * CotacaoTab
 * -----------------------------------------------------------------------
 * Tela de Cotação de Preços: regra de negócio é recotar cada material a
 * cada 2 meses com no mínimo MIN_QUOTES fornecedores.
 *
 * Toda a lógica de status (em dia / vence em breve / vencida / nunca
 * cotado) e as últimas 15 cotações agora vêm prontas do backend
 * (GET /quotes/materials/status e GET /quotes/latest — ver
 * server/src/modules/quotes/quotes.routes.ts), em vez de recalculadas
 * aqui a partir de todo o histórico. Isso evita ter a mesma regra de
 * "bimestre vencido" implementada duas vezes (frontend e backend) —
 * que é exatamente o tipo de duplicação que causa inconsistência quando
 * alguém muda uma regra só de um lado.
 * -----------------------------------------------------------------------
 */
export default function CotacaoTab() {
  const { items: suppliers } = useCollection("/suppliers?pageSize=200&active=true");
  const { items: recentQuotes, reload: reloadRecent } = useCollection("/quotes/latest");

  const [materialsStatus, setMaterialsStatus] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState("");

  const [open, setOpen] = useState(false);
  const [historyMaterial, setHistoryMaterial] = useState(null);
  const [historyQuotes, setHistoryQuotes] = useState([]);
  const [filterStatus, setFilterStatus] = useState("Todos");

  const materials = materialsStatus.map((row) => row.material);

  const loadStatus = () => {
    setLoadingStatus(true);
    apiFetch("/quotes/materials/status")
      .then((data) => {
        setMaterialsStatus(data.items);
        setStats(data.stats);
      })
      .catch((err) => setStatusError(err.message || "Erro ao carregar status das cotações"))
      .finally(() => setLoadingStatus(false));
  };

  useEffect(loadStatus, []);

  const openHistory = async (material) => {
    setHistoryMaterial(material);
    const data = await apiFetch(`/quotes/materials/${material.id}/history`);
    setHistoryQuotes(data.items);
  };

  const onQuoteSaved = () => {
    loadStatus();
    reloadRecent();
  };

  const filteredRows = materialsStatus.filter((row) => {
    if (filterStatus === "Todos") return true;
    if (filterStatus === "Em dia") return row.status === "EM_DIA";
    if (filterStatus === "Vencidas") return row.status === "VENCIDA";
    if (filterStatus === "Vence em breve") return row.status === "VENCE_EM_BREVE";
    if (filterStatus === "Nunca cotado") return row.status === "SEM_COTACAO";
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Cotação de Preços"
        subtitle={`Cotação bimestral de cada material com no mínimo ${MIN_QUOTES} fornecedores diferentes`}
        action={<button onClick={() => setOpen(true)} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Plus size={16} />Nova cotação</button>}
      />

      {statusError && <div className="px-4 sm:px-8 text-sm mb-2" style={{ color: "var(--danger)" }}>{statusError}</div>}

      {stats && (
        <div className="px-4 sm:px-8 flex flex-wrap gap-4">
          <StatCard label="Em dia" value={stats.emDia} sub="cotadas nos últimos 2 meses" icon={CheckCircle2} />
          <StatCard label="Vencendo em breve" value={stats.venceEmBreve} sub="≤ 10 dias para vencer" icon={Clock} tone="var(--accent)" />
          <StatCard label="Vencidas" value={stats.vencidas} sub="precisam de nova cotação" icon={AlertTriangle} tone="var(--danger)" />
          <StatCard label="Nunca cotados" value={stats.semCotacao} sub="sem nenhuma cotação registrada" icon={BarChart3} tone="var(--primary)" />
        </div>
      )}

      <div className="px-4 sm:px-8 mt-6">
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} style={{ color: "var(--primary)" }} />
            <h3 className="font-bold text-sm">Últimas cotações — menor vs. maior preço</h3>
          </div>
          {recentQuotes.length === 0 ? <EmptyState text="Nenhuma cotação registrada ainda." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th>Data</th><th>Material</th>
                  <th>Menor preço</th><th>Fornecedor (menor)</th>
                  <th>Maior preço</th><th>Fornecedor (maior)</th>
                  <th>Economia</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((q) => {
                  const sorted = [...q.items].sort((a, b) => a.price - b.price);
                  const best = sorted[0], worst = sorted[sorted.length - 1];
                  const economia = best && worst && worst.price > 0 ? ((worst.price - best.price) / worst.price) * 100 : 0;
                  return (
                    <tr key={q.id}>
                      <td className="text-sm">{brDate(q.quoteDate)}</td>
                      <td className="text-sm font-medium">{q.material?.name}</td>
                      <td className="text-sm mono font-semibold" style={{ color: "var(--primary-dark)" }}>{brl(best?.price)}</td>
                      <td className="text-sm flex items-center gap-1"><Award size={12} style={{ color: "var(--accent)" }} />{best?.supplier?.name}</td>
                      <td className="text-sm mono" style={{ color: "var(--danger)" }}>{brl(worst?.price)}</td>
                      <td className="text-sm">{worst?.supplier?.name}</td>
                      <td className="text-sm mono font-semibold">{economia.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-8 mt-6 mb-4 flex items-center gap-2">
        <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Filtrar:</span>
        {["Todos", "Em dia", "Vence em breve", "Vencidas", "Nunca cotado"].map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold"
            style={{
              background: filterStatus === f ? "var(--primary)" : "#F0F3F2",
              color: filterStatus === f ? "white" : "var(--muted)",
            }}
          >{f}</button>
        ))}
      </div>

      <div className="px-4 sm:px-8 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
        {loadingStatus ? (
          <div className="col-span-2 text-sm" style={{ color: "var(--muted)" }}>Carregando materiais...</div>
        ) : filteredRows.length === 0 ? (
          <div className="col-span-2"><EmptyState text="Nenhum material encontrado para este filtro." /></div>
        ) : filteredRows.map((row) => {
          const m = row.material;
          const badgeStyle = STATUS_BADGE[row.status];
          return (
            <div key={m.id} className="card p-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="font-bold text-sm">{m.name}</div>
                  <div className="text-xs" style={{ color: "var(--muted)" }}>{m.type} · {m.group}</div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
                  {STATUS_LABEL[row.status]}
                </span>
              </div>

              {row.lastQuoteDate ? (
                <div className="text-xs mt-2 mb-3" style={{ color: "var(--muted)" }}>
                  Última cotação: {brDate(row.lastQuoteDate)}
                </div>
              ) : (
                <div className="text-sm py-4 text-center" style={{ color: "var(--muted)" }}>Este material ainda não possui cotação registrada.</div>
              )}

              <button
                onClick={() => openHistory(m)}
                className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 mt-3 w-full justify-center"
              >
                <History size={13} />Ver histórico de cotações
              </button>
            </div>
          );
        })}
      </div>

      {open && (
        <NovaCotacaoModal
          materials={materials} suppliers={suppliers}
          onSaved={onQuoteSaved} onClose={() => setOpen(false)}
        />
      )}

      {historyMaterial && (
        <HistoricoCotacaoModal
          material={historyMaterial}
          quotes={historyQuotes}
          onClose={() => { setHistoryMaterial(null); setHistoryQuotes([]); }}
        />
      )}
    </div>
  );
}
