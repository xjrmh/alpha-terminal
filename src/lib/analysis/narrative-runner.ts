import { buildNarrativeCacheKey } from "@/lib/analysis/cache-keys";
import type { Language } from "@/lib/i18n/types";
import type {
  AnalysisCacheMeta,
  AnalysisRunMode,
  AnalyzeResponse,
  NarrativeModuleId,
} from "@/types";

interface NarrativeRunState {
  completion: string;
  error: string | null;
  isLoading: boolean;
  updatedAt: string | null;
  cache: AnalysisCacheMeta | null;
}

interface RunNarrativeKeyParams {
  moduleId: NarrativeModuleId;
  language: Language;
  modelId: string;
  expertMode: boolean;
}

interface RunNarrativeParams extends RunNarrativeKeyParams {
  providerApiKey?: string;
  mode?: AnalysisRunMode;
}

interface ErrorPayload {
  error?: string;
  code?: string;
  cache?: AnalysisCacheMeta;
}

type NarrativeListener = (state: NarrativeRunState) => void;

const stateByKey = new Map<string, NarrativeRunState>();
const listenersByKey = new Map<string, Set<NarrativeListener>>();
const controllerByKey = new Map<string, AbortController>();
const runTokenByKey = new Map<string, number>();

function defaultState(): NarrativeRunState {
  return {
    completion: "",
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
    const parsed = JSON.parse(text) as ErrorPayload;
    return parsed;
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

function ensureState(key: string): NarrativeRunState {
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
    | NarrativeRunState
    | ((prev: NarrativeRunState) => NarrativeRunState)
): NarrativeRunState {
  const prev = ensureState(key);
  const next = typeof updater === "function" ? updater(prev) : updater;
  stateByKey.set(key, next);
  notify(key);
  return next;
}

export function getNarrativeRunKey(params: RunNarrativeKeyParams): string {
  return buildNarrativeCacheKey(params);
}

export function getNarrativeRunState(key: string): NarrativeRunState {
  return ensureState(key);
}

export function subscribeNarrativeRun(
  key: string,
  listener: NarrativeListener
): () => void {
  const listeners = listenersByKey.get(key) ?? new Set<NarrativeListener>();
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

export async function runNarrativeAnalysis(
  params: RunNarrativeParams
): Promise<void> {
  const key = getNarrativeRunKey(params);
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
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorPayload = await readErrorPayload(res);
      if (errorPayload.code === "CACHE_REFRESH_LOCKED" && errorPayload.cache) {
        setState(key, (prev) => ({
          ...prev,
          error: null,
          isLoading: false,
          cache: errorPayload.cache ?? prev.cache,
          updatedAt: errorPayload.cache?.updatedAt ?? prev.updatedAt,
        }));
        return;
      }
      throw new Error(errorPayload.error || `HTTP ${res.status}`);
    }

    if (getRunToken(key) !== token) return;
    const payload = (await res.json()) as AnalyzeResponse;
    setState(key, {
      completion: payload.completion,
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
