"use client";

import Link from "next/link";
import { MODULES } from "@/lib/modules";
import { useLanguage } from "@/lib/i18n/context";

export default function Home() {
  const { t } = useLanguage();

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
        </div>

        {/* Footer info */}
        <div className="mt-8 pt-4 border-t border-border text-text-muted text-[0.6rem] tracking-wide">
          <span className="text-green-accent">◆</span> {t.appTitle} ·{" "}
          {t.appSubtitle}
        </div>
      </div>
    </div>
  );
}
