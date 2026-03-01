import type {
  BacktestMetrics,
  ConfigAdjustment,
  PortfolioAction,
  QuantBacktestRequest,
  QuantBacktestResponse,
  QuantSignalRequest,
  QuantSignalResponse,
  QuantStrategyConfig,
  QuantStrategyId,
} from "@/types";

import {
  normalizeQuantConfig,
  NET_EXPOSURE_MAX,
  NET_EXPOSURE_MIN,
} from "./config";
import { getTodayIsoDate, loadPriceMatrix } from "./data";
import {
  formatIsoDate,
  indexOnOrAfter,
  indexOnOrBefore,
  monthlyRebalanceIndices,
  weeklyRebalanceIndices,
  yearOf,
  yearsBefore,
} from "./dates";
import {
  annualizedVol,
  clamp,
  covariance,
  mean,
  simpleMovingAverage,
  stddev,
  trailingReturn,
  zscores,
} from "./math";
import {
  ETF_UNIVERSE,
  STOCK_UNIVERSE,
  UNIVERSE_VERSION,
  getUniverseForStrategy,
} from "./universe";

const LONG_COST_BPS_DEFAULT = 10;
const SHORT_COST_BPS_DEFAULT = 25;
const SHORT_BORROW_ANNUAL = 0.04;
const COVERAGE_THRESHOLD = 0.7;

type Weight = { ticker: string; weight: number };

interface StrategyOutput {
  weights: Weight[];
  notes: string[];
  adjustments: ConfigAdjustment[];
}

interface MatrixContext {
  dates: string[];
  prices: Record<string, number[]>;
  firstValidIndex: Record<string, number>;
  sources: string[];
}

function sortByAbsWeightDesc(weights: Weight[]): Weight[] {
  return [...weights].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

function roundWeight(weight: number): number {
  return Number(weight.toFixed(4));
}

function sanitizeWeights(weights: Weight[]): Weight[] {
  const map = new Map<string, number>();
  for (const item of weights) {
    if (!Number.isFinite(item.weight)) continue;
    const next = (map.get(item.ticker) ?? 0) + item.weight;
    map.set(item.ticker, next);
  }

  const deduped = Array.from(map.entries())
    .map(([ticker, weight]) => ({ ticker, weight: roundWeight(weight) }))
    .filter((item) => Math.abs(item.weight) > 0.0001);

  return sortByAbsWeightDesc(deduped);
}

function sumPositive(weights: Weight[]): number {
  return weights.reduce((acc, item) => acc + (item.weight > 0 ? item.weight : 0), 0);
}

function sumNegativeAbs(weights: Weight[]): number {
  return weights.reduce((acc, item) => acc + (item.weight < 0 ? Math.abs(item.weight) : 0), 0);
}

function weightMap(weights: Weight[]): Map<string, number> {
  return new Map(weights.map((item) => [item.ticker, item.weight]));
}

function buildActions(current: Weight[], previous: Weight[]): PortfolioAction[] {
  const curr = weightMap(current);
  const prev = weightMap(previous);
  const allTickers = new Set<string>([...curr.keys(), ...prev.keys()]);
  const actions: PortfolioAction[] = [];

  for (const ticker of allTickers) {
    const c = curr.get(ticker) ?? 0;
    const p = prev.get(ticker) ?? 0;

    if (Math.abs(c) < 0.0001 && Math.abs(p) < 0.0001) continue;

    let action: PortfolioAction["action"] = "HOLD";

    if (Math.abs(c) < 0.0001 && Math.abs(p) >= 0.0001) {
      action = "EXIT";
    } else if (Math.abs(p) < 0.0001 && Math.abs(c) >= 0.0001) {
      action = "ADD";
    } else {
      const delta = c - p;
      if (Math.abs(delta) < 0.002) {
        action = "HOLD";
      } else {
        action = Math.abs(c) > Math.abs(p) ? "ADD" : "TRIM";
      }
    }

    actions.push({ ticker, action, targetWeight: roundWeight(c) });
  }

  return actions.sort(
    (a, b) => Math.abs(b.targetWeight) - Math.abs(a.targetWeight)
  );
}

function symbolHash(symbol: string, salt: number): number {
  let hash = salt;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 33 + symbol.charCodeAt(i) + 17) >>> 0;
  }
  return hash;
}

function staticValueScore(symbol: string): number {
  const h = symbolHash(symbol, 19);
  return ((h % 1000) / 1000 - 0.5) * 2;
}

