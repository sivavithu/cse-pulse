"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, AlertCircle, Loader2, Settings, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useThemePreference } from "@/lib/hooks/useThemePreference";

interface SettingsData {
  gemini_provider: string;
  gemini_api_key: string;
  gemini_project: string;
  gemini_location: string;
  gemini_service_account_json: string;
  gemini_model_agent: string;
  gemini_model_chat: string;
  gemini_model_explain: string;
  gemini_model_analysis: string;
  gemini_model_ping: string;
  scraper_service: string;
  scraper_key: string;
  fallback_enabled: string;
  alert_email: string;
  alerts_email_enabled: string;
  theme: string;
  fallbackStats?: { total: number; fallbacks: number };
}

export default function SettingsPage() {
  const { updateTheme } = useThemePreference();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [form, setForm] = useState<SettingsData>({
    gemini_provider: "vertex",
    gemini_api_key: "",
    gemini_project: "",
    gemini_location: "us-central1",
    gemini_service_account_json: "",
    gemini_model_agent: "",
    gemini_model_chat: "",
    gemini_model_explain: "",
    gemini_model_analysis: "",
    gemini_model_ping: "",
    scraper_service: "none",
    scraper_key: "",
    fallback_enabled: "false",
    alert_email: "",
    alerts_email_enabled: "false",
    theme: "system",
  });
  const [fallbackStats, setFallbackStats] = useState({ total: 0, fallbacks: 0 });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"ai" | "scraper" | "email" | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        setForm((f) => ({ ...f, ...j.settings }));
        setFallbackStats(j.fallbackStats ?? { total: 0, fallbacks: 0 });
      })
      .catch(() => {});
  }, []);

  function set(key: keyof SettingsData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const { fallbackStats: _ignore, ...formWithoutStats } = form;
      const payload: Record<string, string> = { ...formWithoutStats };
      // Don't overwrite keys with masked value
      if (payload.gemini_api_key === "***") delete payload.gemini_api_key;
      if (payload.scraper_key === "***") delete payload.scraper_key;
      if (!payload.gemini_service_account_json) delete payload.gemini_service_account_json;

      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function testAI() {
    setTesting("ai");
    try {
      const res = await fetch("/api/gemini/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: form.gemini_api_key === "***" ? undefined : form.gemini_api_key,
          provider: form.gemini_provider,
          project: form.gemini_project,
          location: form.gemini_location,
          serviceAccountJson: form.gemini_service_account_json === "***" ? undefined : form.gemini_service_account_json || undefined,
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

  async function testEmail() {
    setTesting("email");
    try {
      // Persist latest recipient first so the server sees it.
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_email: form.alert_email }),
      });
      const res = await fetch("/api/alerts/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true, to: form.alert_email }),
      });
      const j = await res.json();
      setTestResult((t) => ({
        ...t,
        email: { ok: !!j.ok, msg: j.ok ? `Test email sent to ${form.alert_email}` : j.error },
      }));
    } catch (e) {
      setTestResult((t) => ({ ...t, email: { ok: false, msg: String(e) } }));
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
        body: JSON.stringify({
          service: form.scraper_service,
          apiKey: form.scraper_key === "***" ? undefined : form.scraper_key,
        }),
      });
      const j = await res.json();
      setTestResult((t) => ({ ...t, scraper: { ok: j.ok, msg: j.ok ? `OK (${j.chars} chars)` : j.error } }));
    } catch (e) {
      setTestResult((t) => ({ ...t, scraper: { ok: false, msg: String(e) } }));
    } finally {
      setTesting(null);
    }
  }

  async function resetOnboarding() {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_complete: "false" }),
      });
      window.location.href = "/onboarding";
    } catch {
      toast.error("Failed to reset onboarding");
    }
  }

  return (
    <div className="page-shell">
      <section className="page-hero">
        <div className="max-w-3xl">
          <p className="eyebrow">Profile and Automation</p>
          <h1 className="hero-title">Settings</h1>
          <p className="hero-copy">
            Configure AI access, fallback scraping, alert delivery, and the way your workspace behaves across devices.
          </p>
        </div>
        <div className="panel-muted flex items-center gap-2 text-xs">
          <Settings className="h-3.5 w-3.5 text-primary" />
          Preferences are stored per signed-in user.
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
      {/* AI Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gemini AI</CardTitle>
          <CardDescription>Configure your AI provider for analysis and chat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <RadioGroup
              value={form.gemini_provider}
              onValueChange={(v) => set("gemini_provider", v)}
              className="flex gap-4"
            >
              {[
                { value: "vertex", label: "Vertex AI" },
                { value: "aistudio", label: "AI Studio" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`prov-${opt.value}`} />
                  <Label htmlFor={`prov-${opt.value}`} className="cursor-pointer">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label>API Key</Label>
            <Input
              type="password"
              placeholder={form.gemini_api_key === "***" ? "Key is saved (enter new to change)" : "AIza..."}
              onChange={(e) => set("gemini_api_key", e.target.value)}
            />
          </div>

          {form.gemini_provider === "vertex" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Project ID</Label>
                  <Input
                    placeholder="my-project"
                    value={form.gemini_project}
                    onChange={(e) => set("gemini_project", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Region</Label>
                  <Select value={form.gemini_location} onValueChange={(v) => v && set("gemini_location", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[
                        "us-central1", "us-east1", "us-east4", "us-east5", "us-south1", "us-west1", "us-west4",
                        "northamerica-northeast1", "northamerica-northeast2",
                        "southamerica-east1", "southamerica-west1",
                        "europe-central2", "europe-north1", "europe-southwest1",
                        "europe-west1", "europe-west2", "europe-west3", "europe-west4", "europe-west6", "europe-west8", "europe-west9",
                        "asia-east1", "asia-east2", "asia-northeast1", "asia-northeast2", "asia-northeast3",
                        "asia-south1", "asia-south2", "asia-southeast1", "asia-southeast2",
                        "australia-southeast1", "australia-southeast2",
                        "me-central1", "me-central2", "me-west1",
                        "africa-south1",
                      ].map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Service Account JSON</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={form.gemini_service_account_json === "***" ? "Saved (paste new JSON to replace)" : '{"type":"service_account","project_id":"...",...}'}
                  value={form.gemini_service_account_json === "***" ? "" : form.gemini_service_account_json}
                  onChange={(e) => set("gemini_service_account_json", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Required on Vercel — not needed locally (uses gcloud ADC).</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Models per Purpose</Label>
            <p className="text-xs text-muted-foreground">Defaults shown in parentheses. AI Studio and Vertex share these IDs.</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "gemini_model_chat",     label: "Chat",         default: "gemini-2.5-flash" },
                { key: "gemini_model_explain",  label: "Explain",      default: "gemini-2.5-flash" },
                { key: "gemini_model_analysis", label: "Analysis",     default: "gemini-2.5-pro"   },
                { key: "gemini_model_agent",    label: "Agent / Image",default: "gemini-2.5-flash" },
                { key: "gemini_model_ping",     label: "Ping / Test",  default: "gemini-2.0-flash" },
              ] as const).map(({ key, label, default: def }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Select value={form[key] || def} onValueChange={(v) => v && set(key, v === def ? "" : v)}>
                    <SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" disabled className="text-xs text-muted-foreground">— default —</SelectItem>
                      {[
                        { group: "Gemini 2.5", models: [
                          { id: "gemini-2.5-pro",       label: "2.5 Pro" },
                          { id: "gemini-2.5-flash",     label: "2.5 Flash" },
                          { id: "gemini-2.5-flash-lite",label: "2.5 Flash Lite" },
                        ]},
                        { group: "Gemini 2.0", models: [
                          { id: "gemini-2.0-flash",     label: "2.0 Flash" },
                          { id: "gemini-2.0-flash-lite",label: "2.0 Flash Lite" },
                        ]},
                        { group: "Gemini 1.5", models: [
                          { id: "gemini-1.5-pro",       label: "1.5 Pro" },
                          { id: "gemini-1.5-flash",     label: "1.5 Flash" },
                          { id: "gemini-1.5-flash-8b",  label: "1.5 Flash 8B" },
                        ]},
                      ].map(({ group, models }) => (
                        <SelectGroup key={group}>
                          <SelectLabel className="text-xs">{group}</SelectLabel>
                          {models.map(({ id, label: ml }) => (
                            <SelectItem key={id} value={id} className="text-xs">
                              {ml} <span className="text-muted-foreground ml-1">{id}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={testing === "ai"} onClick={testAI}>
              {testing === "ai" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Test Connection
            </Button>
            {testResult.ai && (
              <div className={cn("flex items-center gap-1.5 text-sm", testResult.ai.ok ? "text-emerald-500" : "text-destructive")}>
                {testResult.ai.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {testResult.ai.msg}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scraping Fallback */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Scraping Fallback</CardTitle>
              <CardDescription>Used when the official CSE API fails.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="fallback-toggle" className="text-sm">Enable</Label>
              <Switch
                id="fallback-toggle"
                checked={form.fallback_enabled === "true"}
                onCheckedChange={(v) => set("fallback_enabled", v ? "true" : "false")}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {fallbackStats.total > 0 && (
            <div className="flex gap-3">
              <Badge variant="outline">Total requests (24h): {fallbackStats.total}</Badge>
              <Badge variant={fallbackStats.fallbacks > 0 ? "secondary" : "outline"}>
                Fallback used: {fallbackStats.fallbacks}
              </Badge>
            </div>
          )}

          <div className="space-y-2">
            <Label>Service</Label>
            <RadioGroup
              value={form.scraper_service}
              onValueChange={(v) => set("scraper_service", v)}
              className="space-y-1.5"
            >
              {[
                { value: "none", label: "None" },
                { value: "firecrawl", label: "Firecrawl (recommended)" },
                { value: "scrapingbee", label: "ScrapingBee" },
                { value: "scraperapi", label: "ScraperAPI" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`svc-${opt.value}`} />
                  <Label htmlFor={`svc-${opt.value}`} className="cursor-pointer text-sm">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {form.scraper_service !== "none" && (
            <div className="space-y-1.5">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder={form.scraper_key === "***" ? "Key is saved (enter new to change)" : "Your scraper key"}
                onChange={(e) => set("scraper_key", e.target.value)}
              />
              <div className="flex items-center gap-3 pt-1">
                <Button variant="outline" size="sm" disabled={testing === "scraper"} onClick={testScraper}>
                  {testing === "scraper" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
        </CardContent>
      </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
      {/* Email Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Email Alerts</CardTitle>
              <CardDescription>
                Sent from <code className="text-xs">vithus1912@gmail.com</code> when a watchlist price threshold trips.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="email-alerts-toggle" className="text-sm">Enable</Label>
              <Switch
                id="email-alerts-toggle"
                checked={form.alerts_email_enabled === "true"}
                onCheckedChange={(v) => set("alerts_email_enabled", v ? "true" : "false")}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Send alerts to</Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={form.alert_email}
              onChange={(e) => set("alert_email", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The address that receives price alerts. Save before sending a test.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              disabled={testing === "email" || !form.alert_email}
              onClick={testEmail}
            >
              {testing === "email" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send Test Email
            </Button>
            {testResult.email && (
              <div
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  testResult.email.ok ? "text-emerald-500" : "text-destructive"
                )}
              >
                {testResult.email.ok ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {testResult.email.msg}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            {["light", "dark", "system"].map((t) => (
              <Button
                key={t}
                variant={mounted && form.theme === t ? "default" : "outline"}
                size="sm"
                className="capitalize"
                onClick={async () => {
                  set("theme", t);
                  await updateTheme(t as "light" | "dark" | "system");
                }}
              >
                {t}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Save & Danger Zone */}
      <div className="flex gap-3 flex-wrap">
        <Button onClick={save} disabled={saving} className="flex-1 sm:flex-none">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Save Settings
        </Button>
      </div>

      <Separator />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Open Setup Wizard</p>
              <p className="text-xs text-muted-foreground">Run the optional onboarding flow again</p>
            </div>
            <Button variant="outline" size="sm" onClick={resetOnboarding}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Open
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        All keys stored locally in SQLite (data/cse-pulse.db). Never committed to git or sent to any third party.
      </p>
    </div>
  );
}
