import type {
  WatchlistItem,
  WatchlistScanRequest,
  WatchlistScanResponse,
  WatchlistTimeRange,
} from "@/types";
import { getTodayIsoDate, loadWatchlistMatrix } from "./data";
import { WATCHLIST_UNIVERSE, WATCHLIST_UNIVERSE_VERSION } from "./universe";

const DEFAULT_LIMIT = 20;
const LIMIT_MIN = 5;
const LIMIT_MAX = 50;
const VOL_WINDOW_DAYS = 63;

const FACTOR_WEIGHTS = {
  movement: 0.5,
  volumeShift: 0.35,
  volShift: 0.15,
} as const;

const RANGE_CONFIG: Record<
  WatchlistTimeRange,
  {
    lookbackDays: number;
    volumeBaselineDays: number;
  }
> = {
  "1D": { lookbackDays: 1, volumeBaselineDays: 20 },
  "1W": { lookbackDays: 5, volumeBaselineDays: 20 },
  "1M": { lookbackDays: 21, volumeBaselineDays: 63 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  let sq = 0;
  for (const value of values) {
    const delta = value - avg;
    sq += delta * delta;
  }
  return Math.sqrt(sq / values.length);
}

function zscores(values: number[]): number[] {
  if (values.length === 0) return [];
  const avg = mean(values);
  const sd = stddev(values);
  if (sd <= 1e-12) return values.map(() => 0);
  return values.map((value) => (value - avg) / sd);
}

function indexOnOrBefore(dates: string[], targetDate: string): number {
  let lo = 0;
  let hi = dates.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= targetDate) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function avgWindow(
  values: number[],
  start: number,
  end: number,
  options?: { strictlyPositive?: boolean }
): number | null {
  if (start < 0 || end >= values.length || start > end) return null;

  let sum = 0;
  let count = 0;

  for (let i = start; i <= end; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) return null;
    if (options?.strictlyPositive && value <= 0) return null;
    sum += value;
    count += 1;
  }

  if (count === 0) return null;
  return sum / count;
}

function dailyReturns(
  close: number[],
  start: number,
  end: number
): number[] | null {
  if (start < 1 || end >= close.length || start > end) return null;

  const out: number[] = [];
  for (let i = start; i <= end; i += 1) {
    const prev = close[i - 1];
    const curr = close[i];
    if (!isFiniteNumber(prev) || !isFiniteNumber(curr) || prev <= 0) {
      return null;
    }
    out.push(curr / prev - 1);
  }
  return out;
}

function periodReturn(close: number[], endIndex: number, lookbackDays: number): number | null {
  const start = endIndex - lookbackDays;
  if (start < 0 || endIndex >= close.length) return null;

  const startPrice = close[start];
  const endPrice = close[endIndex];
  if (!isFiniteNumber(startPrice) || !isFiniteNumber(endPrice) || startPrice <= 0) {
    return null;
  }

  return endPrice / startPrice - 1;
}

function buildSignals(
  direction: "UP" | "DOWN",
  movementScore: number,
  volumeShiftZ: number,
  volShiftZ: number
): string[] {
  const signals: string[] = [];
  signals.push(direction === "UP" ? "Directional move: up" : "Directional move: down");

  if (movementScore >= 1.25) signals.push("Large price displacement");
  else if (movementScore >= 0.7) signals.push("Notable price move");

  if (volumeShiftZ >= 1.1) signals.push("Strong volume expansion");
  else if (volumeShiftZ >= 0.5) signals.push("Above-trend volume");
  else if (volumeShiftZ <= -1.1) signals.push("Volume cooling");

  if (volShiftZ >= 1.1) signals.push("Volatility regime upshift");
  else if (volShiftZ <= -1.1) signals.push("Volatility compression");

  return signals;
}

interface FactorRecord {
  ticker: string;
  name: string;
  sector: string;
  close: number;
  signedReturn: number;
  volumeShiftRatio: number;
  volShiftRatio: number;
}

function parseRequestedLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.trunc(value);
}

function parseAsOfDate(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return getTodayIsoDate();
  return value.trim();
}

