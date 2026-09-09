/**
 * bimester.js
 * -----------------------------------------------------------------------
 * Cálculo de "bimestres" (períodos de 2 em 2 meses) usados na tela de
 * Cotação de Preços — a regra de negócio do sistema é recotar cada
 * material a cada 2 meses, com no mínimo 3 fornecedores (ver
 * features/cotacao/CotacaoTab.jsx).
 *
 * (Extraído sem alterações do App.jsx original.)
 * -----------------------------------------------------------------------
 */

export const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Chave única de bimestre para uma data, ex: "2026-3" (ano-índice do bimestre). */
export const bimesterKey = (d) => `${d.getFullYear()}-${Math.floor(d.getMonth() / 2)}`;

/** Rótulo legível do bimestre de uma data, ex: "Jul/Ago 2026". */
export const bimesterLabel = (d) => {
  const start = Math.floor(d.getMonth() / 2) * 2;
  return `${MONTHS_PT[start]}/${MONTHS_PT[start + 1]} ${d.getFullYear()}`;
};

/** Reconstrói a data de início de um bimestre a partir da sua chave (ex: "2026-3"). */
export const bimesterStartDate = (key) => {
  const [y, idx] = key.split("-").map(Number);
  return new Date(y, idx * 2, 1);
};

/** Soma (ou subtrai, com n negativo) meses a uma data, preservando o dia. */
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());

/** Lista os últimos N bimestres (padrão: 6) a partir de hoje, mais recente primeiro.
 *  Usado para popular o seletor de período na "Nova cotação". */
export const listRecentBimesters = (count = 6) => {
  const now = new Date();
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = addMonths(now, -i * 2);
    out.push({ key: bimesterKey(d), label: bimesterLabel(d) });
  }
  return out;
};
