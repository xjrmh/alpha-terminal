"use client";

import { useExpertMode } from "@/lib/expert/context";
import { useLanguage } from "@/lib/i18n/context";

export function ExpertToggle() {
  const { available, enabled, toggle } = useExpertMode();
  const { t } = useLanguage();

  if (!available) return null;

  return (
    <button
      className={`btn-lang btn-top ${enabled ? "btn-lang-active" : ""}`}
      onClick={toggle}
      title={enabled ? t.expertModeOn : t.expertModeOff}
    >
      {enabled ? t.expertOn : t.expertOff}
    </button>
  );
}
