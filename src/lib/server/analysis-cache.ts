import type { AnalysisCacheMeta, AnalysisRunMode } from "@/types";

export const REFRESH_WINDOW_MS = 60 * 60 * 1000;

const REFRESH_LOCK_TTL_MS = 2 * 60 * 1000;

interface AnalysisCacheRecord<T> {
  updatedAt: string;
  payload: T;
}

interface RunWithSharedCacheParams<T> {
  cacheKey: string;
  mode?: AnalysisRunMode;
  execute: () => Promise<T>;
}

export interface RunWithSharedCacheResult<T> {
  payload: T | null;
  cache: AnalysisCacheMeta;
}

export class CacheRefreshLockedError extends Error {
  readonly code = "CACHE_REFRESH_LOCKED" as const;
  readonly cache: AnalysisCacheMeta;

  constructor(cache: AnalysisCacheMeta) {
    super("Cached result is newer than 1 hour. Please retry when cooldown ends.");
    this.name = "CacheRefreshLockedError";
    this.cache = cache;
  }
}

function parseUpdatedAt(updatedAt: string | null | undefined): number | null {
  if (!updatedAt) return null;
  const ts = new Date(updatedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  return ts;
}

function buildCacheMeta(options: {
  source: AnalysisCacheMeta["source"];
  updatedAt: string | null;
  cacheEnabled: boolean;
}): AnalysisCacheMeta {
  const nowMs = Date.now();
  const updatedAtMs = parseUpdatedAt(options.updatedAt);
  const refreshEligibleAt =
    updatedAtMs === null
      ? null
      : new Date(updatedAtMs + REFRESH_WINDOW_MS).toISOString();
  const remainingMs =
    updatedAtMs === null ? 0 : updatedAtMs + REFRESH_WINDOW_MS - nowMs;
  const secondsUntilRefresh = Math.max(0, Math.ceil(remainingMs / 1000));
  const canRefresh = secondsUntilRefresh === 0;

  return {
    source: options.source,
    updatedAt: options.updatedAt,
    refreshEligibleAt,
    canRefresh,
    secondsUntilRefresh,
    cacheEnabled: options.cacheEnabled,
  };
}

async function runWithoutCache<T>(
  params: RunWithSharedCacheParams<T>
): Promise<RunWithSharedCacheResult<T>> {
  if (params.mode === "cache_only") {
    return {
      payload: null,
      cache: buildCacheMeta({
        source: "missing",
        updatedAt: null,
        cacheEnabled: false,
      }),
    };
  }

  const payload = await params.execute();
  const updatedAt = new Date().toISOString();
  return {
    payload,
    cache: buildCacheMeta({
      source: "fresh",
      updatedAt,
      cacheEnabled: false,
    }),
  };
}

class VercelKvClient {
  private readonly url: string | null;
  private readonly token: string | null;

  constructor() {
    const rawUrl = process.env.KV_REST_API_URL?.trim();
    const rawToken = process.env.KV_REST_API_TOKEN?.trim();
    this.url = rawUrl && rawToken ? rawUrl : null;
    this.token = rawUrl && rawToken ? rawToken : null;
  }

  get enabled(): boolean {
    return Boolean(this.url && this.token);
  }

  private async command(args: Array<string | number>): Promise<unknown> {
    if (!this.url || !this.token) {
      throw new Error("Vercel KV is not configured.");
    }

    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`KV HTTP ${res.status}`);
    }

    const parsed = (await res.json()) as { result?: unknown; error?: string };
    if (parsed.error) {
      throw new Error(parsed.error);
    }

    return parsed.result;
  }

  async get<T>(key: string): Promise<AnalysisCacheRecord<T> | null> {
    const result = await this.command(["GET", key]);
    if (typeof result !== "string" || !result) return null;

    try {
      const parsed = JSON.parse(result) as Partial<AnalysisCacheRecord<T>>;
      if (typeof parsed.updatedAt !== "string" || !("payload" in parsed)) {
        return null;
      }
      return {
        updatedAt: parsed.updatedAt,
        payload: parsed.payload as T,
      };
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: AnalysisCacheRecord<T>): Promise<void> {
    await this.command(["SET", key, JSON.stringify(value)]);
  }

  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.command([
      "SET",
      key,
      new Date().toISOString(),
      "PX",
      String(ttlMs),
      "NX",
    ]);
    return result === "OK";
  }

  async releaseLock(key: string): Promise<void> {
    await this.command(["DEL", key]);
  }
}

async function runWithKv<T>(
  client: VercelKvClient,
  params: RunWithSharedCacheParams<T>
): Promise<RunWithSharedCacheResult<T>> {
  const mode = params.mode ?? "auto";
  const cached = await client.get<T>(params.cacheKey);
  const cachedMeta = cached
    ? buildCacheMeta({
        source: "cache",
        updatedAt: cached.updatedAt,
        cacheEnabled: true,
      })
    : buildCacheMeta({
        source: "missing",
        updatedAt: null,
        cacheEnabled: true,
      });

  if (mode === "cache_only") {
    return {
      payload: cached?.payload ?? null,
      cache: cachedMeta,
    };
  }

  if (mode === "auto" && cached) {
    return {
      payload: cached.payload,
      cache: cachedMeta,
    };
  }

  if (mode === "refresh" && cached && !cachedMeta.canRefresh) {
    throw new CacheRefreshLockedError(cachedMeta);
  }

  if (mode === "refresh_if_eligible" && cached && !cachedMeta.canRefresh) {
    return {
      payload: cached.payload,
      cache: cachedMeta,
    };
  }

  const lockKey = `${params.cacheKey}:lock`;
  let lockAcquired = false;

  try {
    lockAcquired = await client.acquireLock(lockKey, REFRESH_LOCK_TTL_MS);

    if (!lockAcquired) {
      const retryCached = await client.get<T>(params.cacheKey);
      if (retryCached) {
        return {
          payload: retryCached.payload,
          cache: buildCacheMeta({
            source: "cache",
            updatedAt: retryCached.updatedAt,
            cacheEnabled: true,
          }),
        };
      }
    }

    const payload = await params.execute();
    const updatedAt = new Date().toISOString();

    await client.set(params.cacheKey, {
      updatedAt,
      payload,
    });

    return {
      payload,
      cache: buildCacheMeta({
        source: "fresh",
        updatedAt,
        cacheEnabled: true,
      }),
    };
  } finally {
    if (lockAcquired) {
      await client.releaseLock(lockKey).catch(() => undefined);
    }
  }
}

export async function runWithSharedAnalysisCache<T>(
  params: RunWithSharedCacheParams<T>
): Promise<RunWithSharedCacheResult<T>> {
  const client = new VercelKvClient();
  if (!client.enabled) {
    return runWithoutCache(params);
  }

  try {
    return await runWithKv(client, params);
  } catch (error: unknown) {
    if (error instanceof CacheRefreshLockedError) {
      throw error;
    }
    if (error instanceof Error) {
      console.warn("[analysis-cache] KV unavailable, falling back to uncached run.", error.message);
    }
    return runWithoutCache(params);
  }
}
