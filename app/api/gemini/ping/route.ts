import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { modelFor } from "@/lib/gemini/config";
import type { GeminiConfig } from "@/lib/gemini/client";

async function applyVertexCredentials() {
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sa && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const fs = await import("fs");
    fs.writeFileSync("/tmp/sa.json", sa);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/sa.json";
  }
}

export async function POST(req: NextRequest) {
  const { apiKey, provider, project, location } = await req.json();
  if (!apiKey && provider !== "vertex") return NextResponse.json({ ok: false, error: "API key required" }, { status: 400 });

  const config: GeminiConfig = { provider: provider ?? "aistudio", apiKey, project, location: location ?? "us-central1" };

  let ai: GoogleGenAI;
  if (config.provider === "vertex") {
    await applyVertexCredentials();
    ai = config.project
      ? new GoogleGenAI({ vertexai: true, project: config.project, location: config.location ?? "us-central1" } as ConstructorParameters<typeof GoogleGenAI>[0])
      : new GoogleGenAI({ vertexai: true, apiKey: config.apiKey } as ConstructorParameters<typeof GoogleGenAI>[0]);
  } else {
    ai = new GoogleGenAI({ apiKey: config.apiKey });
  }

  try {
    const res = await ai.models.generateContent({ model: modelFor("ping"), contents: "Reply with exactly: OK" });
    return NextResponse.json({ ok: true, model: modelFor("ping"), response: res.text?.trim() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 400 });
  }
}
