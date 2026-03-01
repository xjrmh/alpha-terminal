"use client";

import { useTheme, type ThemeMode } from "@/lib/theme/context";
import { useLanguage } from "@/lib/i18n/context";

const icons: Record<ThemeMode, string> = {
  light: "☀",
  dark: "☾",
  auto: "◐",
};

export function ThemeToggle() {
  const { mode, cycleMode } = useTheme();
  const { t } = useLanguage();

  const labels: Record<ThemeMode, string> = {
    light: t.themeLight,
    dark: t.themeDark,
    auto: t.themeAuto,
  };

  return (
    <button
      className="btn-lang btn-top"
      onClick={cycleMode}
      title={`${t.theme}: ${labels[mode]}`}
    >
      {icons[mode]} {labels[mode]}
    </button>
  );
}