function staticQualityScore(symbol: string): number {
  const h = symbolHash(symbol, 43);
  return ((h % 1000) / 1000 - 0.5) * 2;
}

function trailingDailyReturns(
  series: number[],
  index: number,
  window: number
): number[] {
  const start = Math.max(1, index - window + 1);
  const returns: number[] = [];
  for (let i = start; i <= index; i += 1) {
    const prev = series[i - 1];
    const curr = series[i];
    if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) continue;
    returns.push(curr / prev - 1);
  }
  return returns;
}

function getReturnAtIndex(series: number[], index: number): number {
  if (index <= 0) return 0;
  const prev = series[index - 1];
  const curr = series[index];
  if (!Number.isFinite(prev) || !Number.isFinite(curr) || prev <= 0) return 0;
  return curr / prev - 1;
}

function resolveCoverageStartIndex(
  symbols: string[],
  firstValidIndex: Record<string, number>
): number {
  const sorted = symbols
    .map((symbol) => firstValidIndex[symbol] ?? Number.POSITIVE_INFINITY)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (sorted.length === 0) return 0;
  const required = Math.max(0, Math.ceil(sorted.length * COVERAGE_THRESHOLD) - 1);
  return sorted[required] ?? 0;
}

function resolveSignalAsOfIndex(dates: string[], asOfDate?: string): number {
  const target = asOfDate ?? getTodayIsoDate();
  const idx = indexOnOrBefore(dates, target);
  if (idx >= 0) return idx;
  return dates.length - 1;
}

function resolveStartEndIndices(
  dates: string[],
  config: QuantStrategyConfig,
  firstValidIndex: Record<string, number>,
  symbols: string[],
  endDate?: string,
  requestedStartDate?: string,
  adjustments?: ConfigAdjustment[]
): { startIdx: number; endIdx: number } {
  const endIdx = Math.max(
    0,
    resolveSignalAsOfIndex(dates, endDate)
  );

  const coverageStart = resolveCoverageStartIndex(symbols, firstValidIndex);
  let startIdx = 0;

  if (requestedStartDate) {
    const reqIdx = indexOnOrAfter(dates, requestedStartDate);
    startIdx = reqIdx >= 0 ? reqIdx : 0;
  } else if (config.lookbackMode === "fixed_years") {
    const targetStart = yearsBefore(dates[endIdx], config.lookbackYears);
    const reqIdx = indexOnOrAfter(dates, targetStart);
    startIdx = reqIdx >= 0 ? reqIdx : 0;
  } else {
    startIdx = 0;
  }

  if (startIdx < coverageStart) {
    adjustments?.push({
      field: "coverageStartDate",
      requested: dates[startIdx] ?? "N/A",
      applied: dates[coverageStart] ?? "N/A",
      reason:
        "Coverage threshold (>=70% universe with required history) moved the start date forward.",
    });
    startIdx = coverageStart;
  }

  if (endIdx - startIdx < 260) {
    const minStart = Math.max(0, endIdx - 260);
    if (minStart !== startIdx) {
      adjustments?.push({
        field: "coverageStartDate",
        requested: dates[startIdx] ?? "N/A",
        applied: dates[minStart] ?? "N/A",
        reason: "At least 260 trading days are required for stable signal computation.",
      });
      startIdx = minStart;
    }
  }

  return {
    startIdx: Math.min(startIdx, endIdx),
    endIdx,
  };
}

function selectWithSectorCap(
  rankedTickers: string[],
  targetCount: number,
  sectorByTicker: Record<string, string>,
  maxSectorFraction = 0.3
): string[] {
  const maxPerSector = Math.max(1, Math.floor(targetCount * maxSectorFraction));
  const selected: string[] = [];
  const sectorCounts: Record<string, number> = {};

  for (const ticker of rankedTickers) {
    if (selected.length >= targetCount) break;
    const sector = sectorByTicker[ticker] ?? "Other";
    const nextCount = (sectorCounts[sector] ?? 0) + 1;
    if (nextCount > maxPerSector) continue;
    selected.push(ticker);
    sectorCounts[sector] = nextCount;
  }

  return selected;
}

