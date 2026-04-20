# CSE Pulse

> **Fully vibe coded** — every line of this app was built through AI-assisted development. No traditional coding session, just vibes and iteration.

A personal real-time Colombo Stock Exchange (CSE) tracker with AI-powered portfolio management, price alerts, and multi-user support — hosted free on Vercel + Turso.

> **Disclaimer:** Unofficial app using public CSE data. Data may be delayed or inaccurate. **Not financial advice.** Always verify with official [CSE](https://www.cse.lk) sources before making investment decisions.

---

## Features

- **Real-time market data** — ASPI, S&P SL20, top gainers/losers/most active
- **Portfolio manager** — holdings, P&L, hidden fee tracking, allocation pie, performance chart, CSV export, image/Excel import
- **Watchlist with price alerts** — email notifications when price crosses threshold (via cron-job.org, every 5 min)
- **Announcements center** — filtered by category (Rights, Dividends, Financial Results, Circulars, etc.)
- **Gemini AI assistant** — floating chat, announcement explanations, portfolio insights
- **Image import** — scan broker screenshots to auto-populate holdings via Gemini Vision
- **Smart fallback** — when the CSE API fails, scrapes the website and extracts data via Gemini AI
- **Multi-user** — each Google account gets its own isolated portfolio, watchlist, and settings
- **Dark/light mode** — WCAG-compliant dark mode with elevation-based surfaces
- **Cloud storage** — all data stored in Turso (libSQL), no local files needed

---

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** + **Base UI** primitives
- **TanStack Query v5** — data fetching, polling, cache
- **Zustand** — UI state (chat, sidebar, fallback)
- **Auth.js v5** — Google OAuth authentication
- **@libsql/client** — Turso cloud SQLite database
- **@google/genai** — Gemini AI (AI Studio + Vertex AI)
- **Nodemailer** — price alert emails via SMTP
- **Recharts** — allocation pie, performance line, price charts
- **next-themes** — dark/light/system theme
- **sonner** — toast notifications

---

## Hosting (Free Tier)

| Service | Purpose | Free Tier |
|---|---|---|
| **Vercel** | App hosting + serverless | Hobby (free) |
| **Turso** | Cloud SQLite database | 500MB + 1B rows/month |
| **cron-job.org** | Price alert cron (every 5 min) | Free |
| **Google OAuth** | Authentication | Free |

---

## Environment Variables (Vercel)

| Variable | Description |
|---|---|
| `TURSO_DATABASE_URL` | Your Turso DB URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `AUTH_SECRET` | Random secret for Auth.js (run `openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `SMTP_HOST` | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (e.g. `587`) |
| `SMTP_USER` | SMTP username / email |
| `SMTP_PASS` | SMTP password / app password |
| `CRON_SECRET` | Random secret to protect `/api/alerts/check` |

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/sivavithu/cse-pulse.git
cd cse-pulse
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and fill in values (see table above).

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google and complete the onboarding wizard.

---

## Getting API Keys

### Gemini AI (Required for AI features)

#### Option A — Google AI Studio (Easiest, free tier)
1. Go to [aistudio.google.com](https://aistudio.google.com) → Get API key
2. Select **AI Studio** as provider in Settings

#### Option B — Vertex AI (Your own GCP project)
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable the **Vertex AI API**
3. Create a **Service Account** → download JSON key
4. Select **Vertex AI** in Settings, paste the JSON key
5. Project ID is auto-read from the JSON — no need to enter separately

**Configurable models per purpose** — Chat, Explain, Analysis, Agent/Image, Ping — all configurable per user in Settings with grouped dropdowns (Gemini 3.1 → 2.5 → 2.0 → 1.5).

---

### Scraping Fallback (Optional)

When the CSE API returns errors, the app falls back to scraping `cse.lk`.

| Service | Free Tier | Notes |
|---|---|---|
| [Firecrawl](https://firecrawl.dev) | 500 pages/month | Best quality |
| [ScrapingBee](https://scrapingbee.com) | 1,000 credits/month | |
| [ScraperAPI](https://scraperapi.com) | 5,000 calls/month | |

---

### Price Alert Emails

1. Set up **cron-job.org** to call `GET https://your-app.vercel.app/api/alerts/check` every 5 minutes
2. Add header: `Authorization: Bearer YOUR_CRON_SECRET`
3. Set `CRON_SECRET` in Vercel env vars (same value, without `Bearer`)
4. In Settings: enable email alerts, enter recipient email, configure SMTP
5. On Watchlist: set alert above/below price on any item

Cooldown: **4 hours** between repeated alerts for the same stock/threshold.

---

## Architecture

```
app/
├── api/
│   ├── alerts/check/      # Cron endpoint — checks all users' price alerts
│   ├── cse/[endpoint]/    # Proxy to CSE API + fallback orchestration
│   ├── gemini/            # Chat (SSE streaming), explain, portfolio insights, image extract, ping
│   ├── portfolio/         # Holdings CRUD + snapshots
│   ├── watchlist/         # Watchlist CRUD
│   └── settings/          # Per-user settings read/write
├── onboarding/            # First-run wizard (4 steps)
├── dashboard/             # Market overview
├── portfolio/             # Holdings + charts + AI insights
├── stocks/[symbol]/       # Stock detail + price chart
├── watchlist/             # Watchlist + alert management
├── announcements/         # Filtered feed + Gemini explain
└── settings/              # API keys, models, preferences
lib/
├── db/                    # Turso client + schema + queries
├── alerts/                # Alert checker (runAlertCheck)
├── auth/                  # Session helpers
├── cse/                   # CSE API client + quote normalizers
├── scrape/                # Firecrawl / ScrapingBee / ScraperAPI adapters
├── gemini/                # @google/genai client, per-user config, model routing
├── portfolio/             # P&L + allocation calculations
└── hooks/                 # TanStack Query hooks
```

---

## CSE API Endpoints Used

All proxied through `/api/cse/[endpoint]` (server-side to avoid CORS):

| Endpoint | Data |
|---|---|
| `marketStatus` | Market open/closed |
| `aspiData` / `snpData` | Index values |
| `topGainers` / `topLooses` / `mostActiveTrades` | Market movers |
| `todaySharePrice` | Live stock quotes |
| `companyInfoSummery` | Company fundamentals |
| `companyChartDataByStock` | Historical prices |
| `approvedAnnouncement` | All announcements |
| `getFinancialAnnouncement` | Financial results |
| `getNewListingsRelatedNoticesAnnouncements` | New listings |
| `circularAnnouncement` | Circulars |
| `getBuyInBoardAnnouncements` | Buy-in board |

---

## Development Notes

- Market hours: **Mon–Fri 09:30–14:30 Colombo time (UTC+5:30)**. Polling slows to 5min outside hours.
- CSE API uses **POST** for all endpoints, even reads.
- Alert cooldown uses **`ABS(threshold - ?) < 0.001`** for float comparison to avoid binary precision issues.
- Gemini chat uses **Server-Sent Events** for streaming.
- All user data is scoped by `user_email` — fully isolated per Google account.
- Service account JSON for Vertex AI is stored encrypted in Turso per user.
