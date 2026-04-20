import { NextRequest, NextResponse } from "next/server";
import { currentUserEmail } from "@/lib/auth/session";
import { getUserSetting } from "@/lib/db/queries";
import { sendAlertEmail } from "@/lib/email";

function htmlBody(title: string, lines: string[]) {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:16px;color:#0f172a">
    <h2 style="margin:0 0 12px;color:#0369a1">${title}</h2>
    <div style="font-size:14px;line-height:1.6">${lines.map((l) => `<div>${l}</div>`).join("")}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
    <p style="font-size:11px;color:#64748b;margin:0">Sent by CSE Pulse. Not financial advice.</p>
  </body></html>`;
}

export async function POST(req: NextRequest) {
  const user = await currentUserEmail();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { test, subject, text, lines, to: overrideTo } = body as {
    test?: boolean;
    subject?: string;
    text?: string;
    lines?: string[];
    to?: string;
  };

  const [enabledVal, configuredTo0] = await Promise.all([
    getUserSetting(user, "alerts_email_enabled"),
    getUserSetting(user, "alert_email"),
  ]);
  const enabled = enabledVal === "true";
  const configuredTo = configuredTo0 ?? "";
  const to = overrideTo ?? configuredTo;

  if (!to) {
    return NextResponse.json({ ok: false, error: "No recipient configured" }, { status: 400 });
  }
  if (!test && !enabled) {
    return NextResponse.json({ ok: false, error: "Email alerts disabled" }, { status: 400 });
  }

  const finalSubject = subject ?? (test ? "CSE Pulse test email" : "CSE Pulse alert");
  const finalText = text ?? (test ? "This is a test email from CSE Pulse. Delivery is working." : "");
  const finalLines = lines ?? finalText.split("\n").filter(Boolean);

  try {
    const info = await sendAlertEmail({
      to,
      subject: finalSubject,
      text: finalText,
      html: htmlBody(finalSubject, finalLines),
    });
    return NextResponse.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
