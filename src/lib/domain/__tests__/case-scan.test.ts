import { describe, expect, it } from "vitest";
import { scanCase } from "../case-scan";
import { amaF1, kofiB1B2 } from "../fixtures";

describe("scanCase", () => {
  it("flags Ama's funding gap and recent deposit, most severe first", () => {
    const ids = scanCase(amaF1).map((f) => f.id);
    expect(ids[0]).toBe("funding_gap");
    expect(ids).toContain("large_deposit");
    expect(ids).toContain("social_media");
  });

  it("flags Kofi's prior refusal as high severity", () => {
    const refusal = scanCase(kofiB1B2).find((f) => f.id === "prior_refusal");
    expect(refusal?.severity).toBe("high");
  });

  it("never outputs an approval probability", () => {
    const text = JSON.stringify(scanCase(amaF1)) + JSON.stringify(scanCase(kofiB1B2));
    expect(text).not.toMatch(/%|probability|chance/i);
  });
});
