# CSE Pulse

> **Fully vibe coded** — every line of this app was built through AI-assisted development. No traditional coding session, just vibes and iteration.

A personal real-time Colombo Stock Exchange (CSE) tracker with AI-powered portfolio management.

> **Disclaimer:** Unofficial app using public CSE data and web scraping. Data may be delayed or inaccurate. **Not financial advice.** Always verify with official [CSE](https://www.cse.lk) sources before making investment decisions.

---

## Features

- **Real-time market data** — ASPI, S&P SL20, top gainers/losers/most active (polling every 30s during market hours)
- **Portfolio manager** — holdings, P&L, allocation pie, performance chart, CSV export
- **Watchlist** — price alerts via toast notifications
- **Announcements center** — filtered by category (Rights, Dividends, Financial Results, etc.)
- **Gemini AI assistant** — floating chat, announcement explanations, portfolio insights
- **Smart fallback** — when the CSE API fails, scrapes the website and extracts data via Gemini AI
- **SQLite storage** — all data (holdings, watchlist, API keys) stored locally, never in `.env`
- **Dark/light mode** — mobile-first responsive design

---

## Quick Start

### 1. Clone & install

```bash
cd cse-pulse
npm install
```

### 2. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll be redirected to the setup wizard on first run.

### 3. Complete the Setup Wizard

The wizard will ask for:
- **Gemini API Key** (AI Studio or Vertex AI)
- **Scraper API Key** (optional, for fallback)
- **Starting cash balance** and preferences

---

## Getting API Keys

### Gemini AI (Required)

#### Option A — Google AI Studio (Easiest, has free tier)
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click "Get API key" → Create API key
3. Select "AI Studio" in the wizard

#### Option B — Vertex AI (Recommended for production)
1. Create a Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Vertex AI API**
3. Either:
   - Use **Vertex AI Express Mode** (API key, simplest): create a key in the Cloud Console
   - Use **Application Default Credentials**: run `gcloud auth application-default login` locally
4. Note your **Project ID** and **region** (default: `us-central1`)
5. Select "Vertex AI" in the wizard

**Models used:** `gemini-2.0-flash` (fast, cost-effective)

---

### Scraping Fallback (Optional but recommended)

When the official CSE API returns errors or stale data, the app falls back to scraping `cse.lk` and using Gemini to extract structured data.

#### Firecrawl (Best for AI — recommended)
1. Sign up at [firecrawl.dev](https://www.firecrawl.dev) — **500 free pages/month**
2. Get your API key from the dashboard
3. Select "Firecrawl" in settings

#### ScrapingBee
1. Sign up at [scrapingbee.com](https://www.scrapingbee.com) — **1,000 free credits/month**
2. Get your API key
3. Select "ScrapingBee" in settings

#### ScraperAPI
1. Sign up at [scraperapi.com](https://www.scraperapi.com) — **5,000 free calls/month**
2. Get your API key
3. Select "ScraperAPI" in settings

---

## Data Storage

All persistent data is stored in **`data/cse-pulse.db`** (SQLite):

| Table | Contents |
|---|---|
| `settings` | API keys, preferences (encrypted at rest by OS filesystem permissions) |
| `holdings` | Your stock holdings |
| `watchlist` | Watchlist with price alerts |
| `snapshots` | Daily portfolio value history (for performance chart) |
| `fallback_log` | Request log (used for fallback stats in Settings) |

**To reset everything:** Delete `data/cse-pulse.db` — the wizard will run again on next startup.

**The `data/` directory is in `.gitignore`** — your keys will never be accidentally committed.

---

## CSE API Endpoints Used

All calls go through `/api/cse/[endpoint]` (server-side, avoids CORS):

| Endpoint | Data |
|---|---|
| `marketStatus` | Market open/closed |
| `aspiData` / `snpData` | Index values |
| `topGainers` / `topLooses` / `mostActiveTrades` | Movers |
| `todaySharePrice` | Individual stock quotes |
| `companyInfoSummery` | Company fundamentals |
| `companyChartDataByStock` | Historical price chart |
| `approvedAnnouncement` | All announcements |
| `getFinancialAnnouncement` | Financial results |
| `getNewListingsRelatedNoticesAnnouncements` | New listings |
| `circularAnnouncement` | Circulars |
| `getBuyInBoardAnnouncements` | Buy-in board |

---

## Architecture

```
app/
├── api/
│   ├── cse/[endpoint]/    # Proxy to CSE API + fallback orchestration
│   ├── gemini/            # Chat (streaming SSE) + explain + portfolio insights
│   ├── scrape/            # Scraper ping/test
│   ├── portfolio/         # Holdings CRUD + snapshots
│   ├── watchlist/         # Watchlist CRUD
│   └── settings/          # Settings read/write
├── onboarding/            # First-run setup wizard (4 steps)
├── dashboard/             # Market overview
├── portfolio/             # Holdings + charts + AI insights
├── stocks/[symbol]/       # Stock detail + chart
├── watchlist/             # Watchlist + price alerts
├── announcements/         # Filtered announcements + Gemini explain
└── settings/              # API keys + preferences
lib/
├── db/                    # SQLite (better-sqlite3)
├── cse/                   # CSE API client + normalizers
├── scrape/                # Firecrawl / ScrapingBee / ScraperAPI adapters
├── gemini/                # @google/genai client (AI Studio + Vertex)
├── portfolio/             # P&L calculations
└── hooks/                 # TanStack Query hooks
```

---

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** + **shadcn/ui**
- **TanStack Query v5** — data fetching, polling, cache
- **Zustand** — UI state (chat open, sidebar, fallback active)
- **better-sqlite3** — local SQLite database
- **@google/genai** — Gemini AI (AI Studio + Vertex AI unified)
- **Recharts** — allocation pie + performance line + price charts
- **next-themes** — dark/light mode
- **sonner** — toast notifications

---

## Development Notes

- Market hours: **Mon–Fri 09:30–14:30 Colombo time (UTC+5:30)**. Polling switches from 30s → 5min outside hours.
- The CSE API uses **POST** requests for all endpoints (even data reads).
- Scraping respects a **5-second minimum interval** between calls to avoid rate limiting.
- Gemini chat uses **Server-Sent Events** for streaming responses.
- API keys are read from SQLite on **every server request** — no in-memory caching of secrets.
