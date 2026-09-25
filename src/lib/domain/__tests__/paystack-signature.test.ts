import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
process.env.PAYSTACK_SECRET_KEY = "sk_test_example";

describe("paystack webhook signature", async () => {
  const { isValidSignature, allowedAmounts } = await import("@/lib/server/paystack");
  const body = JSON.stringify({ event: "charge.success", data: { reference: "r1" } });
  const good = createHmac("sha512", "sk_test_example").update(body).digest("hex");

  it("accepts Paystack's signature and rejects tampering", () => {
    expect(isValidSignature(body, good)).toBe(true);
    expect(isValidSignature(body + " ", good)).toBe(false);
    expect(isValidSignature(body, null)).toBe(false);
    expect(isValidSignature(body, "abc")).toBe(false);
  });

  it("only accepts real plan prices", () => {
    expect(allowedAmounts("pass")).toEqual([24900, 34900]);
    expect(allowedAmounts("sprint")).toEqual([14900]);
  });
});
