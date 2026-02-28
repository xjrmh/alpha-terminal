"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES } from "@/lib/modules";
import { useLanguage } from "@/lib/i18n/context";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg-secondary flex flex-col overflow-hidden">
      <div className="h-15 flex items-center px-4 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-1.5 no-underline"
        >
          <span className="text-green-accent text-xs font-bold tracking-widest uppercase">
            {t.appTitle}
          </span>
          <span className="terminal-cursor" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        {MODULES.map((mod) => {
          const href = `/modules/${mod.slug}`;
          const isActive = pathname === href;

          return (
            <Link
              key={mod.id}
              href={href}
              className={`nav-item ${isActive ? "nav-item-active" : ""}`}
            >
              <span className="text-xs opacity-60">{mod.icon}</span>
              <span>{t.modules[mod.nameKey]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-border">
        <div className="text-text-muted text-[0.6rem] tracking-wide uppercase">
          v1.0 · {t.ready}
        </div>
      </div>
    </aside>
  );
}
