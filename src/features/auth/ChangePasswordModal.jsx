import { useState } from "react";
import Modal from "../../components/common/Modal.jsx";
import Field from "../../components/common/Field.jsx";
import { apiFetch } from "../../lib/api.js";

/**
 * ChangePasswordModal
 * -----------------------------------------------------------------------
 * Usado em dois lugares:
 *  - troca voluntária (menu de perfil): `forced=false`, tem botão de
 *    fechar e "Cancelar".
 *  - troca obrigatória (currentUser.mustChangePassword): `forced=true`,
 *    sem botão de fechar — o backend já bloqueia qualquer outra rota
 *    nesse estado (ver app.ts), então a tela reforça isso visualmente.
 *
 * Props:
 *  - forced: boolean
 *  - onDone: () => void — chamado após troca bem-sucedida
 *  - onClose: () => void — só usado quando !forced
 * -----------------------------------------------------------------------
 */
export default function ChangePasswordModal({ forced = false, onDone, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (newPassword.length < 10) {
      setError("A nova senha deve ter pelo menos 10 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("A confirmação não confere com a nova senha.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      onDone();
    } catch (err) {
      setError(err.message || "Não foi possível trocar a senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Trocar senha"
      onClose={forced ? undefined : onClose}
      noClose={forced}
    >
      {forced && (
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          Por segurança, defina uma senha própria antes de continuar usando o sistema.
        </p>
      )}
      {error && <div className="text-sm mb-2" style={{ color: "var(--danger)" }}>{error}</div>}
      <Field label="Senha atual">
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus />
      </Field>
      <Field label="Nova senha (mín. 10 caracteres)">
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </Field>
      <Field label="Confirmar nova senha">
        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </Field>
      <div className="flex gap-2 mt-2">
        {!forced && (
          <button onClick={onClose} className="btn-outline rounded-lg px-4 py-2.5 text-sm font-semibold flex-1">
            Cancelar
          </button>
        )}
        <button
          onClick={submit}
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="btn-primary rounded-lg px-4 py-2.5 text-sm font-semibold flex-1 disabled:opacity-40"
        >
          {saving ? "Salvando..." : "Trocar senha"}
        </button>
      </div>
    </Modal>
  );
}
