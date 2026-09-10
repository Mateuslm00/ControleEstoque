/**
 * api.js
 * -----------------------------------------------------------------------
 * Cliente HTTP mínimo para falar com o backend (server/). Centraliza:
 *
 *  - `credentials: "include"`: obrigatório para o cookie de sessão
 *    HttpOnly ir e voltar entre front (Vite, porta 5173/5174) e backend
 *    (Fastify, porta 3333) mesmo sendo origens diferentes em dev.
 *  - Token CSRF: toda rota mutável (POST/PATCH/PUT/DELETE) exige o header
 *    `x-csrf-token`, buscado antes via GET /auth/csrf-token (ver
 *    server/src/app.ts). Isso é cacheado em memória e renovado quando o
 *    backend recusa por token ausente/expirado.
 *  - Nunca guardamos token de sessão aqui: a sessão inteira vive no
 *    cookie HttpOnly setado pelo servidor, igual exige o prompt de
 *    segurança (nada de localStorage).
 * -----------------------------------------------------------------------
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";

let cachedCsrfToken = null;

async function fetchCsrfToken() {
  const res = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Nao foi possivel obter token CSRF");
  const data = await res.json();
  cachedCsrfToken = data.csrfToken;
  return cachedCsrfToken;
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Faz uma requisicao autenticada ao backend.
 * @param {string} path - ex: "/auth/login"
 * @param {RequestInit} [options]
 */
export async function apiFetch(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (MUTATING_METHODS.has(method)) {
    if (!cachedCsrfToken) await fetchCsrfToken();
    headers["x-csrf-token"] = cachedCsrfToken;
  }

  let res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });

  // Token CSRF expirado/invalido: busca um novo e tenta so mais uma vez.
  if (res.status === 403 && MUTATING_METHODS.has(method)) {
    const body = await res.clone().json().catch(() => null);
    if (body?.code === "FST_CSRF_INVALID_TOKEN" || body?.code === "FST_CSRF_MISSING_SECRET") {
      await fetchCsrfToken();
      headers["x-csrf-token"] = cachedCsrfToken;
      res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        method,
        headers,
        credentials: "include",
      });
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message || body?.message || "Erro inesperado ao falar com o servidor";
    const err = new Error(message);
    err.status = res.status;
    err.code = body?.error?.code;
    throw err;
  }

  if (res.status === 204) return null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text();
}

/**
 * Baixa um arquivo binario (ex: relatorio .xlsx) autenticado pela mesma
 * sessao por cookie. Nao reaproveita apiFetch() porque a resposta aqui
 * nao e texto nem JSON — precisa ficar como Blob para virar download.
 * @param {string} path
 * @returns {Promise<Blob>}
 */
export async function apiFetchBlob(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message || body?.message || "Erro inesperado ao falar com o servidor";
    throw new Error(message);
  }
  return res.blob();
}

export const authApi = {
  login: (identifier, password, rememberMe) =>
    apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ identifier, password, rememberMe }) }),
  logout: () => apiFetch("/auth/logout", { method: "POST" }),
  me: () => apiFetch("/auth/me"),
};
