export const site = {
  name: "Okwan",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://okwan.ai",
  tagline: "US visa interview practice, built for Ghana",
  description:
    "Okwan is a realistic US visa interview simulator for Ghanaians. Upload your documents, face an officer who has read your case, and get an honest debrief. F-1 and B1/B2. Pay with MoMo.",
  locale: "en_GH",
  lang: "en-GH",
  social: [] as string[],
} as const;
