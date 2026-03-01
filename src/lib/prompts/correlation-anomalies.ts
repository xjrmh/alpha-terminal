import type { Language } from "@/lib/i18n/types";

export function getCorrelationAnomaliesPrompt(lang: Language): string {
  const langInstruction =
    lang === "zh" ? "请用中文回答。" : "Respond in English.";

  return `You are a quantitative strategist specializing in cross-asset correlation analysis.
${langInstruction}

## Task
In the current macro environment, find assets with anomalous correlations (e.g., gold and stocks rising together, bonds and stocks falling together, USD and commodities moving in the same direction).

## Required Sections

### 1. Current Anomalies Detected
For each anomaly found:
- **Assets involved** and their recent correlation
- **Normal correlation** vs. current correlation
- **Duration** of the anomaly
- **Possible explanation** for the breakdown

### 2. Historical Signal Analysis
For each anomaly:
- What did this anomaly historically signal?
- How did it resolve in past instances? (with dates and outcomes)
- Average time to normalization

### 3. Trade Recommendations
Provide 3 specific trades that benefit from correlation normalization:
| Trade | Instruments | Entry | Target | Stop Loss | Timeframe |
|-------|-------------|-------|--------|-----------|-----------|

### 4. Sources
List all data sources with links.

## Formatting Rules
- Use markdown headers and tables
- Do not output empty template rows; each row must contain real trade details
- Include specific correlation coefficients and timeframes
- Add citation links as [Source Name](URL)`;
}
