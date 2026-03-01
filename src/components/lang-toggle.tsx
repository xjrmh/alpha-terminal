"use client";

import { useLanguage } from "@/lib/i18n/context";

export function LangToggle() {
  const { lang, toggleLang } = useLanguage();

  return (
    <button className="btn-lang btn-top" onClick={toggleLang}>
      {lang === "en" ? "EN → 中" : "中 → EN"}
    </button>
  );
}
