import { describe, expect, test } from "vitest";

import { normalizeVehicleMountedParts } from "./data";
import type { Vehicle } from "./types";

describe("normalizeVehicleMountedParts", () => {
  test("normalizes legacy parts format", () => {
    const vehicle: Vehicle = {
      id: "legacy_vehicle",
      type: "vehicle",
      name: "Legacy vehicle",
      parts: [
        { x: 1, y: 2, part: "frame", fuel: "battery" },
        { x: 0, y: 0, parts: ["seat", { part: "wheel", fuel: "diesel" }] },
      ],
    };

    expect(normalizeVehicleMountedParts(vehicle)).toEqual([
      {
        x: 1,
        y: 2,
        parts: [{ part: "frame", fuel: "battery" }],
      },
      {
        x: 0,
        y: 0,
        parts: [{ part: "seat" }, { part: "wheel", fuel: "diesel" }],
      },
    ]);
  });

  test("normalizes blueprint + palette format", () => {
    const vehicle: Vehicle = {
      id: "blueprint_vehicle",
      type: "vehicle",
      name: "Blueprint vehicle",
      blueprint: ["AB", " C"],
      blueprint_origin: { x: 1, y: 0 },
      palette: {
        A: ["frame"],
        B: [["seat", "aisle"], "roof"],
        C: ["wheel"],
      },
    };

    expect(normalizeVehicleMountedParts(vehicle)).toEqual([
      {
        x: 0,
        y: -1,
        parts: [{ part: "frame" }],
      },
      {
        x: 0,
        y: 0,
        parts: [{ part: "seat" }, { part: "roof" }],
      },
      {
        x: 1,
        y: 0,
        parts: [{ part: "wheel" }],
      },
    ]);
  });
});
