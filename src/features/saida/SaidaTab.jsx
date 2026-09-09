import { useEffect, useState } from "react";
import { Plus, Eye, ClipboardList, Trash2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { uid, todayISO, brDate, brl } from "../../lib/format.js";
import { apiFetch, apiFetchBlob } from "../../lib/api.js";
import { useCollection } from "../../lib/useApi.js";
import RomaneioView from "./RomaneioView.jsx";

const PAGE_SIZE = 25;

/** Primeiro e último dia do mês atual, no formato yyyy-mm-dd (input date). */
function currentMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { from: toISO(first), to: toISO(last) };
}

/**
 * SaidaTab
 * -----------------------------------------------------------------------
 * Tela de Saída de Estoque / Venda: monta um "carrinho" de itens e envia
 * para o backend (POST /sales), que decide de verdade quais lotes são
 * consumidos por FEFO e calcula o total.
 *
 * MUDANÇA IMPORTANTE em relação à versão anterior: o cálculo de FEFO,
 * custo por lote e markup NÃO acontece mais aqui no frontend. Antes esta
 * tela simulava o consumo de lotes localmente (workingRemaining) e
 * calculava preço de venda a partir do custo + markup — isso violava a
 * regra central do prompt de segurança: "o backend deve validar e
 * recalcular o que for crítico" e "o frontend não decide o estoque final
 * sozinho". Agora:
 *   - o frontend só sabe o preço de venda (preenchido manualmente aqui,
 *     ou no futuro pré-calculado por uma rota de sugestão de preço);
 *   - quem decide quais lotes saem, valida disponibilidade e trava
 *     concorrência é o server/src/modules/stock/stock.service.ts.
 *
 * Disponibilidade exibida aqui vem de GET /stock/current (somatório por
 * material dos lotes ACTIVE) — é só um indicativo para o usuário; a
 * validação de verdade sempre acontece no servidor ao confirmar a venda.
 * -----------------------------------------------------------------------
 */
