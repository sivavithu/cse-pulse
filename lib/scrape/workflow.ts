import type { Content } from "@google/genai";
import { getUserClient, getUserGeminiConfig, hasGeminiConfig, modelFor } from "@/lib/gemini/config";
import { SCRAPE_TOOL } from "@/lib/gemini/client";
import { scrapeUrl } from "./index";
import { getUserSetting, logRequest } from "@/lib/db/queries";
import type { ScraperService } from "./index";

export interface WorkflowResult {
  data: unknown;
  source: "primary" | "fallback";
  steps: string[];
  fetchedAt: string;
}

const AGENT_SYSTEM = `You are a CSE (Colombo Stock Exchange) data extraction agent.
You have a scrape_url tool to fetch pages from https://www.cse.lk.

Key pages:
- Market summary / ASPI / S&P SL20: https://www.cse.lk/
- Live prices / gainers / losers: https://www.cse.lk/pages/trading/trading.component.html
- Announcements: https://www.cse.lk/pages/annoucemnt/annoucemnt.component.html
- Company profile: https://www.cse.lk/pages/company-profile/company-profile.component.html

Workflow:
1. Decide which URL(s) to scrape based on the endpoint name and params.
2. Call scrape_url for each needed URL (up to 3 calls max).
3. Extract ALL matching data from the scraped content.
4. Return ONLY a valid JSON value matching the data shape expected for this endpoint.
   No markdown fences, no explanation, no extra keys. Pure JSON only.`;

async function getScraperSettings(userEmail: string): Promise<{ service: ScraperService; key: string } | null> {
  const [fallbackEnabled, service, key] = await Promise.all([
    getUserSetting(userEmail, "fallback_enabled"),
    getUserSetting(userEmail, "scraper_service"),
    getUserSetting(userEmail, "scraper_key"),
  ]);
  if (fallbackEnabled !== "true" || !service || service === "none" || !key) return null;
  return { service: service as ScraperService, key };
}

export async function runScrapingWorkflow(
  endpoint: string,
  params: Record<string, unknown>,
  userEmail: string
): Promise<WorkflowResult> {
  const steps: string[] = [];
  const [scraper, geminiConfig] = await Promise.all([
    getScraperSettings(userEmail),
    getUserGeminiConfig(userEmail),
  ]);

  if (!scraper) throw new Error("Scraping fallback is not configured in Settings");
  if (!hasGeminiConfig(geminiConfig)) throw new Error("Gemini is not configured in Settings");

  const { ai } = await getUserClient(userEmail);

  const model = modelFor("agent");
  steps.push(`Using model: ${model}`);

  const userMessage =
    `I need data for CSE API endpoint: "${endpoint}"` +
    (Object.keys(params).length ? `, params: ${JSON.stringify(params)}` : "") +
    `. Scrape the right page(s) and return the structured JSON data.`;

  const contents: Content[] = [{ role: "user", parts: [{ text: userMessage }] }];

  const MAX_TOOL_CALLS = 4;
  let toolCallCount = 0;

  for (let turn = 0; turn < 6; turn++) {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: { tools: [SCRAPE_TOOL], systemInstruction: AGENT_SYSTEM },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    contents.push({ role: "model", parts });

    const functionCalls = parts.filter((p) => p.functionCall);

    if (functionCalls.length === 0) {
      const text = parts
        .filter((p) => p.text)
        .map((p) => p.text)
        .join("")
        .trim();

      steps.push(`Agent returned final response (${text.length} chars)`);

      const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      let data: unknown;

      try {
        data = JSON.parse(clean);
      } catch {
        data = { rawText: text };
        steps.push("Warning: response was not valid JSON, wrapped as rawText");
      }

      await logRequest(endpoint, true);
      return { data, source: "fallback", steps, fetchedAt: new Date().toISOString() };
    }

    const toolResultParts: Content["parts"] = [];

    for (const part of functionCalls) {
      const call = part.functionCall!;
      if (call.name !== "scrape_url") continue;

      if (toolCallCount >= MAX_TOOL_CALLS) {
        toolResultParts.push({
          functionResponse: {
            name: "scrape_url",
            response: { content: "ERROR: Too many scrape calls. Summarise what you have." },
          },
        });
        continue;
      }

      const args = call.args as Record<string, unknown>;
      const url = String(args.url ?? "");
      const reason = String(args.reason ?? "");
      steps.push(`Scraping: ${url}${reason ? ` - ${reason}` : ""}`);
      toolCallCount++;

      let scraped: string;
      try {
        const result = await scrapeUrl(url, scraper.service, scraper.key);
        scraped = result.content.slice(0, 15_000);
        steps.push(`  -> ${scraped.length} chars received (${result.format})`);
      } catch (err) {
        scraped = `ERROR fetching ${url}: ${String(err)}`;
        steps.push(`  -> fetch failed: ${String(err)}`);
      }

      toolResultParts.push({
        functionResponse: {
          name: "scrape_url",
          response: { content: scraped },
        },
      });
    }

    contents.push({ role: "user", parts: toolResultParts });
  }

  throw new Error(`Scraping agent did not produce a result after ${MAX_TOOL_CALLS} tool calls`);
}
