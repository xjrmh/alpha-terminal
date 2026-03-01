"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isExpertModeEnabled } from "@/lib/features";

interface ExpertModeContextType {
  available: boolean;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

const STORAGE_KEY = "alpha-terminal-expert-mode";

const ExpertModeContext = createContext<ExpertModeContextType | null>(null);

function loadStoredExpertMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function ExpertModeProvider({ children }: { children: ReactNode }) {
  const available = isExpertModeEnabled();
  const [storedEnabled, setEnabledState] = useState(false);
  const enabled = available ? storedEnabled : false;

  useEffect(() => {
    if (!available) return;
    const nextValue = loadStoredExpertMode();
    const timer = window.setTimeout(() => {
      setEnabledState(nextValue);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [available]);

  const setEnabled = useCallback(
    (next: boolean) => {
      const applied = available ? next : false;
      setEnabledState(applied);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, applied ? "true" : "false");
      }
    },
    [available]
  );

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  const value = useMemo(
    () => ({ available, enabled, setEnabled, toggle }),
    [available, enabled, setEnabled, toggle]
  );

  return (
    <ExpertModeContext.Provider value={value}>
      {children}
    </ExpertModeContext.Provider>
  );
}

export function useExpertMode() {
  const ctx = useContext(ExpertModeContext);
  if (!ctx) {
    throw new Error("useExpertMode must be used within ExpertModeProvider");
  }
  return ctx;
}
