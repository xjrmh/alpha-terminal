"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { useModel } from "@/lib/model/context";
import { useExpertMode } from "@/lib/expert/context";
import { useQuantSettings } from "@/lib/quant/settings-context";
import { subscribeModuleStatus, type ModuleStatus } from "@/lib/analysis/run-all";

export function useModuleStatus(): ModuleStatus {
  const { lang } = useLanguage();
  const { modelId } = useModel();
  const { available, enabled } = useExpertMode();
  const { getConfig } = useQuantSettings();
  const expertMode = available && enabled;
  const [status, setStatus] = useState<ModuleStatus>({
    completedIds: new Set(),
    loadingIds: new Set(),
  });

  const handleUpdate = useCallback((next: ModuleStatus) => {
    setStatus((prev) => {
      const sameCompleted =
        prev.completedIds.size === next.completedIds.size &&
        [...next.completedIds].every((id) => prev.completedIds.has(id));
      const sameLoading =
        prev.loadingIds.size === next.loadingIds.size &&
        [...next.loadingIds].every((id) => prev.loadingIds.has(id));
      if (sameCompleted && sameLoading) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    return subscribeModuleStatus(lang, modelId, expertMode, getConfig, handleUpdate);
  }, [lang, modelId, expertMode, getConfig, handleUpdate]);

  return status;
}
