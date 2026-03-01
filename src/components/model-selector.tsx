"use client";

import { MODELS } from "@/lib/ai/models";
import { useLanguage } from "@/lib/i18n/context";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const { t } = useLanguage();

  const grouped = {
    openai: MODELS.filter((m) => m.provider === "openai"),
    anthropic: MODELS.filter((m) => m.provider === "anthropic"),
    google: MODELS.filter((m) => m.provider === "google"),
  };

  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={t.selectModel}
        className="btn-lang btn-top btn-top-select appearance-none max-w-28 truncate cursor-pointer outline-none
                   [&::-ms-expand]:hidden"
      >
        <optgroup label="OpenAI">
          {grouped.openai.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Anthropic">
          {grouped.anthropic.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Google">
          {grouped.google.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      </select>
      <span className="absolute right-1.5 pointer-events-none text-text-muted text-[0.5rem]">
        ▼
      </span>
    </div>
  );
}
