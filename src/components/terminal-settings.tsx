"use client";

import { useCallback, useMemo } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { getModelProvider } from "@/lib/ai/models";
import { ModelSelector } from "./model-selector";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";
import { ExpertToggle } from "./expert-toggle";

interface TerminalSettingsProps {
  className?: string;
  showApiError?: boolean;
}

export function TerminalSettings({
  className = "",
  showApiError = false,
}: TerminalSettingsProps) {
  const { t } = useLanguage();
  const {
    modelId,
    setModelId,
    hasRequiredApiKey,
    promptForModelApiKey,
    apiKeyError,
    setApiKeyError,
  } = useModel();

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
    <div className={`flex items-center gap-2 ${className}`.trim()}>
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
      {showApiError && apiKeyError && (
        <span className="w-full text-red-accent text-xs">
          {apiKeyError}
        </span>
      )}
    </div>
  );
}
