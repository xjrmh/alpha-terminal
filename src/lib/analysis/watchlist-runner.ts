import { buildWatchlistCacheKey } from "@/lib/analysis/cache-keys";
import type {
  AnalysisCacheMeta,
  AnalysisRunMode,
  WatchlistRunResponse,
  WatchlistScanResponse,
  WatchlistTimeRange,
} from "@/types";

interface WatchlistRunState {
  result: WatchlistScanResponse | null;
  error: string | null;
  isLoading: boolean;
  updatedAt: string | null;
  cache: AnalysisCacheMeta | null;
}

interface RunWatchlistKeyParams {
  timeRange: WatchlistTimeRange;
  asOfDate?: string;
  limit?: number;
  modelId: string;
  expertMode: boolean;
}

interface RunWatchlistParams extends RunWatchlistKeyParams {
  mode?: AnalysisRunMode;
}

interface ErrorPayload {
  error?: string;
  code?: string;
  cache?: AnalysisCacheMeta;
}

type WatchlistListener = (state: WatchlistRunState) => void;

const stateByKey = new Map<string, WatchlistRunState>();
const listenersByKey = new Map<string, Set<WatchlistListener>>();
const controllerByKey = new Map<string, AbortController>();
const runTokenByKey = new Map<string, number>();

function defaultState(): WatchlistRunState {
  return {
    result: null,
    error: null,
    isLoading: false,
    updatedAt: null,
    cache: null,
  };
}

async function readErrorPayload(res: Response): Promise<ErrorPayload> {
  const text = await res.text();
  if (!text) return { error: `HTTP ${res.status}` };

  try {
    return JSON.parse(text) as ErrorPayload;
  } catch {
    return { error: text };
  }
}

function getRunToken(key: string): number {
  return runTokenByKey.get(key) ?? 0;
}

function nextRunToken(key: string): number {
  const token = getRunToken(key) + 1;
  runTokenByKey.set(key, token);
  return token;
}

function ensureState(key: string): WatchlistRunState {
  const existing = stateByKey.get(key);
  if (existing) return existing;

  const fresh = defaultState();
  stateByKey.set(key, fresh);
  return fresh;
}

function notify(key: string) {
  const state = ensureState(key);
  const listeners = listenersByKey.get(key);
  if (!listeners) return;

  for (const listener of listeners) {
    listener(state);
  }
}

function setState(
  key: string,
  updater:
    | WatchlistRunState
    | ((prev: WatchlistRunState) => WatchlistRunState)
): WatchlistRunState {
  const prev = ensureState(key);
  const next = typeof updater === "function" ? updater(prev) : updater;
  stateByKey.set(key, next);
  notify(key);
  return next;
}

export function getWatchlistRunKey(params: RunWatchlistKeyParams): string {
  return buildWatchlistCacheKey(params);
}

export function getWatchlistRunState(key: string): WatchlistRunState {
  return ensureState(key);
}

export function subscribeWatchlistRun(
  key: string,
  listener: WatchlistListener
): () => void {
  const listeners = listenersByKey.get(key) ?? new Set<WatchlistListener>();
  listeners.add(listener);
  listenersByKey.set(key, listeners);

  listener(ensureState(key));

  return () => {
    const group = listenersByKey.get(key);
    if (!group) return;
    group.delete(listener);
    if (group.size === 0) {
      listenersByKey.delete(key);
    }
  };
}

export async function runWatchlistScan(
  params: RunWatchlistParams
): Promise<void> {
  const key = getWatchlistRunKey(params);
  const token = nextRunToken(key);
  const mode = params.mode ?? "auto";

  controllerByKey.get(key)?.abort();
  const controller = new AbortController();
  controllerByKey.set(key, controller);

  if (mode !== "cache_only") {
    setState(key, (prev) => ({
      ...prev,
      error: null,
      isLoading: true,
    }));
  }

  try {
    const res = await fetch("/api/watchlist/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const payload = await readErrorPayload(res);
      if (payload.code === "CACHE_REFRESH_LOCKED" && payload.cache) {
        setState(key, (prev) => ({
          ...prev,
          error: null,
          isLoading: false,
          cache: payload.cache ?? prev.cache,
          updatedAt: payload.cache?.updatedAt ?? prev.updatedAt,
        }));
        return;
      }
      throw new Error(payload.error || `HTTP ${res.status}`);
    }

    if (getRunToken(key) !== token) return;
    const payload = (await res.json()) as WatchlistRunResponse;

    setState(key, {
      result: payload.result,
      error: null,
      isLoading: false,
      updatedAt: payload.cache.updatedAt,
      cache: payload.cache,
    });
  } catch (error: unknown) {
    if (getRunToken(key) !== token) return;

    if (error instanceof Error && error.name === "AbortError") {
      setState(key, (prev) => ({ ...prev, isLoading: false }));
      return;
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    setState(key, (prev) => ({
      ...prev,
      error: message,
      isLoading: false,
    }));
  } finally {
    const current = controllerByKey.get(key);
    if (current === controller) {
      controllerByKey.delete(key);
    }
  }
}
