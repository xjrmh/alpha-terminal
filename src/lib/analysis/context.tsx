"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AnalysisContextType {
  onRun: (() => void) | null;
  registerOnRun: (fn: (() => void) | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [onRun, setOnRun] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const registerOnRun = useCallback((fn: (() => void) | null) => {
    setOnRun(() => fn);
  }, []);

  return (
    <AnalysisContext.Provider value={{ onRun, registerOnRun, isLoading, setIsLoading }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
