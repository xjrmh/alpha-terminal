import { streamText } from "ai";
import { registry } from "@/lib/ai/registry";
import { getSystemPrompt } from "@/lib/prompts";
import type { AnalyzeRequest } from "@/types";
import { webSearchPreview } from "@ai-sdk/openai/internal";
import { anthropicTools } from "@ai-sdk/anthropic/internal";
import { googleTools } from "@ai-sdk/google/internal";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { moduleId, language, modelId } = (await req.json()) as AnalyzeRequest;

  const systemPrompt = getSystemPrompt(moduleId, language);
  const model = registry.languageModel(
    modelId as Parameters<typeof registry.languageModel>[0]
  );
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
