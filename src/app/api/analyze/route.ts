import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getSystemPrompt } from "@/lib/prompts";
import type { AnalyzeRequest } from "@/types";
import { webSearchPreview } from "@ai-sdk/openai/internal";
import { anthropicTools } from "@ai-sdk/anthropic/internal";
import { googleTools } from "@ai-sdk/google/internal";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { moduleId, language, modelId, providerApiKey } =
      (await req.json()) as AnalyzeRequest;

    const systemPrompt = getSystemPrompt(moduleId, language);
    const model = resolveModel(modelId, providerApiKey);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Run the analysis now. Today's date is ${new Date().toISOString().split("T")[0]}.`,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: getWebSearchTools(modelId) as any,
      maxOutputTokens: 8192,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    const message = getErrorMessage(error);
    const status = isApiAuthErrorMessage(message) ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}

function resolveModel(modelId: string, providerApiKey?: string) {
  const [provider, ...rest] = modelId.split(":");
  const modelName = rest.join(":");

  if (!provider || !modelName) {
    throw new Error("Invalid model id.");
  }

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error("Server OpenAI API key is missing.");
    }
    return createOpenAI({ apiKey: key })(modelName);
  }

  if (provider === "anthropic") {
    const key = providerApiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error("Anthropic API key is required for this model.");
    }
    return createAnthropic({ apiKey: key })(modelName);
  }

  if (provider === "google") {
    const key = providerApiKey || process.env.GOOGLE_AI_API_KEY;
    if (!key) {
      throw new Error("Google API key is required for this model.");
    }
    return createGoogleGenerativeAI({ apiKey: key })(modelName);
  }

  throw new Error(`Unsupported provider: ${provider}`);
}

function getWebSearchTools(modelId: string) {
  if (modelId.startsWith("openai:")) {
    return { web_search_preview: webSearchPreview({}) };
  }

  if (modelId.startsWith("anthropic:")) {
    return { web_search: anthropicTools.webSearch_20250305({}) };
  }

  if (modelId.startsWith("google:")) {
    return { google_search: googleTools.googleSearch({}) };
  }

  return {};
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Unknown error";
}

function isApiAuthErrorMessage(message: string): boolean {
  return /api key|authentication|unauthorized|invalid key|permission/i.test(
    message
  );
}
