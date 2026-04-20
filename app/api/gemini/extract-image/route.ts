import { NextRequest, NextResponse } from "next/server";
import { currentUserEmail } from "@/lib/auth/session";
import { getUserClient, getUserGeminiConfig, hasGeminiConfig, modelFor } from "@/lib/gemini/config";

const EXTRACTION_PROMPT = `You are extracting stock holdings from one or more trading-account screenshots from a Sri Lankan broker (CSE - Colombo Stock Exchange). Multiple images may show different scroll positions of the SAME portfolio - merge them. If the same symbol appears twice, keep ONE row.

Typical broker-app row layout:
  SYMBOL.N0000    [invested value]        [P&L value]
  [avg price]     [current price]         [P&L %]

Example:
  ACL.N0000       9,480.00                -738.68
  101.13          94.80                   -7.30%

Meaning:
  - avg_price = 101.13 (cost per share - SMALLER number under symbol)
  - current_price = 94.80 (shown in middle column, second row)
  - invested value = 9,480.00 (qty x avg_price) -> qty = 9480 / 101.13 ~= 94, but if qty is shown directly, use that.
  - P&L = -738.68 (-7.30%)

Extract for each holding:
- symbol: CSE ticker exactly as shown (e.g. "SAMP.N0000", "JKH.N0000"). Uppercase, keep the ".N0000" / ".X0000" suffix. If truncated with "..." use the visible prefix.
- qty: number of shares held as an integer. If the image shows only an "invested value" and an avg_price, compute qty = round(invested / avg_price). If qty shows 0 or a dash, skip the row entirely.
- avg_price: average/cost price per share in LKR. Extract it when visible. If not clearly shown, null.
- company_name: full company name if visible, otherwise null.

Do NOT extract current_price - that will be fetched live from the CSE API.

Also extract portfolio-level data if visible anywhere:
- cash_balance: available cash in LKR, null if not shown
- total_portfolio_value: total portfolio value shown on screen in LKR, null if not shown
- broker: name of the brokerage firm, null if not identifiable

Return ONLY this exact JSON - no markdown fences, no explanation:
{
  "holdings": [
    { "symbol": "ACL.N0000", "company_name": null, "qty": 100, "avg_price": 101.13 },
    { "symbol": "ACME.N0000", "company_name": null, "qty": 3300, "avg_price": 5.95 }
  ],
  "cash_balance": 250000,
  "total_portfolio_value": 1250000,
  "broker": "John Keells Stockbrokers",
  "confidence": "high"
}

confidence: "high" if all symbols, quantities AND avg prices are clearly readable, "medium" if some values are estimated or missing, "low" if unclear.`;

interface ImagePayload {
  imageData: string;
  mimeType?: string;
}

export async function POST(req: NextRequest) {
  const user = await currentUserEmail();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const images: ImagePayload[] = Array.isArray(body.images)
    ? body.images
    : body.imageData
      ? [{ imageData: body.imageData, mimeType: body.mimeType }]
      : [];

  if (!images.length) {
    return NextResponse.json({ error: "No image data" }, { status: 400 });
  }

  const [config, { ai }] = await Promise.all([getUserGeminiConfig(user), getUserClient(user)]);
  if (!hasGeminiConfig(config)) {
    return NextResponse.json({ error: "Gemini is not configured" }, { status: 400 });
  }

  const model = modelFor("agent");

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: EXTRACTION_PROMPT },
            ...images.map((img) => ({
              inlineData: { mimeType: img.mimeType ?? "image/png", data: img.imageData },
            })),
          ],
        },
      ],
    });

    const text = (response.text ?? "").trim();
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    try {
      const data = JSON.parse(clean);
      return NextResponse.json({ ok: true, data });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Could not parse Gemini response", raw: text },
        { status: 422 }
      );
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
