import { useState } from "react";
import { Plus, Edit3, Trash2 } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { apiFetch } from "../../lib/api.js";
import { useCollection } from "../../lib/useApi.js";

/**
 * FornecedoresTab
 * -----------------------------------------------------------------------
 * Cadastro de fornecedores, usados nas telas de Entrada de Estoque e
 * Cotação de Preços. Conectado ao backend real (server/src/modules/
 * suppliers) — CNPJ é único no banco, e "excluir" na verdade desativa o
 * fornecedor (o backend não permite apagar histórico de entradas/cotações
 * vinculado a ele).
 * -----------------------------------------------------------------------
 */
export default function FornecedoresTab() {
  const { items: suppliers, loading, error, reload } = useCollection("/suppliers?pageSize=200");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const empty = { name: "", cnpj: "", phone: "", contactPerson: "", email: "" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setForm(empty); setEditing(null); setFormError(""); setOpen(true); };
  const openEdit = (s) => {
    setForm({
      name: s.name, cnpj: s.cnpj || "", phone: s.phone || "",
      contactPerson: s.contactPerson || "", email: s.email || "",
    });
    setEditing(s.id);
    setFormError("");
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        cnpj: form.cnpj || undefined,
        phone: form.phone || undefined,
        contactPerson: form.contactPerson || undefined,
        email: form.email || undefined,
      };
      if (editing) {
        await apiFetch(`/suppliers/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/suppliers", { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message || "Não foi possível salvar o fornecedor.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s) => {
    await apiFetch(`/suppliers/${s.id}`, { method: "PATCH", body: JSON.stringify({ active: !s.active }) });
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Cadastro de Fornecedores"
        subtitle="Gerencie os fornecedores utilizados nas entradas de estoque e cotações"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Plus size={16} />Novo fornecedor</button>}
      />
      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando fornecedores...</div>
          ) : suppliers.length === 0 ? <EmptyState text="Nenhum fornecedor cadastrado." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Pessoa de contato</th><th>Telefone</th><th>E-mail</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="text-sm font-medium">{s.name}</td>
                    <td className="text-sm mono">{s.cnpj || "-"}</td>
                    <td className="text-sm">{s.contactPerson || "-"}</td>
                    <td className="text-sm">{s.phone || "-"}</td>
                    <td className="text-sm">{s.email || "-"}</td>
                    <td className="text-sm">
                      <span style={{ color: s.active ? "var(--primary)" : "var(--danger)" }}>
                        {s.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-black/5 mr-1"><Edit3 size={14} /></button>
                      <button onClick={() => toggleActive(s)} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--danger)" }} title={s.active ? "Desativar" : "Ativar"}>
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
        <Modal title={editing ? "Editar fornecedor" : "Novo fornecedor"} onClose={() => setOpen(false)}>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          <Field label="Razão social / Nome"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="CNPJ"><input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" /></Field>
          <Field label="Pessoa de contato"><input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} placeholder="Nome do vendedor/representante" /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Telefone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" /></Field>
            <Field label="E-mail"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full mt-2">
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar fornecedor"}
          </button>
        </Modal>
      )}
    </div>
  );
}
