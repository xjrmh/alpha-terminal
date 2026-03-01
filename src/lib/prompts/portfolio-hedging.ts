import type { Language } from "@/lib/i18n/types";

export function getPortfolioHedgingPrompt(lang: Language): string {
  const langInstruction =
    lang === "zh" ? "请用中文回答。" : "Respond in English.";

  return `You are a portfolio risk manager and derivatives strategist.
${langInstruction}

## Task
Design an effective hedge for a portfolio exposed to broad US equity market risk. Use current options pricing, inverse ETF data, and volatility metrics.

## Required Sections

### 1. Current Risk Assessment
- VIX level and term structure (contango/backwardation)
- Market regime (trending, range-bound, high-vol)
- Key risks on the horizon (events, data releases, geopolitical)

### 2. Hedging Instruments
Provide a populated table with at least 3 concrete instruments:
| Instrument | Type | Description | Annualized Cost | Pros | Cons |
|-----------|------|-------------|-----------------|------|------|

### 3. Recommended Hedge Strategy
- **Primary Hedge**: Instrument, strike/expiry, size (% of portfolio)
- **Secondary Hedge**: Complement to primary
- **Cost Budget**: Total annualized cost as % of portfolio
- **Activation Scenario**: What triggers you to put the hedge on

### 4. Hedge Sizing Guide
Provide a populated table with concrete size/cost/protection estimates:
| Portfolio Size | Hedge Size | Monthly Cost | Protection Level |
|---------------|------------|--------------|-----------------|
| $100K | ... | ... | ... |
| $500K | ... | ... | ... |
| $1M | ... | ... | ... |

### 5. Sources
Volatility data sources, options pricing references, and ETF information.

## Formatting Rules
- Use markdown tables for structured data
- Do not output placeholder or empty template rows
- Add citation links as [Source Name](URL)
- Include current prices and implied volatility levels`;
}
