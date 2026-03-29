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
});
