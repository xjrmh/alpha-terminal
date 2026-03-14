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

- `OPENAI_API_KEY` — required for OpenAI models such as GPT-5.2 / GPT-5 Mini / GPT-4.1
- `ANTHROPIC_API_KEY` — required for Claude Sonnet / Opus
- `GOOGLE_AI_API_KEY` — required for Gemini Flash / Pro
- `KV_REST_API_URL` — Vercel KV REST URL for shared analysis cache
- `KV_REST_API_TOKEN` — Vercel KV REST token for shared analysis cache
- `ENABLE_QUANT_MODULES` — server-side quant API switch (`true` by default)
- `NEXT_PUBLIC_ENABLE_QUANT_MODULES` — show/hide quant modules in UI
- `NEXT_PUBLIC_ENABLE_EXPERT_MODE` — show/hide Expert Mode toggle in UI

## Features

- 10 AI-powered financial analysis modules
- 1 deterministic Watchlist activity scanner (`1D` / `1W` / `1M`)
- 4 deterministic quant strategy modules with signal + backtest output
- Bilingual (English / Chinese)
- Light / Dark / Auto theme
- Expert mode with per-strategy settings persistence
- Streaming AI responses with markdown rendering
- Multi-model support (OpenAI, Anthropic, Google)
- Shared online cache for all module outputs (partitioned by model + expert mode)
- 1-hour rerun cooldown with disabled refresh countdown

## Cache Behavior

- All narrative, watchlist, and quant outputs are cached online when KV is configured.
- Cached entries are partitioned by module inputs, selected model, and expert mode.
- Manual refresh is blocked until cached output is at least 1 hour old.
- During cooldown, the refresh button is disabled and shows a countdown.
- If KV is not configured or temporarily unavailable, analysis still runs uncached.

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
11. **Watchlist** — Deterministic top-activity stocks ranked by movement, volume shift, and volatility regime (`1D` / `1W` / `1M`)
12. **Quant Dual Momentum** — Monthly ETF trend + relative momentum allocation
13. **Quant Multifactor Stocks** — Value/Quality/Momentum stock basket
14. **Quant Low Beta + Quality** — Defensive quality equity sleeve
15. **Quant Vol Target Overlay** — Weekly risk-scaling overlay

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/xjrmh/alpha-terminal)
