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

const RUN_ALL_LAUNCH_DELAY_MS = 400;
const RUN_ALL_MAX_CONCURRENT = 3;

/* ── State ─────────────────────────────────────────────── */

let runAllState: RunAllState = {
  isRunning: false,
  currentModuleId: null,
  completedCount: 0,
  totalCount: 0,
  error: null,
};

let activeRunToken = 0;
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
  activeRunToken += 1;
  setState({ isRunning: false, currentModuleId: null, error: null });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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

async function runModule(
  mod: (typeof MODULES)[number],
  params: RunAllParams
): Promise<void> {
  const { language, modelId, providerApiKey, expertMode, getQuantConfig } = params;

  if (mod.kind === "narrative") {
    await runNarrativeAnalysis({
      moduleId: mod.id as NarrativeModuleId,
      language,
      modelId,
      providerApiKey,
      expertMode,
      mode: "refresh_if_eligible",
    });
    return;
  }

  if (mod.kind === "watchlist") {
    await runWatchlistScan({
      timeRange: "1D",
      modelId,
      expertMode,
      mode: "refresh_if_eligible",
    });
    return;
  }

  if (mod.kind === "quant") {
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
}

/** Run all modules with staggered starts and bounded overlap. */
export async function runAll(params: RunAllParams): Promise<void> {
  const runToken = activeRunToken + 1;
  activeRunToken = runToken;

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
  let nextIndex = 0;
  let lastLaunchAt = 0;
  const inFlight = new Set<Promise<void>>();

  const launchNext = async (): Promise<boolean> => {
    if (runToken !== activeRunToken || nextIndex >= allModules.length) {
      return false;
    }

    const waitMs = Math.max(
      0,
      lastLaunchAt + RUN_ALL_LAUNCH_DELAY_MS - Date.now()
    );
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    if (runToken !== activeRunToken || nextIndex >= allModules.length) {
      return false;
    }

    const mod = allModules[nextIndex++];
    lastLaunchAt = Date.now();
    setState({ currentModuleId: mod.id as ModuleId });

    const baseTask = runModule(mod, params)
      .catch((error: unknown) => {
        if (runToken !== activeRunToken) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        setState({ error: message });
      });

    const task = baseTask.finally(() => {
      inFlight.delete(task);
      if (runToken !== activeRunToken) return;
      completedCount += 1;
      setState({ completedCount });
    });

    inFlight.add(task);
    return true;
  };

  while (
    runToken === activeRunToken &&
    (nextIndex < allModules.length || inFlight.size > 0)
  ) {
    while (
      runToken === activeRunToken &&
      nextIndex < allModules.length &&
      inFlight.size < RUN_ALL_MAX_CONCURRENT
    ) {
      const launched = await launchNext();
      if (!launched) break;
    }

    if (runToken !== activeRunToken || inFlight.size === 0) {
      break;
    }

    await Promise.race(inFlight);
  }

  if (runToken !== activeRunToken) return;
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
