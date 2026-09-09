import { useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { uid, todayISO } from "../../lib/format.js";
import { apiFetch } from "../../lib/api.js";
import { MIN_QUOTES } from "../../data/constants.js";

/**
 * NovaCotacaoModal
 * -----------------------------------------------------------------------
 * Formulário para registrar uma nova cotação de um material: escolhe o
 * material, a data da cotação e os preços de pelo menos MIN_QUOTES
 * fornecedores diferentes. Envia para POST /quotes — o backend recalcula
 * o período (bimestre) a partir da data e valida de novo (fornecedores
 * ativos, sem duplicados, mínimo de cotações) mesmo que esta tela já
 * tenha filtrado isso antes de habilitar o botão de salvar.
 *
 * Props:
 *  - materials, suppliers: listas de apoio para os selects
 *  - onSaved: () => void — chamado após salvar com sucesso, para recarregar a lista
 *  - onClose: () => void
 * -----------------------------------------------------------------------
 */
export default function NovaCotacaoModal({ materials, suppliers, onSaved, onClose }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id || "");
  const [quoteDate, setQuoteDate] = useState(todayISO());
  const [rows, setRows] = useState([
    { id: uid(), supplierId: suppliers[0]?.id || "", price: "" },
    { id: uid(), supplierId: suppliers[1]?.id || "", price: "" },
    { id: uid(), supplierId: suppliers[2]?.id || "", price: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const addRow = () => setRows([...rows, { id: uid(), supplierId: suppliers[0]?.id || "", price: "" }]);
  const removeRow = (id) => setRows(rows.filter((r) => r.id !== id));
  const updateRow = (id, patch) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const validRows = rows.filter((r) => r.supplierId && Number(r.price) > 0);
  const distinctSuppliers = new Set(validRows.map((r) => r.supplierId));
  const hasDuplicate = validRows.length !== distinctSuppliers.size;
  const canSave = materialId && validRows.length >= MIN_QUOTES && !hasDuplicate;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setFormError("");
    try {
      await apiFetch("/quotes", {
        method: "POST",
        body: JSON.stringify({
          materialId,
          quoteDate,
          items: validRows.map((r) => ({ supplierId: r.supplierId, price: Number(r.price) })),
        }),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setFormError(err.message || "Não foi possível salvar a cotação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Nova cotação" onClose={onClose} wide>
      {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Material">
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
            {materials.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Data da cotação">
          <input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} />
        </Field>
      </div>

      <div className="text-xs font-bold uppercase mb-2 mt-1" style={{ color: "var(--muted)" }}>
        Preços cotados (mínimo {MIN_QUOTES} fornecedores diferentes)
      </div>

      <div className="space-y-2 mb-2">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_140px_32px] gap-2 items-center">
            <select value={r.supplierId} onChange={(e) => updateRow(r.id, { supplierId: e.target.value })}>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="number" min="0" step="0.01" placeholder="Preço (R$)" value={r.price} onChange={(e) => updateRow(r.id, { price: e.target.value })} />
            <button onClick={() => removeRow(r.id)} disabled={rows.length <= MIN_QUOTES} className="p-1.5 rounded hover:bg-black/5 disabled:opacity-30" style={{ color: "var(--danger)" }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button onClick={addRow} className="btn-outline rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 mb-3">
        <Plus size={13} />Adicionar fornecedor
      </button>

      {hasDuplicate && (
        <div className="text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-2" style={{ background: "#FBEAE8", color: "var(--danger)" }}>
          <AlertTriangle size={14} /> Cada fornecedor só pode aparecer uma vez na mesma cotação.
        </div>
      )}
      {!hasDuplicate && validRows.length < MIN_QUOTES && (
        <div className="text-xs px-3 py-2 rounded-lg mb-3 flex items-center gap-2" style={{ background: "#FBF0E0", color: "#8A5A11" }}>
          <AlertTriangle size={14} /> Informe o preço de pelo menos {MIN_QUOTES} fornecedores diferentes.
        </div>
      )}

      <button disabled={!canSave || saving} onClick={save} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full disabled:opacity-40">
        {saving ? "Salvando..." : "Salvar cotação"}
      </button>
    </Modal>
  );
}
