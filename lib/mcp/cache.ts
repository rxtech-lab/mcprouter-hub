import { getCache, type RuntimeCache } from "@vercel/functions";

/**
 * Upstream responses are cached in Vercel Runtime Cache, keyed by request and
 * kept for the tool's `cacheTtl`. Off Vercel, `getCache` falls back to an
 * in-memory store, so local development behaves the same way.
 */
let runtimeCache: RuntimeCache | null = null;

function cache() {
  runtimeCache ??= getCache({ namespace: "mcprouter-upstream" });
  return runtimeCache;
}

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (ttlSeconds <= 0) return load();
  try {
    const hit = await cache().get(key);
    if (hit !== null && hit !== undefined) return hit as T;
  } catch (error) {
    console.warn("[mcp-cache] read failed", error);
  }
  const value = await load();
  try {
    await cache().set(key, value, { ttl: ttlSeconds, name: key.slice(0, 120) });
  } catch (error) {
    console.warn("[mcp-cache] write failed", error);
  }
  return value;
}

/** Test hook: swap the cache implementation. */
export function setCacheForTesting(value: RuntimeCache | null) {
  runtimeCache = value;
}
