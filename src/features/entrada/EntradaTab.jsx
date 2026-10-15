import { useState } from "react";
import { Plus, Building2, Edit3, Trash2 } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { todayISO, brDate, brl } from "../../lib/format.js";
import { apiFetch } from "../../lib/api.js";
import { useCollection } from "../../lib/useApi.js";
import { DISTRIMEDICAL_UNIT } from "../../data/constants.js";

/**
 * EntradaTab
 * -----------------------------------------------------------------------
 * Registro de entradas de estoque (lotes recebidos): material, fornecedor,
 * lote, quantidade, validade, custo unitário e nº da NFe.
 *
 * Conectado a POST /stock/entries (server/src/modules/stock) — cada envio
 * cria a entrada E o lote (stock_lots) numa única transação no backend,
 * pronto para ser consumido por FEFO nas vendas.
 *
 * NOVO em relação à versão local: o campo "Lote" agora é obrigatório —
 * o backend exige lotNumber + expiresAt por item para rastreabilidade
 * (ver stock_lots no schema.prisma). Sugerimos automaticamente um número
 * de lote a partir da NFe, mas o campo pode ser editado.
 * -----------------------------------------------------------------------
 */
export default function EntradaTab() {
  const { items: materials } = useCollection("/materials?pageSize=200&active=true");
  const { items: suppliers } = useCollection("/suppliers?pageSize=200&active=true");
  const { items: clients } = useCollection("/clients?pageSize=200&active=true");
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", supplierId: "" });
  const entriesQuery = new URLSearchParams({ pageSize: "50" });
  if (filters.dateFrom) entriesQuery.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) entriesQuery.set("dateTo", filters.dateTo);
  if (filters.supplierId) entriesQuery.set("supplierId", filters.supplierId);
  const { items: entries, loading, error, reload } = useCollection(`/reports/stock-entries?${entriesQuery}`);
  const hasFilters = Boolean(filters.dateFrom || filters.dateTo || filters.supplierId);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState(null);
  const [listNotice, setListNotice] = useState("");

  const emptyItem = { materialId: "", brand: "", lotNumber: "", expiresAt: "", quantity: 1, unitCost: "" };
  const emptyHeader = { supplierId: "", invoiceNumber: "", entryDate: todayISO(), receivingUnit: DISTRIMEDICAL_UNIT };
  const [header, setHeader] = useState(emptyHeader);
  const [lines, setLines] = useState([]);
  const [draft, setDraft] = useState(emptyItem);

  const openNew = () => {
    const firstMaterial = materials[0];
    setHeader({ ...emptyHeader, supplierId: suppliers[0]?.id || "" });
    setLines([]);
    setDraft({ ...emptyItem, materialId: firstMaterial?.id || "", brand: firstMaterial?.brand || "" });
    setEditing(null);
    setFormError("");
    setOpen(true);
  };

  const openEdit = (e) => {
    setHeader({
      supplierId: e.supplierId,
      invoiceNumber: e.invoiceNumber,
      entryDate: String(e.entryDate).slice(0, 10),
      receivingUnit: e.receivingUnit || DISTRIMEDICAL_UNIT,
    });
    setLines((e.items || []).map((it) => ({
      materialId: it.materialId,
      materialName: it.material?.name || "",
      unit: it.material?.unit || "un",
      brand: it.material?.brand || "",
      origBrand: it.material?.brand || "",
      lotNumber: it.lotNumber || "",
      expiresAt: it.expiresAt ? String(it.expiresAt).slice(0, 10) : "",
      quantity: Number(it.quantity),
      unitCost: Number(it.unitCost),
    })));
    setDraft({ ...emptyItem, materialId: e.items?.[0]?.materialId || materials[0]?.id || "" });
    setEditing(e);
    setFormError("");
    setOpen(true);
  };

  const deleteEntry = async (e) => {
    setListNotice("");
    try {
      await apiFetch(`/stock/entries/${e.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setListNotice(err.message || "Não foi possível excluir a entrada.");
    }
  };

  const selectMaterial = (materialId) => {
    const material = materials.find((m) => m.id === materialId);
    setDraft({ ...draft, materialId, brand: material?.brand || "" });
  };

  const entryMaterials = (editing?.items || []).map((it) => it.material).filter(Boolean);
  const materialOptions = [...entryMaterials.filter((em) => !materials.some((m) => m.id === em.id)), ...materials];
  const matOf = (id) => materialOptions.find((m) => m.id === id);

  const addLine = () => {
    const d = draft;
    if (!d.materialId || !d.lotNumber.trim() || !d.expiresAt || !(Number(d.quantity) > 0) || d.unitCost === "") {
      setFormError("Preencha material, lote, validade, quantidade e custo do item antes de adicionar.");
      return;
    }
    if (lines.some((l) => l.materialId === d.materialId && l.lotNumber.trim() === d.lotNumber.trim())) {
      setFormError("Este material já foi adicionado com o mesmo lote nesta nota.");
      return;
    }
    const m = matOf(d.materialId);
    setLines([...lines, {
      materialId: d.materialId,
      materialName: m?.name || "",
      unit: m?.unit || "un",
      brand: d.brand,
      origBrand: m?.brand || "",
      lotNumber: d.lotNumber.trim(),
      expiresAt: d.expiresAt,
      quantity: Number(d.quantity),
      unitCost: Number(d.unitCost),
    }]);
    setDraft({ ...emptyItem, materialId: d.materialId, brand: d.brand });
    setFormError("");
  };

  const removeLine = (i) => setLines(lines.filter((_, idx) => idx !== i));
  const editLine = (i) => {
    const l = lines[i];
    setDraft({ materialId: l.materialId, brand: l.brand, lotNumber: l.lotNumber, expiresAt: l.expiresAt, quantity: l.quantity, unitCost: l.unitCost });
    removeLine(i);
  };

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);

  const save = async () => {
    if (!header.supplierId || !header.invoiceNumber.trim()) {
      setFormError("Preencha fornecedor e NFe.");
      return;
    }
    if (lines.length === 0) {
      setFormError("Adicione ao menos um item à nota.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      // Marca é do material: atualiza uma vez por material cuja marca mudou.
      const brandByMaterial = new Map();
      for (const l of lines) {
        if (l.brand.trim() !== l.origBrand) brandByMaterial.set(l.materialId, l.brand.trim());
      }
      for (const [id, brand] of brandByMaterial) {
        await apiFetch(`/materials/${id}`, { method: "PATCH", body: JSON.stringify({ brand: brand || null }) });
      }
      const body = JSON.stringify({
        supplierId: header.supplierId,
        invoiceNumber: header.invoiceNumber.trim(),
        entryDate: header.entryDate,
        receivingUnit: header.receivingUnit.trim() || DISTRIMEDICAL_UNIT,
        items: lines.map((l) => ({
          materialId: l.materialId,
          lotNumber: l.lotNumber,
          expiresAt: l.expiresAt,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      });
      if (editing) {
        await apiFetch(`/stock/entries/${editing.id}`, { method: "PATCH", body });
      } else {
        await apiFetch("/stock/entries", { method: "POST", body });
      }
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message || "Não foi possível registrar a entrada.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Entrada de Estoque"
        subtitle="Registre lotes recebidos com validade, quantidade, fornecedor, custo e NFe"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Plus size={16} />Nova entrada</button>}
      />

      <div className="px-4 sm:px-8 mb-4">
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5" style={{ background: "#EAF3F1", color: "var(--primary-dark)" }}>
          <Building2 size={13} /> Unidade padrão de recebimento: <b className="mono">{DISTRIMEDICAL_UNIT}</b>
        </span>
      </div>

      <div className="px-4 sm:px-8 mb-4">
        <div className="card p-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Período — início</label>
            <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Período — fim</label>
            <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
          <div className="min-w-[14rem]">
            <label className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Fornecedor</label>
            <select value={filters.supplierId} onChange={(e) => setFilters({ ...filters, supplierId: e.target.value })}>
              <option value="">Todos os fornecedores</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {hasFilters && (
            <button onClick={() => setFilters({ dateFrom: "", dateTo: "", supplierId: "" })} className="text-sm font-semibold px-3 py-2 rounded-lg hover:bg-black/5" style={{ color: "var(--primary-dark)" }}>
              Limpar filtros
            </button>
          )}
          {!loading && <span className="text-xs ml-auto" style={{ color: "var(--muted)" }}>{entries.length} entrada(s)</span>}
        </div>
      </div>

      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {listNotice && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{listNotice}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando entradas...</div>
          ) : entries.length === 0 ? <EmptyState text={hasFilters ? "Nenhuma entrada encontrada para os filtros selecionados." : "Nenhuma entrada registrada."} /> : (
            <div className="overflow-x-auto overflow-y-auto min-h-[28rem] max-h-[34rem]"><table className="w-full min-w-[640px]">
              <thead style={{ position: "sticky", top: 0, background: "var(--panel)" }}><tr><th>Data</th><th>Fornecedor</th><th>Unidade</th><th>NFe</th><th>Materiais</th><th>Marca</th><th>Valor total</th><th></th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-sm">{brDate(e.entryDate)}</td>
                    <td className="text-sm">{e.supplier?.name}</td>
                    <td className="text-sm">{e.receivingUnit || DISTRIMEDICAL_UNIT}</td>
                    <td className="text-sm mono">{e.invoiceNumber}</td>
                    <td className="text-sm">{e.items?.map((it) => it.material?.name).join(", ")}</td>
                    <td className="text-sm">{e.items?.map((it) => it.material?.brand || "-").join(", ")}</td>
                    <td className="text-sm mono">{e.totalValue !== undefined ? brl(e.totalValue) : "—"}</td>
                    <td className="text-right">
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-black/5 mr-1" title="Editar"><Edit3 size={14} /></button>
                      <button onClick={() => deleteEntry(e)} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--danger)" }} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {open && (
        <Modal title={editing ? "Editar entrada de estoque" : "Nova entrada de estoque"} onClose={() => setOpen(false)} wide>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          <div className="text-xs font-bold uppercase mb-1" style={{ color: "var(--muted)" }}>Dados da NFe</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Fornecedor">
              <select value={header.supplierId} onChange={(e) => setHeader({ ...header, supplierId: e.target.value })}>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Número da NFe de compra">
              <input value={header.invoiceNumber} onChange={(e) => setHeader({ ...header, invoiceNumber: e.target.value })} placeholder="Ex: 000.123.456" />
            </Field>
            <Field label="Unidade que recebeu">
              <input list="receiving-units" value={header.receivingUnit} onChange={(e) => setHeader({ ...header, receivingUnit: e.target.value })} placeholder={DISTRIMEDICAL_UNIT} />
              <datalist id="receiving-units">
                <option value={DISTRIMEDICAL_UNIT} />
                {clients.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </Field>
            <Field label="Data da entrada">
              <input type="date" value={header.entryDate} onChange={(e) => setHeader({ ...header, entryDate: e.target.value })} />
            </Field>
          </div>

          <div className="text-xs font-bold uppercase mt-3 mb-1" style={{ color: "var(--muted)" }}>Itens da nota ({lines.length})</div>
          {lines.length > 0 && (
            <div className="overflow-x-auto mb-3"><table className="w-full min-w-[520px]">
              <thead><tr><th>Material</th><th>Lote</th><th>Validade</th><th>Qtd</th><th>Custo un.</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="text-sm">{l.materialName}{l.brand ? <span style={{ color: "var(--muted)" }}> · {l.brand}</span> : null}</td>
                    <td className="text-sm mono">{l.lotNumber}</td>
                    <td className="text-sm">{brDate(l.expiresAt)}</td>
                    <td className="text-sm mono">{l.quantity} {l.unit}</td>
                    <td className="text-sm mono">{brl(l.unitCost)}</td>
                    <td className="text-sm mono">{brl(l.quantity * l.unitCost)}</td>
                    <td className="text-right whitespace-nowrap">
                      <button onClick={() => editLine(i)} className="p-1.5 rounded hover:bg-black/5 mr-1" title="Editar item"><Edit3 size={14} /></button>
                      <button onClick={() => removeLine(i)} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--danger)" }} title="Remover item"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5} className="text-sm text-right font-bold">Total da NFe</td><td className="text-sm mono font-bold">{brl(total)}</td><td></td></tr></tfoot>
            </table></div>
          )}

          <div className="rounded-lg p-3" style={{ border: "1px dashed var(--border, #cbd5d1)" }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Material">
                <select value={draft.materialId} onChange={(e) => selectMaterial(e.target.value)}>
                  {materialOptions.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </Field>
              <Field label="Marca">
                <input value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="Marca não informada" />
              </Field>
              <Field label="Número do lote">
                <input value={draft.lotNumber} onChange={(e) => setDraft({ ...draft, lotNumber: e.target.value })} placeholder="Ex: L-2026-001" />
              </Field>
              <Field label="Validade">
                <input type="date" value={draft.expiresAt} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} />
              </Field>
              <Field label={`Quantidade (${matOf(draft.materialId)?.unit || "un"})`}>
                <input type="number" min="1" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
              </Field>
              <Field label={`Custo unitário (por ${matOf(draft.materialId)?.unit || "un"}, R$)`}>
                <input type="number" min="0" step="0.01" value={draft.unitCost} onChange={(e) => setDraft({ ...draft, unitCost: e.target.value })} />
              </Field>
            </div>
            <button onClick={addLine} type="button" className="rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2 mt-1" style={{ border: "1px solid var(--primary)", color: "var(--primary-dark)" }}>
              <Plus size={14} />Adicionar item
            </button>
          </div>

          <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full mt-3">
            {saving ? "Salvando..." : editing ? `Salvar alterações (${lines.length} ${lines.length === 1 ? "item" : "itens"})` : `Registrar entrada (${lines.length} ${lines.length === 1 ? "item" : "itens"})`}
          </button>
        </Modal>
      )}
    </div>
  );
}
