import { describe, expect, it } from "vitest";
import { drillEntitlement, entitlement } from "@/lib/domain/entitlement";
import { canonicalEmail, isDisposableEmail, TOKENS_PER_SESSION, tokenAllowed } from "@/lib/domain/abuse";

describe("abuse limits", () => {
  it("treats aliases of one inbox as one person", () => {
    expect(canonicalEmail("V.Kakorsu+test@Gmail.com")).toBe("vkakorsu@gmail.com");
    expect(canonicalEmail("vkakorsu@googlemail.com")).toBe("vkakorsu@gmail.com");
    expect(canonicalEmail("kofi.mensah+2@yahoo.com")).toBe("kofi.mensah@yahoo.com");
  });

  it("spots throwaway inboxes", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@x.mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@gmail.com")).toBe(false);
    expect(isDisposableEmail("a@ug.edu.gh")).toBe(false);
  });

  it("allows a reconnect, not an endless stream of Live tokens", () => {
    const now = new Date("2026-09-26T10:00:00Z");
    const base = { startedAt: null, tokensIssued: 0, tokenLifetimeSec: 300, now };
    expect(tokenAllowed(base).ok).toBe(true);
    expect(tokenAllowed({ ...base, startedAt: new Date(now.getTime() - 60_000), tokensIssued: 1 }).ok).toBe(true);
    expect(tokenAllowed({ ...base, tokensIssued: TOKENS_PER_SESSION }).ok).toBe(false);
    expect(tokenAllowed({ ...base, startedAt: new Date(now.getTime() - 301_000), tokensIssued: 1 }).ok).toBe(false);
  });

  it("blocks free sessions (not paid ones) when the account isn't eligible", () => {
    const none = { interviews: 0, drills: 0, expiresAt: null };
    const paid = { interviews: 2, drills: 5, expiresAt: new Date() };
    const why = "Confirm your email";
    expect(entitlement({ credits: none, freeSessionsUsed: 0, freeBlocked: why })).toEqual({ kind: "none", reason: why });
    expect(entitlement({ credits: paid, freeSessionsUsed: 0, freeBlocked: why }).kind).toBe("full");
    expect(drillEntitlement({ credits: none, freeDrillsUsed: 0, freeBlocked: why }).kind).toBe("none");
    expect(drillEntitlement({ credits: none, freeDrillsUsed: 0 }).kind).toBe("free");
  });
});
