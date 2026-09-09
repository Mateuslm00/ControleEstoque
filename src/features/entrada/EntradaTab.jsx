import { useState } from "react";
import { Plus, Building2 } from "lucide-react";
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
  const { items: entries, loading, error, reload } = useCollection("/reports/stock-entries?pageSize=50");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const empty = {
    materialId: "", supplierId: "", quantity: 1, lotNumber: "",
    expiresAt: "", unitCost: "", invoiceNumber: "", entryDate: todayISO(),
  };
  const [form, setForm] = useState(empty);

  const openNew = () => {
    setForm({ ...empty, materialId: materials[0]?.id || "", supplierId: suppliers[0]?.id || "" });
    setFormError("");
    setOpen(true);
  };

  const save = async () => {
    if (!form.materialId || !form.supplierId || !form.quantity || !form.unitCost || !form.lotNumber || !form.expiresAt || !form.invoiceNumber) {
      setFormError("Preencha material, fornecedor, lote, quantidade, validade, custo e NFe.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await apiFetch("/stock/entries", {
        method: "POST",
        body: JSON.stringify({
          supplierId: form.supplierId,
          invoiceNumber: form.invoiceNumber,
          entryDate: form.entryDate,
          items: [{
            materialId: form.materialId,
            lotNumber: form.lotNumber,
            expiresAt: form.expiresAt,
            quantity: Number(form.quantity),
            unitCost: Number(form.unitCost),
          }],
        }),
      });
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message || "Não foi possível registrar a entrada.");
    } finally {
      setSaving(false);
    }
  };

  const matOf = (id) => materials.find((m) => m.id === id);

  return (
    <div>
      <PageHeader
        title="Entrada de Estoque"
        subtitle="Registre lotes recebidos com validade, quantidade, fornecedor, custo e NFe"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Plus size={16} />Nova entrada</button>}
      />

      <div className="px-4 sm:px-8 mb-4">
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full inline-flex items-center gap-1.5" style={{ background: "#EAF3F1", color: "var(--primary-dark)" }}>
          <Building2 size={13} /> Toda entrada é recebida em: <b className="mono">{DISTRIMEDICAL_UNIT}</b>
        </span>
      </div>

      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando entradas...</div>
          ) : entries.length === 0 ? <EmptyState text="Nenhuma entrada registrada." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Data</th><th>Fornecedor</th><th>NFe</th><th>Materiais</th><th>Valor total</th></tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-sm">{brDate(e.entryDate)}</td>
                    <td className="text-sm">{e.supplier?.name}</td>
                    <td className="text-sm mono">{e.invoiceNumber}</td>
                    <td className="text-sm">{e.items?.map((it) => it.material?.name).join(", ")}</td>
                    <td className="text-sm mono">{e.totalValue !== undefined ? brl(e.totalValue) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {open && (
        <Modal title="Nova entrada de estoque" onClose={() => setOpen(false)} wide>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Material">
              <select value={form.materialId} onChange={(e) => setForm({ ...form, materialId: e.target.value })}>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
            <Field label="Fornecedor">
              <select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unidade que recebeu">
              <input value={DISTRIMEDICAL_UNIT} disabled style={{ background: "#F0F3F2", color: "var(--muted)", fontWeight: 600 }} />
            </Field>
            <Field label="Data da entrada">
              <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Número do lote">
              <input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} placeholder="Ex: L-2026-001" />
            </Field>
            <Field label="Validade">
              <input type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`Quantidade (${matOf(form.materialId)?.unit || "un"})`}>
              <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field label={`Custo unitário (por ${matOf(form.materialId)?.unit || "un"}, R$)`}>
              <input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
            </Field>
          </div>
          <Field label="Número da NFe de compra">
            <input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="Ex: 000.123.456" />
          </Field>
          <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full mt-2">
            {saving ? "Registrando..." : "Registrar entrada"}
          </button>
        </Modal>
      )}
    </div>
  );
}
