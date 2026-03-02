import { NextResponse } from "next/server";
import { isQuantModulesEnabledServer } from "@/lib/features";
import { runBacktest, runSignal } from "@/lib/quant/engine";
import { buildQuantCacheKey } from "@/lib/analysis/cache-keys";
import {
  CacheRefreshLockedError,
  runWithSharedAnalysisCache,
} from "@/lib/server/analysis-cache";
import type {
  QuantBacktestResponse,
  QuantRunRequest,
  QuantRunResponse,
  QuantSignalResponse,
} from "@/types";

export const maxDuration = 120;

interface QuantRunPayload {
  signal: QuantSignalResponse;
  backtest: QuantBacktestResponse;
}

export async function POST(req: Request) {
  if (!isQuantModulesEnabledServer()) {
    return NextResponse.json(
      { error: "Quant modules are disabled." },
      { status: 404 }
    );
  }

  try {
    const payload = (await req.json()) as QuantRunRequest;
    const expertMode = payload.expertMode ?? false;

    const cacheKey = buildQuantCacheKey({
      strategyId: payload.strategyId,
      language: payload.language,
      modelId: payload.modelId,
      expertMode,
      config: payload.config,
      overlayBaseStrategyId: payload.overlayBaseStrategyId,
    });

    const run = await runWithSharedAnalysisCache<QuantRunPayload>({
      cacheKey,
      mode: payload.mode ?? "auto",
      execute: async () => {
        const [signal, backtest] = await Promise.all([
          runSignal({
            strategyId: payload.strategyId,
            language: payload.language,
            asOfDate: payload.asOfDate,
            expertMode,
            config: payload.config,
            overlayBaseStrategyId: payload.overlayBaseStrategyId,
          }),
          runBacktest({
            strategyId: payload.strategyId,
            startDate: payload.startDate,
            endDate: payload.endDate,
            costBps: payload.costBps,
            expertMode,
            config: payload.config,
            overlayBaseStrategyId: payload.overlayBaseStrategyId,
          }),
        ]);

        return { signal, backtest };
      },
    });

    const response: QuantRunResponse = {
      signal: run.payload?.signal ?? null,
      backtest: run.payload?.backtest ?? null,
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
