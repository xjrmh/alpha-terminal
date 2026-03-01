"use client";

import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useAnalysis } from "@/lib/analysis/context";
import { TerminalSettings } from "./terminal-settings";

interface TerminalHeaderProps {
  mobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export function TerminalHeader({
  mobileMenuOpen = false,
  onToggleMobileMenu,
}: TerminalHeaderProps) {
  const { t } = useLanguage();
  const {
    modelId,
    hasRequiredApiKey,
    apiKeyError,
  } = useModel();
  const { onRun, isLoading, requiresModelCredentials, showRefreshCta } = useAnalysis();

  const runDisabledByApiKey =
    requiresModelCredentials && !hasRequiredApiKey(modelId);

  return (
    <header className="h-15 flex items-center justify-between gap-3 px-3 sm:px-4 border-b border-border bg-bg-secondary">
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
        ) : (
          <span className="text-text-muted text-xs tracking-wide truncate">
            {t.appSubtitle}
          </span>
        )}
      </div>
      <TerminalSettings className="hidden md:flex" />
    </header>
  );
}
