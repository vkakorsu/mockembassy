import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Only list pages that exist; lastModified is set when content really changes. */
const CONTENT_UPDATED = new Date("2026-09-25");

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url, lastModified: CONTENT_UPDATED, changeFrequency: "weekly", priority: 1 }];
}
