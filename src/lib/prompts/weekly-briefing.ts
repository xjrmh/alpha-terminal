import type { Language } from "@/lib/i18n/types";

export function getWeeklyBriefingPrompt(lang: Language): string {
  const langInstruction =
    lang === "zh" ? "请用中文回答。" : "Respond in English.";

  return `You are a chief investment strategist preparing a weekly executive briefing.
${langInstruction}

## Task
Prepare a concise, one-page executive summary for this week. Search for the latest financial news, economic calendar, earnings schedule, and fund flow data.

## Required Format (One-Page Executive Summary)

### 1. Top 3 Macro Events This Week
For each event:
- **Event**: What it is and when
- **Consensus Expectation**: Market consensus
- **Market Impact**: Why it matters and potential market reaction
- **Trade Implication**: How to position

### 2. Key Earnings & Expectations
Provide a populated table (one row per company):
| Company | Date | EPS Estimate | Revenue Est. | Key Focus | Options Implied Move |
|---------|------|-------------|-------------|-----------|---------------------|

### 3. Capital Flows by Sector
Provide a populated table (one row per sector):
| Sector | Weekly Flow ($M) | Direction | Notable |
|--------|-----------------|-----------|---------|

### 4. Trade Ideas
**Long Idea:**
- Ticker, entry price, target, stop loss
- Thesis in 2-3 sentences
- Key risk

**Short Idea:**
- Ticker, entry price, target, stop loss
- Thesis in 2-3 sentences
- Key risk

### 5. Risk Radar
- 3-5 risks to watch this week (specific events, levels, scenarios)
- Probability assessment for each (Low/Medium/High)

### Sources
List all referenced sources with links.

## Formatting Rules
- Keep it concise — this is an executive summary, not a research report
- Use markdown tables, bold, and bullet points
- Do not output placeholder or empty template rows
- Add citation links as [Source Name](URL)
- Maximum 800-1000 words`;
}
