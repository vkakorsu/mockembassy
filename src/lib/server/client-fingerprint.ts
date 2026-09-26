import "server-only";
import { createHash } from "node:crypto";

/**
 * Coarse fingerprint: the /24 (IPv4) or /48 (IPv6) network plus the user
 * agent, hashed. It can't identify a person; it only tells us whether one
 * pass is being used from many different places (possible sharing).
 */
export function clientFingerprint(req: Request): string {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const prefix = ip.includes(":") ? ip.split(":").slice(0, 3).join(":") : ip.split(".").slice(0, 3).join(".");
  const ua = req.headers.get("user-agent") ?? "";
  return createHash("sha256").update(`okwan|${prefix}|${ua}`).digest("hex").slice(0, 16);
}
