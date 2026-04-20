import { CSE_BASE, CSE_HEADERS } from "./endpoints";

const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 1;

// Endpoints that require application/x-www-form-urlencoded instead of JSON.
const FORM_ENCODED_ENDPOINTS = new Set<string>([
  "companyInfoSummery",
  "companyChartDataByStock",
  "chartData",
]);

async function fetchWithTimeout(url: string, init: RequestInit, timeout = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function csePost<T>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = `${CSE_BASE}/${endpoint}`;
  const useForm = FORM_ENCODED_ENDPOINTS.has(endpoint);
  let lastErr: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers: Record<string, string> = { ...CSE_HEADERS };
      let bodyStr: string;
      if (useForm) {
        headers["Content-Type"] = "application/x-www-form-urlencoded";
        bodyStr = new URLSearchParams(
          Object.entries(body).reduce((acc, [k, v]) => {
            if (v !== undefined && v !== null) acc[k] = String(v);
            return acc;
          }, {} as Record<string, string>)
        ).toString();
      } else {
        bodyStr = JSON.stringify(body);
      }

      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: bodyStr,
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);

      const json = await res.json();
      return json as T;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_RETRIES) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
