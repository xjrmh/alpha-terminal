import type { Language } from "@/lib/i18n/types";
import type {
  QuantBacktestResponse,
  QuantSignalResponse,
  QuantStrategyConfig,
  QuantStrategyId,
} from "@/types";

interface QuantRunState {
  signal: QuantSignalResponse | null;
  backtest: QuantBacktestResponse | null;
  error: string | null;
  isLoading: boolean;
  updatedAt: string | null;
}

interface QuantCacheRecord {
  version: number;
  signal: QuantSignalResponse | null;
  backtest: QuantBacktestResponse | null;
  updatedAt: string;
}

interface RunQuantParams {
  strategyId: QuantStrategyId;
  language: Language;
  config: QuantStrategyConfig;
  expertMode: boolean;
  overlayBaseStrategyId?: Exclude<
    QuantStrategyId,
    "quant-volatility-target-overlay"
  >;
}

type QuantListener = (state: QuantRunState) => void;

const STORAGE_PREFIX = "alpha-terminal:quant-output:";
const CACHE_VERSION = 1;

const stateByKey = new Map<string, QuantRunState>();
const listenersByKey = new Map<string, Set<QuantListener>>();
const controllerByKey = new Map<string, AbortController>();
const runTokenByKey = new Map<string, number>();

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function defaultState(): QuantRunState {
  return {
    signal: null,
    backtest: null,
    error: null,
    isLoading: false,
    updatedAt: null,
  };
}

function safeNowIso(): string {
  return new Date().toISOString();
}

function getRunToken(key: string): number {
  return runTokenByKey.get(key) ?? 0;
}

function nextRunToken(key: string): number {
  const token = getRunToken(key) + 1;
  runTokenByKey.set(key, token);
  return token;
}

function loadCachedState(key: string): QuantRunState {
  if (typeof window === "undefined") return defaultState();

  const raw = localStorage.getItem(storageKey(key));
  if (!raw) return defaultState();

  try {
    const parsed = JSON.parse(raw) as Partial<QuantCacheRecord>;
    if (parsed.version !== CACHE_VERSION) return defaultState();

    return {
      signal: (parsed.signal as QuantSignalResponse) ?? null,
      backtest: (parsed.backtest as QuantBacktestResponse) ?? null,
      error: null,
      isLoading: false,
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
    };
  } catch {
    return defaultState();
  }
}

function persistState(key: string, state: QuantRunState) {
  if (typeof window === "undefined") return;
  if (!state.signal || !state.backtest) return;

  const payload: QuantCacheRecord = {
    version: CACHE_VERSION,
    signal: state.signal,
    backtest: state.backtest,
    updatedAt: state.updatedAt ?? safeNowIso(),
  };

  localStorage.setItem(storageKey(key), JSON.stringify(payload));
}

function ensureState(key: string): QuantRunState {
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
  updater: QuantRunState | ((prev: QuantRunState) => QuantRunState)
): QuantRunState {
  const prev = ensureState(key);
  const next = typeof updater === "function" ? updater(prev) : updater;
  stateByKey.set(key, next);
  notify(key);
  return next;
}

export function getQuantRunKey(strategyId: QuantStrategyId): string {
  return strategyId;
}

export function getQuantRunState(key: string): QuantRunState {
  return ensureState(key);
}

export function subscribeQuantRun(key: string, listener: QuantListener): () => void {
  const listeners = listenersByKey.get(key) ?? new Set<QuantListener>();
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

export async function runQuantAnalysis(params: RunQuantParams): Promise<void> {
  const key = getQuantRunKey(params.strategyId);
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
    const signalReq = fetch("/api/quant/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        strategyId: params.strategyId,
        language: params.language,
        config: params.config,
        expertMode: params.expertMode,
        overlayBaseStrategyId: params.overlayBaseStrategyId,
      }),
    });

    const backtestReq = fetch("/api/quant/backtest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        strategyId: params.strategyId,
        config: params.config,
        expertMode: params.expertMode,
        overlayBaseStrategyId: params.overlayBaseStrategyId,
      }),
    });

    const [signalRes, backtestRes] = await Promise.all([signalReq, backtestReq]);

    if (!signalRes.ok) {
      const text = await signalRes.text();
      throw new Error(text || `Signal HTTP ${signalRes.status}`);
    }

    if (!backtestRes.ok) {
      const text = await backtestRes.text();
      throw new Error(text || `Backtest HTTP ${backtestRes.status}`);
    }

    if (getRunToken(key) !== token) return;

    const signalPayload = (await signalRes.json()) as QuantSignalResponse;
    const backtestPayload = (await backtestRes.json()) as QuantBacktestResponse;

    const finalState = setState(key, {
      signal: signalPayload,
      backtest: backtestPayload,
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
