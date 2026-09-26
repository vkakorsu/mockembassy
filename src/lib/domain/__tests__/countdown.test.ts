import { describe, expect, it } from "vitest";
import { countdownLabel, daysUntil } from "@/lib/countdown";

describe("interview countdown", () => {
  const now = Date.parse("2026-09-26T20:00:00Z");
  it("counts calendar days, not 24-hour blocks", () => {
    expect(daysUntil("2026-09-27T09:00:00Z", now)).toBe(1);
    expect(daysUntil("2026-10-08T09:00:00Z", now)).toBe(12);
    expect(daysUntil("2026-09-26T09:00:00Z", now)).toBe(0);
  });
  it("says it plainly", () => {
    expect(countdownLabel(12)).toBe("12 days to go");
    expect(countdownLabel(1)).toBe("Interview tomorrow");
    expect(countdownLabel(0)).toBe("Interview today");
    expect(countdownLabel(-2)).toBe("Interview done");
  });
});
