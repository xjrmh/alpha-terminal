"use client";

import { useCallback, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useAnalysis } from "@/lib/analysis/context";
import { getModelProvider } from "@/lib/ai/models";
import { ModelSelector } from "./model-selector";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";
import { ExpertToggle } from "./expert-toggle";

export function TerminalHeader() {
  const { t } = useLanguage();
  const {
    modelId,
    setModelId,
    hasRequiredApiKey,
    promptForModelApiKey,
    apiKeyError,
    setApiKeyError,
  } = useModel();
  const { onRun, isLoading, requiresModelCredentials, showRefreshCta } = useAnalysis();

  const runDisabledByApiKey =
    requiresModelCredentials && !hasRequiredApiKey(modelId);

  const handleModelChange = useCallback(
    async (nextModelId: string) => {
      setModelId(nextModelId);
      if (!hasRequiredApiKey(nextModelId)) {
        const ok = await promptForModelApiKey(nextModelId);
        if (!ok) {
          setApiKeyError(t.modelApiKeyRequired);
        }
      } else {
        setApiKeyError(null);
      }
    },
    [hasRequiredApiKey, promptForModelApiKey, setApiKeyError, setModelId, t.modelApiKeyRequired]
  );

  const handleSetKey = useCallback(async () => {
    const ok = await promptForModelApiKey(modelId);
    if (!ok) {
      setApiKeyError(t.modelApiKeyRequired);
    } else {
      setApiKeyError(null);
    }
  }, [modelId, promptForModelApiKey, setApiKeyError, t.modelApiKeyRequired]);

  const showSetApiKeyButton = useMemo(
    () => getModelProvider(modelId) !== "openai",
    [modelId]
  );

  return (
    <header className="h-15 flex items-center justify-between px-4 border-b border-border bg-bg-secondary">
      <div className="flex items-center gap-2">
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
            {isLoading && (
              <span className="text-text-muted text-xs animate-pulse">
                ● {t.loading}
              </span>
            )}
            {!isLoading && runDisabledByApiKey && (
              <span className="text-red-accent text-xs">{t.modelApiKeyRequired}</span>
            )}
            {apiKeyError && (
              <span className="text-red-accent text-xs truncate max-w-72">
                {apiKeyError}
              </span>
            )}
          </>
        ) : (
          <span className="text-text-muted text-xs tracking-wide">
            {t.appSubtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ModelSelector
          value={modelId}
          onChange={(nextModelId) => {
            void handleModelChange(nextModelId);
          }}
        />
        {showSetApiKeyButton && (
          <button
            className="btn-lang btn-top"
            onClick={() => {
              void handleSetKey();
            }}
          >
            {t.setApiKey}
          </button>
        )}
        <ExpertToggle />
        <ThemeToggle />
        <LangToggle />
      </div>
    </header>
  );
}
