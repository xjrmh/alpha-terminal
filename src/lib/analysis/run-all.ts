import type { Language } from "@/lib/i18n/types";
import type {
  ModuleId,
  NarrativeModuleId,
  QuantStrategyConfig,
  QuantStrategyId,
} from "@/types";
import { MODULES, NARRATIVE_MODULES, QUANT_MODULES } from "@/lib/modules";
import { isQuantModulesEnabled } from "@/lib/features";
import {
  getNarrativeRunKey,
  getNarrativeRunState,
  runNarrativeAnalysis,
  subscribeNarrativeRun,
} from "./narrative-runner";
import {
  getQuantRunKey,
  getQuantRunState,
  runQuantAnalysis,
  subscribeQuantRun,
} from "./quant-runner";
import {
  getWatchlistRunKey,
  getWatchlistRunState,
  runWatchlistScan,
  subscribeWatchlistRun,
} from "./watchlist-runner";

/* ── Types ─────────────────────────────────────────────── */

interface RunAllState {
  isRunning: boolean;
  currentModuleId: ModuleId | null;
  completedCount: number;
  totalCount: number;
  error: string | null;
}

interface RunAllParams {
  language: Language;
  modelId: string;
  providerApiKey?: string;
  expertMode: boolean;
  getQuantConfig: (id: QuantStrategyId) => QuantStrategyConfig;
}

type RunAllListener = (state: RunAllState) => void;

/* ── State ─────────────────────────────────────────────── */

let runAllState: RunAllState = {
  isRunning: false,
  currentModuleId: null,
  completedCount: 0,
  totalCount: 0,
  error: null,
};

let cancelled = false;
const listeners = new Set<RunAllListener>();

function notify() {
  for (const listener of listeners) {
    listener(runAllState);
  }
}

function setState(patch: Partial<RunAllState>) {
  runAllState = { ...runAllState, ...patch };
  notify();
}

/* ── Public API ────────────────────────────────────────── */

export function getRunAllState(): RunAllState {
  return runAllState;
}

export function subscribeRunAll(listener: RunAllListener): () => void {
  listeners.add(listener);
  listener(runAllState);
  return () => {
    listeners.delete(listener);
  };
}

export function cancelRunAll() {
  cancelled = true;
  setState({ isRunning: false, currentModuleId: null, error: null });
}

function quantOverlayBase(
  strategyId: QuantStrategyId
): Exclude<QuantStrategyId, "quant-volatility-target-overlay"> | undefined {
  if (strategyId !== "quant-volatility-target-overlay") return undefined;
  return "quant-dual-momentum";
}

/** Check whether a specific module has cached results ready. */
export function isModuleReady(
  moduleId: ModuleId,
  language: Language,
  modelId: string,
  expertMode: boolean,
  getQuantConfig: (id: QuantStrategyId) => QuantStrategyConfig
): boolean {
  const mod = MODULES.find((m) => m.id === moduleId);
  if (!mod) return false;

  if (mod.kind === "narrative") {
    const key = getNarrativeRunKey({
      moduleId: moduleId as NarrativeModuleId,
      language,
      modelId,
      expertMode,
    });
    const state = getNarrativeRunState(key);
    return Boolean(state.completion);
  }

  if (mod.kind === "watchlist") {
    const key = getWatchlistRunKey({
      timeRange: "1D",
      modelId,
      expertMode,
    });
    const state = getWatchlistRunState(key);
    return Boolean(state.result);
  }

  if (mod.kind === "quant") {
    const strategyId = moduleId as QuantStrategyId;
    const key = getQuantRunKey({
      strategyId,
      language,
      modelId,
      config: getQuantConfig(strategyId),
      expertMode,
      overlayBaseStrategyId: quantOverlayBase(strategyId),
    });
    const state = getQuantRunState(key);
    return Boolean(state.signal && state.backtest);
  }

  return false;
}

