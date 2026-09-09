import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "./api.js";

/**
 * useCollection
 * -----------------------------------------------------------------------
 * Hook simples para telas de CRUD (materiais, fornecedores, unidades...):
 * busca uma lista paginada do backend ao montar e expõe um `reload()`
 * para chamar depois de criar/editar algo.
 *
 * O backend sempre responde `{ items, total, page, pageSize }` (ver
 * server/src/shared/validation/sort.ts e as rotas de listagem) — por
 * isso o hook já assume esse formato em vez de aceitar qualquer shape.
 *
 * @param {string} path - ex: "/materials?pageSize=100"
 * @returns {{ items: any[], loading: boolean, error: string, reload: () => void }}
 */
export function useCollection(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetch(path)
      .then((data) => {
        if (!cancelled) setItems(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Erro ao carregar dados");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, reloadTick]);

  return { items, loading, error, reload };
}
