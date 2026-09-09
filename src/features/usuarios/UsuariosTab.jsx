import { useState } from "react";
import { UserPlus, Edit3, Ban, CheckCircle2, KeyRound } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { apiFetch } from "../../lib/api.js";
import { useCollection } from "../../lib/useApi.js";

const ROLE_LABEL = { ADMIN: "Administrador", OPERACIONAL: "Operacional", LEITURA: "Leitura" };

/**
 * UsuariosTab
 * -----------------------------------------------------------------------
 * Cadastro de usuários com perfil de acesso real (ADMIN / OPERACIONAL /
 * LEITURA). Conectado a server/src/modules/users — rota protegida no
 * backend com `requireRole("ADMIN")`, então mesmo que esta tela nunca
 * fosse renderizada para um usuário não-admin, chamar a API diretamente
 * ainda devolveria 403 (ver auth.plugin.ts). O filtro de menu em
 * Sidebar.jsx é só conveniência visual, não é a proteção real.
 *
 * "Excluir" usuário não existe — o backend só permite ativar/desativar
 * (PATCH /users/:id/status), preservando o autor no histórico de
 * auditoria, entradas, vendas e cotações já registradas por ele.
 * -----------------------------------------------------------------------
 */
export default function UsuariosTab() {
  const { items: users, loading, error, reload } = useCollection("/users?pageSize=100");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const empty = { name: "", email: "", password: "", role: "OPERACIONAL" };
  const [form, setForm] = useState(empty);

  const openNew = () => { setForm(empty); setEditing(null); setFormError(""); setOpen(true); };
  const openEdit = (u) => { setForm({ name: u.name, email: u.email, password: "", role: u.role }); setEditing(u.id); setFormError(""); setOpen(true); };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Nome e e-mail são obrigatórios.");
      return;
    }
    if (!editing && form.password.length < 10) {
      setFormError("Senha inicial deve ter pelo menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editing) {
        await apiFetch(`/users/${editing}`, { method: "PATCH", body: JSON.stringify({ name: form.name, role: form.role }) });
      } else {
        await apiFetch("/users", {
          method: "POST",
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
        });
      }
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message || "Não foi possível salvar o usuário.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    const nextStatus = u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await apiFetch(`/users/${u.id}/status`, { method: "PATCH", body: JSON.stringify({ status: nextStatus }) });
    reload();
  };

  const [resetResult, setResetResult] = useState(null); // { name, temporaryPassword } | null

  const resetPassword = async (u) => {
    if (!window.confirm(`Gerar uma senha temporária para ${u.name}? A senha atual dessa conta deixará de funcionar.`)) return;
    const { temporaryPassword } = await apiFetch(`/users/${u.id}/reset-password`, { method: "POST" });
    setResetResult({ name: u.name, temporaryPassword });
  };

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie usuários, perfis de acesso e status da conta"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><UserPlus size={16} />Novo usuário</button>}
      />
      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando usuários...</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Último login</th><th></th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="text-sm font-medium">{u.name}</td>
                    <td className="text-sm">{u.email}</td>
                    <td className="text-sm">{ROLE_LABEL[u.role]}</td>
                    <td className="text-sm">
                      <span style={{ color: u.status === "ACTIVE" ? "var(--primary)" : "var(--danger)" }}>
                        {u.status === "ACTIVE" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="text-sm">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca"}</td>
                    <td className="text-right">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-black/5 mr-1" title="Editar"><Edit3 size={14} /></button>
                      <button onClick={() => resetPassword(u)} className="p-1.5 rounded hover:bg-black/5 mr-1" title="Resetar senha"><KeyRound size={14} /></button>
                      <button
                        onClick={() => toggleStatus(u)}
                        className="p-1.5 rounded hover:bg-black/5"
                        style={{ color: u.status === "ACTIVE" ? "var(--danger)" : "var(--primary)" }}
                        title={u.status === "ACTIVE" ? "Desativar" : "Ativar"}
                      >
                        {u.status === "ACTIVE" ? <Ban size={14} /> : <CheckCircle2 size={14} />}
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
        <Modal title={editing ? "Editar usuário" : "Novo usuário"} onClose={() => setOpen(false)}>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          <Field label="Nome"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="E-mail">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editing} />
          </Field>
          {!editing && (
            <Field label="Senha inicial (mín. 10 caracteres)">
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
          )}
          <Field label="Perfil de acesso">
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="ADMIN">Administrador</option>
              <option value="OPERACIONAL">Operacional</option>
              <option value="LEITURA">Leitura</option>
            </select>
          </Field>
          <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full mt-2">
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar usuário"}
          </button>
        </Modal>
      )}

      {resetResult && (
        <Modal title="Senha temporária gerada" onClose={() => setResetResult(null)}>
          <p className="text-sm mb-3">
            Repasse esta senha para <strong>{resetResult.name}</strong> por um canal seguro. Ela só aparece
            agora — não fica salva em nenhum lugar do sistema — e será obrigatório trocá-la no próximo login.
          </p>
          <div className="card p-3 mono text-sm font-semibold text-center mb-3" style={{ background: "#FAFBFB", wordBreak: "break-all" }}>
            {resetResult.temporaryPassword}
          </div>
          <button onClick={() => setResetResult(null)} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full">
            Fechar
          </button>
        </Modal>
      )}
    </div>
  );
}
