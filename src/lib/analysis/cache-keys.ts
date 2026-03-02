import { normalizeQuantConfig } from "@/lib/quant/config";
import type { Language } from "@/lib/i18n/types";
import type {
  NarrativeModuleId,
  QuantStrategyConfig,
  QuantStrategyId,
  WatchlistTimeRange,
} from "@/types";

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function hashFnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function modePart(expertMode: boolean): string {
  return expertMode ? "expert" : "standard";
}

export interface NarrativeCacheKeyInput {
  moduleId: NarrativeModuleId;
  language: Language;
  modelId: string;
  expertMode: boolean;
}

export function buildNarrativeCacheKey(input: NarrativeCacheKeyInput): string {
  return [
    "analysis",
    "narrative",
    input.moduleId,
    input.language,
    input.modelId,
    modePart(input.expertMode),
  ].join(":");
}

export interface QuantCacheKeyInput {
  strategyId: QuantStrategyId;
  language: Language;
  modelId: string;
  expertMode: boolean;
  config?: Partial<QuantStrategyConfig>;
  overlayBaseStrategyId?: Exclude<
    QuantStrategyId,
    "quant-volatility-target-overlay"
  >;
}

export function buildQuantCacheKey(input: QuantCacheKeyInput): string {
  const effectiveConfig = normalizeQuantConfig(input.strategyId, input.config, {
    expertMode: input.expertMode,
  }).effectiveConfig;
  const fingerprint = hashFnv1a(
    stableSerialize({
      strategyId: input.strategyId,
      effectiveConfig,
      overlayBaseStrategyId: input.overlayBaseStrategyId ?? null,
    })
  );

  return [
    "analysis",
    "quant",
    input.strategyId,
    input.language,
    input.modelId,
    modePart(input.expertMode),
    fingerprint,
  ].join(":");
}

export interface WatchlistCacheKeyInput {
  timeRange: WatchlistTimeRange;
  asOfDate?: string;
  limit?: number;
  modelId: string;
  expertMode: boolean;
}

export function buildWatchlistCacheKey(input: WatchlistCacheKeyInput): string {
  return [
    "analysis",
    "watchlist",
    input.timeRange,
    input.asOfDate ?? "latest",
    typeof input.limit === "number" ? String(Math.trunc(input.limit)) : "default",
    input.modelId,
    modePart(input.expertMode),
  ].join(":");
}
