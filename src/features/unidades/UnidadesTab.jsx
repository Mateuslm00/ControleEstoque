import { useState } from "react";
import { Building, Building2, Edit3, Trash2 } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { formatCNPJInput } from "../../lib/format.js";
import { apiFetch } from "../../lib/api.js";
import { useCollection } from "../../lib/useApi.js";

/**
 * UnidadesTab
 * -----------------------------------------------------------------------
 * Cadastro das unidades do grupo, que funcionam como "clientes" nas
 * vendas internas (SaidaTab) — cada romaneio de venda referencia uma
 * unidade e usa seu CNPJ para o documento.
 *
 * Mapeia direto para o recurso `/clients` do backend (server/src/modules/
 * clients) — "unidade" e "cliente" são o mesmo conceito no banco.
 * -----------------------------------------------------------------------
 */
export default function UnidadesTab() {
  const { items: units, loading, error, reload } = useCollection("/clients?pageSize=200");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const empty = { name: "", cnpj: "" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setForm(empty); setEditing(null); setFormError(""); setOpen(true); };
  const openEdit = (u) => { setForm({ name: u.name, cnpj: u.cnpj || "" }); setEditing(u.id); setFormError(""); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: form.name.trim(), cnpj: form.cnpj || undefined };
      if (editing) {
        await apiFetch(`/clients/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/clients", { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message || "Não foi possível salvar a unidade.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    await apiFetch(`/clients/${u.id}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) });
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Unidades / Clientes"
        subtitle="Cada unidade funciona como cliente nas vendas — cadastre nome e CNPJ para o romaneio"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Building size={16} />Nova unidade</button>}
      />
      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando unidades...</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Unidade / Cliente</th><th>CNPJ</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td className="text-sm font-medium flex items-center gap-2 py-3"><Building2 size={14} style={{ color: "var(--primary)" }} />{u.name}</td>
                    <td className="text-sm mono">{u.cnpj || <span style={{ color: "var(--danger)" }}>não informado</span>}</td>
                    <td className="text-sm">
                      <span style={{ color: u.active ? "var(--primary)" : "var(--danger)" }}>
                        {u.active ? "Ativa" : "Inativa"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-black/5 mr-1"><Edit3 size={14} /></button>
                      <button onClick={() => toggleActive(u)} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--danger)" }} title={u.active ? "Desativar" : "Ativar"}>
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
        <Modal title={editing ? "Editar unidade / cliente" : "Nova unidade / cliente"} onClose={() => setOpen(false)}>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          <Field label="Nome da unidade">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: ISV Papicu" />
          </Field>
          <Field label="CNPJ">
            <input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJInput(e.target.value) })} placeholder="00.000.000/0000-00" />
          </Field>
          <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full mt-2">
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar unidade"}
          </button>
        </Modal>
      )}
    </div>
  );
}