export default function SaidaTab() {
  const { items: materials } = useCollection("/materials?pageSize=200&active=true");
  const { items: clients } = useCollection("/clients?pageSize=200&active=true");
  const { items: currentStock, reload: reloadStock } = useCollection("/stock/current?pageSize=200");

  // ---------- Listagem de saídas: filtro por período + paginação ----------
  // Trocado de useCollection() simples para um fetch próprio porque aqui
  // precisamos do total de registros (para paginar) e de refazer a busca
  // sempre que o período ou a página mudam — não só ao montar a tela.
  const [{ from: monthFrom, to: monthTo }] = useState(currentMonthRange);
  const [dateFrom, setDateFrom] = useState(monthFrom);
  const [dateTo, setDateTo] = useState(monthTo);
  const [page, setPage] = useState(1);
  const [sales, setSales] = useState([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [salesReloadTick, setSalesReloadTick] = useState(0);

  const reloadSales = () => setSalesReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    apiFetch(`/sales?${params.toString()}`)
      .then((data) => {
        if (cancelled) return;
        setSales(data.items || []);
        setSalesTotal(data.total || 0);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Erro ao carregar saídas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateFrom, dateTo, page, salesReloadTick]);

  // Volta pra primeira página sempre que o período de busca muda.
  useEffect(() => {
    setPage(1);
  }, [dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(salesTotal / PAGE_SIZE));

  const downloadReport = async () => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const blob = await apiFetchBlob(`/sales/report?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio-saidas_${dateFrom || "inicio"}_a_${dateTo || "hoje"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Não foi possível gerar o relatório.");
    } finally {
      setReportLoading(false);
    }
  };

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [cart, setCart] = useState([]); // {id, materialId, quantity, unitPrice}
  const [viewingSale, setViewingSale] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [itMaterialId, setItMaterialId] = useState("");
  const [itQty, setItQty] = useState(1);
  const [itPrice, setItPrice] = useState("");

  const materialById = (id) => materials.find((m) => m.id === id);

  const availableFor = (materialId) => {
    const row = currentStock.find((r) => r.material?.id === materialId);
    return row ? Number(row.currentQuantity) : 0;
  };
  const inCartQty = (materialId) => cart.filter((c) => c.materialId === materialId).reduce((a, c) => a + c.quantity, 0);
  const availableForItem = availableFor(itMaterialId) - inCartQty(itMaterialId);

  const openNew = () => {
    setClientId(clients[0]?.id || "");
    setCart([]);
    setItMaterialId(materials[0]?.id || "");
    setItQty(1);
    setItPrice("");
    setFormError("");
    setOpen(true);
  };

  const addItem = () => {
    if (!itMaterialId || !itQty || Number(itQty) <= 0 || !itPrice || Number(itPrice) < 0) return;
    if (Number(itQty) > availableForItem) return;
    setCart([...cart, { id: uid(), materialId: itMaterialId, quantity: Number(itQty), unitPrice: Number(itPrice) }]);
    setItQty(1);
    setItPrice("");
  };

  const removeItem = (id) => setCart(cart.filter((c) => c.id !== id));

  const grandTotal = cart.reduce((acc, c) => acc + c.quantity * c.unitPrice, 0);
  const canFinalize = cart.length > 0 && !!clientId;

  const finalizeSale = async () => {
    if (!canFinalize) return;
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        docNumber: `V-${Date.now()}`,
        clientId,
        saleDate: todayISO(),
        items: cart.map((c) => ({ materialId: c.materialId, quantity: c.quantity, unitPrice: c.unitPrice })),
      };
      const { sale } = await apiFetch("/sales", { method: "POST", body: JSON.stringify(payload) });
      setOpen(false);
      reloadSales();
      reloadStock();
      setViewingSale(sale);
    } catch (err) {
      // Ex.: "Estoque insuficiente para o material X: faltam N un" — o backend
      // já valida isso de novo mesmo que a tela tenha deixado adicionar ao carrinho
      // (proteção contra outra venda ter consumido o estoque nesse meio-tempo).
      setFormError(err.message || "Não foi possível finalizar a venda.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Saída de Estoque / Venda"
        subtitle="Monta o romaneio de venda; o backend decide quais lotes saem por FEFO e trava a concorrência de estoque"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Plus size={16} />Nova saída</button>}
      />

      <div className="px-4 sm:px-8 pb-8">
        {/* Filtro de período + relatório: fica fora do card de lista para
            continuar visível e utilizável mesmo com muitas saídas na tabela. */}
        <div className="card p-3 mb-4 flex flex-wrap items-end gap-3 no-print">
          <Field label="De">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </Field>
          <Field label="Até">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </Field>
          <button
            onClick={downloadReport}
            disabled={reportLoading}
            className="btn-outline rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-40"
          >
            <Download size={14} />{reportLoading ? "Gerando..." : "Baixar relatório do período"}
          </button>
          <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>
            {salesTotal} {salesTotal === 1 ? "saída encontrada" : "saídas encontradas"}
          </span>
        </div>

        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando vendas...</div>
          ) : sales.length === 0 ? <EmptyState text="Nenhum romaneio emitido no período selecionado." /> : (
            <>
              {/* max-h + sticky no cabeçalho: com muitas saídas no período,
                  a tabela rola por dentro do card em vez de esticar a página
                  inteira, e o cabeçalho continua visível durante a rolagem. */}
              <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "60vh" }}>
                <table className="w-full min-w-[640px]">
                  <thead className="sticky top-0" style={{ background: "var(--bg-card, #fff)" }}>
                    <tr><th>Nº</th><th>Data</th><th>Cliente / Unidade</th><th>Valor da venda</th><th></th></tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id}>
                        <td className="text-sm mono">{s.docNumber}</td>
                        <td className="text-sm">{brDate(s.saleDate)}</td>
                        <td className="text-sm font-medium">{s.client?.name}</td>
                        <td className="text-sm mono font-semibold" style={{ color: "var(--primary-dark)" }}>
                          {s.total !== undefined ? brl(s.total) : "—"}
                        </td>
                        <td className="text-right">
                          <button onClick={() => setViewingSale(s)} className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1">
                            <Eye size={13} />Ver romaneio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-t" style={{ borderColor: "var(--border, #eee)" }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                  >
                    <ChevronLeft size={13} />Anterior
                  </button>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Página {page} de {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 disabled:opacity-40"
                  >
                    Próxima<ChevronRight size={13} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {open && (
        <Modal title="Registrar saída (venda)" onClose={() => setOpen(false)} wide>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          <Field label="Unidade / Cliente">
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.cnpj ? ` — ${c.cnpj}` : ""}</option>)}
            </select>
          </Field>

          <div className="card p-3 mb-3" style={{ background: "#FAFBFB" }}>
            <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--muted)" }}>Adicionar item</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <Field label="Material">
                <select value={itMaterialId} onChange={(e) => setItMaterialId(e.target.value)}>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Quantidade">
                <input type="number" min="1" value={itQty} onChange={(e) => setItQty(e.target.value)} />
              </Field>
              <Field label="Preço unitário de venda (R$)">
                <input type="number" min="0" step="0.01" value={itPrice} onChange={(e) => setItPrice(e.target.value)} />
              </Field>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: Number(itQty) > availableForItem ? "var(--danger)" : "var(--muted)" }}>
                Disponível: {availableForItem} {materialById(itMaterialId)?.unit}
              </span>
              <button
                onClick={addItem}
                disabled={!itQty || Number(itQty) <= 0 || Number(itQty) > availableForItem || !itPrice}
                className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              >
                Adicionar ao romaneio
              </button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-bold uppercase mb-2" style={{ color: "var(--muted)" }}>Itens do romaneio</div>
              <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
                <thead><tr><th>Material</th><th>Qtd.</th><th>Preço unitário</th><th>Subtotal</th><th></th></tr></thead>
                <tbody>
                  {cart.map((c) => (
                    <tr key={c.id}>
                      <td className="text-sm">{materialById(c.materialId)?.name}</td>
                      <td className="text-sm mono">{c.quantity}</td>
                      <td className="text-sm mono">{brl(c.unitPrice)}</td>
                      <td className="text-sm mono font-semibold">{brl(c.quantity * c.unitPrice)}</td>
                      <td className="text-right"><button onClick={() => removeItem(c.id)} className="p-1 rounded hover:bg-black/5" style={{ color: "var(--danger)" }}><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <div className="text-right mt-2 font-bold" style={{ color: "var(--primary-dark)" }}>
                Total geral do romaneio: {brl(grandTotal)}
              </div>
            </div>
          )}

          <button disabled={!canFinalize || saving} onClick={finalizeSale} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full disabled:opacity-40 flex items-center justify-center gap-2">
            <ClipboardList size={16} />{saving ? "Enviando..." : "Finalizar venda e gerar romaneio"}
          </button>
        </Modal>
      )}

      {viewingSale && (
        <RomaneioView saleId={viewingSale.id} docNumber={viewingSale.docNumber} onClose={() => setViewingSale(null)} />
      )}
    </div>
  );
}
