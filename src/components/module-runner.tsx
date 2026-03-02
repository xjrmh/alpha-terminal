"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useAnalysis } from "@/lib/analysis/context";
import { useExpertMode } from "@/lib/expert/context";
import { isQuantStrategyId, isWatchlistModuleId } from "@/lib/modules";
import {
  getNarrativeRunKey,
  getNarrativeRunState,
  runNarrativeAnalysis,
  subscribeNarrativeRun,
} from "@/lib/analysis/narrative-runner";
import { MarkdownRenderer } from "./markdown-renderer";
import { SkeletonLoader } from "./skeleton-loader";
import { QuantModuleRunner } from "./quant-module-runner";
import { WatchlistModuleRunner } from "./watchlist-module-runner";
import type { AnalysisRunMode, ModuleId, NarrativeModuleId } from "@/types";

interface ModuleRunnerProps {
  moduleId: ModuleId;
}

function NarrativeModuleRunner({ moduleId }: { moduleId: NarrativeModuleId }) {
  const { lang, t } = useLanguage();
  const {
    modelId,
    getProviderApiKeyForModel,
    hasRequiredApiKey,
    setApiKeyError,
  } = useModel();
  const { registerOnRun, setIsLoading, setRunButtonState } = useAnalysis();
  const { available: expertAvailable, enabled: expertEnabled } = useExpertMode();
  const effectiveExpertMode = expertAvailable && expertEnabled;
  const prevModuleIdRef = useRef(moduleId);
  const prevLangRef = useRef(lang);
  const prevModelIdRef = useRef(modelId);
  const prevExpertModeRef = useRef(effectiveExpertMode);

  const buildRunKey = useCallback(
    (expertMode: boolean) =>
      getNarrativeRunKey({
        moduleId,
        language: lang,
        modelId,
        expertMode,
      }),
    [moduleId, lang, modelId]
  );

  const desiredRunKey = useMemo(
    () => buildRunKey(effectiveExpertMode),
    [buildRunKey, effectiveExpertMode]
  );

  const [activeRunKey, setActiveRunKey] = useState(desiredRunKey);
  const [runState, setRunState] = useState(() => getNarrativeRunState(desiredRunKey));
  const [desiredState, setDesiredState] = useState(() =>
    getNarrativeRunState(desiredRunKey)
  );

  const runCurrentNarrative = useCallback(
    (mode: AnalysisRunMode) => {
      void runNarrativeAnalysis({
        moduleId,
        language: lang,
        modelId,
        providerApiKey: getProviderApiKeyForModel(modelId),
        expertMode: effectiveExpertMode,
        mode,
      });
    },
    [
      moduleId,
      lang,
      modelId,
      getProviderApiKeyForModel,
      effectiveExpertMode,
    ]
  );

  const handleRun = useCallback(() => {
    const mode: AnalysisRunMode = desiredState.completion ? "refresh" : "auto";
    setActiveRunKey(desiredRunKey);
    setRunState(getNarrativeRunState(desiredRunKey));
    setApiKeyError(null);
    runCurrentNarrative(mode);
  }, [desiredRunKey, desiredState.completion, runCurrentNarrative, setApiKeyError]);

  useEffect(() => {
    registerOnRun(handleRun, { requiresModelCredentials: true });
    return () => registerOnRun(null, { requiresModelCredentials: true });
  }, [handleRun, registerOnRun]);

  useEffect(() => {
    return subscribeNarrativeRun(activeRunKey, setRunState);
  }, [activeRunKey]);

  useEffect(() => {
    return subscribeNarrativeRun(desiredRunKey, setDesiredState);
  }, [desiredRunKey]);

  useEffect(() => {
    if (desiredState.cache || desiredState.isLoading || desiredState.error) return;
    if (!hasRequiredApiKey(modelId)) return;
    runCurrentNarrative("cache_only");
  }, [
    desiredState.cache,
    desiredState.error,
    desiredState.isLoading,
    hasRequiredApiKey,
    modelId,
    runCurrentNarrative,
  ]);

  useEffect(() => {
    const moduleChanged = prevModuleIdRef.current !== moduleId;
    const langChanged = prevLangRef.current !== lang;
    const modelChanged = prevModelIdRef.current !== modelId;
    const expertChanged = prevExpertModeRef.current !== effectiveExpertMode;
    const hasAnalysis = Boolean(runState.completion);

    const shouldPreserveCurrentOutput =
      hasAnalysis &&
      !moduleChanged &&
      !langChanged &&
      (modelChanged || expertChanged);

    if (shouldPreserveCurrentOutput) return;

    const timer = window.setTimeout(() => {
      setActiveRunKey(desiredRunKey);
      setRunState(getNarrativeRunState(desiredRunKey));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    desiredRunKey,
    effectiveExpertMode,
    lang,
    modelId,
    moduleId,
    runState.completion,
  ]);

  useEffect(() => {
    setIsLoading(runState.isLoading);
  }, [runState.isLoading, setIsLoading]);

  useEffect(() => {
    if (!runState.error) return;
    if (/api key|unauthorized|authentication|invalid key|permission/i.test(runState.error)) {
      setApiKeyError(runState.error);
    }
  }, [runState.error, setApiKeyError]);

  useEffect(() => {
    if (activeRunKey !== desiredRunKey) return;
    if (runState.completion || runState.isLoading || runState.error) return;
    if (!hasRequiredApiKey(modelId)) return;
    runCurrentNarrative("auto");
  }, [
    activeRunKey,
    desiredRunKey,
    hasRequiredApiKey,
    modelId,
    runCurrentNarrative,
    runState.completion,
    runState.error,
    runState.isLoading,
  ]);

  useEffect(() => {
    setRunButtonState({
      hasResult: Boolean(desiredState.completion),
      refreshEligibleAt: desiredState.cache?.refreshEligibleAt ?? null,
      secondsUntilRefresh: desiredState.cache?.secondsUntilRefresh ?? 0,
      cacheEnabled: desiredState.cache?.cacheEnabled ?? true,
    });
  }, [desiredState.cache, desiredState.completion, setRunButtonState]);

  useEffect(() => {
    prevModuleIdRef.current = moduleId;
    prevLangRef.current = lang;
    prevModelIdRef.current = modelId;
    prevExpertModeRef.current = effectiveExpertMode;
  }, [effectiveExpertMode, lang, modelId, moduleId]);

  const showScan = !runState.completion && !runState.error;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 relative">
        {showScan && <div className="terminal-scan" />}

        {runState.error && (
          <div className="text-red-accent text-sm border border-red-accent/30 bg-red-accent/5 p-4 rounded">
            <strong>Error:</strong> {runState.error}
          </div>
        )}

        {runState.isLoading && !runState.completion && <SkeletonLoader />}

        {runState.completion && (
          <div className="module-output">
            <MarkdownRenderer content={runState.completion} />
          </div>
        )}

        {!runState.completion && !runState.isLoading && !runState.error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-muted">
              <div className="text-2xl mb-2 opacity-30">◈</div>
              <div className="text-sm">{t.modules[moduleId]}</div>
              <div className="text-xs mt-1 opacity-60">
                {t.moduleDescriptions[moduleId]}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ModuleRunner({ moduleId }: ModuleRunnerProps) {
  if (isQuantStrategyId(moduleId)) {
    return <QuantModuleRunner strategyId={moduleId} />;
  }

  if (isWatchlistModuleId(moduleId)) {
    return <WatchlistModuleRunner />;
  }

  return <NarrativeModuleRunner moduleId={moduleId} />;
}
