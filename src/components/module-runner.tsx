"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useAnalysis } from "@/lib/analysis/context";
import { MarkdownRenderer } from "./markdown-renderer";
import { SkeletonLoader } from "./skeleton-loader";
import type { ModuleId } from "@/types";

interface ModuleRunnerProps {
  moduleId: ModuleId;
}

export function ModuleRunner({ moduleId }: ModuleRunnerProps) {
  const { lang, t } = useLanguage();
  const { modelId } = useModel();
  const { registerOnRun, setIsLoading } = useAnalysis();

  const [completion, setCompletion] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleRun = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCompletion("");
    setError(null);
    setLoading(true);
    setIsLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, language: lang, modelId }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setCompletion(accumulated);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setIsLoading(false);
    }
  }, [moduleId, lang, modelId, setIsLoading]);

  // Register run handler with header
  useEffect(() => {
    registerOnRun(handleRun);
    return () => registerOnRun(null);
  }, [handleRun, registerOnRun]);

  // Sync loading state
  useEffect(() => {
    setIsLoading(isLoading);
  }, [isLoading, setIsLoading]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 relative">
        <div className="terminal-scan" />

        {error && (
          <div className="text-red-accent text-sm border border-red-accent/30 bg-red-accent/5 p-4 rounded">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isLoading && !completion && <SkeletonLoader />}

        {completion && (
          <div className="module-output">
            <MarkdownRenderer content={completion} />
          </div>
        )}

        {!completion && !isLoading && !error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-text-muted">
              <div className="text-2xl mb-2 opacity-30">◈</div>
              <div className="text-sm">{t.modules[moduleId]}</div>
              <div className="text-xs mt-1 opacity-60">
                {t.moduleDescriptions[moduleId]}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
