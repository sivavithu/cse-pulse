import { GoogleGenAI, Type, type Content } from "@google/genai";

export type GeminiProvider = "aistudio" | "vertex";

export interface GeminiConfig {
  provider: GeminiProvider;
  apiKey: string;
  project?: string;
  location?: string;
  model?: string;
}

export function createGeminiClient(config: GeminiConfig): GoogleGenAI {
  if (config.provider === "vertex") {
    return new GoogleGenAI({
      vertexai: true,
      project: config.project ?? "",
      location: config.location ?? "us-central1",
      apiKey: config.apiKey || undefined,
    } as ConstructorParameters<typeof GoogleGenAI>[0]);
  }
  return new GoogleGenAI({ apiKey: config.apiKey });
}

/** Simple one-shot text generation (used by explain + insights via global client). */
export async function generateContent(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: systemInstruction ? { systemInstruction } : undefined,
  });
  return response.text ?? "";
}

/** Streaming chat generation (SSE). */
export async function* streamContent(
  ai: GoogleGenAI,
  model: string,
  contents: Content[],
  systemInstruction?: string
): AsyncGenerator<string> {
  const stream = ai.models.generateContentStream({
    model,
    contents,
    config: systemInstruction ? { systemInstruction } : undefined,
  });
  for await (const chunk of await stream) {
    if (chunk.text) yield chunk.text;
  }
}

// ── Scraping agent tool declaration ──────────────────────────────────────────
export const SCRAPE_TOOL = {
  functionDeclarations: [
    {
      name: "scrape_url",
      description:
        "Fetch the HTML or markdown content of a CSE website page to get live market data.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          url: {
            type: Type.STRING,
            description: "Full URL on cse.lk to fetch",
          },
          reason: {
            type: Type.STRING,
            description: "Why you are scraping this URL (for audit log)",
          },
        },
        required: ["url"],
      },
    },
  ],
};
