import { useState } from "react";
import { Plus, Search, Edit3, Trash2 } from "lucide-react";
import PageHeader from "../../components/common/PageHeader.jsx";
import EmptyState from "../../components/common/EmptyState.jsx";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { apiFetch } from "../../lib/api.js";
import { useCollection } from "../../lib/useApi.js";
import { DEFAULT_MARKUP } from "../../data/constants.js";

const MEASURE_UNITS = ["un", "cx", "pct", "kg", "l", "par", "rolo"];

/**
 * MateriaisTab
 * -----------------------------------------------------------------------
 * Cadastro de materiais. Conectado ao backend real (server/src/modules/
 * materials) — cada material fica persistido no Postgres, com SKU único
 * e auditoria automática de criação/edição feita pelo servidor.
 *
 * Diferente da versão anterior (estado local em App.jsx), aqui os dados
 * são buscados via useCollection("/materials?...") e toda gravação passa
 * por apiFetch, que já cuida de cookie de sessão + token CSRF.
 *
 * "Tipos" e "Grupos" continuam sendo texto livre por material (não há
 * tabela própria no backend para eles ainda) — cada material guarda seu
 * próprio `type`/`group`, e a lista de sugestões nos selects é montada a
 * partir dos valores já usados nos materiais carregados.
 *
 * PONTOS DE ATENÇÃO (mantidos como no sistema original):
 *  - Excluir (Trash2) não existe mais aqui: o backend não expõe DELETE de
 *    material (só ativar/desativar via PATCH), para não perder histórico
 *    de entradas/vendas já vinculadas a ele.
 * -----------------------------------------------------------------------
 */
export default function MateriaisTab() {
  const { items: materials, loading, error, reload } = useCollection("/materials?pageSize=200");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const types = [...new Set(materials.map((m) => m.type).filter(Boolean))];
  const groups = [...new Set(materials.map((m) => m.group).filter(Boolean))];

  const empty = { name: "", sku: "", type: "", group: "", unit: "un", markup: DEFAULT_MARKUP, minStock: 0 };
  const [form, setForm] = useState(empty);

  const openNew = () => { setForm(empty); setEditing(null); setFormError(""); setOpen(true); };
  const openEdit = (m) => {
    setForm({
      name: m.name, sku: m.sku, type: m.type || "", group: m.group || "",
      unit: m.unit, markup: Number(m.markup), minStock: Number(m.minStock),
    });
    setEditing(m.id);
    setFormError("");
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.sku.trim()) {
      setFormError("Nome e SKU são obrigatórios.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        unit: form.unit,
        type: form.type || undefined,
        group: form.group || undefined,
        markup: Number(form.markup),
        minStock: Number(form.minStock),
      };
      if (editing) {
        await apiFetch(`/materials/${editing}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await apiFetch("/materials", { method: "POST", body: JSON.stringify(payload) });
      }
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message || "Não foi possível salvar o material.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m) => {
    await apiFetch(`/materials/${m.id}`, { method: "PATCH", body: JSON.stringify({ active: !m.active }) });
    reload();
  };

  const filtered = materials.filter((m) => m.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <PageHeader
        title="Cadastro de Materiais"
        subtitle="Organize os materiais por tipo e grupo"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Plus size={16} />Novo material</button>}
      />

      <div className="px-4 sm:px-8 mb-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input className="pl-9" placeholder="Buscar material..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando materiais...</div>
          ) : filtered.length === 0 ? <EmptyState text="Nenhum material cadastrado." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px]">
              <thead><tr><th>Material</th><th>SKU</th><th>Tipo</th><th>Grupo</th><th>Un. medida</th><th>Markup padrão</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td className="text-sm font-medium">{m.name}</td>
                    <td className="text-sm mono">{m.sku}</td>
                    <td className="text-sm">{m.type || "-"}</td>
                    <td className="text-sm">{m.group || "-"}</td>
                    <td className="text-sm">{m.unit}</td>
                    <td className="text-sm mono">{Number(m.markup)}%</td>
                    <td className="text-sm">
                      <span style={{ color: m.active ? "var(--primary)" : "var(--danger)" }}>
                        {m.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button onClick={() => openEdit(m)} className="p-1.5 rounded hover:bg-black/5 mr-1"><Edit3 size={14} /></button>
                      <button onClick={() => toggleActive(m)} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--danger)" }} title={m.active ? "Desativar" : "Ativar"}>
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
        <Modal title={editing ? "Editar material" : "Novo material"} onClose={() => setOpen(false)}>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          <Field label="Nome do material">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Luva de Procedimento M" />
          </Field>
          <Field label="SKU (código único)">
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Ex: LUV-M-001" disabled={!!editing} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Tipo">
              <input list="material-types" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Ex: Enxoval" />
              <datalist id="material-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="Grupo">
              <input list="material-groups" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="Ex: Ortopédico" />
              <datalist id="material-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Unidade de medida">
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {MEASURE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Markup padrão de venda (%)">
              <input type="number" min="0" step="0.5" value={form.markup} onChange={(e) => setForm({ ...form, markup: e.target.value })} />
            </Field>
          </div>
          <Field label="Estoque mínimo">
            <input type="number" min="0" step="1" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </Field>
          <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full mt-2">
            {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar material"}
          </button>
        </Modal>
      )}
    </div>
  );
}
