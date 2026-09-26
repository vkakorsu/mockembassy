import { describe, expect, it } from "vitest";
import { isRepeatRequest, stripToolText } from "../transcript";

describe("transcripts", () => {
  it("removes function calls the model spoke as text", () => {
    expect(
      stripToolText("Good morning. Passport and I-20, please. smog_probe(probe_id='f1.career.after',quality='weak')\n... What will you do after you graduate?"),
    ).toBe("Good morning. Passport and I-20, please. What will you do after you graduate?");
    expect(stripToolText("Where is the money coming from?")).toBe("Where is the money coming from?");
  });

  it("recognises requests to repeat", () => {
    expect(isRepeatRequest("What?")).toBe(true);
    expect(isRepeatRequest("Sorry?")).toBe(true);
    expect(isRepeatRequest("Can you repeat the question please?")).toBe(true);
    expect(isRepeatRequest("What I plan to do is return to Ghana.")).toBe(false);
  });
});
