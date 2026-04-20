import { GoogleGenAI } from "@google/genai";
import { getUserSetting } from "@/lib/db/queries";
import type { GeminiConfig, GeminiProvider } from "./client";

export const MODELS = {
  agent: "gemini-2.5-flash",
  chat: "gemini-2.5-flash",
  explain: "gemini-2.5-flash",
  analysis: "gemini-2.5-pro",
  ping: "gemini-2.0-flash",
} as const;

export type TaskType = keyof typeof MODELS;

const userClients = new Map<string, { ai: GoogleGenAI; config: GeminiConfig; cacheKey: string }>();

async function loadUserConfig(userEmail: string): Promise<GeminiConfig> {
  const [provider, apiKey, project, location, serviceAccountJson] = await Promise.all([
    getUserSetting(userEmail, "gemini_provider"),
    getUserSetting(userEmail, "gemini_api_key"),
    getUserSetting(userEmail, "gemini_project"),
    getUserSetting(userEmail, "gemini_location"),
    getUserSetting(userEmail, "gemini_service_account_json"),
  ]);
  return {
    provider: (provider ?? "aistudio") as GeminiProvider,
    apiKey: apiKey ?? "",
    project: project ?? undefined,
    location: location ?? "us-central1",
    serviceAccountJson: serviceAccountJson ?? undefined,
  };
}

async function applyVertexCredentials(serviceAccountJson?: string) {
  const sa = serviceAccountJson ?? process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (sa) {
    const fs = await import("fs");
    fs.writeFileSync("/tmp/sa.json", sa);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/sa.json";
  }
}

async function buildClient(config: GeminiConfig): Promise<GoogleGenAI> {
  if (config.provider === "vertex") {
    await applyVertexCredentials(config.serviceAccountJson);
    if (config.project) {
      return new GoogleGenAI({
        vertexai: true,
        project: config.project,
        location: config.location ?? "us-central1",
      } as ConstructorParameters<typeof GoogleGenAI>[0]);
    }
    return new GoogleGenAI({ vertexai: true, apiKey: config.apiKey } as ConstructorParameters<typeof GoogleGenAI>[0]);
  }
  return new GoogleGenAI({ apiKey: config.apiKey });
}

function configCacheKey(config: GeminiConfig): string {
  return JSON.stringify({ provider: config.provider, apiKey: config.apiKey, project: config.project ?? "", location: config.location ?? "" });
}

export function hasGeminiConfig(config: GeminiConfig): boolean {
  return config.provider === "vertex"
    ? Boolean(config.project || config.apiKey)
    : Boolean(config.apiKey);
}

export async function getUserGeminiConfig(userEmail: string): Promise<GeminiConfig> {
  return loadUserConfig(userEmail);
}

export async function getUserClient(userEmail: string): Promise<{ ai: GoogleGenAI; config: GeminiConfig }> {
  const config = await loadUserConfig(userEmail);
  const cacheKey = configCacheKey(config);
  const cached = userClients.get(userEmail);
  if (cached && cached.cacheKey === cacheKey) return { ai: cached.ai, config: cached.config };
  const ai = await buildClient(config);
  userClients.set(userEmail, { ai, config, cacheKey });
  return { ai, config };
}

export function invalidateGlobalClient(): void {
  userClients.clear();
}

export function invalidateUserClient(userEmail?: string): void {
  if (userEmail) { userClients.delete(userEmail); return; }
  userClients.clear();
}

export function modelFor(task: TaskType): string {
  return MODELS[task];
}
