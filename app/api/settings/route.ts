import { NextRequest, NextResponse } from "next/server";
import { getAllUserSettings, setUserSettings, getFallbackStats } from "@/lib/db/queries";
import { currentUserEmail } from "@/lib/auth/session";
import { invalidateUserClient } from "@/lib/gemini/config";
import { SECRET_SETTING_KEYS, isUserSettingKey } from "@/lib/db/setting-keys";
import { isThemeValue } from "@/lib/theme";

export async function GET() {
  const user = await currentUserEmail();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [settings, stats] = await Promise.all([
    getAllUserSettings(user),
    getFallbackStats(),
  ]);

  const safe = { ...settings };
  for (const key of SECRET_SETTING_KEYS) {
    if (safe[key]) safe[key] = "***";
  }

  return NextResponse.json({ settings: safe, fallbackStats: stats });
}

export async function POST(req: NextRequest) {
  const user = await currentUserEmail();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const pairs: Record<string, string> = {};

  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string" && isUserSettingKey(k)) {
      if (k === "theme" && !isThemeValue(v)) continue;
      pairs[k] = v;
    }
  }

  if (Object.keys(pairs).length) {
    await setUserSettings(user, pairs);
  }

  const geminiKeys = ["gemini_api_key", "gemini_provider", "gemini_project", "gemini_location"];
  if (geminiKeys.some((k) => k in pairs)) invalidateUserClient(user);

  return NextResponse.json({ ok: true });
}