export async function runWatchlistScan(
  request: WatchlistScanRequest
): Promise<WatchlistScanResponse> {
  const timeRange = request.timeRange;
  const rangeConfig = RANGE_CONFIG[timeRange];
  if (!rangeConfig) {
    throw new Error("Invalid timeRange. Expected one of: 1D, 1W, 1M.");
  }

  const requestedLimit = parseRequestedLimit(request.limit);
  const effectiveLimit = clamp(requestedLimit, LIMIT_MIN, LIMIT_MAX);
  const asOfDateInput = parseAsOfDate(request.asOfDate);

  const requiredLookback =
    rangeConfig.lookbackDays +
    Math.max(rangeConfig.volumeBaselineDays, VOL_WINDOW_DAYS) +
    8;
  const lookbackStart = new Date(`${asOfDateInput}T00:00:00Z`);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - requiredLookback * 2);
  const startDate = lookbackStart.toISOString().slice(0, 10);

  const matrix = await loadWatchlistMatrix(
    WATCHLIST_UNIVERSE.map((item) => item.ticker),
    startDate,
    asOfDateInput
  );

  if (matrix.dates.length === 0) {
    throw new Error("No market data available for the requested window.");
  }

  const endIndex = indexOnOrBefore(matrix.dates, asOfDateInput);
  if (endIndex < 0) {
    throw new Error("No market data on or before asOfDate.");
  }

  const diagnosticsReasons = new Map<string, number>();
  const addReason = (reason: string) => {
    diagnosticsReasons.set(reason, (diagnosticsReasons.get(reason) ?? 0) + 1);
  };

  const factorRecords: FactorRecord[] = [];

  const lookbackDays = rangeConfig.lookbackDays;
  const volumeBaselineDays = rangeConfig.volumeBaselineDays;
  const volumeRecentStart = endIndex - lookbackDays + 1;
  const volumeBaseEnd = endIndex - lookbackDays;
  const volumeBaseStart = volumeBaseEnd - volumeBaselineDays + 1;
  const recentVolStart = endIndex - lookbackDays + 1;
  const priorVolEnd = endIndex - lookbackDays;
  const priorVolStart = priorVolEnd - VOL_WINDOW_DAYS + 1;

  for (const instrument of WATCHLIST_UNIVERSE) {
    const close = matrix.closeBySymbol[instrument.ticker] ?? [];
    const volume = matrix.volumeBySymbol[instrument.ticker] ?? [];
    const firstValid = matrix.firstValidIndex[instrument.ticker] ?? Number.POSITIVE_INFINITY;

    if (
      !Number.isFinite(firstValid) ||
      endIndex - firstValid < lookbackDays + VOL_WINDOW_DAYS
    ) {
      addReason("insufficient_history");
      continue;
    }

    const signedReturn = periodReturn(close, endIndex, lookbackDays);
    if (signedReturn === null) {
      addReason("missing_price_window");
      continue;
    }

    const recentAvgVolume = avgWindow(volume, volumeRecentStart, endIndex, {
      strictlyPositive: true,
    });
    const baselineAvgVolume = avgWindow(volume, volumeBaseStart, volumeBaseEnd, {
      strictlyPositive: true,
    });
    if (recentAvgVolume === null || baselineAvgVolume === null || baselineAvgVolume <= 0) {
      addReason("missing_volume_window");
      continue;
    }

    const recentReturns = dailyReturns(close, recentVolStart, endIndex);
    const priorReturns = dailyReturns(close, priorVolStart, priorVolEnd);
    if (
      recentReturns === null ||
      priorReturns === null ||
      priorReturns.length === 0
    ) {
      addReason("missing_volatility_window");
      continue;
    }

    const recentStd = stddev(recentReturns);
    const priorStd = stddev(priorReturns);
    if (!isFiniteNumber(recentStd) || !isFiniteNumber(priorStd) || priorStd <= 0) {
      addReason("unstable_volatility_window");
      continue;
    }

    const endClose = close[endIndex];
    if (!isFiniteNumber(endClose) || endClose <= 0) {
      addReason("invalid_last_close");
      continue;
    }

    factorRecords.push({
      ticker: instrument.ticker,
      name: instrument.name,
      sector: instrument.sector,
      close: endClose,
      signedReturn,
      volumeShiftRatio: recentAvgVolume / baselineAvgVolume,
      volShiftRatio: recentStd / priorStd,
    });
  }

  if (factorRecords.length === 0) {
    throw new Error("No eligible symbols found after data coverage checks.");
  }

  const movementInputs = factorRecords.map((item) => item.signedReturn);
  const volumeInputs = factorRecords.map((item) =>
    Math.log(Math.max(item.volumeShiftRatio, 1e-8))
  );
  const volatilityInputs = factorRecords.map((item) =>
    Math.log(Math.max(item.volShiftRatio, 1e-8))
  );

  const movementZ = zscores(movementInputs);
  const volumeZ = zscores(volumeInputs);
  const volatilityZ = zscores(volatilityInputs);

  const scoredItems: WatchlistItem[] = factorRecords.map((item, index) => {
    const movementScore = Math.abs(movementZ[index]);
    const volumeShiftScore = volumeZ[index];
    const volShiftScore = volatilityZ[index];
    const activityScore =
      FACTOR_WEIGHTS.movement * movementScore +
      FACTOR_WEIGHTS.volumeShift * volumeShiftScore +
      FACTOR_WEIGHTS.volShift * volShiftScore;

    const direction: "UP" | "DOWN" = item.signedReturn >= 0 ? "UP" : "DOWN";

    return {
      ticker: item.ticker,
      name: item.name,
      sector: item.sector,
      close: Number(item.close.toFixed(4)),
      returnPct: Number(item.signedReturn.toFixed(6)),
      volumeShift: Number(item.volumeShiftRatio.toFixed(6)),
      volShift: Number(item.volShiftRatio.toFixed(6)),
      activityScore: Number(activityScore.toFixed(6)),
      direction,
      signals: buildSignals(direction, movementScore, volumeShiftScore, volShiftScore),
    };
  });

  scoredItems.sort((a, b) => {
    if (b.activityScore !== a.activityScore) {
      return b.activityScore - a.activityScore;
    }
    return a.ticker.localeCompare(b.ticker);
  });

  const exclusionCount = Array.from(diagnosticsReasons.values()).reduce(
    (acc, count) => acc + count,
    0
  );

  const sources = [
    `Pinned static universe (${WATCHLIST_UNIVERSE_VERSION})`,
    ...matrix.sources,
  ];

  return {
    asOfDate: matrix.dates[endIndex] ?? asOfDateInput,
    timeRange,
    requestedLimit,
    effectiveLimit,
    universeVersion: WATCHLIST_UNIVERSE_VERSION,
    items: scoredItems.slice(0, effectiveLimit),
    diagnostics: {
      universeSize: WATCHLIST_UNIVERSE.length,
      eligibleCount: factorRecords.length,
      excludedCount: exclusionCount,
      reasons: Object.fromEntries(diagnosticsReasons.entries()),
      factorWeights: { ...FACTOR_WEIGHTS },
    },
    sources,
  };
}