function buildLongShortWeights(
  rankedLong: string[],
  rankedShort: string[],
  config: QuantStrategyConfig,
  borrowProxy: Record<string, boolean>,
  options?: {
    longTargetCount?: number;
    shortTargetCount?: number;
    maxPerName?: number;
    cashTicker?: string;
  }
): StrategyOutput {
  const longTargetCount = options?.longTargetCount ?? 30;
  const shortTargetCount = options?.shortTargetCount ?? 10;
  const maxPerName = options?.maxPerName ?? 0.06;
  const cashTicker = options?.cashTicker ?? "CASH";
  const adjustments: ConfigAdjustment[] = [];

  const gross = clamp(config.grossExposureCap, 0, 1.3);
  const targetNet = clamp(
    (config.netExposureMin + config.netExposureMax) / 2,
    NET_EXPOSURE_MIN,
    NET_EXPOSURE_MAX
  );

  let longGross = gross;
  let shortGross = 0;

  if (config.positionMode === "long_short") {
    longGross = clamp((gross + targetNet) / 2, 0, gross);
    shortGross = clamp(gross - longGross, 0, gross);
  }

  const selectedLong = rankedLong.slice(0, longTargetCount);
  const selectedShort =
    config.positionMode === "long_short"
      ? rankedShort
          .filter((ticker) => borrowProxy[ticker])
          .slice(0, shortTargetCount)
      : [];

  if (config.positionMode === "long_short") {
    const requestedShort = rankedShort.slice(0, shortTargetCount);
    if (selectedShort.length < requestedShort.length) {
      adjustments.push({
        field: "positionMode",
        requested: "long_short",
        applied: "long_short",
        reason:
          "Short sleeve was partially reduced because borrow proxy is unavailable for some names.",
      });
    }

    if (selectedShort.length === 0 && shortGross > 0) {
      adjustments.push({
        field: "positionMode",
        requested: "long_short",
        applied: "long_only",
        reason: "Short sleeve disabled because no borrow-eligible names were available.",
      });
      shortGross = 0;
      longGross = Math.min(1, longGross);
    }
  }

  const weights: Weight[] = [];

  if (selectedLong.length > 0 && longGross > 0) {
    const equalLong = longGross / selectedLong.length;
    for (const ticker of selectedLong) {
      weights.push({ ticker, weight: Math.min(equalLong, maxPerName) });
    }
  }

  if (selectedShort.length > 0 && shortGross > 0) {
    const equalShort = shortGross / selectedShort.length;
    for (const ticker of selectedShort) {
      weights.push({ ticker, weight: -Math.min(equalShort, maxPerName) });
    }
  }

  const allocatedLong = sumPositive(weights);
  const allocatedShort = sumNegativeAbs(weights);
  const residualCash = Math.max(0, 1 - (allocatedLong - allocatedShort));
  if (residualCash > 0.0001) {
    weights.push({ ticker: cashTicker, weight: residualCash });
  }

  return {
    weights: sanitizeWeights(weights),
    notes: [],
    adjustments,
  };
}

