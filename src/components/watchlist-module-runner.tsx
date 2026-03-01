"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useAnalysis } from "@/lib/analysis/context";
import {
  getWatchlistRunKey,
  getWatchlistRunState,
  runWatchlistScan,
  subscribeWatchlistRun,
} from "@/lib/analysis/watchlist-runner";
import { SkeletonLoader } from "./skeleton-loader";
import type { WatchlistTimeRange } from "@/types";

const TIME_RANGES: WatchlistTimeRange[] = ["1D", "1W", "1M"];

function formatPrice(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatRatio(value: number): string {
  return `${value.toFixed(2)}x`;
}

function formatScore(value: number): string {
  return value.toFixed(3);
}

export function WatchlistModuleRunner() {
  const { t } = useLanguage();
  const { registerOnRun, setIsLoading, setShowRefreshCta } = useAnalysis();
  const [timeRange, setTimeRange] = useState<WatchlistTimeRange>("1D");

  const runKey = useMemo(() => getWatchlistRunKey(timeRange), [timeRange]);
  const [runState, setRunState] = useState(() => getWatchlistRunState(runKey));

  const handleRun = useCallback(() => {
    setShowRefreshCta(false);
    void runWatchlistScan({ timeRange });
  }, [setShowRefreshCta, timeRange]);

  useEffect(() => {
    registerOnRun(handleRun, { requiresModelCredentials: false });
    return () => registerOnRun(null, { requiresModelCredentials: false });
  }, [handleRun, registerOnRun]);

  useEffect(() => {
    return subscribeWatchlistRun(runKey, setRunState);
  }, [runKey]);

  useEffect(() => {
    setIsLoading(runState.isLoading);
  }, [runState.isLoading, setIsLoading]);

  useEffect(() => {
    setShowRefreshCta(false);
  }, [setShowRefreshCta, timeRange]);

  useEffect(() => {
    if (runState.result || runState.isLoading || runState.error) return;
    void runWatchlistScan({ timeRange });
  }, [runState.error, runState.isLoading, runState.result, timeRange]);

  const result = runState.result;
  const showScan = !result && !runState.error;

  return (
    <div className="relative flex flex-col h-full overflow-y-auto p-6 gap-4">
      {showScan && <div className="terminal-scan" />}

      <section className="border border-border bg-bg-secondary p-4 rounded">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm text-green-accent font-semibold">
            {t.watchlist.title}
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">{t.watchlist.timeRange}</span>
            <div className="inline-flex gap-1">
              {TIME_RANGES.map((range) => (
                <button
                  key={range}
                  className={`btn-lang ${
                    range === timeRange ? "btn-lang-active" : ""
                  }`}
                  onClick={() => setTimeRange(range)}
                >
                  {t.watchlist.ranges[range]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 text-[0.65rem] text-text-muted">
          {t.watchlist.runHint}
        </div>
      </section>

      {runState.error && (
        <div className="text-red-accent text-sm border border-red-accent/30 bg-red-accent/5 p-3 rounded">
          <strong>Error:</strong> {runState.error}
        </div>
      )}

      {runState.isLoading && !result && <SkeletonLoader />}

      {result && (
        <>
          <section className="border border-border bg-bg-secondary rounded overflow-hidden">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[1180px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-bg-surface text-green-accent">
                    <th className="text-left px-3 py-2 whitespace-nowrap">{t.watchlist.ticker}</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">{t.watchlist.name}</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">{t.watchlist.sector}</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">{t.watchlist.direction}</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">{t.watchlist.close}</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">{t.watchlist.returnPct}</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">{t.watchlist.volumeShift}</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">{t.watchlist.volShift}</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">{t.watchlist.activityScore}</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap">{t.watchlist.signals}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr
                      key={item.ticker}
                      className="border-b border-border/70 last:border-b-0"
                    >
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{item.ticker}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{item.name}</td>
                      <td className="px-3 py-2 text-text-secondary whitespace-nowrap">{item.sector}</td>
                      <td
                        className={`px-3 py-2 font-semibold ${
                          item.direction === "UP"
                            ? "text-green-accent"
                            : "text-red-accent"
                        }`}
                      >
                        {item.direction === "UP" ? t.watchlist.up : t.watchlist.down}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">{formatPrice(item.close)}</td>
                      <td
                        className={`px-3 py-2 text-right whitespace-nowrap ${
                          item.returnPct >= 0 ? "text-green-accent" : "text-red-accent"
                        }`}
                      >
                        {formatPct(item.returnPct)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatRatio(item.volumeShift)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {formatRatio(item.volShift)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                        {formatScore(item.activityScore)}
                      </td>
                      <td className="px-3 py-2 min-w-[16rem]">
                        <div className="flex flex-wrap gap-1">
                          {item.signals.map((signal) => (
                            <span
                              key={`${item.ticker}-${signal}`}
                              className="px-1.5 py-0.5 border border-border rounded text-[0.65rem] text-text-secondary"
                            >
                              {signal}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="border border-border bg-bg-secondary rounded p-3 text-xs">
              <h3 className="text-green-accent font-semibold mb-2">
                {t.watchlist.diagnostics}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-text-secondary">
                <div>
                  {t.watchlist.universeSize}: {result.diagnostics.universeSize}
                </div>
                <div>
                  {t.watchlist.eligibleCount}: {result.diagnostics.eligibleCount}
                </div>
                <div>
                  {t.watchlist.excludedCount}: {result.diagnostics.excludedCount}
                </div>
                <div>
                  {t.watchlist.activityScore}:{" "}
                  {`M:${result.diagnostics.factorWeights.movement.toFixed(2)} V:${result.diagnostics.factorWeights.volumeShift.toFixed(2)} R:${result.diagnostics.factorWeights.volShift.toFixed(2)}`}
                </div>
              </div>

              <div className="mt-2 text-text-muted text-[0.7rem]">
                {t.watchlist.reasons}:{" "}
                {Object.entries(result.diagnostics.reasons)
                  .map(([reason, count]) => `${reason} (${count})`)
                  .join(", ") || "none"}
              </div>
            </div>

            <div className="border border-border bg-bg-secondary rounded p-3 text-xs">
              <h3 className="text-green-accent font-semibold mb-2">
                {t.watchlist.sources}
              </h3>
              <div className="text-text-secondary space-y-1">
                <div>
                  {t.watchlist.asOf}: {result.asOfDate}
                </div>
                <div>
                  {t.watchlist.universeVersion}: {result.universeVersion}
                </div>
                {result.sources.map((source) => (
                  <div key={source}>- {source}</div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {!result && !runState.isLoading && !runState.error && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-text-muted">
            <div className="text-2xl mb-2 opacity-30">◍</div>
            <div className="text-sm">{t.modules.watchlist}</div>
            <div className="text-xs mt-1 opacity-60">{t.watchlist.noData}</div>
          </div>
        </div>
      )}
    </div>
  );
}
