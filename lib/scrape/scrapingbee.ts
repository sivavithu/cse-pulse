export async function scrapeWithScrapingBee(
  url: string,
  apiKey: string
): Promise<{ html: string }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    render_js: "false",
    premium_proxy: "false",
  });

  const res = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ScrapingBee error ${res.status}: ${text}`);
  }

  const html = await res.text();
  return { html };
}
