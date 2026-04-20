import { scrapeWithFirecrawl } from "./firecrawl";
import { scrapeWithScrapingBee } from "./scrapingbee";
import { scrapeWithScraperApi } from "./scraperapi";

export type ScraperService = "firecrawl" | "scrapingbee" | "scraperapi" | "none";

export interface ScrapeResult {
  content: string;
  format: "markdown" | "html";
}

const MIN_INTERVAL_MS = 5_000;
let lastScrapeAt = 0;

export async function scrapeUrl(
  url: string,
  service: ScraperService,
  apiKey: string
): Promise<ScrapeResult> {
  if (service === "none") throw new Error("Scraping is disabled");

  // Rate-limit: minimum 5s between calls
  const now = Date.now();
  const wait = MIN_INTERVAL_MS - (now - lastScrapeAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastScrapeAt = Date.now();

  switch (service) {
    case "firecrawl": {
      const { markdown, html } = await scrapeWithFirecrawl(url, apiKey);
      return { content: markdown || html, format: markdown ? "markdown" : "html" };
    }
    case "scrapingbee": {
      const { html } = await scrapeWithScrapingBee(url, apiKey);
      return { content: html, format: "html" };
    }
    case "scraperapi": {
      const { html } = await scrapeWithScraperApi(url, apiKey);
      return { content: html, format: "html" };
    }
    default:
      throw new Error(`Unknown scraper service: ${service}`);
  }
}
