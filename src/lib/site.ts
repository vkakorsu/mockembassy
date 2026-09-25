/** Accepts "okwan.ai", "https://okwan.ai/" or blank (empty env vars are treated as unset). */
function origin(value: string | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).origin;
  } catch {
    return undefined;
  }
}

export const siteOrigin = (fallback: string) =>
  origin(process.env.NEXT_PUBLIC_SITE_URL) ??
  origin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  origin(process.env.VERCEL_URL) ??
  fallback;

export const site = {
  name: "Okwan",
  // Canonical origin: the real domain once it's set, else Vercel's production URL.
  url: siteOrigin("https://okwan.ai"),
  tagline: "US visa interview practice, built for Ghana",
  description:
    "Okwan is a realistic US visa interview simulator for Ghanaians. Upload your documents, face an officer who has read your case, and get an honest debrief. F-1 and B1/B2. Pay with MoMo.",
  locale: "en_GH",
  lang: "en-GH",
  social: [] as string[],
} as const;
