import { NextRequest } from "next/server";
import { currentUserEmail } from "@/lib/auth/session";
import { getUserClient, getUserGeminiConfig, hasGeminiConfig, modelFor } from "@/lib/gemini/config";
import { chatSystemPrompt } from "@/lib/gemini/prompts";
import { formatColomboTime } from "@/lib/market-hours";

export async function POST(req: NextRequest) {
  const user = await currentUserEmail();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, portfolioJson, marketJson } = await req.json();
  const [config, { ai }] = await Promise.all([getUserGeminiConfig(user), getUserClient(user)]);

  if (!hasGeminiConfig(config)) {
    return Response.json({ error: "Gemini is not configured" }, { status: 400 });
  }

  const model = modelFor("chat");
  const sysPrompt = chatSystemPrompt(
    portfolioJson ?? "[]",
    marketJson ?? "{}",
    formatColomboTime()
  );

  const contents = (messages as { role: string; content: string }[]).map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const genStream = ai.models.generateContentStream({
          model,
          contents,
          config: { systemInstruction: sysPrompt },
        });

        for await (const chunk of await genStream) {
          if (chunk.text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk.text })}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
