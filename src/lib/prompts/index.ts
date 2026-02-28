import type { Language } from "@/lib/i18n/types";
import type { ModuleId } from "@/types";

import { getMacroLandscapePrompt } from "./macro-landscape";
import { getInsiderActivityPrompt } from "./insider-activity";
import { getShortSqueezePrompt } from "./short-squeeze";
import { getMnaRadarPrompt } from "./mna-radar";
import { getSentimentDivergencePrompt } from "./sentiment-divergence";
import { getCorrelationAnomaliesPrompt } from "./correlation-anomalies";
import { getDividendTrapsPrompt } from "./dividend-traps";
import { getInstitutionalFlowPrompt } from "./institutional-flow";
import { getPortfolioHedgingPrompt } from "./portfolio-hedging";
import { getWeeklyBriefingPrompt } from "./weekly-briefing";

const promptRegistry: Record<ModuleId, (lang: Language) => string> = {
  "macro-landscape": getMacroLandscapePrompt,
  "insider-activity": getInsiderActivityPrompt,
  "short-squeeze": getShortSqueezePrompt,
  "mna-radar": getMnaRadarPrompt,
  "sentiment-divergence": getSentimentDivergencePrompt,
  "correlation-anomalies": getCorrelationAnomaliesPrompt,
  "dividend-traps": getDividendTrapsPrompt,
  "institutional-flow": getInstitutionalFlowPrompt,
  "portfolio-hedging": getPortfolioHedgingPrompt,
  "weekly-briefing": getWeeklyBriefingPrompt,
};

export function getSystemPrompt(moduleId: ModuleId, lang: Language): string {
  const promptFn = promptRegistry[moduleId];
  if (!promptFn) throw new Error(`Unknown module: ${moduleId}`);
  return promptFn(lang);
}