/** Run all modules sequentially and defer rerun eligibility to the shared cache mode. */
export async function runAll(params: RunAllParams): Promise<void> {
  const { language, modelId, providerApiKey, expertMode, getQuantConfig } = params;
  cancelled = false;

  const narrativeOnly = NARRATIVE_MODULES.filter((m) => m.kind === "narrative");
  const watchlistMod = NARRATIVE_MODULES.find((m) => m.kind === "watchlist");
  const quantMods = isQuantModulesEnabled() ? QUANT_MODULES : [];
  const allModules = [...narrativeOnly, ...(watchlistMod ? [watchlistMod] : []), ...quantMods];

  setState({
    isRunning: true,
    currentModuleId: null,
    completedCount: 0,
    totalCount: allModules.length,
    error: null,
  });

  let completedCount = 0;

  for (const mod of allModules) {
    if (cancelled) return;
    setState({ currentModuleId: mod.id as ModuleId });

    try {
      if (mod.kind === "narrative") {
        await runNarrativeAnalysis({
          moduleId: mod.id as NarrativeModuleId,
          language,
          modelId,
          providerApiKey,
          expertMode,
          mode: "refresh_if_eligible",
        });
      } else if (mod.kind === "watchlist") {
        await runWatchlistScan({
          timeRange: "1D",
          modelId,
          expertMode,
          mode: "refresh_if_eligible",
        });
      } else if (mod.kind === "quant") {
        const strategyId = mod.id as QuantStrategyId;
        await runQuantAnalysis({
          strategyId,
          language,
          modelId,
          config: getQuantConfig(strategyId),
          expertMode,
          overlayBaseStrategyId: quantOverlayBase(strategyId),
          mode: "refresh_if_eligible",
        });
      }
    } catch (error: unknown) {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "Unknown error";
      setState({ error: message });
    }

    if (cancelled) return;
    completedCount += 1;
    setState({ completedCount });
  }

  setState({ isRunning: false, currentModuleId: null });
}

/* ── Module status helpers ─────────────────────────────── */

function isModuleLoading(
  moduleId: ModuleId,
  language: Language,
  modelId: string,
  expertMode: boolean,
  getQuantConfig: (id: QuantStrategyId) => QuantStrategyConfig
): boolean {
  const mod = MODULES.find((m) => m.id === moduleId);
  if (!mod) return false;

  if (mod.kind === "narrative") {
    const key = getNarrativeRunKey({
      moduleId: moduleId as NarrativeModuleId,
      language,
      modelId,
      expertMode,
    });
    return getNarrativeRunState(key).isLoading;
  }

  if (mod.kind === "watchlist") {
    const key = getWatchlistRunKey({
      timeRange: "1D",
      modelId,
      expertMode,
    });
    return getWatchlistRunState(key).isLoading;
  }

  if (mod.kind === "quant") {
    const strategyId = moduleId as QuantStrategyId;
    const key = getQuantRunKey({
      strategyId,
      language,
      modelId,
      config: getQuantConfig(strategyId),
      expertMode,
      overlayBaseStrategyId: quantOverlayBase(strategyId),
    });
    return getQuantRunState(key).isLoading;
  }

  return false;
}

export interface ModuleStatus {
  completedIds: Set<string>;
  loadingIds: Set<string>;
}

export function subscribeModuleStatus(
  language: Language,
  modelId: string,
  expertMode: boolean,
  getQuantConfig: (id: QuantStrategyId) => QuantStrategyConfig,
  listener: (status: ModuleStatus) => void
): () => void {
  const unsubscribers: (() => void)[] = [];

  const check = () => {
    const completed = new Set<string>();
    const loading = new Set<string>();
    for (const mod of MODULES) {
      const id = mod.id as ModuleId;
      if (isModuleReady(id, language, modelId, expertMode, getQuantConfig)) {
        completed.add(mod.id);
      }
      if (isModuleLoading(id, language, modelId, expertMode, getQuantConfig)) {
        loading.add(mod.id);
      }
    }
    listener({ completedIds: completed, loadingIds: loading });
  };

  for (const mod of NARRATIVE_MODULES.filter((m) => m.kind === "narrative")) {
    const key = getNarrativeRunKey({
      moduleId: mod.id as NarrativeModuleId,
      language,
      modelId,
      expertMode,
    });
    unsubscribers.push(subscribeNarrativeRun(key, () => check()));
  }

  unsubscribers.push(
    subscribeWatchlistRun(
      getWatchlistRunKey({
        timeRange: "1D",
        modelId,
        expertMode,
      }),
      () => check()
    )
  );

  if (isQuantModulesEnabled()) {
    for (const mod of QUANT_MODULES) {
      const strategyId = mod.id as QuantStrategyId;
      const key = getQuantRunKey({
        strategyId,
        language,
        modelId,
        config: getQuantConfig(strategyId),
        expertMode,
        overlayBaseStrategyId: quantOverlayBase(strategyId),
      });
      unsubscribers.push(subscribeQuantRun(key, () => check()));
    }
  }

  unsubscribers.push(subscribeRunAll(() => check()));

  const interval = setInterval(check, 1000);
  check();

  return () => {
    clearInterval(interval);
    for (const unsub of unsubscribers) {
      unsub();
    }
  };
}
