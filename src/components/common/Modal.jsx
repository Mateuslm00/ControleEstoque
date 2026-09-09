import { X } from "lucide-react";

/**
 * Modal
 * -----------------------------------------------------------------------
 * Janela modal genérica usada em todos os formulários e visualizações
 * (novo material, nova entrada, romaneio, relatório etc).
 *
 * Props:
 *  - title: string — título exibido no cabeçalho do modal
 *  - onClose: () => void — chamado ao clicar no X
 *  - children: ReactNode — conteúdo do modal
 *  - wide?: boolean — usa largura maior (760px) em vez da padrão (480px)
 *  - noPad?: boolean — remove o padding padrão (usado em telas com
 *            área de impressão própria, como romaneios e relatórios)
 *
 * OBS: não possui nenhuma confirmação embutida — quem decide se uma
 * ação é destrutiva (ex: excluir) é o componente que usa o Modal.
 * -----------------------------------------------------------------------
 */
export default function Modal({ title, onClose, children, wide, noPad, noClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" style={{ background: "rgba(20,30,29,0.45)" }}>
      <div className="card w-full max-h-[90vh] overflow-y-auto" style={{ maxWidth: wide ? 760 : 480, padding: noPad ? 0 : 24 }}>
        <div className="flex items-center justify-between mb-4 no-print" style={{ padding: noPad ? "20px 20px 0 20px" : 0 }}>
          <h3 className="font-bold text-lg">{title}</h3>
          {!noClose && <button onClick={onClose} className="p-1 rounded hover:bg-black/5"><X size={18} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}
