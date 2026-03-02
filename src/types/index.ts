import type { Language } from "@/lib/i18n/types";

export type NarrativeModuleId =
  | "macro-landscape"
  | "insider-activity"
  | "short-squeeze"
  | "mna-radar"
  | "sentiment-divergence"
  | "correlation-anomalies"
  | "dividend-traps"
  | "institutional-flow"
  | "portfolio-hedging"
  | "weekly-briefing";

export type QuantStrategyId =
  | "quant-dual-momentum"
  | "quant-multifactor-stocks"
  | "quant-low-beta-quality"
  | "quant-volatility-target-overlay";

export type WatchlistModuleId = "watchlist";

export type ModuleId = NarrativeModuleId | QuantStrategyId | WatchlistModuleId;

export type ModuleKind = "narrative" | "quant" | "watchlist";

export type AnalysisRunMode =
  | "auto"
  | "refresh"
  | "refresh_if_eligible"
  | "cache_only";

export type AnalysisCacheSource = "fresh" | "cache" | "missing";

export interface AnalysisCacheMeta {
  source: AnalysisCacheSource;
  updatedAt: string | null;
  refreshEligibleAt: string | null;
  canRefresh: boolean;
  secondsUntilRefresh: number;
  cacheEnabled: boolean;
}

export interface CacheRefreshLockedErrorPayload {
  code: "CACHE_REFRESH_LOCKED";
  error: string;
  cache: AnalysisCacheMeta;
}

export interface ModuleInfo {
  id: ModuleId;
  slug: string;
  icon: string;
  nameKey: ModuleId;
  kind: ModuleKind;
}

export interface AnalyzeRequest {
  moduleId: NarrativeModuleId;
  language: Language;
  modelId: string;
  providerApiKey?: string;
  expertMode?: boolean;
  mode?: AnalysisRunMode;
}

export interface AnalyzeResponse {
  completion: string;
  cache: AnalysisCacheMeta;
}

export type WatchlistTimeRange = "1D" | "1W" | "1M";

export interface WatchlistScanRequest {
  timeRange: WatchlistTimeRange;
  asOfDate?: string;
  limit?: number;
  modelId?: string;
  expertMode?: boolean;
  mode?: AnalysisRunMode;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  sector: string;
  close: number;
  returnPct: number;
  volumeShift: number;
  volShift: number;
  activityScore: number;
  direction: "UP" | "DOWN";
  signals: string[];
}

export interface WatchlistScanResponse {
  asOfDate: string;
  timeRange: WatchlistTimeRange;
  requestedLimit: number;
  effectiveLimit: number;
  universeVersion: string;
  items: WatchlistItem[];
  diagnostics: {
    universeSize: number;
    eligibleCount: number;
    excludedCount: number;
    reasons: Record<string, number>;
    factorWeights: {
      movement: number;
      volumeShift: number;
      volShift: number;
    };
  };
  sources: string[];
}

export interface WatchlistRunResponse {
  result: WatchlistScanResponse | null;
  cache: AnalysisCacheMeta;
}

export type LookbackMode = "fixed_years" | "since_inception";

export type PositionMode = "long_only" | "long_short";

export type RiskTolerancePreset = "conservative" | "balanced" | "aggressive";

export interface QuantStrategyConfig {
  lookbackMode: LookbackMode;
  lookbackYears: number;
  positionMode: PositionMode;
  riskTolerance: RiskTolerancePreset;
  targetVol: number;
  grossExposureCap: number;
  netExposureMin: number;
  netExposureMax: number;
}

export interface ConfigAdjustment {
  field: keyof QuantStrategyConfig | "coverageStartDate" | "positionMode";
  requested: number | string;
  applied: number | string;
  reason: string;
}

export interface PortfolioAction {
  ticker: string;
  action: "ADD" | "HOLD" | "TRIM" | "EXIT";
  targetWeight: number;
}

export interface RiskSnapshot {
  expVol: number;
  expBetaToSPY: number;
  concentrationTop5: number;
}

export interface QuantSignalRequest {
  strategyId: QuantStrategyId;
  language: Language;
  asOfDate?: string;
  expertMode?: boolean;
  config?: Partial<QuantStrategyConfig>;
  overlayBaseStrategyId?: Exclude<
    QuantStrategyId,
    "quant-volatility-target-overlay"
  >;
  modelId?: string;
  mode?: AnalysisRunMode;
}

export interface QuantSignalResponse {
  asOfDate: string;
  strategyId: QuantStrategyId;
  universeVersion: string;
  requestedConfig: QuantStrategyConfig;
  effectiveConfig: QuantStrategyConfig;
  adjustments: ConfigAdjustment[];
  actions: PortfolioAction[];
  risk: RiskSnapshot;
  notes: string[];
  sources: string[];
}

export interface BacktestMetrics {
  cagr: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  calmar: number;
  turnover: number;
}

export interface QuantBacktestRequest {
  strategyId: QuantStrategyId;
  startDate?: string;
  endDate?: string;
  costBps?: number;
  expertMode?: boolean;
  config?: Partial<QuantStrategyConfig>;
  overlayBaseStrategyId?: Exclude<
    QuantStrategyId,
    "quant-volatility-target-overlay"
  >;
  modelId?: string;
  mode?: AnalysisRunMode;
}

export interface QuantBacktestResponse {
  strategyId: QuantStrategyId;
  startDate: string;
  endDate: string;
  requestedConfig: QuantStrategyConfig;
  effectiveConfig: QuantStrategyConfig;
  adjustments: ConfigAdjustment[];
  metrics: BacktestMetrics;
  benchmark: {
    ticker: "SPY";
    metrics: BacktestMetrics;
  };
  yearlyReturns: Array<{ year: number; ret: number }>;
  drawdownSeries: Array<{ date: string; dd: number }>;
  assumptions: {
    longCostBps: number;
    shortCostBps: number;
    shortBorrowAnnual: number;
    requestedCostBps: number;
  };
  sources: string[];
}

export interface QuantRunRequest {
  strategyId: QuantStrategyId;
  language: Language;
  modelId: string;
  mode?: AnalysisRunMode;
  asOfDate?: string;
  startDate?: string;
  endDate?: string;
  costBps?: number;
  expertMode?: boolean;
  config?: Partial<QuantStrategyConfig>;
  overlayBaseStrategyId?: Exclude<
    QuantStrategyId,
    "quant-volatility-target-overlay"
  >;
}

export interface QuantRunResponse {
  signal: QuantSignalResponse | null;
  backtest: QuantBacktestResponse | null;
  cache: AnalysisCacheMeta;
}
