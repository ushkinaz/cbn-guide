import { writable } from "svelte/store";

import { getDataJsonUrl } from "../constants";
import { CddaData } from "./cddaData";
import { i18n } from "./i18n";

export const versionSlug = writable<string>("stable");

const fetchJsonWithProgress = (
  url: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
): Promise<any> => {
  // GoogleBot has a 15MB limit on the size of the response, so we need to
  // serve it double-gzipped JSON.
  if (/latest/.test(url) && /googlebot/i.test(navigator.userAgent))
    return fetchGzippedJsonForGoogleBot(url);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.response) resolve(xhr.response);
      else reject(`Unknown error fetching JSON from ${url}`);
    };
    xhr.onprogress = (e) => {
      if (e.lengthComputable) progress(e.loaded, e.total);
    };
    xhr.onerror = () => {
      reject(`Error ${xhr.status} (${xhr.statusText}) fetching ${url}`);
    };
    xhr.onabort = () => {
      reject(`Aborted while fetching ${url}`);
    };
    xhr.open("GET", url);
    xhr.responseType = "json";
    xhr.send();
  });
};

async function fetchGzippedJsonForGoogleBot(url: string): Promise<any> {
  const gzUrl = url.replace(/latest/, "latest.gz");
  const res = await fetch(gzUrl, { mode: "cors" });
  if (!res.ok)
    throw new Error(`Error ${res.status} (${res.statusText}) fetching ${url}`);
  if (!res.body)
    throw new Error(`No body in response from ${url} (status ${res.status})`);

  // Use DecompressionStream to decompress the gzipped response
  const decompressionStream = new (globalThis as any).DecompressionStream(
    "gzip",
  );
  const decompressedStream: ReadableStream<ArrayBuffer> =
    res.body.pipeThrough(decompressionStream);

  const text = await new Response(decompressedStream).text();
  return JSON.parse(text);
}

const fetchJson = async (
  version: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
) => {
  return fetchJsonWithProgress(getDataJsonUrl(version, "all.json"), progress);
};

const fetchLocaleJson = async (
  version: string,
  locale: string,
  progress: (receivedBytes: number, totalBytes: number) => void,
) => {
  return fetchJsonWithProgress(
    getDataJsonUrl(version, `lang/${locale}.json`),
    progress,
  );
};

async function retry<T>(promiseGenerator: () => Promise<T>) {
  while (true) {
    try {
      return await promiseGenerator();
    } catch (e) {
      console.error(e);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

const loadProgressStore = writable<[number, number] | null>(null);
export const loadProgress = { subscribe: loadProgressStore.subscribe };
let _hasSetVersion = false;
const { subscribe, set } = writable<CddaData | null>(null);
export const data = {
  subscribe,
  async setVersion(version: string, locale: string | null) {
    if (_hasSetVersion) throw new Error("can only set version once");
    _hasSetVersion = true;
    let totals = [0, 0, 0];
    let receiveds = [0, 0, 0];
    const updateProgress = () => {
      const total = totals.reduce((a, b) => a + b, 0);
      const received = receiveds.reduce((a, b) => a + b, 0);
      loadProgressStore.set([received, total]);
    };
    const [dataJson, localeJson, pinyinNameJson] = await Promise.all([
      retry(() =>
        fetchJson(version, (receivedBytes, totalBytes) => {
          totals[0] = totalBytes;
          receiveds[0] = receivedBytes;
          updateProgress();
        }),
      ),
      locale &&
        retry(() =>
          fetchLocaleJson(version, locale, (receivedBytes, totalBytes) => {
            totals[1] = totalBytes;
            receiveds[1] = receivedBytes;
            updateProgress();
          }),
        ),
      locale?.startsWith("zh_") &&
        retry(() =>
          fetchLocaleJson(
            version,
            locale + "_pinyin",
            (receivedBytes, totalBytes) => {
              totals[2] = totalBytes;
              receiveds[2] = receivedBytes;
              updateProgress();
            },
          ),
        ),
    ]);
    if (locale && localeJson) {
      if (pinyinNameJson) pinyinNameJson[""] = localeJson[""];
      i18n.loadJSON(localeJson);
      i18n.setLocale(locale);
      if (pinyinNameJson) {
        i18n.loadJSON(pinyinNameJson, "pinyin");
      }
    }
    const cddaData = new CddaData(
      dataJson.data,
      dataJson.build_number,
      dataJson.release,
    );
    set(cddaData);
  },
};
