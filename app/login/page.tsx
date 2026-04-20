import { signIn } from "@/auth";
import { ArrowRight, BarChart3, BellRing, ShieldCheck, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    title: "Track positions live",
    copy: "Portfolio totals, watchlist thresholds, and market movers stay in the same workspace.",
    icon: BarChart3,
  },
  {
    title: "Get alert coverage",
    copy: "Price triggers and filing notifications can route to each signed-in user's own settings.",
    icon: BellRing,
  },
  {
    title: "Keep setup local",
    copy: "Keys and personal preferences remain in your local SQLite store, scoped to your account.",
    icon: ShieldCheck,
  },
];

export default function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-8 md:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <section className="page-hero flex flex-col justify-between">
          <div className="max-w-3xl space-y-5">
            <p className="eyebrow">Colombo Market Desk</p>
            <div className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-[22px] border border-primary/20 bg-primary/10 text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-5xl">CSE Pulse</h1>
                <p className="text-sm text-muted-foreground md:text-base">
                  A denser personal workspace for Colombo Stock Exchange tracking.
                </p>
              </div>
            </div>
            <p className="hero-copy">
              Sign in to open your portfolio, watchlist, alert preferences, and AI-assisted market workflows with the right per-user data already attached.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {FEATURES.map(({ title, copy, icon: Icon }) => (
              <div key={title} className="panel-muted p-4">
                <Icon className="mb-3 h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center">
          <div className="w-full rounded-[2rem] border border-border/70 bg-card/88 p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.55)] backdrop-blur-2xl md:p-8">
            <div className="mb-6">
              <p className="eyebrow">Access</p>
              <h2 className="mt-4 font-heading text-2xl font-semibold">Sign in with Google</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use the Google account you want tied to this workspace. Each account keeps separate settings, watchlists, and alert targets.
              </p>
            </div>

            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/dashboard" });
              }}
              className="space-y-4"
            >
              <Button type="submit" size="lg" className="w-full justify-between rounded-2xl px-5">
                <span className="flex items-center gap-3">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue with Google
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-6 rounded-[1.5rem] border border-border/70 bg-background/55 px-4 py-3 text-xs leading-5 text-muted-foreground">
              Unofficial app. Not financial advice. Public market data may be delayed and should be verified against official CSE sources.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
