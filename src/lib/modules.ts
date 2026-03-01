import { isQuantModulesEnabled } from "@/lib/features";
import type { ModuleInfo, QuantStrategyId, WatchlistModuleId } from "@/types";

export const NARRATIVE_MODULES: ModuleInfo[] = [
  {
    id: "macro-landscape",
    slug: "macro-landscape",
    icon: "◈",
    nameKey: "macro-landscape",
    kind: "narrative",
  },
  {
    id: "insider-activity",
    slug: "insider-activity",
    icon: "◉",
    nameKey: "insider-activity",
    kind: "narrative",
  },
  {
    id: "short-squeeze",
    slug: "short-squeeze",
    icon: "▲",
    nameKey: "short-squeeze",
    kind: "narrative",
  },
  {
    id: "mna-radar",
    slug: "mna-radar",
    icon: "◎",
    nameKey: "mna-radar",
    kind: "narrative",
  },
  {
    id: "sentiment-divergence",
    slug: "sentiment-divergence",
    icon: "⇄",
    nameKey: "sentiment-divergence",
    kind: "narrative",
  },
  {
    id: "correlation-anomalies",
    slug: "correlation-anomalies",
    icon: "∿",
    nameKey: "correlation-anomalies",
    kind: "narrative",
  },
  {
    id: "dividend-traps",
    slug: "dividend-traps",
    icon: "◇",
    nameKey: "dividend-traps",
    kind: "narrative",
  },
  {
    id: "institutional-flow",
    slug: "institutional-flow",
    icon: "◫",
    nameKey: "institutional-flow",
    kind: "narrative",
  },
  {
    id: "portfolio-hedging",
    slug: "portfolio-hedging",
    icon: "△",
    nameKey: "portfolio-hedging",
    kind: "narrative",
  },
  {
    id: "weekly-briefing",
    slug: "weekly-briefing",
    icon: "▣",
    nameKey: "weekly-briefing",
    kind: "narrative",
  },
  {
    id: "watchlist",
    slug: "watchlist",
    icon: "◍",
    nameKey: "watchlist",
    kind: "watchlist",
  },
];

export const QUANT_MODULES: ModuleInfo[] = [
  {
    id: "quant-dual-momentum",
    slug: "quant-dual-momentum",
    icon: "≋",
    nameKey: "quant-dual-momentum",
    kind: "quant",
  },
  {
    id: "quant-multifactor-stocks",
    slug: "quant-multifactor-stocks",
    icon: "▦",
    nameKey: "quant-multifactor-stocks",
    kind: "quant",
  },
  {
    id: "quant-low-beta-quality",
    slug: "quant-low-beta-quality",
    icon: "▱",
    nameKey: "quant-low-beta-quality",
    kind: "quant",
  },
  {
    id: "quant-volatility-target-overlay",
    slug: "quant-volatility-target-overlay",
    icon: "◬",
    nameKey: "quant-volatility-target-overlay",
    kind: "quant",
  },
];

export const MODULES: ModuleInfo[] = isQuantModulesEnabled()
  ? [...NARRATIVE_MODULES, ...QUANT_MODULES]
  : NARRATIVE_MODULES;

const quantSet = new Set<QuantStrategyId>(
  QUANT_MODULES.map((mod) => mod.id as QuantStrategyId)
);

export function isQuantStrategyId(id: string): id is QuantStrategyId {
  return quantSet.has(id as QuantStrategyId);
}

export function isWatchlistModuleId(id: string): id is WatchlistModuleId {
  return id === "watchlist";
}
