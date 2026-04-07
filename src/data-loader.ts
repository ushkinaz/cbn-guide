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
import { isTesting } from "./utils/env";

type ProgressCallback = (receivedBytes: number, totalBytes: number) => void;
const noopProgress: ProgressCallback = () => {};

export type LoadedRawDataset = {
  dataJSON: unknown;
  localeJSON: unknown | undefined;
  pinyinJSON: unknown | undefined;
  modsJSON: unknown | undefined;
};

const fetchJSONWithProgress = (
  url: string,
  progress: ProgressCallback,
): Promise<unknown> => {
  if (isTesting) {
    progress(100, 100);
    return fetch(url).then((r) => {
      if (!r.ok) {
        throw new HTTPError(
          `HTTP ${r.status} (${r.statusText}) fetching ${url}`,
          r.status,
          url,
        );
      }
      return r.json();
    });
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const handleError = (type: string) => {
      const status = xhr.status;
      // If status is 404, we definitely have a missing file.
      // If status is 0, it often means a CORS error, network error,
      // or a request aborted by the browser/extensions.
      if (status === 404) {
        reject(new HTTPError(`404: ${url}`, 404, url));
        return;
      }
      if (status === 0) {
        reject(new Error(`Network/CORS/Abort: ${url}`));
        return;
      }
      reject(
        new Error(
          `${type} ${status} (${xhr.statusText}) while fetching ${url}`,
        ),
      );
    };

    xhr.onload = () => {
      if (xhr.status === 404) {
        reject(new HTTPError(`404: ${url}`, 404, url));
      } else if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.response) resolve(xhr.response);
        else reject(new Error(`Empty/invalid JSON response from ${url}`));
      } else {
        handleError("Status");
      }
    };
    xhr.onprogress = (e) => {
      progress(e.loaded, e.lengthComputable ? e.total : 0);
    };
    xhr.onerror = () => handleError("Error");
    xhr.onabort = () => handleError("Aborted");
    xhr.open("GET", url);
    xhr.responseType = "json";
    xhr.send();
  });
};

/**
 * Fetches the main game data blob (`all.json`) for a given build version.
 *
 * @param version Build version slug (e.g. "nightly", "v0.9.1")
 * @param progress Callback invoked with (receivedBytes, totalBytes) during download
 * @returns Raw parsed JSON with the dataset payload and build number.
 */
const fetchRawData = (
  version: string,
  progress: ProgressCallback,
): Promise<unknown> =>
  fetchJSONWithProgress(getDataJSONUrl(version, "all.json"), progress);

/**
 * Fetches a locale PO/MO translation file for a given build version and locale.
 *
 * @param version Build version slug
 * @param locale Locale code (e.g. "uk", "zh_CN")
 * @param progress Callback invoked with (receivedBytes, totalBytes) during download
 * @returns Raw parsed locale JSON blob
 */
const fetchRawLocale = (
  version: string,
  locale: string,
  progress: ProgressCallback,
): Promise<unknown> =>
  fetchJSONWithProgress(
    getDataJSONUrl(version, `lang/${locale}.json`),
    progress,
  );

/**
 * Fetches the mod index (`all_mods.json`) for a given build version.
 *
 * @param version Build version slug
 * @param progress Callback invoked with (receivedBytes, totalBytes) during download
 * @returns Raw parsed mod JSON blob keyed by mod id
 */
const fetchRawMods = (
  version: string,
  progress: ProgressCallback,
): Promise<unknown> =>
  fetchJSONWithProgress(getDataJSONUrl(version, "all_mods.json"), progress);

export async function loadRawDataset(
  version: string,
  locale: string,
  onProgress: (received: number, total: number) => void,
): Promise<LoadedRawDataset> {
  const needsLocale = locale !== DEFAULT_LOCALE;
  const needsPinyin = locale.startsWith("zh_");
  const [dataResult, localeResult, pinyinResult, modsResult] =
    await Promise.allSettled([
      fetchRawData(version, onProgress),
      needsLocale
        ? fetchRawLocale(version, locale, noopProgress)
        : Promise.resolve(undefined),
      needsPinyin
        ? fetchRawLocale(version, `${locale}_pinyin`, noopProgress)
        : Promise.resolve(undefined),
      fetchRawMods(version, noopProgress),
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
