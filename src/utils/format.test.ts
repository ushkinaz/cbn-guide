import { describe, it, test, expect } from "vitest";
import { cleanText, parseDuration, parseMass, parseVolume } from "./format";

describe("cleanText", () => {
  test("removes color tags", () => {
    expect(cleanText("Hello <color_red>World</color>")).toBe("Hello World");
    expect(cleanText("<info>Info</info>")).toBe("Info");
    expect(cleanText("A<good>B</good>C")).toBe("ABC");
  });

  test("handles newlines", () => {
    expect(cleanText("Hello\nWorld")).toBe("Hello World");
    expect(cleanText("Hello\r\nWorld")).toBe("Hello World");
    expect(cleanText("Line1\nLine2\nLine3")).toBe("Line1 Line2 Line3");
  });

  test("collapses whitespace", () => {
    expect(cleanText("Hello   World")).toBe("Hello World");
    expect(cleanText("  Hello World  ")).toBe("Hello World");
  });

  test("handles mixed tags and whitespace", () => {
    expect(cleanText("Hello <color_red>World</color>\nNext Line")).toBe(
      "Hello World Next Line",
    );
  });

  test("handles complex cases", () => {
    expect(
      cleanText(
        "<color_light_red>Warning:</color> <color_white>Nuclear blast imminent.</color>\n\n<info>Run!</info>",
      ),
    ).toBe("Warning: Nuclear blast imminent. Run!");
  });
});

describe("Parsing units", () => {
  test("parseVolume", () => {
    expect(parseVolume(1)).toBe(250); //see legacy_volume_factor
    expect(parseVolume("100 ml")).toBe(100);
    expect(parseVolume("2 L")).toBe(2000);
    expect(parseVolume("1 L 500 ml")).toBe(1500);
    expect(parseVolume("83.33 ml")).toBe(83.33);
    expect(parseVolume("0.5 L")).toBe(500);
  });

  test("parseMass", () => {
    expect(parseMass(100)).toBe(100);
    expect(parseMass("1 kg")).toBe(1000);
    expect(parseMass("500 g")).toBe(500);
    expect(parseMass("50 mg")).toBe(0.05);
    expect(parseMass("1 kg 500 g")).toBe(1500);
    expect(parseMass("1.5 kg")).toBe(1500);
    expect(parseMass("0.5 g")).toBe(0.5);
  });

  test("parseDuration", () => {
    expect(parseDuration(100)).toBe(1);
    expect(parseDuration("1 turns")).toBe(1);
    expect(parseDuration("10 s")).toBe(10);
    expect(parseDuration("1 m")).toBe(60);
    expect(parseDuration("1 h")).toBe(3600);
    expect(parseDuration("1 d")).toBe(86400);
    expect(parseDuration("1 day 12 hours")).toBe(86400 + 12 * 3600);
    expect(parseDuration("1 h 7 m 30 s")).toBe(3600 + 7 * 60 + 30);
    expect(parseDuration("+1 day -23 hours 50m")).toBe(110 * 60);
    expect(parseDuration("1 turn 1 minutes 9 turns")).toBe(70);
    expect(parseDuration("-10s")).toBe(-10);
    expect(parseDuration("1.5 m")).toBe(90);
    expect(parseDuration("0.5 h")).toBe(1800);
  });
});
