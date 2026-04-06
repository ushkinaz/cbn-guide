import { describe, expect, test, vi } from "vitest";
import { data, CBNData } from "./data";

describe("Reproduction: all_mods.json 404 should be silent", () => {
  test("loadData should not throw on 404 for all_mods.json without selected mods", async () => {
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

      await expect(data.loadData("latest", "en", [])).resolves.not.toThrow();

      const loaded = await new Promise<CBNData>((resolve) => {
        data.subscribe((v) => {
          if (v) resolve(v);
        });
      });

      expect(fetchCalls.some((url) => url.includes("all_mods.json"))).toBe(
        true,
      );
      expect(Object.keys(loaded.rawModsJSON)).toEqual([]);
      expect(loaded.rawModsJSON).toEqual({});
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });

  test("loadData should not throw on 'HTTP 404' for all_mods.json without selected mods", async () => {
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
      await expect(data.loadData("latest", "en", [])).resolves.not.toThrow();

      const loaded = await new Promise<CBNData>((resolve) => {
        data.subscribe((v) => {
          if (v) resolve(v);
        });
      });

      expect(Object.keys(loaded.rawModsJSON)).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });

  test("loadData with requested mods should not throw on 404 for all_mods.json", async () => {
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
        data.loadData("latest", "en", ["some_mod"]),
      ).resolves.not.toThrow();

      const loaded = await new Promise<CBNData>((resolve) => {
        data.subscribe((v) => {
          if (v) resolve(v);
        });
      });

      expect(Object.keys(loaded.rawModsJSON)).toEqual([]);
      expect(loaded.activeMods).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });

  test("loadData swallows non-404 all_mods errors that merely mention 404", async () => {
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
        return Promise.reject(
          new Error("Malformed schema near line 404 in all_mods.json"),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    try {
      (globalThis as any).__isTesting__ = true;
      await expect(
        data.loadData("latest", "en", ["some_mod"]),
      ).resolves.not.toThrow();

      const loaded = await new Promise<CBNData>((resolve) => {
        data.subscribe((v) => {
          if (v) resolve(v);
        });
      });

      expect(loaded.rawModsJSON).toEqual({});
      expect(loaded.activeMods).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
      (globalThis as any).__isTesting__ = false;
    }
  });
});
