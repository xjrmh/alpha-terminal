"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useAnalysis } from "@/lib/analysis/context";
import { useExpertMode } from "@/lib/expert/context";
import { useQuantSettings } from "@/lib/quant/settings-context";
import {
  runAll,
  cancelRunAll,
  getRunAllState,
  subscribeRunAll,
} from "@/lib/analysis/run-all";
import { TerminalSettings } from "./terminal-settings";

interface TerminalHeaderProps {
  mobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export function TerminalHeader({
  mobileMenuOpen = false,
  onToggleMobileMenu,
}: TerminalHeaderProps) {
  const { lang, t } = useLanguage();
  const {
    modelId,
    hasRequiredApiKey,
    getProviderApiKeyForModel,
    apiKeyError,
  } = useModel();
  const { onRun, isLoading, requiresModelCredentials, showRefreshCta } = useAnalysis();
  const { available: expertAvailable, enabled: expertEnabled } = useExpertMode();
  const expertMode = expertAvailable && expertEnabled;
  const { getConfig } = useQuantSettings();

  const [runAllState, setRunAllState] = useState(() => getRunAllState());

  useEffect(() => {
    return subscribeRunAll(setRunAllState);
  }, []);

  const handleRunAll = useCallback(() => {
    void runAll({
      language: lang,
      modelId,
      providerApiKey: getProviderApiKeyForModel(modelId),
      expertMode,
      getQuantConfig: getConfig,
    });
  }, [lang, modelId, getProviderApiKeyForModel, expertMode, getConfig]);

  const handleCancelRunAll = useCallback(() => {
    cancelRunAll();
  }, []);

  const runDisabledByApiKey =
    requiresModelCredentials && !hasRequiredApiKey(modelId);

  const apiKeyMissing = !hasRequiredApiKey(modelId);
  const currentModuleName = runAllState.currentModuleId
    ? t.modules[runAllState.currentModuleId as keyof typeof t.modules]
    : null;

  return (
    <header className="h-15 flex items-center justify-between gap-3 px-3 sm:px-6 border-b border-border bg-bg-secondary">
      <div className="min-w-0 flex items-center gap-2">
        {onToggleMobileMenu && (
          <button
            type="button"
            className="btn-lang btn-top md:hidden !px-2.5"
            onClick={onToggleMobileMenu}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <span className="flex h-3 w-3 flex-col justify-between">
              <span className="block h-0.5 w-full bg-current" />
              <span className="block h-0.5 w-full bg-current" />
              <span className="block h-0.5 w-full bg-current" />
            </span>
          </button>
        )}
        {onRun ? (
          <>
            <button
              className={`btn-run ${showRefreshCta ? "btn-run-refresh" : ""}`}
              onClick={onRun}
              disabled={isLoading || runDisabledByApiKey}
              title={runDisabledByApiKey ? t.modelApiKeyRequired : undefined}
            >
              {isLoading
                ? t.loading
                : showRefreshCta
                  ? t.refreshAnalysis
                  : t.runAnalysis}
            </button>
            {!isLoading && runDisabledByApiKey && (
              <span className="text-red-accent text-xs">{t.modelApiKeyRequired}</span>
            )}
            {apiKeyError && (
              <span className="text-red-accent text-xs truncate max-w-72">
                {apiKeyError}
              </span>
            )}
          </>
        ) : runAllState.isRunning ? (
          <>
            <button className="btn-run" onClick={handleCancelRunAll}>
              {t.runAllCancel}
            </button>
            <span className="text-text-muted text-xs tracking-wide truncate">
              {currentModuleName
                ? `${currentModuleName}… ${runAllState.completedCount}/${runAllState.totalCount}`
                : `${runAllState.completedCount}/${runAllState.totalCount}`}
            </span>
          </>
        ) : (
          <>
            <button
              className="btn-run"
              onClick={handleRunAll}
              disabled={apiKeyMissing}
              title={apiKeyMissing ? t.modelApiKeyRequired : undefined}
            >
              {t.runAllAnalysis}
            </button>
            {apiKeyMissing && (
              <span className="text-red-accent text-xs">{t.modelApiKeyRequired}</span>
            )}
          </>
        )}
      </div>
      <TerminalSettings className="hidden md:flex" />
    </header>
  );
}
