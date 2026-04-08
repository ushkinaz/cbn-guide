/**
 * Fetch orchestration layer.
 *
 * This module owns all network I/O and parallel dispatch for game data JSON
 * files. It fetches all required assets (data, locale, pinyin, mods) in
 * parallel via Promise.allSettled, reports progress from the main all.json
 * download, and swallows errors for optional assets (locale, pinyin, mods).
 *
 * In tests, `isTesting` causes the module to fall back to the global `fetch`
 * API so test fixtures can intercept requests uniformly.
 */
import { DEFAULT_LOCALE, getDataJSONUrl } from "./constants";
import { HTTPError } from "./utils/http-errors";
import { retry } from "./utils/retry";

export type ProgressCallback = (
  receivedBytes: number,
  totalBytes: number | undefined,
) => void;
const noopProgress: ProgressCallback = () => {};

export type LoadedRawDataset = {
  dataJSON: unknown;
  localeJSON: unknown | undefined;
  pinyinJSON: unknown | undefined;
  modsJSON: unknown | undefined;
};

async function fetchJSONWithProgress<T>(
  url: string,
  progress: ProgressCallback = noopProgress,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    throw new Error(`Failed to fetch ${url}: ${message}`);
  }

  if (!response.ok) {
    throw new HTTPError(
      `HTTP ${response.status} (${response.statusText}) fetching ${url}`,
      response.status,
      url,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown parse error";
    throw new Error(`Failed to parse JSON from ${url}: ${message}`);
  } finally {
    progress(100, 100);
  }
}

/**
 * Fetches the main game data blob (`all.json`) for a given build version.
 *
 * @param version Build version slug (e.g. "nightly", "v0.9.1")
 * @param progress Callback invoked with (receivedBytes, totalBytes) during download
 * @returns Raw parsed JSON with the dataset payload and build number.
 */
async function fetchRawData<T>(
  version: string,
  progress: ProgressCallback,
): Promise<T> {
  return await retry(() =>
    fetchJSONWithProgress(getDataJSONUrl(version, "all.json"), progress),
  );
}

/**
 * Fetches a locale PO/MO translation file for a given build version and locale.
 *
 * @param version Build version slug
 * @param locale Locale code (e.g. "uk", "zh_CN")
 * @returns Raw parsed locale JSON blob
 */
function fetchRawLocale<T>(version: string, locale: string): Promise<T> {
  return retry(
    () => fetchJSONWithProgress(getDataJSONUrl(version, `lang/${locale}.json`)),
    { maxAttempts: 2, baseDelayMs: 1000 },
  );
}

/**
 * Fetches the mod index (`all_mods.json`) for a given build version.
 *
 * @param version Build version slug
 * @returns Raw parsed mod JSON blob keyed by mod id
 */
async function fetchRawMods<T>(version: string): Promise<T> {
  return retry(
    () => fetchJSONWithProgress(getDataJSONUrl(version, "all_mods.json")),
    { maxAttempts: 2, baseDelayMs: 1000 },
  );
}

export async function loadRawDataset(
  version: string,
  locale: string,
  onProgress: ProgressCallback,
): Promise<LoadedRawDataset> {
  const needsLocale = locale !== DEFAULT_LOCALE;
  const needsPinyin = locale.startsWith("zh_");
  const [dataResult, localeResult, pinyinResult, modsResult] =
    await Promise.allSettled([
      fetchRawData(version, onProgress),
      needsLocale
        ? fetchRawLocale(version, locale)
        : Promise.resolve(undefined),
      needsPinyin
        ? fetchRawLocale(version, `${locale}_pinyin`)
        : Promise.resolve(undefined),
      fetchRawMods(version),
    ]);

  if (dataResult.status === "rejected") {
    throw dataResult.reason;
  }

  if (localeResult.status === "rejected") {
    console.warn(`Failed to load locale ${locale}:`, localeResult.reason);
  }
  if (pinyinResult.status === "rejected") {
    console.warn(`Failed to load pinyin for ${locale}:`, pinyinResult.reason);
  }
  if (modsResult.status === "rejected") {
    console.warn("Failed to load mods catalog:", modsResult.reason);
  }

  return {
    dataJSON: dataResult.value,
    localeJSON:
      localeResult.status === "fulfilled" ? localeResult.value : undefined,
    pinyinJSON:
      pinyinResult.status === "fulfilled" ? pinyinResult.value : undefined,
    modsJSON: modsResult.status === "fulfilled" ? modsResult.value : undefined,
  };
}
