import type { Language } from "@/lib/i18n/types";
import type { NarrativeModuleId } from "@/types";

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

const promptRegistry: Record<NarrativeModuleId, (lang: Language) => string> = {
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

function getAudienceCalibration(
  lang: Language,
  expertMode: boolean
): string {
  if (lang === "zh") {
    if (expertMode) {
      return `## 受众校准（专家模式）
- 受众为有经验的投资者或从业者；保持专业表达但避免空洞术语堆砌。
- 在不改变既有结构要求的前提下，增加技术细节：指标窗口、阈值、假设条件、信号约束与失效场景。
- 每个核心结论尽量给出依据：数据点、历史对照、概率判断或情景分叉（基准/乐观/悲观）。
- 明确风险与不确定性来源，并说明结论在什么条件下会失效。
- 保留可执行建议，并给出触发条件、失效条件和观察指标。`;
    }

    return `## 受众校准（标准模式）
- 受众为普通投资者；使用清晰、简洁、易懂的语言。
- 保持“适度简化”：不牺牲关键信息，但避免过度技术化表述。
- 首次出现术语时用一句话解释其含义或市场影响。
- 强调可执行结论：说明“这意味着什么、可以怎么做、主要风险是什么”。
- 保留引用与数据日期，确保结论可核验。`;
  }

  if (expertMode) {
    return `## Audience Calibration (Expert Mode)
- Audience: advanced investors and technical users; keep professional rigor.
- Without removing any required sections, add technical depth: indicator windows, thresholds, assumptions, constraints, and failure modes.
- Support major conclusions with evidence (dated data points, historical analogs, scenario probabilities, or condition-based logic).
- Include explicit risk diagnostics and state what would invalidate the thesis.
- Keep recommendations actionable with triggers, invalidation levels, and monitoring metrics.`;
  }

  return `## Audience Calibration (Standard Mode)
- Audience: regular investors with limited finance background; use plain, concise language.
- Apply moderate simplification: preserve core insights while reducing unnecessary technical complexity.
- Explain jargon briefly the first time it appears.
- Emphasize practical takeaways: what it means, what to do, and key risks.
- Keep data references and source links so the analysis remains verifiable.`;
}

export function getSystemPrompt(
  moduleId: NarrativeModuleId,
  lang: Language,
  options?: { expertMode?: boolean }
): string {
  const promptFn = promptRegistry[moduleId];
  if (!promptFn) throw new Error(`Unknown module: ${moduleId}`);
  const basePrompt = promptFn(lang);
  const expertMode = options?.expertMode ?? false;
  const audienceCalibration = getAudienceCalibration(lang, expertMode);
  return `${basePrompt}\n\n${audienceCalibration}`;
}
