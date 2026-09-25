/**
 * One place for every key. Each feature checks `features.x` and shows a clear
 * "not configured" state instead of failing mysteriously. Names accept both
 * the Vercel ↔ Supabase integration variables and Supabase's newer key names.
 */

const first = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return undefined;
};

export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  supabaseUrl: first("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"),
  supabasePublishableKey: first(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
  ),
  supabaseSecretKey: first("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),

  geminiApiKey: first("GEMINI_API_KEY", "GOOGLE_API_KEY"),
  // Verify these ids against https://ai.google.dev/gemini-api/docs/models before launch.
  geminiLiveModel: process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live",
  geminiFlashModel: process.env.GEMINI_FLASH_MODEL ?? "gemini-3.8-flash",

  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
};

export const features = {
  get supabase() {
    return Boolean(env.supabaseUrl && env.supabasePublishableKey);
  },
  get supabaseAdmin() {
    return Boolean(env.supabaseUrl && env.supabaseSecretKey);
  },
  get gemini() {
    return Boolean(env.geminiApiKey);
  },
  get paystack() {
    return Boolean(env.paystackSecretKey);
  },
};

export function requireEnv<T>(value: T | undefined, name: string): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is not configured. See .env.example.`);
  }
  return value;
}
