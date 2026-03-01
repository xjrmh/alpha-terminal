"use client";

import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useAnalysis } from "@/lib/analysis/context";
import { ModelSelector } from "./model-selector";
import { LangToggle } from "./lang-toggle";
import { ThemeToggle } from "./theme-toggle";
import { ExpertToggle } from "./expert-toggle";

export function TerminalHeader() {
  const { t } = useLanguage();
  const { modelId, setModelId } = useModel();
  const { onRun, isLoading } = useAnalysis();

  return (
    <header className="h-15 flex items-center justify-between px-4 border-b border-border bg-bg-secondary">
      <div className="flex items-center gap-2">
        {onRun ? (
          <>
            <button
              className="btn-run"
              onClick={onRun}
              disabled={isLoading}
            >
              {isLoading ? t.loading : t.runAnalysis}
            </button>
            {isLoading && (
              <span className="text-text-muted text-xs animate-pulse">
                ● {t.loading}
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
        <ModelSelector value={modelId} onChange={setModelId} />
        <ExpertToggle />
        <ThemeToggle />
        <LangToggle />
      </div>
    </header>
  );
}
