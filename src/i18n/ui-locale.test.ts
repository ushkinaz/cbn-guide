import { beforeEach, describe, expect, test, vi } from "vitest";

const { setCurrentLocale } = vi.hoisted(() => ({
  setCurrentLocale: vi.fn<(locale: string) => Promise<void>>(),
}));

vi.mock("@transifex/native", () => ({
  tx: {
    setCurrentLocale,
  },
}));

import { initializeUILocale } from "./ui-locale";

describe("UI locale bootstrap", () => {
  beforeEach(() => {
    setCurrentLocale.mockReset();
  });

  test("tries mapped locale candidates until one succeeds", async () => {
    setCurrentLocale
      .mockRejectedValueOnce(new Error("missing ru"))
      .mockResolvedValueOnce();

    await initializeUILocale("ru_RU");

    expect(setCurrentLocale.mock.calls.map(([locale]) => locale)).toEqual([
      "ru",
      "ru_RU",
    ]);
  });

  test("falls back from a region code to a language-only locale", async () => {
    setCurrentLocale
      .mockRejectedValueOnce(new Error("missing pt-BR"))
      .mockResolvedValueOnce();

    await initializeUILocale("pt-BR");

    expect(setCurrentLocale.mock.calls.map(([locale]) => locale)).toEqual([
      "pt-BR",
      "pt",
    ]);
  });

  test("does nothing when no locale was requested", async () => {
    await initializeUILocale();

    expect(setCurrentLocale).not.toHaveBeenCalled();
  });

  test("silently keeps the default locale when every candidate fails", async () => {
    setCurrentLocale.mockRejectedValue(new Error("missing locale"));

    await expect(initializeUILocale("zz_ZZ")).resolves.toBeUndefined();

    expect(setCurrentLocale.mock.calls.map(([locale]) => locale)).toEqual([
      "zz_ZZ",
      "zz",
    ]);
  });

  test("resolves known region locales using the mapped fallback first", async () => {
    // ru_RU maps to "ru" before trying "ru_RU" itself.
    setCurrentLocale.mockResolvedValueOnce();

    await initializeUILocale("ru_RU");

    expect(setCurrentLocale.mock.calls[0][0]).toBe("ru");
  });

  test("tries only the locale itself when there is no known mapping and no language-only variant", async () => {
    // "en" has no KNOWN_LOCALE_FALLBACKS entry and splitting on _ or - gives "en" again.
    setCurrentLocale.mockResolvedValueOnce();

    await initializeUILocale("en");

    expect(setCurrentLocale.mock.calls.map(([locale]) => locale)).toEqual([
      "en",
    ]);
  });

  test("locale using hyphen separator produces language-only fallback", async () => {
    // "zh-CN" has no known fallback mapping and splits to "zh".
    setCurrentLocale
      .mockRejectedValueOnce(new Error("missing zh-CN"))
      .mockResolvedValueOnce();

    await initializeUILocale("zh-CN");

    expect(setCurrentLocale.mock.calls.map(([locale]) => locale)).toEqual([
      "zh-CN",
      "zh",
    ]);
  });

  test("stops at the first successful candidate even when later candidates exist", async () => {
    // pl_PL maps to "pl" first. If that succeeds, "pl_PL" should never be tried.
    setCurrentLocale.mockResolvedValueOnce();

    await initializeUILocale("pl_PL");

    expect(setCurrentLocale).toHaveBeenCalledOnce();
    expect(setCurrentLocale.mock.calls[0][0]).toBe("pl");
  });
});