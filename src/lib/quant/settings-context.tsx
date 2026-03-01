"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { QuantStrategyConfig, QuantStrategyId } from "@/types";
import {
  getDefaultConfigForStrategy,
  normalizeQuantConfig,
} from "@/lib/quant/config";

interface StoredStrategyConfig {
  version: number;
  updatedAt: string;
  config: QuantStrategyConfig;
}

interface QuantSettingsContextType {
  hydrated: boolean;
  getConfig: (strategyId: QuantStrategyId) => QuantStrategyConfig;
  setConfig: (
    strategyId: QuantStrategyId,
    patch: Partial<QuantStrategyConfig>
  ) => void;
  replaceConfig: (strategyId: QuantStrategyId, config: QuantStrategyConfig) => void;
  resetConfig: (strategyId: QuantStrategyId) => void;
}

const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "alpha-terminal:quant-settings:";

const STRATEGIES: QuantStrategyId[] = [
  "quant-dual-momentum",
  "quant-multifactor-stocks",
  "quant-low-beta-quality",
  "quant-volatility-target-overlay",
];

const QuantSettingsContext = createContext<QuantSettingsContextType | null>(null);

function storageKey(strategyId: QuantStrategyId): string {
  return `${STORAGE_PREFIX}${strategyId}`;
}

function migrateStored(
  strategyId: QuantStrategyId,
  raw: string | null
): QuantStrategyConfig {
  const defaultConfig = getDefaultConfigForStrategy(strategyId);
  if (!raw) return defaultConfig;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredStrategyConfig>;
    if (!parsed || typeof parsed !== "object") return defaultConfig;

    const maybeConfig = parsed.config ?? (parsed as Partial<QuantStrategyConfig>);
    const normalized = normalizeQuantConfig(strategyId, maybeConfig, {
      expertMode: true,
    });
    return normalized.effectiveConfig;
  } catch {
    return defaultConfig;
  }
}

function persist(strategyId: QuantStrategyId, config: QuantStrategyConfig) {
  if (typeof window === "undefined") return;

  const payload: StoredStrategyConfig = {
    version: STORAGE_VERSION,
    updatedAt: new Date().toISOString(),
    config,
  };

  localStorage.setItem(storageKey(strategyId), JSON.stringify(payload));
}

function getDefaultConfigMap(): Record<QuantStrategyId, QuantStrategyConfig> {
  return {
    "quant-dual-momentum": getDefaultConfigForStrategy("quant-dual-momentum"),
    "quant-multifactor-stocks":
      getDefaultConfigForStrategy("quant-multifactor-stocks"),
    "quant-low-beta-quality":
      getDefaultConfigForStrategy("quant-low-beta-quality"),
    "quant-volatility-target-overlay": getDefaultConfigForStrategy(
      "quant-volatility-target-overlay"
    ),
  };
}

function loadInitialConfigs(): Record<QuantStrategyId, QuantStrategyConfig> {
  const loaded = getDefaultConfigMap();
  if (typeof window === "undefined") return loaded;

  for (const strategyId of STRATEGIES) {
    loaded[strategyId] = migrateStored(
      strategyId,
      localStorage.getItem(storageKey(strategyId))
    );
  }

  return loaded;
}

export function QuantSettingsProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<
    Record<QuantStrategyId, QuantStrategyConfig>
  >(() => loadInitialConfigs());

  const hydrated = true;

  const getConfig = useCallback(
    (strategyId: QuantStrategyId) => configs[strategyId],
    [configs]
  );

  const setConfig = useCallback(
    (strategyId: QuantStrategyId, patch: Partial<QuantStrategyConfig>) => {
      setConfigs((prev) => {
        const merged = { ...prev[strategyId], ...patch };
        const normalized = normalizeQuantConfig(strategyId, merged, {
          expertMode: true,
        }).effectiveConfig;
        const next = { ...prev, [strategyId]: normalized };
        persist(strategyId, normalized);
        return next;
      });
    },
    []
  );

  const replaceConfig = useCallback(
    (strategyId: QuantStrategyId, config: QuantStrategyConfig) => {
      const normalized = normalizeQuantConfig(strategyId, config, {
        expertMode: true,
      }).effectiveConfig;

      setConfigs((prev) => {
        const next = { ...prev, [strategyId]: normalized };
        persist(strategyId, normalized);
        return next;
      });
    },
    []
  );

  const resetConfig = useCallback((strategyId: QuantStrategyId) => {
    const defaultConfig = getDefaultConfigForStrategy(strategyId);
    setConfigs((prev) => {
      const next = { ...prev, [strategyId]: defaultConfig };
      persist(strategyId, defaultConfig);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ hydrated, getConfig, setConfig, replaceConfig, resetConfig }),
    [hydrated, getConfig, replaceConfig, resetConfig, setConfig]
  );

  return (
    <QuantSettingsContext.Provider value={value}>
      {children}
    </QuantSettingsContext.Provider>
  );
}

export function useQuantSettings() {
  const ctx = useContext(QuantSettingsContext);
  if (!ctx) {
    throw new Error("useQuantSettings must be used within QuantSettingsProvider");
  }
  return ctx;
}
