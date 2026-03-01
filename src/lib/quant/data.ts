interface PricePoint {
  date: string;
  close: number;
}

export interface LoadedPriceMatrix {
  dates: string[];
  prices: Record<string, number[]>;
  firstValidIndex: Record<string, number>;
  sourceBySymbol: Record<string, "stooq" | "synthetic">;
  sources: string[];
}

const SERIES_CACHE = new Map<string, PricePoint[]>();
const SOURCE_CACHE = new Map<string, "stooq" | "synthetic">();

const SYNTHETIC_START = "1990-01-01";

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

function stooqTicker(symbol: string): string {
  return `${symbol.toLowerCase()}.us`;
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

function generateSyntheticSeries(symbol: string): PricePoint[] {
  const startDate = parseIsoDate(SYNTHETIC_START);
  const endDate = new Date();
  const rand = seededNoise(symbolSeed(symbol));
  const series: PricePoint[] = [];

  let price = 40 + (symbolSeed(symbol) % 120);
  const drift = ((symbolSeed(symbol) % 11) - 5) / 10000;
  const vol = 0.012 + ((symbolSeed(symbol) % 9) / 1000);

  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    if (isBusinessDay(cursor)) {
      const shock = rand() * vol;
      price = Math.max(1, price * (1 + drift + shock));
      series.push({
        date: formatIsoDate(cursor),
        close: Number(price.toFixed(4)),
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return series;
}

async function fetchStooqSeries(symbol: string): Promise<PricePoint[] | null> {
  const url = `https://stooq.com/q/d/l/?s=${stooqTicker(symbol)}&i=d`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) return null;

  const csv = await res.text();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;

  const points: PricePoint[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i];
    const [date, , , , close] = row.split(",");
    const px = Number(close);
    if (!date || !Number.isFinite(px) || px <= 0) continue;
    points.push({ date, close: px });
  }

  if (points.length < 60) return null;
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

async function getSeries(symbol: string): Promise<PricePoint[]> {
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
    // Fall through to deterministic synthetic backup.
  }

  const synthetic = generateSyntheticSeries(symbol);
  SERIES_CACHE.set(symbol, synthetic);
  SOURCE_CACHE.set(symbol, "synthetic");
  return synthetic;
}

function filterRange(series: PricePoint[], startDate: string, endDate: string): PricePoint[] {
  return series.filter((p) => p.date >= startDate && p.date <= endDate);
}

function buildCalendar(
  preferred: PricePoint[],
  fallback: PricePoint[],
  startDate: string,
  endDate: string
): string[] {
  const preferredRange = filterRange(preferred, startDate, endDate).map((p) => p.date);
  if (preferredRange.length > 0) return preferredRange;

  const fallbackRange = filterRange(fallback, startDate, endDate).map((p) => p.date);
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

export async function loadPriceMatrix(
  symbols: string[],
  startDate: string,
  endDate: string
): Promise<LoadedPriceMatrix> {
  const uniqueSymbols = Array.from(new Set([...symbols, "SPY"]));
  const seriesBySymbol: Record<string, PricePoint[]> = {};

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

  const prices: Record<string, number[]> = {};
  const firstValidIndex: Record<string, number> = {};
  const sourceBySymbol: Record<string, "stooq" | "synthetic"> = {};

  for (const symbol of uniqueSymbols) {
    const ranged = filterRange(seriesBySymbol[symbol] ?? [], startDate, endDate);
    const map = new Map<string, number>();
    for (const point of ranged) {
      map.set(point.date, point.close);
    }

    const row: number[] = [];
    let first = -1;
    let current = Number.NaN;

    for (let i = 0; i < calendar.length; i += 1) {
      const date = calendar[i];
      const exact = map.get(date);
      if (typeof exact === "number" && Number.isFinite(exact)) {
        current = exact;
        if (first === -1) first = i;
      }
      row.push(Number.isFinite(current) ? current : Number.NaN);
    }

    prices[symbol] = row;
    firstValidIndex[symbol] = first === -1 ? Number.POSITIVE_INFINITY : first;
    sourceBySymbol[symbol] = SOURCE_CACHE.get(symbol) ?? "synthetic";
  }

  const sources = new Set<string>();
  sources.add("Stooq EOD CSV (primary)");
  for (const [symbol, source] of Object.entries(sourceBySymbol)) {
    if (source === "synthetic") {
      sources.add(`Synthetic fallback (deterministic) for ${symbol}`);
    }
  }

  return {
    dates: calendar,
    prices,
    firstValidIndex,
    sourceBySymbol,
    sources: Array.from(sources),
  };
}

export function getTodayIsoDate(): string {
  return formatIsoDate(new Date());
}
