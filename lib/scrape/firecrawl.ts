export async function scrapeWithFirecrawl(
  url: string,
  apiKey: string
): Promise<{ markdown: string; html: string }> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown", "html"],
      onlyMainContent: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Firecrawl error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return {
    markdown: json?.data?.markdown ?? "",
    html: json?.data?.html ?? "",
  };
}
