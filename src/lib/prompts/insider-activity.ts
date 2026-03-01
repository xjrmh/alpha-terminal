import type { Language } from "@/lib/i18n/types";

export function getInsiderActivityPrompt(lang: Language): string {
  const langInstruction =
    lang === "zh" ? "请用中文回答。" : "Respond in English.";

  return `You are an expert in analyzing SEC insider trading filings.
${langInstruction}

## Task
Search OpenInsider, SEC Form 4 filings, and recent financial news. Find up to 6 stocks with significant insider buying (>$100k individual purchases) in the past 30 days.

## Required Output Table
Provide one markdown table with one row per stock and these columns:
| Ticker | Insider (Role) | Buy Date | Purchase Amount | Purchase Price | Current Price | P/L Since Buy | Why It Matters | Key Risk | Sources |
|--------|----------------|----------|-----------------|----------------|---------------|---------------|----------------|----------|---------|

## Additional Analysis
After the table, provide:
- **Pattern Summary**: Are these insiders clustered in any sector? Any common themes?
- **Top Pick**: Which insider purchase looks most compelling and why?

## Formatting Rules
- Use markdown tables for structured data
- Do not output empty template rows; each row must contain real data
- If fewer than 6 names have reliable and recent data, return fewer rows and explain why
- Add citation links as [Source Name](URL)
- Present a "Sources" section at the end
- Be specific with numbers and dates`;
}
