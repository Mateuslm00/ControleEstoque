/**
 * Field
 * -----------------------------------------------------------------------
 * Wrapper padrão para um campo de formulário: label pequeno em cima do
 * input/select passado como children. Usado em todos os formulários do
 * sistema para manter o espaçamento e a tipografia consistentes.
 *
 * Props:
 *  - label: string — texto do rótulo
 *  - children: ReactNode — o input/select/textarea do campo
 * -----------------------------------------------------------------------
 */
export default function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>{label}</span>
      {children}
    </label>
  );
}
