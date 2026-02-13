import { describe, expect, test, vi } from "vitest";
import { data, CBNData } from "./data";

describe("Reproduction: all_mods.json 404 should be silent", () => {
  test("ensureModsLoaded should not throw on 404 for all_mods.json", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };

    const originalFetch = globalThis.fetch;
    const fetchCalls: string[] = [];
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      fetchCalls.push(url);
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        // Return 404 error
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          url: url,
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    try {
      // Mock progress store
      (globalThis as any).__isTesting__ = true;

      await data.setVersion("latest", null, undefined, undefined, []);

      // This is where it might be throwing
      await expect(data.ensureModsLoaded()).resolves.not.toThrow();

      const loaded = await new Promise<CBNData>((resolve) => {
        data.subscribe((v) => {
          if (v && v.mods !== null) resolve(v);
        });
      });

      expect(fetchCalls.some((url) => url.includes("all_mods.json"))).toBe(
        true,
      );
      expect(loaded.mods).toEqual([]);
      expect(loaded.raw_mods_json).toEqual({});
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });

  test("ensureModsLoaded should not throw on 'HTTP 404' for all_mods.json", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        // Return error that doesn't START with 404 but contains it
        return Promise.reject(new Error(`HTTP 404: Not Found at ${url}`));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    try {
      (globalThis as any).__isTesting__ = true;
      await data.setVersion("latest", null, undefined, undefined, []);

      // If this fails, then is404Error is too strict
      await expect(data.ensureModsLoaded()).resolves.not.toThrow();

      const loaded = await new Promise<CBNData>((resolve) => {
        data.subscribe((v) => {
          if (v && v.mods !== null) resolve(v);
        });
      });

      expect(loaded.mods).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });

  test("setVersion with requested mods should not throw on 404 for all_mods.json", async () => {
    const mockData = {
      data: [{ type: "GENERIC", id: "core_item" }],
      build_number: "123",
      release: "test-release",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("all.json")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response);
      }
      if (url.includes("all_mods.json")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: "Not Found",
          url: url,
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    try {
      (globalThis as any).__isTesting__ = true;

      // Requesting a mod that won't be found because all_mods.json is 404
      await expect(
        data.setVersion("latest", null, undefined, undefined, ["some_mod"]),
      ).resolves.not.toThrow();

      const loaded = await new Promise<CBNData>((resolve) => {
        data.subscribe((v) => {
          if (v) resolve(v);
        });
      });

      expect(loaded.mods).toEqual([]);
      expect(loaded.active_mods).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });
});
