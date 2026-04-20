import { NextRequest, NextResponse } from "next/server";
import { currentUserEmail } from "@/lib/auth/session";
import { getUserClient, getUserGeminiConfig, hasGeminiConfig, modelFor } from "@/lib/gemini/config";
import { portfolioInsightPrompt } from "@/lib/gemini/prompts";

export async function POST(req: NextRequest) {
  const user = await currentUserEmail();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { holdingsText, totalValue, pl, aspi, movers } = await req.json();
  const config = getUserGeminiConfig(user);

  if (!hasGeminiConfig(config)) {
    return NextResponse.json({ error: "Gemini is not configured" }, { status: 400 });
  }
  const { ai } = getUserClient(user);

  const model = modelFor("analysis");
  const prompt = portfolioInsightPrompt(holdingsText, totalValue, pl, aspi, movers);

  try {
    const res = await ai.models.generateContent({ model, contents: prompt });
    return NextResponse.json({ text: res.text ?? "", model });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
