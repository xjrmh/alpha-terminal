import type { QuantStrategyId } from "@/types";

export interface InstrumentInfo {
  ticker: string;
  name: string;
  sector: string;
  borrowProxy: boolean;
}

export const ETF_UNIVERSE: InstrumentInfo[] = [
  { ticker: "SPY", name: "SPDR S&P 500 ETF", sector: "Equity", borrowProxy: true },
  { ticker: "QQQ", name: "Invesco QQQ", sector: "Equity", borrowProxy: true },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", sector: "Equity", borrowProxy: true },
  { ticker: "EFA", name: "iShares MSCI EAFE ETF", sector: "Equity", borrowProxy: true },
  { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", sector: "Equity", borrowProxy: true },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF", sector: "Real Estate", borrowProxy: true },
  { ticker: "DBC", name: "Invesco DB Commodity ETF", sector: "Commodities", borrowProxy: true },
  { ticker: "GLD", name: "SPDR Gold Shares", sector: "Commodities", borrowProxy: true },
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", sector: "Rates", borrowProxy: true },
  { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", sector: "Rates", borrowProxy: true },
  { ticker: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", sector: "Cash", borrowProxy: false },
];

export const STOCK_UNIVERSE: InstrumentInfo[] = [
  { ticker: "AAPL", name: "Apple", sector: "Technology", borrowProxy: true },
  { ticker: "MSFT", name: "Microsoft", sector: "Technology", borrowProxy: true },
  { ticker: "NVDA", name: "NVIDIA", sector: "Technology", borrowProxy: true },
  { ticker: "AMZN", name: "Amazon", sector: "Consumer Discretionary", borrowProxy: true },
  { ticker: "GOOGL", name: "Alphabet", sector: "Communication Services", borrowProxy: true },
  { ticker: "META", name: "Meta Platforms", sector: "Communication Services", borrowProxy: true },
  { ticker: "TSLA", name: "Tesla", sector: "Consumer Discretionary", borrowProxy: true },
  { ticker: "JPM", name: "JPMorgan", sector: "Financials", borrowProxy: true },
  { ticker: "BAC", name: "Bank of America", sector: "Financials", borrowProxy: true },
  { ticker: "WFC", name: "Wells Fargo", sector: "Financials", borrowProxy: true },
  { ticker: "XOM", name: "Exxon Mobil", sector: "Energy", borrowProxy: true },
  { ticker: "CVX", name: "Chevron", sector: "Energy", borrowProxy: true },
  { ticker: "LLY", name: "Eli Lilly", sector: "Healthcare", borrowProxy: true },
  { ticker: "UNH", name: "UnitedHealth", sector: "Healthcare", borrowProxy: true },
  { ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", borrowProxy: true },
  { ticker: "PFE", name: "Pfizer", sector: "Healthcare", borrowProxy: true },
  { ticker: "HD", name: "Home Depot", sector: "Consumer Discretionary", borrowProxy: true },
  { ticker: "WMT", name: "Walmart", sector: "Consumer Staples", borrowProxy: true },
  { ticker: "COST", name: "Costco", sector: "Consumer Staples", borrowProxy: true },
  { ticker: "KO", name: "Coca-Cola", sector: "Consumer Staples", borrowProxy: true },
  { ticker: "PEP", name: "PepsiCo", sector: "Consumer Staples", borrowProxy: true },
  { ticker: "PG", name: "Procter & Gamble", sector: "Consumer Staples", borrowProxy: true },
  { ticker: "NKE", name: "Nike", sector: "Consumer Discretionary", borrowProxy: true },
  { ticker: "DIS", name: "Disney", sector: "Communication Services", borrowProxy: true },
  { ticker: "CSCO", name: "Cisco", sector: "Technology", borrowProxy: true },
  { ticker: "ORCL", name: "Oracle", sector: "Technology", borrowProxy: true },
  { ticker: "ADBE", name: "Adobe", sector: "Technology", borrowProxy: true },
  { ticker: "CRM", name: "Salesforce", sector: "Technology", borrowProxy: true },
  { ticker: "INTC", name: "Intel", sector: "Technology", borrowProxy: false },
  { ticker: "IBM", name: "IBM", sector: "Technology", borrowProxy: false },
];

export function getUniverseForStrategy(strategyId: QuantStrategyId): InstrumentInfo[] {
  switch (strategyId) {
    case "quant-dual-momentum":
      return ETF_UNIVERSE;
    case "quant-multifactor-stocks":
    case "quant-low-beta-quality":
      return STOCK_UNIVERSE;
    case "quant-volatility-target-overlay":
      return ETF_UNIVERSE;
    default:
      return ETF_UNIVERSE;
  }
}

export const UNIVERSE_VERSION = "v1-us-core";
