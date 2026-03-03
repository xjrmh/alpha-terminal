"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useExpertMode } from "@/lib/expert/context";
import { useQuantSettings } from "@/lib/quant/settings-context";
import { runAll, getRunAllState } from "@/lib/analysis/run-all";

export default function Home() {
  const { lang, t } = useLanguage();
  const { modelId, getProviderApiKeyForModel } = useModel();
  const { available: expertAvailable, enabled: expertEnabled } = useExpertMode();
  const { getConfig } = useQuantSettings();
  const autoRunFired = useRef(false);

  useEffect(() => {
    if (autoRunFired.current) return;
    if (getRunAllState().isRunning) return;
    autoRunFired.current = true;

    const timer = setTimeout(() => {
      runAll({
        language: lang,
        modelId,
        providerApiKey: getProviderApiKeyForModel(modelId),
        expertMode: expertAvailable && expertEnabled,
        getQuantConfig: getConfig,
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [lang, modelId, getProviderApiKeyForModel, expertAvailable, expertEnabled, getConfig]);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-green-accent text-lg font-bold mb-1">
            {t.welcome}
          </h1>
          <p className="text-text-muted text-xs">{t.welcomeDesc}</p>
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map((mod) => (
            <Link
              key={mod.id}
              href={`/modules/${mod.slug}`}
              className="group block p-4 border border-border bg-bg-secondary
                         hover:border-green-accent hover:bg-bg-surface
                         transition-all duration-200 no-underline"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-accent text-sm opacity-60 group-hover:opacity-100 transition-opacity">
                  {mod.icon}
                </span>
                <span className="text-text-primary text-sm font-semibold group-hover:text-green-accent transition-colors">
                  {t.modules[mod.nameKey]}
                </span>
              </div>
              <p className="text-text-muted text-xs leading-relaxed">
                {t.moduleDescriptions[mod.nameKey]}
              </p>
            </Link>
          ))}
        </div>      </div>
    </div>
  );
}
