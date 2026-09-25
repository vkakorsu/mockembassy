"use client";
import { createBrowserClient } from "@supabase/ssr";

export function createClient(url: string, publishableKey: string) {
  return createBrowserClient(url, publishableKey);
}
