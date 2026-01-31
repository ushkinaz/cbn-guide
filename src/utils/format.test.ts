import { describe, it, expect } from "vitest";
import { cleanText } from "./format";

describe("cleanText", () => {
  it("removes color tags", () => {
    expect(cleanText("Hello <color_red>World</color>")).toBe("Hello World");
    expect(cleanText("<info>Info</info>")).toBe("Info");
    expect(cleanText("A<good>B</good>C")).toBe("ABC");
  });

  it("handles newlines", () => {
    expect(cleanText("Hello\nWorld")).toBe("Hello World");
    expect(cleanText("Hello\r\nWorld")).toBe("Hello World");
    expect(cleanText("Line1\nLine2\nLine3")).toBe("Line1 Line2 Line3");
  });

  it("collapses whitespace", () => {
    expect(cleanText("Hello   World")).toBe("Hello World");
    expect(cleanText("  Hello World  ")).toBe("Hello World");
  });

  it("handles mixed tags and whitespace", () => {
    expect(cleanText("Hello <color_red>World</color>\nNext Line")).toBe(
      "Hello World Next Line",
    );
  });

  it("handles complex cases", () => {
    expect(
      cleanText(
        "<color_light_red>Warning:</color> <color_white>Nuclear blast imminent.</color>\n\n<info>Run!</info>",
      ),
    ).toBe("Warning: Nuclear blast imminent. Run!");
  });
});
