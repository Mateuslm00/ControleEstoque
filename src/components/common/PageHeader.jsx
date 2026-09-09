/**
 * PageHeader
 * -----------------------------------------------------------------------
 * Cabeçalho padrão usado no topo de cada aba/tela do sistema: título,
 * subtítulo opcional e uma ação (geralmente um botão "Novo ...") à direita.
 *
 * Props:
 *  - title: string — título principal da página
 *  - subtitle?: string — texto de apoio abaixo do título
 *  - action?: ReactNode — geralmente um <button> alinhado à direita
 * -----------------------------------------------------------------------
 */
export default function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-8 pt-6 sm:pt-8 pb-6 no-print">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--text)" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
