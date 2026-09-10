import { useEffect, useRef, useState } from "react";
import { Download, Printer } from "lucide-react";
import Modal from "../../components/common/Modal.jsx";
import { apiFetch } from "../../lib/api.js";

/**
 * RomaneioView
 * -----------------------------------------------------------------------
 * Exibe o romaneio de uma venda já finalizada.
 *
 * IMPORTANTE (correção de segurança): esta tela usada a mostrar custo
 * unitário e markup no romaneio do cliente — exatamente o que o backend
 * (server/src/modules/romaneio/romaneio.service.ts) foi construído para
 * NUNCA expor. Por isso o HTML não é mais montado aqui no frontend: ele
 * é buscado pronto do backend via GET /sales/:id/romaneio, que já:
 *   - escapa todo valor dinâmico (nome de material/cliente) contra XSS;
 *   - nunca inclui custo unitário nem markup;
 *   - é a mesma fonte usada para o e-mail do romaneio (quando implementado).
 *
 * O HTML é renderizado dentro de um <iframe sandbox> (nunca com
 * dangerouslySetInnerHTML) — mesmo confiando no próprio backend, isolar
 * o documento evita que qualquer estilo/script do romaneio vaze para o
 * resto da aplicação.
 *
 * Props:
 *  - saleId: id da venda já persistida no backend
 *  - docNumber: número do romaneio (só para o título do modal)
 *  - onClose: () => void
 * -----------------------------------------------------------------------
 */
export default function RomaneioView({ saleId, docNumber, onClose }) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const iframeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/sales/${saleId}/romaneio`)
      .then((text) => {
        if (!cancelled) setHtml(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Não foi possível carregar o romaneio.");
      });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const doPrint = () => iframeRef.current?.contentWindow?.print();

  const doDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `romaneio-${docNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal title={`Romaneio Nº ${docNumber}`} onClose={onClose} wide noPad>
      <div className="flex justify-end gap-2 px-5 pt-1 pb-3 no-print">
        <button onClick={doDownload} disabled={!html} className="btn-outline rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-40"><Download size={14} />Baixar HTML</button>
        <button onClick={doPrint} disabled={!html} className="btn-primary rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-40"><Printer size={14} />Imprimir</button>
      </div>
      {error && <div className="px-6 pb-4 text-sm" style={{ color: "var(--danger)" }}>{error}</div>}
      {html && (
        <iframe
          ref={iframeRef}
          title={`Romaneio ${docNumber}`}
          srcDoc={html}
          sandbox="allow-same-origin allow-modals"
          style={{ width: "100%", height: "70vh", border: 0 }}
        />
      )}
    </Modal>
  );
}
