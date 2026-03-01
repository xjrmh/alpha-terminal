export interface ModelConfig {
  id: string;
  label: string;
  provider: "openai" | "anthropic" | "google";
}

export const MODELS: ModelConfig[] = [
  { id: "openai:gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "openai:gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  {
    id: "anthropic:claude-sonnet-4-20250514",
    label: "Claude Sonnet",
    provider: "anthropic",
  },
  {
    id: "anthropic:claude-opus-4-20250514",
    label: "Claude Opus",
    provider: "anthropic",
  },
  {
    id: "google:gemini-2.0-flash",
    label: "Gemini Flash",
    provider: "google",
  },
  {
    id: "google:gemini-2.0-pro",
    label: "Gemini Pro",
    provider: "google",
  },
];

export const DEFAULT_MODEL = MODELS[0];

export type ModelProvider = ModelConfig["provider"];
export type ExternalModelProvider = Exclude<ModelProvider, "openai">;

export function getModelConfig(modelId: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === modelId);
}

export function getModelProvider(modelId: string): ModelProvider {
  return getModelConfig(modelId)?.provider ?? "openai";
}

export function isChatGptModel(modelId: string): boolean {
  return getModelProvider(modelId) === "openai";
}
