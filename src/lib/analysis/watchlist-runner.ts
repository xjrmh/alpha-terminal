import type {
  WatchlistScanRequest,
  WatchlistScanResponse,
  WatchlistTimeRange,
} from "@/types";
import { isCacheExpired } from "./cache-expiry";

interface WatchlistRunState {
  result: WatchlistScanResponse | null;
  error: string | null;
  isLoading: boolean;
  updatedAt: string | null;
}

interface WatchlistCacheRecord {
  version: number;
  result: WatchlistScanResponse;
  updatedAt: string;
}

interface RunWatchlistParams extends WatchlistScanRequest {
  timeRange: WatchlistTimeRange;
}

type WatchlistListener = (state: WatchlistRunState) => void;

const STORAGE_PREFIX = "alpha-terminal:watchlist-output:";
const CACHE_VERSION = 1;

const stateByKey = new Map<string, WatchlistRunState>();
const listenersByKey = new Map<string, Set<WatchlistListener>>();
const controllerByKey = new Map<string, AbortController>();
const runTokenByKey = new Map<string, number>();

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function safeNowIso(): string {
  return new Date().toISOString();
}

function defaultState(): WatchlistRunState {
  return {
    result: null,
    error: null,
    isLoading: false,
    updatedAt: null,
  };
}

function getRunToken(key: string): number {
  return runTokenByKey.get(key) ?? 0;
}

function nextRunToken(key: string): number {
  const token = getRunToken(key) + 1;
  runTokenByKey.set(key, token);
  return token;
}

function loadCachedState(key: string): WatchlistRunState {
  if (typeof window === "undefined") return defaultState();

  const raw = localStorage.getItem(storageKey(key));
  if (!raw) return defaultState();

  try {
    const parsed = JSON.parse(raw) as Partial<WatchlistCacheRecord>;
    if (parsed.version !== CACHE_VERSION || !parsed.result) return defaultState();
    const updatedAt =
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : null;
    if (isCacheExpired(updatedAt)) return defaultState();

    return {
      result: parsed.result as WatchlistScanResponse,
      error: null,
      isLoading: false,
      updatedAt,
    };
  } catch {
    return defaultState();
  }
}

function persistState(key: string, state: WatchlistRunState) {
  if (typeof window === "undefined") return;
  if (!state.result) return;

  const payload: WatchlistCacheRecord = {
    version: CACHE_VERSION,
    result: state.result,
    updatedAt: state.updatedAt ?? safeNowIso(),
  };

  localStorage.setItem(storageKey(key), JSON.stringify(payload));
}

function ensureState(key: string): WatchlistRunState {
  const existing = stateByKey.get(key);
  if (existing) return existing;

  const loaded = loadCachedState(key);
  stateByKey.set(key, loaded);
  return loaded;
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

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `HTTP ${res.status}`;

  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // Ignore JSON parse errors and return raw payload.
  }

  return text;
}

export function getWatchlistRunKey(timeRange: WatchlistTimeRange): string {
  return timeRange;
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
  const key = getWatchlistRunKey(params.timeRange);
  const token = nextRunToken(key);

  controllerByKey.get(key)?.abort();
  const controller = new AbortController();
  controllerByKey.set(key, controller);

  setState(key, (prev) => ({
    ...prev,
    error: null,
    isLoading: true,
    updatedAt: safeNowIso(),
  }));

  try {
    const res = await fetch("/api/watchlist/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        timeRange: params.timeRange,
        asOfDate: params.asOfDate,
        limit: params.limit,
      }),
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }

    if (getRunToken(key) !== token) return;
    const payload = (await res.json()) as WatchlistScanResponse;

    const finalState = setState(key, {
      result: payload,
      error: null,
      isLoading: false,
      updatedAt: safeNowIso(),
    });
    persistState(key, finalState);
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
      updatedAt: safeNowIso(),
    }));
  } finally {
    const current = controllerByKey.get(key);
    if (current === controller) {
      controllerByKey.delete(key);
    }
  }
}
