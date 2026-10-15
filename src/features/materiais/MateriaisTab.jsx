import { useState } from "react";
import { Plus, Search, Edit3, Trash2, X } from "lucide-react";
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
 * PONTOS DE ATENÇÃO:
 *  - O botão de lixeira exclui de verdade (DELETE /materials/:id). O
 *    backend só apaga se o material não tiver entradas, lotes, vendas ou
 *    cotações vinculadas (senão devolve 409) — nesse caso cai automatico
 *    para desativar (PATCH active:false), preservando o histórico.
 * -----------------------------------------------------------------------
 */
export default function MateriaisTab() {
  const { items: materials, loading, error, reload } = useCollection("/materials?pageSize=200");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [listNotice, setListNotice] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [bulkMarkup, setBulkMarkup] = useState("");
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkNotice, setBulkNotice] = useState("");

  const types = [...new Set(materials.map((m) => m.type).filter(Boolean))];
  const groups = [...new Set(materials.map((m) => m.group).filter(Boolean))];

  const empty = { name: "", brand: "", sku: "", type: "", group: "", unit: "un", markup: DEFAULT_MARKUP, minStock: 0 };
  const [form, setForm] = useState(empty);

  const [rows, setRows] = useState(() => [{ ...empty, key: 1 }]);
  const [nextKey, setNextKey] = useState(2);

  const openNew = () => { setForm(empty); setRows([{ ...empty, key: 1 }]); setNextKey(2); setEditing(null); setFormError(""); setOpen(true); };
  const updateRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  // A nova linha herda tipo/grupo/unidade/markup/mínimo da última, para agilizar lotes parecidos.
  const addRow = () => {
    setRows((rs) => {
      const last = rs[rs.length - 1];
      return [...rs, { ...empty, type: last.type, group: last.group, unit: last.unit, markup: last.markup, minStock: last.minStock, key: nextKey }];
    });
    setNextKey((k) => k + 1);
  };
  const openEdit = (m) => {
    setForm({
      name: m.name, brand: m.brand || "", sku: m.sku, type: m.type || "", group: m.group || "",
      unit: m.unit, markup: Number(m.markup), minStock: Number(m.minStock),
    });
    setEditing(m.id);
    setFormError("");
    setOpen(true);
  };

  const rowPayload = (r) => ({
    name: r.name.trim(),
    brand: r.brand.trim() || undefined,
    sku: r.sku.trim(),
    unit: r.unit,
    type: r.type.trim() || undefined,
    group: r.group.trim() || undefined,
    markup: Number(r.markup),
    minStock: Number(r.minStock),
  });

  // Cadastro em lote: grava linha a linha; as que dão certo saem da lista e as
  // que falham ficam com a mensagem de erro para correção.
  const saveMany = async () => {
    const filled = rows.filter((r) => r.name.trim() || r.sku.trim());
    if (filled.length === 0) { setFormError("Preencha ao menos um material."); return; }
    const incomplete = filled.find((r) => !r.name.trim() || !r.sku.trim());
    if (incomplete) { setRows((rs) => rs.map((r) => (r === incomplete ? { ...r, error: "Nome e SKU são obrigatórios." } : r))); setFormError("Corrija as linhas destacadas."); return; }
    const skus = filled.map((r) => r.sku.trim().toLowerCase());
    if (new Set(skus).size !== skus.length) { setFormError("Há SKUs repetidos na lista."); return; }
    setSaving(true);
    setFormError("");
    const failed = [];
    let ok = 0;
    for (const r of filled) {
      try {
        await apiFetch("/materials", { method: "POST", body: JSON.stringify(rowPayload(r)) });
        ok++;
      } catch (err) {
        failed.push({ ...r, error: err.message || "Não foi possível salvar." });
      }
    }
    setSaving(false);
    reload();
    if (failed.length === 0) {
      setOpen(false);
      setListNotice("");
      setBulkNotice(`${ok} material(is) cadastrado(s).`);
    } else {
      setRows(failed);
      setFormError(`${ok} cadastrado(s); ${failed.length} com erro — corrija e tente novamente.`);
    }
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
        brand: form.brand.trim() || (editing ? null : undefined),
        sku: form.sku.trim(),
        unit: form.unit,
        type: form.type.trim() || (editing ? null : undefined),
        group: form.group.trim() || (editing ? null : undefined),
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

  const deleteMaterial = async (m) => {
    setListNotice("");
    try {
      await apiFetch(`/materials/${m.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      if (err.status === 409) {
        await apiFetch(`/materials/${m.id}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
        setListNotice(`"${m.name}" tem histórico vinculado (entradas, lotes, vendas ou cotações) e não pode ser excluído — foi desativado.`);
        reload();
      } else {
        setListNotice(err.message || "Não foi possível excluir o material.");
      }
    }
  };

  const filtered = materials.filter((m) =>
    m.name.toLowerCase().includes(filter.toLowerCase()) &&
    (!typeFilter || m.type === typeFilter) &&
    (!groupFilter || m.group === groupFilter) &&
    (!statusFilter || (statusFilter === "active" ? m.active : !m.active))
  );

  // Só conta como selecionado o que está visível com os filtros atuais.
  const selectedVisible = filtered.filter((m) => selected.has(m.id));
  const allSelected = filtered.length > 0 && selectedVisible.length === filtered.length;
  const bulkValue = Number(bulkMarkup);
  const bulkValid = bulkMarkup !== "" && Number.isFinite(bulkValue) && bulkValue >= 0 && bulkValue <= 1000;

  const toggleOne = (id) => {
    setBulkConfirm(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setBulkConfirm(false);
    setSelected(allSelected ? new Set() : new Set(filtered.map((m) => m.id)));
  };

  const applyBulkMarkup = async () => {
    setBulkSaving(true);
    setBulkNotice("");
    try {
      const res = await apiFetch("/materials/bulk-markup", {
        method: "POST",
        body: JSON.stringify({ ids: selectedVisible.map((m) => m.id), markup: bulkValue }),
      });
      setBulkNotice(`Markup padrão de ${res.updated} material(is) alterado para ${bulkValue}%.`);
      setSelected(new Set());
      setBulkMarkup("");
      setBulkConfirm(false);
      reload();
    } catch (err) {
      setBulkNotice(err.message || "Não foi possível reajustar o markup.");
      setBulkConfirm(false);
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Cadastro de Materiais"
        subtitle="Organize os materiais por tipo e grupo"
        action={<button onClick={openNew} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold flex items-center gap-2"><Plus size={16} />Novo material</button>}
      />

      <div className="px-4 sm:px-8 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input className="pl-9" placeholder="Buscar material..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto">
          <option value="">Todos os tipos</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="w-auto">
          <option value="">Todos os grupos</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
          <option value="">Ativos e inativos</option>
          <option value="active">Somente ativos</option>
          <option value="inactive">Somente inativos</option>
        </select>
      </div>

      {(selectedVisible.length > 0 || bulkNotice) && (
        <div className="px-4 sm:px-8 mb-4">
          <div className="card p-3 flex flex-wrap items-center gap-3 text-sm">
            {selectedVisible.length > 0 && (
              <>
                <span className="font-medium">{selectedVisible.length} selecionado(s)</span>
                <label className="flex items-center gap-2">
                  Novo markup padrão (%)
                  <input
                    type="number" min="0" max="1000" step="0.5" className="w-24"
                    value={bulkMarkup}
                    onChange={(e) => { setBulkMarkup(e.target.value); setBulkConfirm(false); }}
                  />
                </label>
                {!bulkConfirm ? (
                  <button
                    onClick={() => setBulkConfirm(true)} disabled={!bulkValid}
                    className="btn-primary rounded-lg px-3 py-1.5 text-sm font-semibold"
                  >
                    Aplicar aos selecionados
                  </button>
                ) : (
                  <>
                    <span style={{ color: "var(--danger)" }}>
                      Alterar o markup de {selectedVisible.length} material(is) para {bulkValue}%?
                    </span>
                    <button onClick={applyBulkMarkup} disabled={bulkSaving} className="btn-primary rounded-lg px-3 py-1.5 text-sm font-semibold">
                      {bulkSaving ? "Aplicando..." : "Confirmar"}
                    </button>
                    <button onClick={() => setBulkConfirm(false)} disabled={bulkSaving} className="text-sm underline">Cancelar</button>
                  </>
                )}
                <button onClick={() => { setSelected(new Set()); setBulkConfirm(false); }} className="text-sm underline ml-auto">Limpar seleção</button>
              </>
            )}
            {bulkNotice && <span style={{ color: "var(--primary)" }}>{bulkNotice}</span>}
          </div>
        </div>
      )}

      <div className="px-4 sm:px-8 pb-8">
        <div className="card overflow-hidden">
          {error && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
          {listNotice && <div className="p-4 text-sm" style={{ color: "var(--danger)" }}>{listNotice}</div>}
          {loading ? (
            <div className="p-6 text-sm" style={{ color: "var(--muted)" }}>Carregando materiais...</div>
          ) : filtered.length === 0 ? <EmptyState text="Nenhum material cadastrado." /> : (
            <div className="overflow-x-auto overflow-y-auto min-h-[28rem] max-h-[40rem]"><table className="w-full min-w-[640px]">
              <thead style={{ position: "sticky", top: 0, background: "var(--panel)" }}><tr><th className="w-8"><input type="checkbox" checked={allSelected} onChange={toggleAll} title="Selecionar todos (conforme filtros)" /></th><th>Material</th><th>Marca</th><th>SKU</th><th>Tipo</th><th>Grupo</th><th>Un. medida</th><th>Markup padrão</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} /></td>
                    <td className="text-sm font-medium">{m.name}</td>
                    <td className="text-sm">{m.brand || "-"}</td>
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
                      <button onClick={() => deleteMaterial(m)} className="p-1.5 rounded hover:bg-black/5" style={{ color: "var(--danger)" }} title="Excluir">
                        <Trash2 size={14} />
                      </button>
                      {m.active && (
                        <button onClick={() => toggleActive(m)} className="p-1.5 rounded hover:bg-black/5 ml-1" title="Desativar">
                          <span className="text-xs">Desativar</span>
                        </button>
                      )}
                      {!m.active && (
                        <button onClick={() => toggleActive(m)} className="p-1.5 rounded hover:bg-black/5 ml-1" style={{ color: "var(--primary)" }} title="Ativar">
                          <span className="text-xs">Ativar</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {open && (
        <Modal title={editing ? "Editar material" : "Novo material"} onClose={() => setOpen(false)} wide={!editing}>
          {formError && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{formError}</div>}
          {!editing ? (
            <>
              <div className="space-y-3">
                {rows.map((r, i) => (
                  <div key={r.key} className="rounded-lg p-3" style={{ border: "1px solid var(--border, #d9dedc)" }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>Material {i + 1}</span>
                      {rows.length > 1 && (
                        <button onClick={() => removeRow(r.key)} className="p-1 rounded hover:bg-black/5" title="Remover linha"><X size={14} /></button>
                      )}
                    </div>
                    {r.error && <div className="text-xs mb-2" style={{ color: "var(--danger)" }}>{r.error}</div>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Nome do material">
                        <input value={r.name} onChange={(e) => updateRow(r.key, { name: e.target.value, error: "" })} placeholder="Ex: Luva de Procedimento M" />
                      </Field>
                      <Field label="SKU (código único)">
                        <input value={r.sku} onChange={(e) => updateRow(r.key, { sku: e.target.value, error: "" })} placeholder="Ex: LUV-M-001" />
                      </Field>
                      <Field label="Tipo">
                        <input list="material-types" value={r.type} onChange={(e) => updateRow(r.key, { type: e.target.value })} placeholder="Ex: Enxoval" />
                      </Field>
                      <Field label="Grupo">
                        <input list="material-groups" value={r.group} onChange={(e) => updateRow(r.key, { group: e.target.value })} placeholder="Ex: Ortopédico" />
                      </Field>
                      <Field label="Unidade de medida">
                        <select value={r.unit} onChange={(e) => updateRow(r.key, { unit: e.target.value })}>
                          {MEASURE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </Field>
                      <Field label="Markup padrão de venda (%)">
                        <input type="number" min="0" step="0.5" value={r.markup} onChange={(e) => updateRow(r.key, { markup: e.target.value })} />
                      </Field>
                      <Field label="Estoque mínimo">
                        <input type="number" min="0" step="1" value={r.minStock} onChange={(e) => updateRow(r.key, { minStock: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <datalist id="material-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
              <datalist id="material-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
              <button onClick={addRow} disabled={saving} className="text-sm font-semibold flex items-center gap-1 mt-3" style={{ color: "var(--primary)" }}>
                <Plus size={14} />Adicionar outro material
              </button>
              <button onClick={saveMany} disabled={saving} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold w-full mt-3">
                {saving ? "Salvando..." : rows.length > 1 ? `Cadastrar ${rows.length} materiais` : "Cadastrar material"}
              </button>
            </>
          ) : (
          <>
          <Field label="Nome do material">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Luva de Procedimento M" />
          </Field>
          <Field label="SKU (código único)">
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="Ex: LUV-M-001" />
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
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
          </>
          )}
        </Modal>
      )}
    </div>
  );
}
