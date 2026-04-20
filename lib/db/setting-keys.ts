export const USER_SETTING_KEYS = [
  "gemini_provider",
  "gemini_api_key",
  "gemini_project",
  "gemini_location",
  "gemini_service_account_json",
  "scraper_service",
  "scraper_key",
  "fallback_enabled",
  "alert_email",
  "alerts_email_enabled",
  "cash_balance",
  "total_deposit",
  "buying_power",
  "total_dividend",
  "onboarding_complete",
  "polling_interval",
  "theme",
] as const;

export const SECRET_SETTING_KEYS = ["gemini_api_key", "scraper_key", "gemini_service_account_json"] as const;

const USER_SETTING_KEY_SET = new Set<string>(USER_SETTING_KEYS);

export type UserSettingKey = (typeof USER_SETTING_KEYS)[number];

export function isUserSettingKey(key: string): key is UserSettingKey {
  return USER_SETTING_KEY_SET.has(key);
}
