"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { TerminalHeader } from "@/components/terminal-header";
import { TerminalSettings } from "@/components/terminal-settings";

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/45 md:hidden"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[86vw] flex-col border-r border-border bg-bg-secondary md:hidden">
            <Sidebar mobile onNavigate={() => setMobileMenuOpen(false)} />
            <div className="border-t border-border p-4">
              <TerminalSettings className="flex-wrap" showApiError />
            </div>
          </aside>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TerminalHeader
          mobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
