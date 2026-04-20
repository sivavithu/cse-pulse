import { NextRequest } from "next/server";
import { currentUserEmail } from "@/lib/auth/session";
import { getUserClient, getUserGeminiConfig, hasGeminiConfig, modelForUser } from "@/lib/gemini/config";
import { announcementChatSystemPrompt } from "@/lib/gemini/prompts";
import { formatColomboTime } from "@/lib/market-hours";

type ChatMessage = { role: string; content: string };

const DEFAULT_EXPLAIN_MESSAGE =
  "Explain this announcement in simple English for a retail investor. What is happening, why does it matter, what should I watch out for, and what could be the share-price impact?";

export async function POST(req: NextRequest) {
  const user = await currentUserEmail();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, announcement, companyName, holdings } = await req.json();
  const [config, { ai }] = await Promise.all([getUserGeminiConfig(user), getUserClient(user)]);

  if (!hasGeminiConfig(config)) {
    return Response.json({ error: "Gemini is not configured" }, { status: 400 });
  }

  const model = await modelForUser(user, "explain");
  const sysPrompt = announcementChatSystemPrompt(
    announcement ?? "",
    holdings ?? "",
    companyName ?? "",
    formatColomboTime()
  );

  const messageList = Array.isArray(messages) && messages.length
    ? (messages as ChatMessage[])
    : [{ role: "user", content: DEFAULT_EXPLAIN_MESSAGE }];

  const contents = messageList.map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: String(message.content ?? "") }],
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
      } catch (error) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`));
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
