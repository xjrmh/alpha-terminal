# Alpha Terminal

AI-Powered Financial Intelligence Terminal

## Setup

```bash
npm install
cp .env.example .env.local
# Add your API keys to .env.local
npm run dev
```

## Environment Variables

- `OPENAI_API_KEY` — required for GPT-4o / GPT-4o Mini
- `ANTHROPIC_API_KEY` — required for Claude Sonnet / Opus
- `GOOGLE_AI_API_KEY` — required for Gemini Flash / Pro

## Features

- 10 AI-powered financial analysis modules
- Bilingual (English / Chinese)
- Light / Dark / Auto theme
- Streaming AI responses with markdown rendering
- Multi-model support (OpenAI, Anthropic, Google)

## Modules

1. **Macro Landscape** — Current macro background, historical parallels
2. **Insider Activity** — Significant insider buying from SEC filings
3. **Short Squeeze Scanner** — High short interest + catalysts
4. **M&A Radar** — Acquisition rumors and targets
5. **Sentiment Divergence** — Negative sentiment vs strong fundamentals
6. **Correlation Anomalies** — Unusual asset correlations
7. **Dividend Traps** — High yield with warning signs
8. **Institutional Flow** — 13F hedge fund tracking
9. **Portfolio Hedging** — Hedge recommendations with options/ETFs
10. **Weekly Briefing** — Executive summary of the week

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/xjrmh/alpha-terminal)
