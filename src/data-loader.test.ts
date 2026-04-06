import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getDataJsonUrl } from "./constants";
import { loadRawDataset } from "./data-loader";
import { HttpError } from "./utils/http-errors";

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
  test("loadRawDataset returns dataJson on success", async () => {
    const version = "nightly";
    const locale = "zh_CN";
    const dataJson = { data: [{ id: "item_1" }], build_number: "123" };
    const localeJson = { "": { language: "zh_CN" }, item_1: ["Locale"] };
    const pinyinJson = { item_1: ["PinYin"] };
    const modsJson = { aftershock: { info: { id: "aftershock" }, data: [] } };

    installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(jsonResponse(dataJson)),
      [getDataJsonUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse(localeJson)),
      [getDataJsonUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        Promise.resolve(jsonResponse(pinyinJson)),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse(modsJson)),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result).toEqual({
      dataJson,
      localeJson,
      pinyinJson,
      modsJson,
    });
  });

  test("loadRawDataset throws when all.json fails", async () => {
    const version = "nightly";
    const locale = "uk";
    const error = new HttpError("HTTP 500 (Server Error)", 500, "all.json");

    installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () => Promise.reject(error),
      [getDataJsonUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse({ "": { language: locale } })),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    await expect(loadRawDataset(version, locale, () => {})).rejects.toBe(error);
  });

  test('loadRawDataset returns localeJson: undefined when locale is "en"', async () => {
    const version = "nightly";
    const fetchMock = installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, "en", () => {});

    expect(result.localeJson).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      getDataJsonUrl(version, "lang/en.json"),
    );
  });

  test("loadRawDataset returns localeJson: undefined on locale 404", async () => {
    const version = "nightly";
    const locale = "uk";

    installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(
          jsonResponse(null, {
            ok: false,
            status: 404,
            statusText: "Not Found",
          }),
        ),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result.localeJson).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      `Failed to load locale ${locale}:`,
      expect.any(HttpError),
    );
  });

  test("loadRawDataset returns localeJson: undefined on locale network error", async () => {
    const version = "nightly";
    const locale = "uk";
    const error = new Error("Network down");

    installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, `lang/${locale}.json`)]: () =>
        Promise.reject(error),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result.localeJson).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      `Failed to load locale ${locale}:`,
      error,
    );
  });

  test("loadRawDataset fetches pinyin only for zh_* locales", async () => {
    const version = "nightly";

    const zhFetchMock = installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, "lang/zh_CN.json")]: () =>
        Promise.resolve(jsonResponse({ "": { language: "zh_CN" } })),
      [getDataJsonUrl(version, "lang/zh_CN_pinyin.json")]: () =>
        Promise.resolve(jsonResponse({ item_1: ["PinYin"] })),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    await loadRawDataset(version, "zh_CN", () => {});

    expect(zhFetchMock).toHaveBeenCalledWith(
      getDataJsonUrl(version, "lang/zh_CN_pinyin.json"),
    );

    const ukFetchMock = installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, "lang/uk.json")]: () =>
        Promise.resolve(jsonResponse({ "": { language: "uk" } })),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    await loadRawDataset(version, "uk", () => {});

    expect(ukFetchMock).not.toHaveBeenCalledWith(
      getDataJsonUrl(version, "lang/uk_pinyin.json"),
    );
  });

  test("loadRawDataset returns pinyinJson: undefined on pinyin 404", async () => {
    const version = "nightly";
    const locale = "zh_CN";

    installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse({ "": { language: locale } })),
      [getDataJsonUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        Promise.resolve(
          jsonResponse(null, {
            ok: false,
            status: 404,
            statusText: "Not Found",
          }),
        ),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(jsonResponse({})),
    });

    const result = await loadRawDataset(version, locale, () => {});

    expect(result.pinyinJson).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      `Failed to load pinyin for ${locale}:`,
      expect.any(HttpError),
    );
  });

  test("loadRawDataset returns modsJson: undefined on mods 404", async () => {
    const version = "nightly";

    installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
        Promise.resolve(
          jsonResponse(null, {
            ok: false,
            status: 404,
            statusText: "Not Found",
          }),
        ),
    });

    const result = await loadRawDataset(version, "en", () => {});

    expect(result.modsJson).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "Failed to load mods catalog:",
      expect.any(HttpError),
    );
  });

  test("loadRawDataset returns modsJson: undefined on mods network error", async () => {
    const version = "nightly";
    const error = new Error("mods network failure");

    installFetchMock({
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, "all_mods.json")]: () => Promise.reject(error),
    });

    const result = await loadRawDataset(version, "en", () => {});

    expect(result.modsJson).toBeUndefined();
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
      [getDataJsonUrl(version, "all.json")]: () =>
        Promise.resolve(
          jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
        ),
      [getDataJsonUrl(version, `lang/${locale}.json`)]: () =>
        Promise.resolve(jsonResponse({ "": { language: locale } })),
      [getDataJsonUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        Promise.resolve(jsonResponse({ item_1: ["PinYin"] })),
      [getDataJsonUrl(version, "all_mods.json")]: () =>
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
      [getDataJsonUrl(version, "all.json")]: () => dataDeferred.promise,
      [getDataJsonUrl(version, `lang/${locale}.json`)]: () =>
        localeDeferred.promise,
      [getDataJsonUrl(version, `lang/${locale}_pinyin.json`)]: () =>
        pinyinDeferred.promise,
      [getDataJsonUrl(version, "all_mods.json")]: () => modsDeferred.promise,
    });

    const loadPromise = loadRawDataset(version, locale, () => {});

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      getDataJsonUrl(version, "all.json"),
      getDataJsonUrl(version, `lang/${locale}.json`),
      getDataJsonUrl(version, `lang/${locale}_pinyin.json`),
      getDataJsonUrl(version, "all_mods.json"),
    ]);

    dataDeferred.resolve(
      jsonResponse({ data: [{ id: "item_1" }], build_number: "123" }),
    );
    localeDeferred.resolve(jsonResponse({ "": { language: locale } }));
    pinyinDeferred.resolve(jsonResponse({ item_1: ["PinYin"] }));
    modsDeferred.resolve(jsonResponse({}));

    await expect(loadPromise).resolves.toMatchObject({
      dataJson: { build_number: "123" },
    });
  });
});