function computeDualMomentum(
  ctx: MatrixContext,
  index: number,
  config: QuantStrategyConfig
): StrategyOutput {
  const riskAssets = ["SPY", "QQQ", "IWM", "EFA", "EEM", "VNQ", "DBC", "GLD", "TLT"];
  const cashTicker = "SHY";

  const ranked: Array<{ ticker: string; score: number; vol: number }> = [];

  for (const ticker of riskAssets) {
    const series = ctx.prices[ticker];
    if (!series) continue;
    const mom = trailingReturn(series, index, 252, 21);
    const sma200 = simpleMovingAverage(series, index, 200);
    const price = series[index];
    const vol = annualizedVol(trailingDailyReturns(series, index, 63));
    if (!Number.isFinite(mom) || !Number.isFinite(sma200) || !Number.isFinite(price) || !Number.isFinite(vol) || vol <= 0) {
      continue;
    }

    if (mom > 0 && price > sma200) {
      ranked.push({ ticker, score: mom, vol });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  const selected = ranked.slice(0, 3);

  if (selected.length === 0) {
    return {
      weights: [{ ticker: cashTicker, weight: 1 }],
      notes: ["No ETF passed absolute momentum filters; moved to SHY defensive sleeve."],
      adjustments: [],
    };
  }

  const invVolSum = selected.reduce((acc, item) => acc + 1 / item.vol, 0);
  const gross = clamp(config.grossExposureCap, 0, 1);
  const weights: Weight[] = selected.map((item) => ({
    ticker: item.ticker,
    weight: (gross * (1 / item.vol)) / invVolSum,
  }));

  const allocated = sumPositive(weights);
  const cashWeight = Math.max(0, 1 - allocated);
  if (cashWeight > 0.0001) {
    weights.push({ ticker: cashTicker, weight: cashWeight });
  }

  return {
    weights: sanitizeWeights(weights),
    notes: [
      "Ranked ETFs by 12-1 momentum with SMA200 trend filter and inverse-vol sizing.",
    ],
    adjustments: [],
  };
}

function rankMultifactorStocks(
  ctx: MatrixContext,
  index: number
): Array<{ ticker: string; composite: number }> {
  const rows = STOCK_UNIVERSE.map((item) => {
    const series = ctx.prices[item.ticker];
    const momentum = series ? trailingReturn(series, index, 252, 21) : Number.NaN;
    return {
      ticker: item.ticker,
      value: staticValueScore(item.ticker),
      quality: staticQualityScore(item.ticker),
      momentum,
    };
  }).filter((row) => Number.isFinite(row.momentum));

  const valueZ = zscores(rows.map((row) => row.value));
  const qualityZ = zscores(rows.map((row) => row.quality));
  const momentumZ = zscores(rows.map((row) => row.momentum));

  const ranked = rows.map((row, idx) => ({
    ticker: row.ticker,
    composite: 0.35 * valueZ[idx] + 0.35 * qualityZ[idx] + 0.3 * momentumZ[idx],
  }));

  ranked.sort((a, b) => b.composite - a.composite);
  return ranked;
}

function computeMultifactorStocks(
  ctx: MatrixContext,
  index: number,
  config: QuantStrategyConfig
): StrategyOutput {
  const ranked = rankMultifactorStocks(ctx, index);

  const sectorByTicker: Record<string, string> = Object.fromEntries(
    STOCK_UNIVERSE.map((item) => [item.ticker, item.sector])
  );
  const borrowProxy: Record<string, boolean> = Object.fromEntries(
    STOCK_UNIVERSE.map((item) => [item.ticker, item.borrowProxy])
  );

  const rankedTickers = ranked.map((row) => row.ticker);
  const longCandidates = selectWithSectorCap(rankedTickers, 30, sectorByTicker, 0.3);
  const shortCandidates = [...rankedTickers].reverse();

  const output = buildLongShortWeights(
    longCandidates,
    shortCandidates,
    config,
    borrowProxy,
    {
      longTargetCount: 30,
      shortTargetCount: 10,
      maxPerName: 0.06,
      cashTicker: "CASH",
    }
  );

  output.notes.push("Composite score = 35% Value + 35% Quality + 30% Momentum.");
  return output;
}

function estimateBetaToSpy(
  ctx: MatrixContext,
  ticker: string,
  index: number,
  window = 252
): number {
  const assetSeries = ctx.prices[ticker];
  const spySeries = ctx.prices.SPY;
  if (!assetSeries || !spySeries) return Number.NaN;

  const start = Math.max(1, index - window + 1);
  const assetRet: number[] = [];
  const spyRet: number[] = [];
  for (let i = start; i <= index; i += 1) {
    assetRet.push(getReturnAtIndex(assetSeries, i));
    spyRet.push(getReturnAtIndex(spySeries, i));
  }

  const varSpy = stddev(spyRet) ** 2;
  if (!Number.isFinite(varSpy) || varSpy <= 0) return Number.NaN;
  return covariance(assetRet, spyRet) / varSpy;
}

function computeLowBetaQuality(
  ctx: MatrixContext,
  index: number,
  config: QuantStrategyConfig
): StrategyOutput {
  const universe = STOCK_UNIVERSE.map((item) => item.ticker);
  const sectorByTicker: Record<string, string> = Object.fromEntries(
    STOCK_UNIVERSE.map((item) => [item.ticker, item.sector])
  );
  const borrowProxy: Record<string, boolean> = Object.fromEntries(
    STOCK_UNIVERSE.map((item) => [item.ticker, item.borrowProxy])
  );

  const rows = universe
    .map((ticker) => {
      const series = ctx.prices[ticker];
      const momentum = series ? trailingReturn(series, index, 126, 21) : Number.NaN;
      const beta = estimateBetaToSpy(ctx, ticker, index, 252);
      const quality = staticQualityScore(ticker);
      return { ticker, momentum, beta, quality };
    })
    .filter(
      (row) =>
        Number.isFinite(row.momentum) &&
        Number.isFinite(row.beta) &&
        Number.isFinite(row.quality)
    );

  const sortedByBeta = [...rows].sort((a, b) => a.beta - b.beta);
  const sortedByQuality = [...rows].sort((a, b) => b.quality - a.quality);

  const lowBetaSet = new Set(
    sortedByBeta
      .slice(0, Math.max(1, Math.floor(rows.length * 0.3)))
      .map((row) => row.ticker)
  );
  const highQualitySet = new Set(
    sortedByQuality
      .slice(0, Math.max(1, Math.floor(rows.length * 0.5)))
      .map((row) => row.ticker)
  );

  const eligible = rows
    .filter((row) => lowBetaSet.has(row.ticker) && highQualitySet.has(row.ticker))
    .sort((a, b) => b.momentum - a.momentum)
    .map((row) => row.ticker);

  const longCandidates = selectWithSectorCap(eligible, 25, sectorByTicker, 0.3);
  const shortCandidates = [...rows]
    .sort((a, b) => a.momentum - b.momentum)
    .map((row) => row.ticker);

  const output = buildLongShortWeights(
    longCandidates,
    shortCandidates,
    config,
    borrowProxy,
    {
      longTargetCount: 25,
      shortTargetCount: 10,
      maxPerName: 0.06,
      cashTicker: "CASH",
    }
  );

  output.notes.push("Selected low-beta and high-quality intersection, then ranked by 6-1 momentum.");
  return output;
}

function computePortfolioDailyReturns(
  ctx: MatrixContext,
  index: number,
  window: number,
  weights: Weight[]
): number[] {
  const start = Math.max(1, index - window + 1);
  const out: number[] = [];

  for (let i = start; i <= index; i += 1) {
    let ret = 0;
    for (const item of weights) {
      if (item.ticker === "CASH") continue;
      const series = ctx.prices[item.ticker];
      if (!series) continue;
      ret += item.weight * getReturnAtIndex(series, i);
    }
    out.push(ret);
  }

  return out;
}

function computeVolatilityTargetOverlay(
  ctx: MatrixContext,
  index: number,
  config: QuantStrategyConfig,
  baseStrategyId: Exclude<QuantStrategyId, "quant-volatility-target-overlay">
): StrategyOutput {
  const baseConfig: QuantStrategyConfig = {
    ...config,
    positionMode: "long_only",
    grossExposureCap: 1,
    netExposureMin: 0,
    netExposureMax: 1,
  };

  const baseOutput = computeStrategyAtIndex(baseStrategyId, ctx, index, baseConfig, baseStrategyId);
  const baseWeights = baseOutput.weights.filter((item) => item.ticker !== "CASH");

  const baseReturns = computePortfolioDailyReturns(ctx, index, 20, baseWeights);
  const realizedVol = Math.max(0.0001, annualizedVol(baseReturns));
  const scalar = clamp(config.targetVol / realizedVol, 0.3, 1);

  const scaledWeights = baseWeights.map((item) => ({
    ticker: item.ticker,
    weight: item.weight * scalar,
  }));

  const invested = scaledWeights.reduce((acc, item) => acc + item.weight, 0);
  const cashWeight = Math.max(0, 1 - invested);

  if (cashWeight > 0.0001) {
    scaledWeights.push({ ticker: "SHY", weight: cashWeight });
  }

  return {
    weights: sanitizeWeights(scaledWeights),
    notes: [
      `Volatility target overlay scalar ${scalar.toFixed(2)} applied to ${baseStrategyId}.`,
      ...baseOutput.notes,
    ],
    adjustments: baseOutput.adjustments,
  };
}

function computeStrategyAtIndex(
  strategyId: QuantStrategyId,
  ctx: MatrixContext,
  index: number,
  config: QuantStrategyConfig,
  overlayBaseStrategyId: Exclude<QuantStrategyId, "quant-volatility-target-overlay"> =
    "quant-dual-momentum"
): StrategyOutput {
  switch (strategyId) {
    case "quant-dual-momentum":
      return computeDualMomentum(ctx, index, config);
    case "quant-multifactor-stocks":
      return computeMultifactorStocks(ctx, index, config);
    case "quant-low-beta-quality":
      return computeLowBetaQuality(ctx, index, config);
    case "quant-volatility-target-overlay":
      return computeVolatilityTargetOverlay(
        ctx,
        index,
        config,
        overlayBaseStrategyId
      );
    default:
      return computeDualMomentum(ctx, index, config);
  }
}

function collectSymbols(
  strategyId: QuantStrategyId,
  overlayBaseStrategyId?: Exclude<QuantStrategyId, "quant-volatility-target-overlay">
): string[] {
  if (strategyId === "quant-dual-momentum") {
    return ETF_UNIVERSE.map((item) => item.ticker);
  }
  if (strategyId === "quant-multifactor-stocks" || strategyId === "quant-low-beta-quality") {
    return STOCK_UNIVERSE.map((item) => item.ticker);
  }

  const baseId = overlayBaseStrategyId ?? "quant-dual-momentum";
  if (baseId === "quant-multifactor-stocks" || baseId === "quant-low-beta-quality") {
    return [...STOCK_UNIVERSE.map((item) => item.ticker), ...ETF_UNIVERSE.map((item) => item.ticker)];
  }

  return ETF_UNIVERSE.map((item) => item.ticker);
}

function rebalanceIndicesForStrategy(
  strategyId: QuantStrategyId,
  dates: string[],
  startIdx: number,
  endIdx: number
): number[] {
  if (strategyId === "quant-volatility-target-overlay") {
    return weeklyRebalanceIndices(dates, startIdx, endIdx);
  }
  return monthlyRebalanceIndices(dates, startIdx, endIdx);
}

function computeRiskSnapshot(
  ctx: MatrixContext,
  index: number,
  weights: Weight[]
): { expVol: number; expBetaToSPY: number; concentrationTop5: number } {
  const returns = computePortfolioDailyReturns(ctx, index, 63, weights);
  const vol = annualizedVol(returns);

  const spySeries = ctx.prices.SPY;
  const spyRet = trailingDailyReturns(spySeries, index, 63);
  const portRet = returns.slice(-spyRet.length);

  const varSpy = stddev(spyRet) ** 2;
  const beta = varSpy > 0 ? covariance(portRet, spyRet) / varSpy : 0;

  const concentration = sortByAbsWeightDesc(
    weights.filter((item) => item.weight > 0)
  )
    .slice(0, 5)
    .reduce((acc, item) => acc + item.weight, 0);

  return {
    expVol: Number(vol.toFixed(4)),
    expBetaToSPY: Number(beta.toFixed(4)),
    concentrationTop5: Number(concentration.toFixed(4)),
  };
}

function evaluateMetrics(equity: number[], returns: number[], turnover: number): BacktestMetrics {
  if (equity.length < 2 || returns.length === 0) {
    return {
      cagr: 0,
      sharpe: 0,
      sortino: 0,
      maxDrawdown: 0,
      calmar: 0,
      turnover: 0,
    };
  }

  const years = returns.length / 252;
  const final = equity[equity.length - 1];
  const cagr = years > 0 ? final ** (1 / years) - 1 : 0;

  const meanRet = mean(returns);
  const vol = stddev(returns);
  const sharpe = vol > 0 ? (meanRet / vol) * Math.sqrt(252) : 0;

  const downside = stddev(returns.filter((r) => r < 0));
  const sortino = downside > 0 ? (meanRet / downside) * Math.sqrt(252) : 0;

  let peak = equity[0];
  let maxDd = 0;
  for (const value of equity) {
    peak = Math.max(peak, value);
    if (peak > 0) {
      maxDd = Math.min(maxDd, value / peak - 1);
    }
  }

  const calmar = maxDd < 0 ? cagr / Math.abs(maxDd) : 0;

  return {
    cagr: Number(cagr.toFixed(4)),
    sharpe: Number(sharpe.toFixed(4)),
    sortino: Number(sortino.toFixed(4)),
    maxDrawdown: Number(maxDd.toFixed(4)),
    calmar: Number(calmar.toFixed(4)),
    turnover: Number(turnover.toFixed(4)),
  };
}

function deriveBacktestSeries(
  strategyId: QuantStrategyId,
  ctx: MatrixContext,
  startIdx: number,
  endIdx: number,
  config: QuantStrategyConfig,
  options?: {
    overlayBaseStrategyId?: Exclude<QuantStrategyId, "quant-volatility-target-overlay">;
    longCostBps?: number;
    shortCostBps?: number;
  }
): {
  equity: number[];
  returns: number[];
  dates: string[];
  turnover: number;
  drawdownSeries: Array<{ date: string; dd: number }>;
} {
  const rebalanceIndices = rebalanceIndicesForStrategy(
    strategyId,
    ctx.dates,
    startIdx,
    endIdx
  );

  if (rebalanceIndices.length === 0) {
    return {
      equity: [1],
      returns: [],
      dates: [ctx.dates[startIdx]],
      turnover: 0,
      drawdownSeries: [],
    };
  }

  let currentWeights = computeStrategyAtIndex(
    strategyId,
    ctx,
    rebalanceIndices[0],
    config,
    options?.overlayBaseStrategyId ?? "quant-dual-momentum"
  ).weights;

  const rebalanceSet = new Set(rebalanceIndices);
  const equity: number[] = [1];
  const returns: number[] = [];
  const outDates: string[] = [];
  let turnover = 0;

  for (let i = startIdx + 1; i <= endIdx; i += 1) {
    if (rebalanceSet.has(i)) {
      const nextWeights = computeStrategyAtIndex(
        strategyId,
        ctx,
        i,
        config,
        options?.overlayBaseStrategyId ?? "quant-dual-momentum"
      ).weights;

      const prevMap = weightMap(currentWeights);
      const nextMap = weightMap(nextWeights);
      const all = new Set([...prevMap.keys(), ...nextMap.keys()]);

      let turnoverStep = 0;
      let longTurn = 0;
      let shortTurn = 0;
      for (const ticker of all) {
        const prev = prevMap.get(ticker) ?? 0;
        const next = nextMap.get(ticker) ?? 0;
        const delta = Math.abs(next - prev);
        turnoverStep += delta;
        if (next >= 0) longTurn += delta;
        else shortTurn += delta;
      }

      turnover += turnoverStep;

      const longCost = (options?.longCostBps ?? LONG_COST_BPS_DEFAULT) / 10000;
      const shortCost = (options?.shortCostBps ?? SHORT_COST_BPS_DEFAULT) / 10000;
      const cost = longTurn * longCost + shortTurn * shortCost;
      const prevEquity = equity[equity.length - 1] ?? 1;
      equity[equity.length - 1] = prevEquity * (1 - cost);

      currentWeights = nextWeights;
    }

    let dayRet = 0;
    let shortGross = 0;
    for (const item of currentWeights) {
      if (item.ticker === "CASH") continue;
      const series = ctx.prices[item.ticker];
      if (!series) continue;
      const itemRet = getReturnAtIndex(series, i);
      dayRet += item.weight * itemRet;
      if (item.weight < 0) shortGross += Math.abs(item.weight);
    }

    dayRet -= shortGross * (SHORT_BORROW_ANNUAL / 252);

    const prev = equity[equity.length - 1] ?? 1;
    equity.push(prev * (1 + dayRet));
    returns.push(dayRet);
    outDates.push(ctx.dates[i]);
  }

  let peak = 1;
  const drawdownSeries: Array<{ date: string; dd: number }> = [];
  for (let i = 1; i < equity.length; i += 1) {
    peak = Math.max(peak, equity[i]);
    const dd = peak > 0 ? equity[i] / peak - 1 : 0;
    const date = outDates[i - 1];
    if (date) drawdownSeries.push({ date, dd: Number(dd.toFixed(4)) });
  }

  return {
    equity,
    returns,
    dates: [ctx.dates[startIdx], ...outDates],
    turnover,
    drawdownSeries,
  };
}

function yearlyReturns(
  dates: string[],
  equity: number[]
): Array<{ year: number; ret: number }> {
  if (dates.length !== equity.length || dates.length < 2) return [];

  const byYear = new Map<number, { start: number; end: number }>();
  for (let i = 0; i < dates.length; i += 1) {
    const y = yearOf(dates[i]);
    const row = byYear.get(y);
    if (!row) {
      byYear.set(y, { start: equity[i], end: equity[i] });
    } else {
      row.end = equity[i];
    }
  }

  return Array.from(byYear.entries())
    .map(([year, row]) => ({
      year,
      ret: row.start > 0 ? Number((row.end / row.start - 1).toFixed(4)) : 0,
    }))
    .sort((a, b) => a.year - b.year);
}

export async function runSignal(
  request: QuantSignalRequest
): Promise<QuantSignalResponse> {
  const expertMode = request.expertMode ?? false;
  const { requestedConfig, effectiveConfig, adjustments } = normalizeQuantConfig(
    request.strategyId,
    request.config,
    { expertMode }
  );

  const symbols = collectSymbols(request.strategyId, request.overlayBaseStrategyId);

  const asOfDate = request.asOfDate ?? getTodayIsoDate();
  const matrix = await loadPriceMatrix(symbols, "1990-01-01", asOfDate);

  const runtimeAdjustments = [...adjustments];
  const { startIdx, endIdx } = resolveStartEndIndices(
    matrix.dates,
    effectiveConfig,
    matrix.firstValidIndex,
    getUniverseForStrategy(request.strategyId).map((item) => item.ticker),
    asOfDate,
    undefined,
    runtimeAdjustments
  );

  const ctx: MatrixContext = {
    dates: matrix.dates,
    prices: matrix.prices,
    firstValidIndex: matrix.firstValidIndex,
    sources: matrix.sources,
  };

  const signal = computeStrategyAtIndex(
    request.strategyId,
    ctx,
    endIdx,
    effectiveConfig,
    request.overlayBaseStrategyId ?? "quant-dual-momentum"
  );

  runtimeAdjustments.push(...signal.adjustments);

  const rebalanceIndices = rebalanceIndicesForStrategy(
    request.strategyId,
    matrix.dates,
    startIdx,
    endIdx
  );
  const previousIdx =
    rebalanceIndices.length > 1
      ? rebalanceIndices[rebalanceIndices.length - 2]
      : Math.max(0, endIdx - 21);

  const previous = computeStrategyAtIndex(
    request.strategyId,
    ctx,
    previousIdx,
    effectiveConfig,
    request.overlayBaseStrategyId ?? "quant-dual-momentum"
  );

  const actions = buildActions(signal.weights, previous.weights);
  const risk = computeRiskSnapshot(ctx, endIdx, signal.weights);

  return {
    asOfDate: matrix.dates[endIdx] ?? asOfDate,
    strategyId: request.strategyId,
    universeVersion: UNIVERSE_VERSION,
    requestedConfig,
    effectiveConfig,
    adjustments: runtimeAdjustments,
    actions,
    risk,
    notes: signal.notes,
    sources: matrix.sources,
  };
}

export async function runBacktest(
  request: QuantBacktestRequest
): Promise<QuantBacktestResponse> {
  const expertMode = request.expertMode ?? false;
  const { requestedConfig, effectiveConfig, adjustments } = normalizeQuantConfig(
    request.strategyId,
    request.config,
    { expertMode }
  );

  const endDate = request.endDate ?? getTodayIsoDate();
  const symbols = collectSymbols(request.strategyId, request.overlayBaseStrategyId);
  const matrix = await loadPriceMatrix(symbols, "1990-01-01", endDate);

  const runtimeAdjustments = [...adjustments];
  const bounds = resolveStartEndIndices(
    matrix.dates,
    effectiveConfig,
    matrix.firstValidIndex,
    getUniverseForStrategy(request.strategyId).map((item) => item.ticker),
    endDate,
    request.startDate,
    runtimeAdjustments
  );

  const ctx: MatrixContext = {
    dates: matrix.dates,
    prices: matrix.prices,
    firstValidIndex: matrix.firstValidIndex,
    sources: matrix.sources,
  };

  const requestedCostBps = Number.isFinite(request.costBps)
    ? Number(request.costBps)
    : LONG_COST_BPS_DEFAULT;

  const strategySeries = deriveBacktestSeries(
    request.strategyId,
    ctx,
    bounds.startIdx,
    bounds.endIdx,
    effectiveConfig,
    {
      overlayBaseStrategyId: request.overlayBaseStrategyId,
      longCostBps: requestedCostBps,
      shortCostBps: SHORT_COST_BPS_DEFAULT,
    }
  );

  const benchmarkSeries = deriveBacktestSeries(
    "quant-dual-momentum",
    ctx,
    bounds.startIdx,
    bounds.endIdx,
    {
      ...effectiveConfig,
      positionMode: "long_only",
      grossExposureCap: 1,
      netExposureMin: 0,
      netExposureMax: 1,
    },
    {
      longCostBps: requestedCostBps,
      shortCostBps: SHORT_COST_BPS_DEFAULT,
    }
  );

  const metrics = evaluateMetrics(
    strategySeries.equity,
    strategySeries.returns,
    strategySeries.turnover
  );

  const benchmarkMetrics = evaluateMetrics(
    benchmarkSeries.equity,
    benchmarkSeries.returns,
    benchmarkSeries.turnover
  );

  return {
    strategyId: request.strategyId,
    startDate: matrix.dates[bounds.startIdx],
    endDate: matrix.dates[bounds.endIdx],
    requestedConfig,
    effectiveConfig,
    adjustments: runtimeAdjustments,
    metrics,
    benchmark: {
      ticker: "SPY",
      metrics: benchmarkMetrics,
    },
    yearlyReturns: yearlyReturns(strategySeries.dates, strategySeries.equity),
    drawdownSeries: strategySeries.drawdownSeries,
    assumptions: {
      longCostBps: LONG_COST_BPS_DEFAULT,
      shortCostBps: SHORT_COST_BPS_DEFAULT,
      shortBorrowAnnual: SHORT_BORROW_ANNUAL,
      requestedCostBps,
    },
    sources: matrix.sources,
  };
}

export function getQuantUniverse() {
  return {
    version: UNIVERSE_VERSION,
    updatedAt: formatIsoDate(new Date()),
    etfs: ETF_UNIVERSE,
    stocks: STOCK_UNIVERSE,
  };
}
