/**
 * EmptyState
 * -----------------------------------------------------------------------
 * Mensagem simples exibida no lugar de uma tabela/lista quando ainda
 * não há nenhum registro cadastrado.
 *
 * Props:
 *  - text: string — mensagem a exibir
 * -----------------------------------------------------------------------
 */
export default function EmptyState({ text }) {
  return (
    <div className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
      {text}
    </div>
  );
}
