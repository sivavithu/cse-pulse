"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertCircle, Loader2, TrendingUp, Shield, Zap, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "welcome" | "ai" | "scraper" | "defaults";
const STEPS: Step[] = ["welcome", "ai", "scraper", "defaults"];

interface FormData {
  gemini_provider: "aistudio" | "vertex";
  gemini_api_key: string;
  gemini_project: string;
  gemini_location: string;
  gemini_service_account_json: string;
  scraper_service: "firecrawl" | "scrapingbee" | "scraperapi" | "none";
  scraper_key: string;
  fallback_enabled: string;
  cash_balance: string;
  polling_interval: string;
  theme: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [step, setStep] = useState<Step>("welcome");
  const [accepted, setAccepted] = useState(false);
  const [testing, setTesting] = useState<"ai" | "scraper" | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormData>({
    gemini_provider: "vertex",
    gemini_api_key: "",
    gemini_project: "",
    gemini_location: "us-central1",
    gemini_service_account_json: "",
    scraper_service: "none",
    scraper_key: "",
    fallback_enabled: "false",
    cash_balance: "0",
    polling_interval: "30",
    theme: "system",
  });

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  function set(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function testAI() {
    setTesting("ai");
    try {
      const res = await fetch("/api/gemini/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: form.gemini_api_key,
          provider: form.gemini_provider,
          project: form.gemini_project,
          location: form.gemini_location,
          serviceAccountJson: form.gemini_service_account_json || undefined,
        }),
      });
      const j = await res.json();
      setTestResult((t) => ({ ...t, ai: { ok: j.ok, msg: j.ok ? "Connected!" : j.error } }));
    } catch (e) {
      setTestResult((t) => ({ ...t, ai: { ok: false, msg: String(e) } }));
    } finally {
      setTesting(null);
    }
  }

  async function testScraper() {
    setTesting("scraper");
    try {
      const res = await fetch("/api/scrape/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: form.scraper_service, apiKey: form.scraper_key }),
      });
      const j = await res.json();
      setTestResult((t) => ({ ...t, scraper: { ok: j.ok, msg: j.ok ? `OK (${j.chars} chars)` : j.error } }));
    } catch (e) {
      setTestResult((t) => ({ ...t, scraper: { ok: false, msg: String(e) } }));
    } finally {
      setTesting(null);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      const settings: Record<string, string> = {
        ...form,
        onboarding_complete: "true",
        fallback_enabled: form.scraper_service !== "none" ? "true" : "false",
      };
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setTheme(form.theme);
      toast.success("Setup complete! Welcome to CSE Pulse.");
      router.push("/dashboard");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  function skipForNow() {
    router.push("/dashboard");
  }

  function logout() {
    void signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">CSE Pulse</h1>
          </div>
          <p className="text-muted-foreground">Personal Colombo Stock Exchange Tracker</p>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={logout}>
            Sign out
          </Button>
          <Button variant="outline" size="sm" onClick={skipForNow}>
            Skip for now
          </Button>
        </div>

        {/* ── Welcome ── */}
        {step === "welcome" && (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to CSE Pulse</CardTitle>
              <CardDescription>Optional setup for AI, scraping fallback, and your starting preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {[
                  { icon: <TrendingUp className="h-5 w-5 text-blue-500" />, title: "Real-time Market Data", desc: "Live ASPI, S&P SL20, gainers, losers from CSE" },
                  { icon: <Shield className="h-5 w-5 text-emerald-500" />, title: "Smart Fallback", desc: "Automatic scraping fallback when official API fails" },
                  { icon: <Zap className="h-5 w-5 text-amber-500" />, title: "Gemini AI Assistant", desc: "Ask about your portfolio, market, and announcements" },
                ].map((f) => (
                  <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    {f.icon}
                    <div>
                      <p className="font-medium text-sm">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className={cn(
                "rounded-lg border p-3 text-sm space-y-1 cursor-pointer transition-colors",
                accepted ? "border-emerald-500 bg-emerald-500/10" : "border-border hover:border-primary"
              )} onClick={() => setAccepted(!accepted)}>
                <div className="flex items-center gap-2">
                  {accepted ? (
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium">I understand & accept</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  This is an unofficial app using public CSE data and web scraping. Data may be delayed or inaccurate.
                  <strong> Not financial advice.</strong> Always verify with official CSE sources.
                </p>
              </div>

              <Button className="w-full" disabled={!accepted} onClick={() => setStep("ai")}>
                Get Started <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── AI Provider ── */}
        {step === "ai" && (
          <Card>
            <CardHeader>
              <CardTitle>AI Provider Setup</CardTitle>
              <CardDescription>CSE Pulse uses Gemini AI for smart analysis and Q&A.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <RadioGroup
                  value={form.gemini_provider}
                  onValueChange={(v) => set("gemini_provider", v)}
                  className="grid grid-cols-2 gap-3"
                >
                  {[
                    { value: "vertex", label: "Vertex AI", desc: "Google Cloud (recommended)" },
                    { value: "aistudio", label: "AI Studio", desc: "Free tier available" },
                  ].map((opt) => (
                    <div key={opt.value}>
                      <RadioGroupItem value={opt.value} id={opt.value} className="sr-only" />
                      <Label
                        htmlFor={opt.value}
                        className={cn(
                          "flex flex-col gap-1 p-3 rounded-lg border cursor-pointer transition-colors",
                          form.gemini_provider === opt.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <span className="font-medium text-sm">{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">
                  {form.gemini_provider === "vertex" ? "API Key (Express Mode) or leave blank for ADC" : "API Key"}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="AIza... or your Vertex Express key"
                  value={form.gemini_api_key}
                  onChange={(e) => set("gemini_api_key", e.target.value)}
                />
              </div>

              {form.gemini_provider === "vertex" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="project">Project ID <span className="text-destructive">*</span></Label>
                      <Input
                        id="project"
                        placeholder="my-gcp-project"
                        value={form.gemini_project}
                        onChange={(e) => set("gemini_project", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Region</Label>
                      <Select value={form.gemini_location} onValueChange={(v) => v && set("gemini_location", v)}>
                        <SelectTrigger id="location"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["us-central1", "us-east1", "europe-west1", "asia-southeast1"].map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Service Account JSON</Label>
                    <textarea
                      className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={'{"type":"service_account","project_id":"...",...}'}
                      value={form.gemini_service_account_json}
                      onChange={(e) => set("gemini_service_account_json", e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Required on Vercel — not needed locally (uses gcloud ADC).</p>
                  </div>
                </div>
              )}

              {/* Test button */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!form.gemini_api_key || testing === "ai"}
                  onClick={testAI}
                >
                  {testing === "ai" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Test Connection
                </Button>
                {testResult.ai && (
                  <div className={cn("flex items-center gap-1.5 text-sm", testResult.ai.ok ? "text-emerald-500" : "text-destructive")}>
                    {testResult.ai.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {testResult.ai.msg}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("welcome")}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button className="flex-1" disabled={!form.gemini_api_key} onClick={() => setStep("scraper")}>
                  Next: Scraper <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Scraper ── */}
        {step === "scraper" && (
          <Card>
            <CardHeader>
              <CardTitle>Scraping Fallback <Badge variant="secondary">Optional</Badge></CardTitle>
              <CardDescription>
                When the CSE API fails, this scrapes the website and uses Gemini to extract data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Scraping Service</Label>
                <RadioGroup
                  value={form.scraper_service}
                  onValueChange={(v) => set("scraper_service", v)}
                  className="space-y-2"
                >
                  {[
                    { value: "none", label: "Disabled", desc: "No fallback scraping" },
                    { value: "firecrawl", label: "Firecrawl", desc: "Best for AI — clean markdown output. Free tier: 500 pages/month" },
                    { value: "scrapingbee", label: "ScrapingBee", desc: "Reliable. Free tier: 1,000 credits/month" },
                    { value: "scraperapi", label: "ScraperAPI", desc: "Simple & fast. Free tier: 5,000 calls/month" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-start gap-3">
                      <RadioGroupItem value={opt.value} id={`s-${opt.value}`} className="mt-1" />
                      <Label htmlFor={`s-${opt.value}`} className="cursor-pointer">
                        <span className="font-medium">{opt.label}</span>
                        <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {form.scraper_service !== "none" && (
                <div className="space-y-2">
                  <Label htmlFor="scraperKey">API Key</Label>
                  <Input
                    id="scraperKey"
                    type="password"
                    placeholder="Your scraper API key"
                    value={form.scraper_key}
                    onChange={(e) => set("scraper_key", e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!form.scraper_key || testing === "scraper"}
                      onClick={testScraper}
                    >
                      {testing === "scraper" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Test Scraper
                    </Button>
                    {testResult.scraper && (
                      <div className={cn("flex items-center gap-1.5 text-sm", testResult.scraper.ok ? "text-emerald-500" : "text-destructive")}>
                        {testResult.scraper.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {testResult.scraper.msg}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("ai")}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button className="flex-1" onClick={() => setStep("defaults")}>
                  Next: Defaults <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Defaults ── */}
        {step === "defaults" && (
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Customize your starting setup.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cash">Starting Cash Balance (LKR)</Label>
                <Input
                  id="cash"
                  type="number"
                  placeholder="500000"
                  value={form.cash_balance}
                  onChange={(e) => set("cash_balance", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Theme</Label>
                <RadioGroup value={form.theme} onValueChange={(v) => set("theme", v)} className="flex gap-4">
                  {["light", "dark", "system"].map((t) => (
                    <div key={t} className="flex items-center gap-2">
                      <RadioGroupItem value={t} id={`theme-${t}`} />
                      <Label htmlFor={`theme-${t}`} className="capitalize cursor-pointer">{t}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("scraper")}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button className="flex-1" disabled={saving} onClick={finish}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Complete Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Your API keys are stored locally in SQLite and never transmitted anywhere except directly to the respective API provider.
        </p>
      </div>
    </div>
  );
}
