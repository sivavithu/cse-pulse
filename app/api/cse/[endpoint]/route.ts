import { NextRequest, NextResponse } from "next/server";
import { csePost } from "@/lib/cse/client";
import { getUserSetting, logRequest } from "@/lib/db/queries";
import { currentUserEmail } from "@/lib/auth/session";
import { getUserGeminiConfig, hasGeminiConfig } from "@/lib/gemini/config";
import { runScrapingWorkflow } from "@/lib/scrape/workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ endpoint: string }> }
) {
  const { endpoint } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* body is optional */ }

  try {
    const data = await csePost(endpoint, body);
    try { logRequest(endpoint, false); } catch { /* non-critical */ }
    return NextResponse.json({ data, source: "primary", fetchedAt: new Date().toISOString() });
  } catch (primaryErr) {
    console.warn(`[CSE] Primary failed for ${endpoint}:`, (primaryErr as Error).message);
  }

  const user = await currentUserEmail();
  const [fallbackEnabledVal, geminiConfig] = user
    ? await Promise.all([getUserSetting(user, "fallback_enabled"), getUserGeminiConfig(user)])
    : [null, null];
  const fallbackEnabled = fallbackEnabledVal === "true";

  if (!user || !fallbackEnabled || !geminiConfig || !hasGeminiConfig(geminiConfig)) {
    try { logRequest(endpoint, false); } catch { /* non-critical */ }
    return NextResponse.json(
      {
        data: null,
        source: "primary",
        error: "Primary API failed; fallback is not configured for this user",
        fetchedAt: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    const result = await runScrapingWorkflow(endpoint, body, user);
    console.info(`[Fallback] ${endpoint} - steps:`, result.steps);
    return NextResponse.json(result);
  } catch (err) {
    console.error(`[CSE] Workflow fallback failed for ${endpoint}:`, err);
    try { logRequest(endpoint, false); } catch { /* non-critical */ }
    return NextResponse.json(
      { data: null, source: "fallback", error: String(err), fetchedAt: new Date().toISOString() },
      { status: 503 }
    );
  }
}
