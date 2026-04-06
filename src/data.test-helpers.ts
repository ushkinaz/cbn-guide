import { CBNData } from "./data";
import type { ModData } from "./types";
import { DEFAULT_LOCALE } from "./constants";

type TestCBNDataOptions = {
  buildVersion?: string;
  fetchVersion?: string;
  locale?: string;
  localeJSON?: unknown;
  pinyinJSON?: unknown;
  activeMods?: string[];
  rawModsJSON?: Record<string, ModData>;
};

export function makeTestCBNData(
  rawJSON: unknown[],
  {
    buildVersion = "test-build",
    fetchVersion = "test-version",
    locale = DEFAULT_LOCALE,
    localeJSON = undefined,
    pinyinJSON = undefined,
    activeMods = [],
    rawModsJSON = {},
  }: TestCBNDataOptions = {},
): CBNData {
  return new CBNData(
    rawJSON,
    buildVersion,
    fetchVersion,
    locale,
    localeJSON,
    pinyinJSON,
    activeMods,
    rawModsJSON,
  );
}
