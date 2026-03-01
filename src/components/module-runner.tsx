"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useAnalysis } from "@/lib/analysis/context";
import { isQuantStrategyId } from "@/lib/modules";
import {
  getNarrativeRunKey,
  getNarrativeRunState,
  runNarrativeAnalysis,
  subscribeNarrativeRun,
} from "@/lib/analysis/narrative-runner";
import { MarkdownRenderer } from "./markdown-renderer";
import { SkeletonLoader } from "./skeleton-loader";
import { QuantModuleRunner } from "./quant-module-runner";
import type { ModuleId, NarrativeModuleId } from "@/types";

interface ModuleRunnerProps {
  moduleId: ModuleId;
}

function NarrativeModuleRunner({ moduleId }: { moduleId: NarrativeModuleId }) {
  const { lang, t } = useLanguage();
  const { modelId } = useModel();
  const { registerOnRun, setIsLoading } = useAnalysis();
  const runKey = useMemo(
    () =>
      getNarrativeRunKey({
        moduleId,
        language: lang,
        modelId,
      }),
    [moduleId, lang, modelId]
  );
  const [runState, setRunState] = useState(() => getNarrativeRunState(runKey));
  const showScan = !runState.completion && !runState.error;

  const handleRun = useCallback(() => {
    void runNarrativeAnalysis({
      moduleId,
      language: lang,
      modelId,
    });
  }, [moduleId, lang, modelId]);

  useEffect(() => {
    registerOnRun(handleRun);
    return () => registerOnRun(null);
  }, [handleRun, registerOnRun]);

  useEffect(() => {
    return subscribeNarrativeRun(runKey, setRunState);
  }, [runKey]);

  useEffect(() => {
    setIsLoading(runState.isLoading);
  }, [runState.isLoading, setIsLoading]);

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

  return <NarrativeModuleRunner moduleId={moduleId} />;
}
