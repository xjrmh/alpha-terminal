"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NARRATIVE_MODULES, QUANT_MODULES } from "@/lib/modules";
import { isQuantModulesEnabled } from "@/lib/features";
import { useLanguage } from "@/lib/i18n/context";
import { useModuleStatus } from "@/hooks/use-module-completion";
import type { ModuleInfo } from "@/types";

const narrativeOnly = NARRATIVE_MODULES.filter((m) => m.kind === "narrative");
const scanners = NARRATIVE_MODULES.filter((m) => m.kind === "watchlist");

const NAV_GROUPS: { key: "intelligence" | "scanners" | "quant"; modules: ModuleInfo[] }[] = [
  { key: "intelligence", modules: narrativeOnly },
  { key: "scanners", modules: scanners },
  ...(isQuantModulesEnabled()
    ? [{ key: "quant" as const, modules: QUANT_MODULES }]
    : []),
];

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { completedIds, loadingIds } = useModuleStatus();

  return (
    <aside
      className={
        mobile
          ? "h-full w-full border-r border-border bg-bg-secondary flex flex-col overflow-hidden"
          : "w-66 shrink-0 border-r border-border bg-bg-secondary flex flex-col overflow-hidden"
      }
    >
      <div className="h-15 flex items-center px-4 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-1.5 no-underline"
          onClick={onNavigate}
        >
          <span className="text-green-accent text-sm font-bold tracking-widest uppercase">
            {t.appTitle}
          </span>
          <span className="terminal-cursor" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.key}>
            <div className="px-4 pt-3 pb-1 text-text-muted text-[0.6rem] tracking-wider uppercase">
              {t.navGroups[group.key]}
            </div>
            {group.modules.map((mod) => {
              const href = `/modules/${mod.slug}`;
              const isActive = pathname === href;

              return (
                <Link
                  key={mod.id}
                  href={href}
                  className={`nav-item ${isActive ? "nav-item-active" : ""}`}
                  onClick={onNavigate}
                >
                  <span className="text-xs opacity-60">{mod.icon}</span>
                  <span>{t.modules[mod.nameKey]}</span>
                  {loadingIds.has(mod.id) ? (
                    <span
                      className="ml-auto w-1.5 h-1.5 rounded-full shrink-0 nav-dot-loading"
                      style={{ backgroundColor: "var(--amber-accent)" }}
                    />
                  ) : completedIds.has(mod.id) ? (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-accent opacity-50 shrink-0" />
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <div className="text-text-muted text-[0.6rem] tracking-wide uppercase">
          v1.0 · {t.ready}
        </div>
      </div>
    </aside>
  );
}
