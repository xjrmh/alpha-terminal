"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  DEFAULT_MODEL,
  getModelProvider,
  isChatGptModel,
  type ExternalModelProvider,
} from "@/lib/ai/models";

interface StoredProviderKeys {
  anthropic?: string;
  google?: string;
}

interface ApiKeyModalState {
  provider: ExternalModelProvider;
  resolve: (ok: boolean) => void;
}

interface ModelContextType {
  modelId: string;
  setModelId: (id: string) => void;
  getProviderApiKeyForModel: (modelId: string) => string | undefined;
  hasRequiredApiKey: (modelId: string) => boolean;
  promptForProviderApiKey: (
    provider: ExternalModelProvider
  ) => Promise<boolean>;
  promptForModelApiKey: (modelId: string) => Promise<boolean>;
  apiKeyError: string | null;
  setApiKeyError: (message: string | null) => void;
}

const STORAGE_KEY = "alpha-terminal-provider-keys";

const ModelContext = createContext<ModelContextType | null>(null);

function loadStoredProviderKeys(): StoredProviderKeys {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredProviderKeys;
    const out: StoredProviderKeys = {};

    if (typeof parsed.anthropic === "string" && parsed.anthropic.trim()) {
      out.anthropic = parsed.anthropic.trim();
    }
    if (typeof parsed.google === "string" && parsed.google.trim()) {
      out.google = parsed.google.trim();
    }

    return out;
  } catch {
    return {};
  }
}

function persistProviderKeys(keys: StoredProviderKeys) {
  if (typeof window === "undefined") return;

  const payload: StoredProviderKeys = {};
  if (keys.anthropic) payload.anthropic = keys.anthropic;
  if (keys.google) payload.google = keys.google;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function providerLabel(provider: ExternalModelProvider): string {
  return provider === "anthropic" ? "Anthropic" : "Google";
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const [modelId, setModelId] = useState(DEFAULT_MODEL.id);
  const [providerKeys, setProviderKeys] = useState<StoredProviderKeys>(() =>
    loadStoredProviderKeys()
  );
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ApiKeyModalState | null>(null);
  const [modalInput, setModalInput] = useState("");

  const getProviderApiKeyForModel = useCallback(
    (id: string) => {
      const provider = getModelProvider(id);
      if (provider === "openai") return undefined;
      return providerKeys[provider];
    },
    [providerKeys]
  );

  const hasRequiredApiKey = useCallback(
    (id: string) => {
      if (isChatGptModel(id)) return true;
      return Boolean(getProviderApiKeyForModel(id));
    },
    [getProviderApiKeyForModel]
  );

  const closeModal = useCallback((ok: boolean) => {
    setModalState((prev) => {
      if (!prev) return null;
      prev.resolve(ok);
      return null;
    });
  }, []);

  const promptForProviderApiKey = useCallback(
    (provider: ExternalModelProvider) => {
      return new Promise<boolean>((resolve) => {
        setModalState((prev) => {
          if (prev) prev.resolve(false);
          return { provider, resolve };
        });
        setModalInput(providerKeys[provider] ?? "");
      });
    },
    [providerKeys]
  );

  const promptForModelApiKey = useCallback(
    async (id: string) => {
      const provider = getModelProvider(id);
      if (provider === "openai") return true;
      return promptForProviderApiKey(provider);
    },
    [promptForProviderApiKey]
  );

  const saveModalInput = useCallback(() => {
    setModalState((active) => {
      if (!active) return null;

      const trimmed = modalInput.trim();

      setProviderKeys((prev) => {
        const next: StoredProviderKeys = { ...prev };
        if (trimmed) {
          next[active.provider] = trimmed;
        } else {
          delete next[active.provider];
        }
        persistProviderKeys(next);
        return next;
      });

      if (!trimmed) {
        setApiKeyError(`${providerLabel(active.provider)} API key is required.`);
        active.resolve(false);
        return null;
      }

      setApiKeyError(null);
      active.resolve(true);
      return null;
    });
  }, [modalInput]);

  const value = useMemo<ModelContextType>(
    () => ({
      modelId,
      setModelId,
      getProviderApiKeyForModel,
      hasRequiredApiKey,
      promptForProviderApiKey,
      promptForModelApiKey,
      apiKeyError,
      setApiKeyError,
    }),
    [
      modelId,
      getProviderApiKeyForModel,
      hasRequiredApiKey,
      promptForProviderApiKey,
      promptForModelApiKey,
      apiKeyError,
    ]
  );

  return (
    <ModelContext.Provider value={value}>
      {children}

      {modalState && (
        <div
          className="api-key-modal-overlay"
          onMouseDown={() => closeModal(false)}
        >
          <div
            className="api-key-modal-panel"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="text-green-accent text-xs font-bold tracking-widest uppercase">
              API KEY CONFIG
            </div>
            <div className="text-text-secondary text-xs mt-2 leading-relaxed">
              Enter your {providerLabel(modalState.provider)} API key.
            </div>
            <div className="text-text-muted text-[0.65rem] mt-1 leading-relaxed">
              Stored only in your local browser storage on this device.
            </div>

            <input
              autoFocus
              type="password"
              value={modalInput}
              onChange={(event) => setModalInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  closeModal(false);
                }
                if (event.key === "Enter") {
                  saveModalInput();
                }
              }}
              className="api-key-modal-input mt-3"
              placeholder="Paste API key"
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="btn-lang btn-top" onClick={() => closeModal(false)}>
                Cancel
              </button>
              <button className="btn-run btn-top" onClick={saveModalInput}>
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </ModelContext.Provider>
  );
}

export function useModel() {
  const ctx = useContext(ModelContext);
  if (!ctx) throw new Error("useModel must be used within ModelProvider");
  return ctx;
}
