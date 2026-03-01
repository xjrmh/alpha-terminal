"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useAnalysis } from "@/lib/analysis/context";
import {
  getQuantRunKey,
  getQuantRunState,
  runQuantAnalysis,
  subscribeQuantRun,
} from "@/lib/analysis/quant-runner";
import { useExpertMode } from "@/lib/expert/context";
import { useModel } from "@/lib/model/context";
import { useQuantSettings } from "@/lib/quant/settings-context";
import type {
  QuantStrategyConfig,
  QuantStrategyId,
} from "@/types";

interface QuantModuleRunnerProps {
  strategyId: QuantStrategyId;
}

const OVERLAY_OPTIONS: Exclude<
  QuantStrategyId,
  "quant-volatility-target-overlay"
>[] = [
  "quant-dual-momentum",
  "quant-multifactor-stocks",
  "quant-low-beta-quality",
];

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function configRows(config: QuantStrategyConfig): Array<[string, string]> {
  return [
    ["lookbackMode", config.lookbackMode],
    ["lookbackYears", String(config.lookbackYears)],
    ["positionMode", config.positionMode],
    ["riskTolerance", config.riskTolerance],
    ["targetVol", pct(config.targetVol)],
    ["grossExposureCap", pct(config.grossExposureCap)],
    ["netExposureMin", pct(config.netExposureMin)],
    ["netExposureMax", pct(config.netExposureMax)],
  ];
}

