interface WatchlistMarketPoint {
  date: string;
  close: number;
  volume: number;
}

export interface LoadedWatchlistMatrix {
  dates: string[];
  closeBySymbol: Record<string, number[]>;
  volumeBySymbol: Record<string, number[]>;
  firstValidIndex: Record<string, number>;
  sourceBySymbol: Record<string, "stooq" | "synthetic">;
  sources: string[];
}

const SERIES_CACHE = new Map<string, WatchlistMarketPoint[]>();
const SOURCE_CACHE = new Map<string, "stooq" | "synthetic">();

const SYNTHETIC_START = "2010-01-01";

function parseIsoDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isBusinessDay(date: Date): boolean {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function seededNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 4294967296) * 2 - 1;
  };
}

function symbolSeed(symbol: string): number {
  let seed = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    seed = (seed * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return seed || 1;
}

function stooqTicker(symbol: string): string {
  return `${symbol.toLowerCase()}.us`;
}

function generateSyntheticSeries(symbol: string): WatchlistMarketPoint[] {
  const startDate = parseIsoDate(SYNTHETIC_START);
  const endDate = new Date();
  const rand = seededNoise(symbolSeed(symbol));
  const series: WatchlistMarketPoint[] = [];

  let price = 30 + (symbolSeed(symbol) % 180);
  const drift = ((symbolSeed(symbol) % 13) - 6) / 11000;
  const dailyVol = 0.01 + (symbolSeed(symbol) % 9) / 1200;
  const baseVolume = 900_000 + (symbolSeed(symbol) % 11) * 380_000;

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    if (isBusinessDay(cursor)) {
      const shock = rand() * dailyVol;
      price = Math.max(1, price * (1 + drift + shock));

      const activity = 1 + Math.abs(rand()) * 1.15 + (rand() + 1) * 0.15;
      const volume = Math.max(100_000, Math.round(baseVolume * activity));

      series.push({
        date: formatIsoDate(cursor),
        close: Number(price.toFixed(4)),
        volume,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

async function fetchStooqSeries(
  symbol: string
): Promise<WatchlistMarketPoint[] | null> {
  const url = `https://stooq.com/q/d/l/?s=${stooqTicker(symbol)}&i=d`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return null;

  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const points: WatchlistMarketPoint[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i];
    const [date, , , , closeRaw, volumeRaw] = row.split(",");
    const close = Number(closeRaw);
    const volume = Number(volumeRaw);
    if (!date || !Number.isFinite(close) || close <= 0) continue;
    if (!Number.isFinite(volume) || volume < 0) continue;
    points.push({ date, close, volume });
  }

  if (points.length < 90) return null;
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

async function getSeries(symbol: string): Promise<WatchlistMarketPoint[]> {
  if (SERIES_CACHE.has(symbol)) {
    return SERIES_CACHE.get(symbol) ?? [];
  }

  try {
    const stooq = await fetchStooqSeries(symbol);
    if (stooq && stooq.length > 0) {
      SERIES_CACHE.set(symbol, stooq);
      SOURCE_CACHE.set(symbol, "stooq");
      return stooq;
    }
  } catch {
    // Fall through to deterministic fallback.
  }

  const synthetic = generateSyntheticSeries(symbol);
  SERIES_CACHE.set(symbol, synthetic);
  SOURCE_CACHE.set(symbol, "synthetic");
  return synthetic;
}

function filterRange(
  series: WatchlistMarketPoint[],
  startDate: string,
  endDate: string
): WatchlistMarketPoint[] {
  return series.filter((point) => point.date >= startDate && point.date <= endDate);
}

function buildCalendar(
  preferred: WatchlistMarketPoint[],
  fallback: WatchlistMarketPoint[],
  startDate: string,
  endDate: string
): string[] {
  const preferredRange = filterRange(preferred, startDate, endDate).map(
    (point) => point.date
  );
  if (preferredRange.length > 0) return preferredRange;

  const fallbackRange = filterRange(fallback, startDate, endDate).map(
    (point) => point.date
  );
  if (fallbackRange.length > 0) return fallbackRange;

  const generated: string[] = [];
  const cursor = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  while (cursor <= end) {
    if (isBusinessDay(cursor)) {
      generated.push(formatIsoDate(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return generated;
}

export async function loadWatchlistMatrix(
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<LoadedWatchlistMatrix> {
  const requested = Array.from(new Set(symbols));
  const uniqueSymbols = Array.from(new Set([...requested, "SPY"]));
  const seriesBySymbol: Record<string, WatchlistMarketPoint[]> = {};

  await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      seriesBySymbol[symbol] = await getSeries(symbol);
    })
  );

  const calendar = buildCalendar(
    seriesBySymbol.SPY ?? [],
    seriesBySymbol[uniqueSymbols[0]] ?? [],
    startDate,
    endDate
  );

  const closeBySymbol: Record<string, number[]> = {};
  const volumeBySymbol: Record<string, number[]> = {};
  const firstValidIndex: Record<string, number> = {};
  const sourceBySymbol: Record<string, "stooq" | "synthetic"> = {};

  for (const symbol of requested) {
    const ranged = filterRange(seriesBySymbol[symbol] ?? [], startDate, endDate);
    const dateMap = new Map<string, WatchlistMarketPoint>();
    for (const point of ranged) {
      dateMap.set(point.date, point);
    }

    const closeRow: number[] = [];
    const volumeRow: number[] = [];
    let first = Number.POSITIVE_INFINITY;

    for (let i = 0; i < calendar.length; i += 1) {
      const point = dateMap.get(calendar[i]);
      const close = point?.close;
      const volume = point?.volume;

      if (typeof close === "number" && Number.isFinite(close) && close > 0) {
        closeRow.push(close);
      } else {
        closeRow.push(Number.NaN);
      }

      if (
        typeof volume === "number" &&
        Number.isFinite(volume) &&
        volume >= 0
      ) {
        volumeRow.push(volume);
      } else {
        volumeRow.push(Number.NaN);
      }

      if (
        !Number.isFinite(first) &&
        Number.isFinite(closeRow[i]) &&
        Number.isFinite(volumeRow[i]) &&
        volumeRow[i] > 0
      ) {
        first = i;
      }
    }

    closeBySymbol[symbol] = closeRow;
    volumeBySymbol[symbol] = volumeRow;
    firstValidIndex[symbol] = Number.isFinite(first)
      ? first
      : Number.POSITIVE_INFINITY;
    sourceBySymbol[symbol] = SOURCE_CACHE.get(symbol) ?? "synthetic";
  }

  const syntheticCount = Object.values(sourceBySymbol).filter(
    (source) => source === "synthetic"
  ).length;

  const sources = ["Stooq EOD CSV (primary)"];
  if (syntheticCount > 0) {
    sources.push(
      `Synthetic fallback (deterministic) used for ${syntheticCount} symbol(s)`
    );
  }

  return {
    dates: calendar,
    closeBySymbol,
    volumeBySymbol,
    firstValidIndex,
    sourceBySymbol,
    sources,
  };
}

export function getTodayIsoDate(): string {
  return formatIsoDate(new Date());
}
