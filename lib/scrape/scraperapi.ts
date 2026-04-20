export async function scrapeWithScraperApi(
  url: string,
  apiKey: string
): Promise<{ html: string }> {
  const params = new URLSearchParams({
    api_key: apiKey,
    url,
    render: "false",
  });

  const res = await fetch(`https://api.scraperapi.com?${params}`, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ScraperAPI error ${res.status}: ${text}`);
  }

  const html = await res.text();
  return { html };
}