export function QuantModuleRunner({ strategyId }: QuantModuleRunnerProps) {
  const { lang, t } = useLanguage();
  const { registerOnRun, setIsLoading, setShowRefreshCta } = useAnalysis();
  const { modelId } = useModel();
  const { available: expertAvailable, enabled: expertEnabled } = useExpertMode();
  const { hydrated, getConfig, setConfig, resetConfig } = useQuantSettings();
  const effectiveExpertMode = expertAvailable && expertEnabled;
  const prevModelIdRef = useRef(modelId);
  const prevExpertModeRef = useRef(effectiveExpertMode);
  const needsRefreshRef = useRef(false);

  const [overlayBase, setOverlayBase] = useState<
    Exclude<QuantStrategyId, "quant-volatility-target-overlay">
  >("quant-dual-momentum");
  const runKey = getQuantRunKey(strategyId);
  const [runState, setRunState] = useState(() => getQuantRunState(runKey));
  const config = getConfig(strategyId);

  const handleRun = useCallback(() => {
    void runQuantAnalysis({
      strategyId,
      language: lang,
      config,
      expertMode: effectiveExpertMode,
      overlayBaseStrategyId:
        strategyId === "quant-volatility-target-overlay"
          ? overlayBase
          : undefined,
    });
    needsRefreshRef.current = false;
    setShowRefreshCta(false);
  }, [
    config,
    effectiveExpertMode,
    lang,
    overlayBase,
    setShowRefreshCta,
    strategyId,
  ]);

  useEffect(() => {
    registerOnRun(handleRun, { requiresModelCredentials: false });
    return () => registerOnRun(null, { requiresModelCredentials: false });
  }, [handleRun, registerOnRun]);

  useEffect(() => {
    return subscribeQuantRun(runKey, setRunState);
  }, [runKey]);

  useEffect(() => {
    setIsLoading(runState.isLoading);
  }, [runState.isLoading, setIsLoading]);

  const advancedVisible = effectiveExpertMode;
  const signal = runState.signal;
  const backtest = runState.backtest;
  const showScan = !signal && !backtest && !runState.error;
  const hasAnalysis = Boolean(signal || backtest);

  useEffect(() => {
    if (!hasAnalysis) {
      needsRefreshRef.current = false;
      setShowRefreshCta(false);
      return;
    }

    const modelChanged = prevModelIdRef.current !== modelId;
    const expertChanged = prevExpertModeRef.current !== effectiveExpertMode;
    if (modelChanged || expertChanged) {
      needsRefreshRef.current = true;
    }
    setShowRefreshCta(needsRefreshRef.current);
  }, [effectiveExpertMode, hasAnalysis, modelId, setShowRefreshCta]);

  useEffect(() => {
    prevModelIdRef.current = modelId;
    prevExpertModeRef.current = effectiveExpertMode;
  }, [effectiveExpertMode, modelId]);

  return (
    <div className="relative flex flex-col h-full overflow-y-auto p-6 gap-4">
      {showScan && <div className="terminal-scan" />}

      <section className="border border-border bg-bg-secondary p-4 rounded">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm text-green-accent font-semibold">{t.quant.settings}</h2>
          <button className="btn-lang" onClick={() => resetConfig(strategyId)}>
            {t.quant.reset}
          </button>
        </div>

        {!advancedVisible && (
          <div className="text-xs text-text-muted">{t.quant.expertOnly}</div>
        )}

        {advancedVisible && hydrated && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t.quant.lookbackMode}</span>
              <select
                className="btn-lang text-left normal-case"
                value={config.lookbackMode}
                onChange={(e) =>
                  setConfig(strategyId, {
                    lookbackMode:
                      e.target.value === "since_inception"
                        ? "since_inception"
                        : "fixed_years",
                  })
                }
              >
                <option value="fixed_years">{t.quant.fixedYears}</option>
                <option value="since_inception">{t.quant.sinceInception}</option>
              </select>
            </label>

            {config.lookbackMode === "fixed_years" && (
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t.quant.lookbackYears}</span>
                <input
                  className="btn-lang"
                  type="number"
                  min={3}
                  max={30}
                  value={config.lookbackYears}
                  onChange={(e) =>
                    setConfig(strategyId, {
                      lookbackYears: Number(e.target.value),
                    })
                  }
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t.quant.positionMode}</span>
              <select
                className="btn-lang text-left normal-case"
                value={config.positionMode}
                onChange={(e) =>
                  setConfig(strategyId, {
                    positionMode:
                      e.target.value === "long_short" ? "long_short" : "long_only",
                  })
                }
              >
                <option value="long_only">{t.quant.longOnly}</option>
                <option value="long_short">{t.quant.longShort}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t.quant.riskTolerance}</span>
              <select
                className="btn-lang text-left normal-case"
                value={config.riskTolerance}
                onChange={(e) =>
                  setConfig(strategyId, {
                    riskTolerance:
                      e.target.value === "conservative" ||
                      e.target.value === "aggressive"
                        ? e.target.value
                        : "balanced",
                  })
                }
              >
                <option value="conservative">{t.quant.conservative}</option>
                <option value="balanced">{t.quant.balanced}</option>
                <option value="aggressive">{t.quant.aggressive}</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t.quant.targetVol}</span>
              <input
                className="btn-lang"
                type="number"
                min={6}
                max={20}
                step={0.5}
                value={(config.targetVol * 100).toFixed(2)}
                onChange={(e) =>
                  setConfig(strategyId, {
                    targetVol: Number(e.target.value) / 100,
                  })
                }
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t.quant.grossExposureCap}</span>
              <input
                className="btn-lang"
                type="number"
                min={30}
                max={130}
                step={1}
                value={(config.grossExposureCap * 100).toFixed(0)}
                onChange={(e) =>
                  setConfig(strategyId, {
                    grossExposureCap: Number(e.target.value) / 100,
                  })
                }
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t.quant.netExposureMin}</span>
              <input
                className="btn-lang"
                type="number"
                min={-30}
                max={100}
                step={1}
                value={(config.netExposureMin * 100).toFixed(0)}
                onChange={(e) =>
                  setConfig(strategyId, {
                    netExposureMin: Number(e.target.value) / 100,
                  })
                }
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-text-muted">{t.quant.netExposureMax}</span>
              <input
                className="btn-lang"
                type="number"
                min={-30}
                max={100}
                step={1}
                value={(config.netExposureMax * 100).toFixed(0)}
                onChange={(e) =>
                  setConfig(strategyId, {
                    netExposureMax: Number(e.target.value) / 100,
                  })
                }
              />
            </label>

            {strategyId === "quant-volatility-target-overlay" && (
              <label className="flex flex-col gap-1">
                <span className="text-text-muted">{t.quant.overlayBase}</span>
                <select
                  className="btn-lang text-left normal-case"
                  value={overlayBase}
                  onChange={(e) =>
                    setOverlayBase(
                      e.target.value as Exclude<
                        QuantStrategyId,
                        "quant-volatility-target-overlay"
                      >
                    )
                  }
                >
                  {OVERLAY_OPTIONS.map((id) => (
                    <option key={id} value={id}>
                      {t.modules[id]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        <div className="mt-3 text-[0.65rem] text-text-muted">{t.quant.runHint}</div>
      </section>

      {runState.error && (
        <div className="text-red-accent text-sm border border-red-accent/30 bg-red-accent/5 p-3 rounded">
          <strong>Error:</strong> {runState.error}
        </div>
      )}

      {runState.isLoading && (
        <div className="text-text-muted text-xs animate-pulse">● {t.loading}</div>
      )}

      {!signal && !runState.isLoading && !runState.error && (
        <div className="text-text-muted text-sm">{t.quant.noData}</div>
      )}

      {signal && (
        <section className="border border-border bg-bg-secondary p-4 rounded">
          <h2 className="text-sm text-green-accent font-semibold mb-2">{t.quant.signal}</h2>
          <div className="text-xs text-text-muted mb-2">
            {t.quant.strategy}: {t.modules[signal.strategyId]} · {t.quant.asOf}: {signal.asOfDate} · {t.quant.universeVersion}: {signal.universeVersion}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
            <div>
              <h3 className="text-xs text-green-accent mb-1">{t.quant.requested}</h3>
              <div className="text-xs">
                {configRows(signal.requestedConfig).map(([k, v]) => (
                  <div key={`req-${k}`} className="flex justify-between gap-3 border-b border-border/40 py-0.5">
                    <span className="text-text-muted">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs text-green-accent mb-1">{t.quant.effective}</h3>
              <div className="text-xs">
                {configRows(signal.effectiveConfig).map(([k, v]) => (
                  <div key={`eff-${k}`} className="flex justify-between gap-3 border-b border-border/40 py-0.5">
                    <span className="text-text-muted">{k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {signal.adjustments.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs text-green-accent mb-1">{t.quant.adjustments}</h3>
              <ul className="text-xs text-text-muted list-disc pl-4">
                {signal.adjustments.map((item, idx) => (
                  <li key={`${item.field}-${idx}`}>
                    <strong>{item.field}</strong>: {String(item.requested)} → {String(item.applied)} ({item.reason})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-3">
            <h3 className="text-xs text-green-accent mb-1">{t.quant.actions}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border p-1 text-left">{t.quant.ticker}</th>
                    <th className="border border-border p-1 text-left">{t.quant.action}</th>
                    <th className="border border-border p-1 text-left">{t.quant.targetWeight}</th>
                  </tr>
                </thead>
                <tbody>
                  {signal.actions.map((item) => (
                    <tr key={`${item.ticker}-${item.action}`}>
                      <td className="border border-border p-1">{item.ticker}</td>
                      <td className="border border-border p-1">{item.action}</td>
                      <td className="border border-border p-1">{pct(item.targetWeight)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="border border-border p-2 rounded">
              <div className="text-text-muted">{t.quant.expVol}</div>
              <div className="text-green-accent">{pct(signal.risk.expVol)}</div>
            </div>
            <div className="border border-border p-2 rounded">
              <div className="text-text-muted">{t.quant.expBeta}</div>
              <div className="text-green-accent">{signal.risk.expBetaToSPY.toFixed(2)}</div>
            </div>
            <div className="border border-border p-2 rounded">
              <div className="text-text-muted">{t.quant.concentration}</div>
              <div className="text-green-accent">{pct(signal.risk.concentrationTop5)}</div>
            </div>
          </div>

          {signal.notes.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs text-green-accent mb-1">{t.quant.notes}</h3>
              <ul className="text-xs text-text-muted list-disc pl-4">
                {signal.notes.map((note, idx) => (
                  <li key={`${note}-${idx}`}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {backtest && (
        <section className="border border-border bg-bg-secondary p-4 rounded">
          <h2 className="text-sm text-green-accent font-semibold mb-2">{t.quant.backtest}</h2>
          <div className="text-xs text-text-muted mb-2">
            {backtest.startDate} → {backtest.endDate}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-3">
            <div className="border border-border p-2 rounded"><div className="text-text-muted">{t.quant.cagr}</div><div>{pct(backtest.metrics.cagr)}</div></div>
            <div className="border border-border p-2 rounded"><div className="text-text-muted">{t.quant.sharpe}</div><div>{backtest.metrics.sharpe.toFixed(2)}</div></div>
            <div className="border border-border p-2 rounded"><div className="text-text-muted">{t.quant.sortino}</div><div>{backtest.metrics.sortino.toFixed(2)}</div></div>
            <div className="border border-border p-2 rounded"><div className="text-text-muted">{t.quant.maxDrawdown}</div><div>{pct(backtest.metrics.maxDrawdown)}</div></div>
            <div className="border border-border p-2 rounded"><div className="text-text-muted">{t.quant.calmar}</div><div>{backtest.metrics.calmar.toFixed(2)}</div></div>
            <div className="border border-border p-2 rounded"><div className="text-text-muted">{t.quant.turnover}</div><div>{backtest.metrics.turnover.toFixed(2)}</div></div>
          </div>

          <div className="text-xs text-text-muted mb-3">
            {t.quant.benchmark}: {pct(backtest.benchmark.metrics.cagr)} CAGR · Sharpe {backtest.benchmark.metrics.sharpe.toFixed(2)}
          </div>

          {backtest.yearlyReturns.length > 0 && (
            <div className="mb-3">
              <h3 className="text-xs text-green-accent mb-1">{t.quant.yearlyReturns}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-border p-1 text-left">Year</th>
                      <th className="border border-border p-1 text-left">Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.yearlyReturns.map((item) => (
                      <tr key={item.year}>
                        <td className="border border-border p-1">{item.year}</td>
                        <td className="border border-border p-1">{pct(item.ret)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-text-muted">
            {t.quant.longCost}: {backtest.assumptions.longCostBps} · {t.quant.shortCost}: {backtest.assumptions.shortCostBps} · {t.quant.borrowCost}: {pct(backtest.assumptions.shortBorrowAnnual)}
          </div>

          {backtest.sources.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs text-green-accent mb-1">{t.quant.sources}</h3>
              <ul className="text-xs text-text-muted list-disc pl-4">
                {backtest.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
