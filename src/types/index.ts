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

export type ModuleId = NarrativeModuleId | QuantStrategyId;

export type ModuleKind = "narrative" | "quant";

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
