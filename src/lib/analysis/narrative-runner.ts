import type { Language } from "@/lib/i18n/types";
import type { NarrativeModuleId } from "@/types";
import { isCacheExpired } from "./cache-expiry";

interface NarrativeRunState {
  completion: string;
  error: string | null;
  isLoading: boolean;
  updatedAt: string | null;
}

interface NarrativeCacheRecord {
  version: number;
  completion: string;
  updatedAt: string;
}

interface RunNarrativeParams {
  moduleId: NarrativeModuleId;
  language: Language;
  modelId: string;
  providerApiKey?: string;
  expertMode: boolean;
}

type NarrativeListener = (state: NarrativeRunState) => void;

const STORAGE_PREFIX = "alpha-terminal:narrative-output:";
const CACHE_VERSION = 1;

const stateByKey = new Map<string, NarrativeRunState>();
const listenersByKey = new Map<string, Set<NarrativeListener>>();
const controllerByKey = new Map<string, AbortController>();
const runTokenByKey = new Map<string, number>();

function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function defaultState(): NarrativeRunState {
  return {
    completion: "",
    error: null,
    isLoading: false,
    updatedAt: null,
  };
}

function safeNowIso(): string {
  return new Date().toISOString();
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `HTTP ${res.status}`;

  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // ignore json parse errors
  }

  return text;
}

function getRunToken(key: string): number {
  return runTokenByKey.get(key) ?? 0;
}

function nextRunToken(key: string): number {
  const token = getRunToken(key) + 1;
  runTokenByKey.set(key, token);
  return token;
}

function loadCachedState(key: string): NarrativeRunState {
  if (typeof window === "undefined") return defaultState();

  const raw = localStorage.getItem(getStorageKey(key));
  if (!raw) return defaultState();

  try {
    const parsed = JSON.parse(raw) as Partial<NarrativeCacheRecord>;
    if (parsed.version !== CACHE_VERSION) return defaultState();
    const updatedAt =
      typeof parsed.updatedAt === "string" ? parsed.updatedAt : null;
    if (isCacheExpired(updatedAt)) return defaultState();
    const completion =
      typeof parsed.completion === "string" ? parsed.completion : "";

    return {
      completion,
      error: null,
      isLoading: false,
      updatedAt,
    };
  } catch {
    return defaultState();
  }
}

function persistState(key: string, state: NarrativeRunState) {
  if (typeof window === "undefined") return;
  if (!state.completion) return;

  const payload: NarrativeCacheRecord = {
    version: CACHE_VERSION,
    completion: state.completion,
    updatedAt: state.updatedAt ?? safeNowIso(),
  };

  localStorage.setItem(getStorageKey(key), JSON.stringify(payload));
}

function ensureState(key: string): NarrativeRunState {
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
    | NarrativeRunState
    | ((prev: NarrativeRunState) => NarrativeRunState)
): NarrativeRunState {
  const prev = ensureState(key);
  const next = typeof updater === "function" ? updater(prev) : updater;
  stateByKey.set(key, next);
  notify(key);
  return next;
}

export function getNarrativeRunKey(params: RunNarrativeParams): string {
  const modePart = params.expertMode ? "mode:expert" : "mode:standard";
  return `${params.moduleId}|${params.language}|${params.modelId}|${modePart}`;
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

  controllerByKey.get(key)?.abort();
  const controller = new AbortController();
  controllerByKey.set(key, controller);

  setState(key, {
    completion: "",
    error: null,
    isLoading: true,
    updatedAt: safeNowIso(),
  });

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(await readErrorMessage(res));
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let accumulated = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (getRunToken(key) !== token) return;

      accumulated += decoder.decode(value, { stream: true });
      setState(key, (prev) => ({
        ...prev,
        completion: accumulated,
        error: null,
        isLoading: true,
        updatedAt: safeNowIso(),
      }));
    }

    if (getRunToken(key) !== token) return;

    const finalState = setState(key, (prev) => ({
      ...prev,
      completion: accumulated,
      error: null,
      isLoading: false,
      updatedAt: safeNowIso(),
    }));

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
