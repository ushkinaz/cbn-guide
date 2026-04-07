import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getDataJSONUrl } from "./constants";
import { loadRawDataset } from "./data-loader";
import { HTTPError } from "./utils/http-errors";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {},
): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    json: () => Promise.resolve(body),
  } as Response;
}

function installFetchMock(
  handlers: Record<string, () => Promise<Response>>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((url: string) => {
    const handler = handlers[url];
    if (!handler) {
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    }
    return handler();
  });
  globalThis.fetch = fetchMock as typeof globalThis.fetch;
  return fetchMock;
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("loadRawDataset", () => {
  test("loadRawDataset returns dataJSON on success", async () => {
    const version = "nightly";
    const locale = "zh_CN";
    const dataJSON = { data: [{ id: "item_1" }], build_number: "123" };
    const localeJSON = { "": { language: "zh_CN" }, item_1: ["Locale"] };
    const pinyinJSON = { item_1: ["PinYin"] };
    const modsJSON = { aftershock: { info: { id: "aftershock" }, data: [] } };

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(jsonResponse(dataJSON)),
      [getDataJSONUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse(localeJSON)),
      [getDataJSONUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        Promise.resolve(jsonResponse(pinyinJSON)),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse(modsJSON)),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result).toEqual({
      dataJSON: dataJSON,
      localeJSON: localeJSON,
      pinyinJSON: pinyinJSON,
      modsJSON: modsJSON,
    });
  });

  test("loadRawDataset throws when all.json fails", async () => {
    const version = "nightly";
    const locale = "uk";
    const error = new HTTPError("HTTP 500 (Server Error)", 500, "all.json");

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () => Promise.reject(error),
      [getDataJSONUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse({ "": { language: locale } })),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    await expect(loadRawDataset(version, locale, () => {})).rejects.toBe(error);
  });

  test('loadRawDataset returns localeJson: undefined when locale is "en"', async () => {
    const version = "nightly";
    const fetchMock = installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, "en", () => {});

    expect(result.localeJSON).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      getDataJSONUrl(version, "lang/en.json"),
    );
  });

  test("loadRawDataset returns localeJson: undefined on locale 404", async () => {
    const version = "nightly";
    const locale = "uk";

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(
          jsonResponse(null, {
            ok: false,
            status: 404,
            statusText: "Not Found",
          }),
        ),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result.localeJSON).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      `Failed to load locale ${locale}:`,
      expect.any(HTTPError),
    );
  });

  test("loadRawDataset returns localeJson: undefined on locale network error", async () => {
    const version = "nightly";
    const locale = "uk";
    const error = new Error("Network down");

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, `lang/${locale}.json`)]: () =>
        Promise.reject(error),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result.localeJSON).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      `Failed to load locale ${locale}:`,
      error,
    );
  });

  test("loadRawDataset fetches pinyin only for zh_* locales", async () => {
    const version = "nightly";

    const zhFetchMock = installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, "lang/zh_CN.json")]: () =>
        Promise.resolve(jsonResponse({ "": { language: "zh_CN" } })),
      [getDataJSONUrl(version, "lang/zh_CN_pinyin.json")]: () =>
        Promise.resolve(jsonResponse({ item_1: ["PinYin"] })),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    await loadRawDataset(version, "zh_CN", () => {});

    expect(zhFetchMock).toHaveBeenCalledWith(
      getDataJSONUrl(version, "lang/zh_CN_pinyin.json"),
    );

    const ukFetchMock = installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, "lang/uk.json")]: () =>
        Promise.resolve(jsonResponse({ "": { language: "uk" } })),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    await loadRawDataset(version, "uk", () => {});

    expect(ukFetchMock).not.toHaveBeenCalledWith(
      getDataJSONUrl(version, "lang/uk_pinyin.json"),
    );
  });

  test("loadRawDataset returns pinyinJson: undefined on pinyin 404", async () => {
    const version = "nightly";
    const locale = "zh_CN";

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse({ "": { language: locale } })),
      [getDataJSONUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        Promise.resolve(
          jsonResponse(null, {
            ok: false,
            status: 404,
            statusText: "Not Found",
          }),
        ),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result.pinyinJSON).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      `Failed to load pinyin for ${locale}:`,
      expect.any(HTTPError),
    );
  });

  test("loadRawDataset returns modsJson: undefined on mods 404", async () => {
    const version = "nightly";

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(
          jsonResponse(null, {
            ok: false,
            status: 404,
            statusText: "Not Found",
          }),
        ),
    });

    const result = await loadRawDataset(version, "en", () => {});

    expect(result.modsJSON).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "Failed to load mods catalog:",
      expect.any(HTTPError),
    );
  });

  test("loadRawDataset returns modsJson: undefined on mods network error", async () => {
    const version = "nightly";
    const error = new Error("mods network failure");

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, "all_mods.json")]: () => Promise.reject(error),
    });

    const result = await loadRawDataset(version, "en", () => {});

    expect(result.modsJSON).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "Failed to load mods catalog:",
      error,
    );
  });

  test("loadRawDataset invokes onProgress only for all.json", async () => {
    const version = "nightly";
    const locale = "zh_CN";
    const onProgress = vi.fn<(received: number, total: number) => void>();

    installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJSONUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse({ "": { language: locale } })),
      [getDataJSONUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        Promise.resolve(jsonResponse({ item_1: ["PinYin"] })),
      [getDataJSONUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    await loadRawDataset(version, locale, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(100, 100);
  });

  test("loadRawDataset fires all fetches in parallel", async () => {
    const version = "nightly";
    const locale = "zh_CN";
    const dataDeferred = createDeferred<Response>();
    const localeDeferred = createDeferred<Response>();
    const pinyinDeferred = createDeferred<Response>();
    const modsDeferred = createDeferred<Response>();
    const fetchMock = installFetchMock({
      [getDataJSONUrl(version, "all.json")]: () => dataDeferred.promise,
      [getDataJSONUrl(version, `lang/${locale}.json`)]: () =>
        localeDeferred.promise,
      [getDataJSONUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        pinyinDeferred.promise,
      [getDataJSONUrl(version, "all_mods.json")]: () => modsDeferred.promise,
    });

    const loadPromise = loadRawDataset(version, locale, () => {});

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      getDataJSONUrl(version, "all.json"),
      getDataJSONUrl(version, `lang/${locale}.json`),
      getDataJSONUrl(version, `lang/${locale}_pinyin.json`),
      getDataJSONUrl(version, "all_mods.json"),
    ]);

    dataDeferred.resolve(
      jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
    );
    localeDeferred.resolve(jsonResponse({ "": { language: locale } }));
    pinyinDeferred.resolve(jsonResponse({ item_1: ["PinYin"] }));
    modsDeferred.resolve(jsonResponse({}));

    await expect(loadPromise).resolves.toMatchObject({
      dataJSON: { build_number: "123" },
    });
  });
});
