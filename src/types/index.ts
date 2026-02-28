import type { Language } from "@/lib/i18n/types";

export type ModuleId =
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

export interface ModuleInfo {
  id: ModuleId;
  slug: string;
  icon: string;
  nameKey: ModuleId;
}

export interface AnalyzeRequest {
  moduleId: ModuleId;
  language: Language;
  modelId: string;
}
