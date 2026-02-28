"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_MODEL } from "@/lib/ai/models";

interface ModelContextType {
  modelId: string;
  setModelId: (id: string) => void;
}

const ModelContext = createContext<ModelContextType | null>(null);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [modelId, setModelId] = useState(DEFAULT_MODEL.id);

  return (
    <ModelContext.Provider value={{ modelId, setModelId }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModel must be used within ModelProvider");
  return ctx;
}
