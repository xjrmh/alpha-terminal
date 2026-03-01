import { NextResponse } from "next/server";
import { runWatchlistScan } from "@/lib/watchlist/engine";
import type { WatchlistScanRequest, WatchlistTimeRange } from "@/types";

export const maxDuration = 120;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWatchlistTimeRange(value: unknown): value is WatchlistTimeRange {
  return value === "1D" || value === "1W" || value === "1M";
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parsePayload(input: unknown): WatchlistScanRequest {
  if (!isPlainObject(input)) {
    throw new Error("Invalid payload: expected JSON object.");
  }

  const timeRange = input.timeRange;
  if (!isWatchlistTimeRange(timeRange)) {
    throw new Error("Invalid field `timeRange`: expected one of 1D, 1W, 1M.");
  }

  let asOfDate: string | undefined;
  if (typeof input.asOfDate !== "undefined") {
    if (typeof input.asOfDate !== "string" || !isIsoDate(input.asOfDate)) {
      throw new Error("Invalid field `asOfDate`: expected YYYY-MM-DD.");
    }
    asOfDate = input.asOfDate;
  }

  let limit: number | undefined;
  if (typeof input.limit !== "undefined") {
    if (typeof input.limit !== "number" || !Number.isFinite(input.limit)) {
      throw new Error("Invalid field `limit`: expected finite number.");
    }
    limit = input.limit;
  }

  return {
    timeRange,
    asOfDate,
    limit,
  };
}

export async function POST(req: Request) {
  try {
    const payload = parsePayload(await req.json());
    const result = await runWatchlistScan(payload);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
