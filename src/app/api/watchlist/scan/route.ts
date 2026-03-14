import { NextResponse } from "next/server";
import { runWatchlistScan } from "@/lib/watchlist/engine";
import { buildWatchlistCacheKey } from "@/lib/analysis/cache-keys";
import {
  CacheRefreshLockedError,
  runWithSharedAnalysisCache,
} from "@/lib/server/analysis-cache";
import type {
  AnalysisRunMode,
  WatchlistScanRequest,
  WatchlistScanResponse,
  WatchlistRunResponse,
  WatchlistTimeRange,
} from "@/types";

export const maxDuration = 120;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWatchlistTimeRange(value: unknown): value is WatchlistTimeRange {
  return value === "1D" || value === "1W" || value === "1M";
}

function isAnalysisRunMode(value: unknown): value is AnalysisRunMode {
  return (
    value === "auto" ||
    value === "refresh" ||
    value === "refresh_if_eligible" ||
    value === "cache_only"
  );
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

interface ParsedWatchlistPayload extends WatchlistScanRequest {
  modelId: string;
  expertMode: boolean;
  mode: AnalysisRunMode;
}

function parsePayload(input: unknown): ParsedWatchlistPayload {
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

  let modelId = "openai:gpt-5.2";
  if (typeof input.modelId !== "undefined") {
    if (typeof input.modelId !== "string" || !input.modelId.trim()) {
      throw new Error("Invalid field `modelId`: expected non-empty string.");
    }
    modelId = input.modelId.trim();
  }

  const expertMode =
    typeof input.expertMode === "boolean" ? input.expertMode : false;

  let mode: AnalysisRunMode = "auto";
  if (typeof input.mode !== "undefined") {
    if (!isAnalysisRunMode(input.mode)) {
      throw new Error(
        "Invalid field `mode`: expected one of auto, refresh, refresh_if_eligible, cache_only."
      );
    }
    mode = input.mode;
  }

  return {
    timeRange,
    asOfDate,
    limit,
    modelId,
    expertMode,
    mode,
  };
}

export async function POST(req: Request) {
  try {
    const payload = parsePayload(await req.json());
    const cacheKey = buildWatchlistCacheKey({
      timeRange: payload.timeRange,
      asOfDate: payload.asOfDate,
      limit: payload.limit,
      modelId: payload.modelId,
      expertMode: payload.expertMode,
    });

    const run = await runWithSharedAnalysisCache<WatchlistScanResponse>({
      cacheKey,
      mode: payload.mode,
      execute: async () =>
        runWatchlistScan({
          timeRange: payload.timeRange,
          asOfDate: payload.asOfDate,
          limit: payload.limit,
        }),
    });

    const response: WatchlistRunResponse = {
      result: run.payload ?? null,
      cache: run.cache,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof CacheRefreshLockedError) {
      return NextResponse.json(
        { code: error.code, error: error.message, cache: error.cache },
        { status: 409 }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
