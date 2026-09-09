/**
 * Garante que orderBy/sort venha apenas de uma allowlist explicita por recurso,
 * nunca de string livre do cliente (previne injecao via nome de coluna).
 */
export function resolveSort<T extends string>(
  requested: string | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  if (requested && (allowed as readonly string[]).includes(requested)) {
    return requested as T;
  }
  return fallback;
}

export function resolveDirection(requested: string | undefined): "asc" | "desc" {
  return requested === "asc" ? "asc" : "desc";
}
