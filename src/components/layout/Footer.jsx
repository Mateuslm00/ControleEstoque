/**
 * Footer
 * -----------------------------------------------------------------------
 * Rodapé fixo na base do conteúdo, mesma cor do cabeçalho para manter a
 * identidade visual do sistema.
 * -----------------------------------------------------------------------
 */
export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      className="no-print px-4 sm:px-6 py-4 text-center text-xs"
      style={{ background: "linear-gradient(to top, var(--primary-deep), var(--primary-neon))", color: "#9FC3BD" }}
    >
      © {year} Grupo Multiunidades — Controlador de Estoque
    </footer>
  );
}
