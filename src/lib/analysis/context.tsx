"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AnalysisContextType {
  onRun: (() => void) | null;
  registerOnRun: (
    fn: (() => void) | null,
    options?: { requiresModelCredentials?: boolean }
  ) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  requiresModelCredentials: boolean;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [onRun, setOnRun] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresModelCredentials, setRequiresModelCredentials] = useState(true);

  const registerOnRun = useCallback(
    (
      fn: (() => void) | null,
      options?: { requiresModelCredentials?: boolean }
    ) => {
      setOnRun(() => fn);
      setRequiresModelCredentials(options?.requiresModelCredentials ?? true);
    },
    []
  );

  return (
    <AnalysisContext.Provider
      value={{
        onRun,
        registerOnRun,
        isLoading,
        setIsLoading,
        requiresModelCredentials,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
