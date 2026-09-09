/**
 * format.js
 * -----------------------------------------------------------------------
 * Funções utilitárias puras de formatação, usadas em todo o sistema:
 * geração de IDs, conversão/formatação de datas e valores em Real (R$).
 *
 * Nenhuma lógica de negócio mora aqui — só transformação de dados.
 * (Extraído sem alterações do App.jsx original.)
 * -----------------------------------------------------------------------
 */

/** Gera um id curto e "único o suficiente" para uso em listas no front-end.
 *  Observação: usa Math.random(), não é criptograficamente seguro nem
 *  garante unicidade absoluta — adequado para um protótipo em memória,
 *  mas não deve ser usado como chave primária em um banco real. */
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Data de hoje no formato ISO (YYYY-MM-DD).
 *  Atenção: toISOString() converte para UTC, então perto da meia-noite,
 *  dependendo do fuso do navegador, pode retornar a data de "ontem" ou
 *  "amanhã" em relação ao horário local (comportamento herdado do
 *  sistema original, mantido de propósito). */
export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Converte uma data ISO (YYYY-MM-DD ou um datetime ISO completo, como o
 *  backend retorna) para o formato brasileiro DD/MM/AAAA. */
export const brDate = (iso) => {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

/** Formata um número como moeda brasileira (R$ 0,00). */
export const brl = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Quantos dias faltam (ou já passaram, se negativo) até a data ISO informada. */
export const daysUntil = (iso) => {
  if (!iso) return null;
  const d1 = new Date(iso + "T00:00:00");
  const d0 = new Date(todayISO() + "T00:00:00");
  return Math.round((d1 - d0) / 86400000);
};

/** Placeholder para uma futura máscara de CNPJ.
 *  Hoje é apenas uma função identidade (não formata nada) — mantido
 *  como estava no sistema original, sem implementar a máscara agora. */
export const formatCNPJInput = (v) => v; // free text, keep as typed
