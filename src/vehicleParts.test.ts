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
        x: -1,
        y: 0,
        parts: [{ part: "frame" }],
      },
      {
        x: 0,
        y: 0,
        parts: [{ part: "seat" }, { part: "roof" }],
      },
      {
        x: 0,
        y: 1,
        parts: [{ part: "wheel" }],
      },
    ]);
  });

  test("combines legacy parts with blueprint + palette format", () => {
    const vehicle: Vehicle = {
      id: "mixed_vehicle",
      type: "vehicle",
      name: "Mixed vehicle",
      parts: [{ x: 0, y: 0, part: "tank", fuel: "gasoline" }],
      blueprint: ["AB"],
      palette: {
        A: ["frame"],
        B: ["seat"],
      },
    };

    expect(normalizeVehicleMountedParts(vehicle)).toEqual([
      {
        x: 0,
        y: 0,
        parts: [{ part: "tank", fuel: "gasoline" }],
      },
      {
        x: 0,
        y: 0,
        parts: [{ part: "frame" }],
      },
      {
        x: 1,
        y: 0,
        parts: [{ part: "seat" }],
      },
    ]);
  });

  test("normalizes object palette entries with fuel and ammo metadata", () => {
    const vehicle: Vehicle = {
      id: "object_palette_vehicle",
      type: "vehicle",
      name: "Object palette vehicle",
      blueprint: ["AB"],
      palette: {
        A: [
          "frame",
          {
            part: "fuel_bunker",
            fuel: "coal_lump",
          },
        ],
        B: [
          "turret_mount_manual_wood",
          {
            part: "mounted_launcher_ballista",
            ammo: 75,
            ammo_types: [
              "rock",
              "sling_bullet",
              "ammo_ballista_wood",
              "ammo_ballista_iron",
            ],
            ammo_qty: [1, 10],
          },
        ],
      },
    };

    expect(normalizeVehicleMountedParts(vehicle)).toEqual([
      {
        x: 0,
        y: 0,
        parts: [{ part: "frame" }, { part: "fuel_bunker", fuel: "coal_lump" }],
      },
      {
        x: 1,
        y: 0,
        parts: [
          { part: "turret_mount_manual_wood" },
          {
            part: "mounted_launcher_ballista",
            ammo: 75,
            ammo_types: [
              "rock",
              "sling_bullet",
              "ammo_ballista_wood",
              "ammo_ballista_iron",
            ],
            ammo_qty: [1, 10],
          },
        ],
      },
    ]);
  });
});
