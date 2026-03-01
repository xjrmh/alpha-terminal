"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import type { ModuleId, NarrativeModuleId } from "@/types";

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
  const { registerOnRun, setIsLoading, setShowRefreshCta } = useAnalysis();
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
  const [activeRunKey, setActiveRunKey] = useState(() =>
    buildRunKey(effectiveExpertMode)
  );
  const [runState, setRunState] = useState(() =>
    getNarrativeRunState(buildRunKey(effectiveExpertMode))
  );
  const showScan = !runState.completion && !runState.error;
  const hasAnalysis = Boolean(runState.completion);

  const runCurrentNarrative = useCallback(() => {
    void runNarrativeAnalysis({
      moduleId,
      language: lang,
      modelId,
      providerApiKey: getProviderApiKeyForModel(modelId),
      expertMode: effectiveExpertMode,
    });
  }, [
    moduleId,
    lang,
    modelId,
    getProviderApiKeyForModel,
    effectiveExpertMode,
  ]);

  const handleRun = useCallback(() => {
    const runKey = buildRunKey(effectiveExpertMode);
    setActiveRunKey(runKey);
    setRunState(getNarrativeRunState(runKey));
    setShowRefreshCta(false);
    setApiKeyError(null);
    runCurrentNarrative();
  }, [
    buildRunKey,
    effectiveExpertMode,
    runCurrentNarrative,
    setApiKeyError,
    setShowRefreshCta,
  ]);

  useEffect(() => {
    registerOnRun(handleRun, { requiresModelCredentials: true });
    return () => registerOnRun(null, { requiresModelCredentials: true });
  }, [handleRun, registerOnRun]);

  useEffect(() => {
    return subscribeNarrativeRun(activeRunKey, setRunState);
  }, [activeRunKey]);

  useEffect(() => {
    const moduleChanged = prevModuleIdRef.current !== moduleId;
    const langChanged = prevLangRef.current !== lang;
    const modelChanged = prevModelIdRef.current !== modelId;
    const expertChanged = prevExpertModeRef.current !== effectiveExpertMode;

    const shouldPreserveCurrentOutput =
      hasAnalysis &&
      !moduleChanged &&
      !langChanged &&
      (modelChanged || expertChanged);

    if (shouldPreserveCurrentOutput) {
      return;
    }

    const nextKey = buildRunKey(effectiveExpertMode);
    const timer = window.setTimeout(() => {
      setActiveRunKey(nextKey);
      setRunState(getNarrativeRunState(nextKey));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [
    buildRunKey,
    effectiveExpertMode,
    hasAnalysis,
    lang,
    modelId,
    moduleId,
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
    if (runState.completion || runState.isLoading || runState.error) return;
    if (!hasRequiredApiKey(modelId)) return;
    runCurrentNarrative();
  }, [
    hasRequiredApiKey,
    modelId,
    runCurrentNarrative,
    runState.completion,
    runState.isLoading,
    runState.error,
  ]);

  useEffect(() => {
    const desiredKey = buildRunKey(effectiveExpertMode);
    setShowRefreshCta(hasAnalysis && desiredKey !== activeRunKey);
  }, [activeRunKey, buildRunKey, effectiveExpertMode, hasAnalysis, setShowRefreshCta]);

  useEffect(() => {
    prevModuleIdRef.current = moduleId;
    prevLangRef.current = lang;
    prevModelIdRef.current = modelId;
    prevExpertModeRef.current = effectiveExpertMode;
  }, [effectiveExpertMode, lang, modelId, moduleId]);

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
