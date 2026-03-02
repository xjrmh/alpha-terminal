"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface AnalysisRunButtonState {
  hasResult: boolean;
  refreshEligibleAt: string | null;
  secondsUntilRefresh: number;
  cacheEnabled: boolean;
}

const DEFAULT_RUN_BUTTON_STATE: AnalysisRunButtonState = {
  hasResult: false,
  refreshEligibleAt: null,
  secondsUntilRefresh: 0,
  cacheEnabled: true,
};

interface AnalysisContextType {
  onRun: (() => void) | null;
  registerOnRun: (
    fn: (() => void) | null,
    options?: { requiresModelCredentials?: boolean }
  ) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  requiresModelCredentials: boolean;
  runButtonState: AnalysisRunButtonState;
  setRunButtonState: (state: AnalysisRunButtonState) => void;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [onRun, setOnRun] = useState<(() => void) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresModelCredentials, setRequiresModelCredentials] = useState(true);
  const [runButtonState, setRunButtonState] = useState<AnalysisRunButtonState>(
    DEFAULT_RUN_BUTTON_STATE
  );

  const registerOnRun = useCallback(
    (
      fn: (() => void) | null,
      options?: { requiresModelCredentials?: boolean }
    ) => {
      setOnRun(() => fn);
      setRequiresModelCredentials(options?.requiresModelCredentials ?? true);
      if (!fn) {
        setRunButtonState(DEFAULT_RUN_BUTTON_STATE);
      }
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
        runButtonState,
        setRunButtonState,
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
