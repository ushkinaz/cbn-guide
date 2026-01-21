import type { CBNData } from "../../data";
import type * as raw from "../../types";
import { multimap } from "../../utils/collections";

// Map generation constants
const DEFAULT_CHANCE_PERCENTAGE = 100;
const DEFAULT_MAPGEN_WEIGHT = 1000;
const OMAP_TILE_SIZE = 24;

// Performance/scheduling constants
const IDLE_YIELD_TIMEOUT_MS = 1;
const MIN_TIME_REMAINING_MS = 0;

/** 0.0 <= chance <= 1.0 */
type chance = number;

/**
 * Extract weight from a weighted value tuple.
 * If value is not weighted (plain T), returns default weight of 1.
 */
function extractWeight<T>(it: T | [T, number]): number {
  return Array.isArray(it) ? it[1] : 1;
}

/**
 * Extract the actual value from a potentially weighted tuple.
 * If value is not weighted (plain T), returns the value itself.
 */
function extractValue<T>(it: T | [T, number]): T {
  return Array.isArray(it) ? it[0] : it;
}

function normalizeMinMax(
  v: undefined | number | [number] | [number, number],
): [number, number] {
  if (v == null) return [1, 1];
  if (typeof v === "number") return [v, v];
  if (v.length === 1) return [v[0], v[0]];
  //For malformed min-max arrays
  return v[0] <= v[1] ? v : [v[1], v[0]];
}

export function repeatChance(
  repeat: undefined | number | [number] | [number, number],
  chance: chance,
): chance {
  const [n0, n1] = normalizeMinMax(repeat);
  let sum = 0;
  let count = 0;
  // It would be more efficient to use the formula
  // for the sum of a geometric progression,
  // but this should be easier to understand
  for (let r = n0; r <= n1; ++r) {
    sum += 1 - Math.pow(1 - chance, r);
    ++count;
  }
  return sum / count;
}

export type ItemChance = {
  // The probability of getting at least one of this item.
  prob: number;

  // The expected number of this item.
  expected: number;
};

/**
 * Combine two item chances, assuming they are independent.
 * i.e. both |a| and |b| will be rolled independently.
 * @param inPlace - If true, mutates `a` for performance in hot paths; otherwise returns new object
 */
function combineItemChances(
  a: ItemChance,
  b: ItemChance,
  inPlace = false,
): ItemChance {
  const newProb = 1 - (1 - a.prob) * (1 - b.prob);
  const newExpected = a.expected + b.expected;

  if (inPlace) {
    a.prob = newProb;
    a.expected = newExpected;
    return a;
  }

  return { prob: newProb, expected: newExpected };
}

// Convenience aliases for readability
function andItemChance(a: ItemChance, b: ItemChance): ItemChance {
  return combineItemChances(a, b, false);
}
function andItemChanceInPlace(a: ItemChance, b: ItemChance): ItemChance {
  return combineItemChances(a, b, true);
}

// |a| is repeated between |n0| and |n1| times.
function repeatItemChance(
  a: ItemChance,
  [n0, n1]: [number, number],
): ItemChance {
  return {
    prob: repeatChance([n0, n1], a.prob),
    expected: (a.expected * (n0 + n1)) / 2,
  };
}

function applyAmount(a: ItemChance, amount: raw.MapgenInt): ItemChance {
  const avg = averageMapgenInt(amount);
  return {
    prob: a.prob,
    expected: a.expected * avg,
  };
}

function applyAmmoAndMagazine(
  loot: Loot,
  ammo: number | undefined,
  magazine: number | undefined,
): Loot {
  if (!ammo && !magazine) return loot;
  const ret: Loot = new Map(loot);
  for (const [id, chance] of loot.entries()) {
    if (ammo) {
      const ammoChance = scaleItemChance(chance, ammo / 100);
      const oldAmmo = ret.get(`${id}_ammo`) ?? zeroItemChance;
      ret.set(`${id}_ammo`, andItemChance(oldAmmo, ammoChance));
    }
    if (magazine) {
      const magazineChance = scaleItemChance(chance, magazine / 100);
      const oldMagazine = ret.get(`${id}_magazine`) ?? zeroItemChance;
      ret.set(`${id}_magazine`, andItemChance(oldMagazine, magazineChance));
    }
  }
  return ret;
}

function scaleItemChance(a: ItemChance, t: number): ItemChance {
  return {
    prob: a.prob * t,
    expected: a.expected * t,
  };
}

/**
 * Scale all item chances in a Loot map by a factor.
 */
function attenuateLoot(loot: Loot, t: number): Loot {
  const attenuatedLoot: Loot = new Map();
  for (const [k, v] of loot.entries())
    attenuatedLoot.set(k, scaleItemChance(v, t));
  return attenuatedLoot;
}

/**
 * Scale all item chances in a Palette (Map of Loots) by a factor.
 */
function attenuatePalette<T extends Map<string, Loot>>(
  palette: T,
  t: number,
): T {
  const attenuatedPalette = new Map() as T;
  for (const [k, v] of palette.entries())
    attenuatedPalette.set(k, attenuateLoot(v, t));
  return attenuatedPalette;
}

/**
 * Convert a chance percentage (0-100+) to ItemChance.
 * Probability is capped at 1.0: chance > 100 means "higher expected count",
 * not "more than 100% probability".
 */
function chanceToItemChance(chance: number): ItemChance {
  const p = chance / 100;
  return {
    prob: Math.min(1.0, p),
    expected: p,
  };
}

function averageMapgenInt(
  v: undefined | number | [number] | [number, number],
): number {
  const [n0, n1] = normalizeMinMax(v);
  return (n0 + n1) / 2;
}

function estimateLineTiles(set: raw.MapgenSet): number {
  const x1 = averageMapgenInt(set.x);
  const y1 = averageMapgenInt(set.y);
  const x2 = averageMapgenInt(set.x2 ?? set.x);
  const y2 = averageMapgenInt(set.y2 ?? set.y);
  return Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) + 1;
}

function estimateSquareTiles(set: raw.MapgenSet): number {
  const x1 = averageMapgenInt(set.x);
  const y1 = averageMapgenInt(set.y);
  const x2 = averageMapgenInt(set.x2 ?? set.x);
  const y2 = averageMapgenInt(set.y2 ?? set.y);
  return (Math.abs(x2 - x1) + 1) * (Math.abs(y2 - y1) + 1);
}

function setToLoot(
  set: raw.MapgenSet,
  kind: "furniture" | "terrain",
): Loot | null {
  const shape =
    set.point === kind ? "point" : set.line === kind ? "line" : null;
  const square = set.square === kind ? "square" : null;
  if (!shape && !square) return null;
  if (!set.id) return null;
  const tiles =
    square === "square"
      ? estimateSquareTiles(set)
      : shape === "line"
        ? estimateLineTiles(set)
        : 1;
  const placementChance = (set.chance ?? DEFAULT_CHANCE_PERCENTAGE) / 100;
  const baseChance = {
    prob: 1 - Math.pow(1 - placementChance, tiles),
    expected: placementChance * tiles,
  };
  const itemChance = repeatItemChance(baseChance, normalizeMinMax(set.repeat));
  return new Map([[set.id, itemChance]]);
}

function getSetLoot(mapgen: raw.Mapgen, kind: "furniture" | "terrain"): Loot[] {
  return (mapgen.object.set ?? [])
    .map((set) => setToLoot(set, kind))
    .filter((set): set is Loot => Boolean(set));
}

const zeroItemChance = Object.freeze({ prob: 0, expected: 0 });
export type Loot = Map</**item_id*/ string, ItemChance>;
/** Independently choose whether to place each item  */
export function collection(items: Array<Loot>): Loot {
  if (items.length === 1) return items[0];
  const ret = new Map<string, ItemChance>();
  for (const loot of items) {
    for (const [item_id, itemChance] of loot.entries()) {
      if (!ret.has(item_id)) ret.set(item_id, { ...itemChance });
      else {
        const currentChance = ret.get(item_id)!;
        andItemChanceInPlace(currentChance, itemChance);
      }
    }
  }
  return ret;
}

function offsetMapgen(mapgen: raw.Mapgen, x: number, y: number): raw.Mapgen {
  const object = {
    ...mapgen.object,
    rows: (mapgen.object.rows ?? [])
      .slice(y * OMAP_TILE_SIZE, (y + 1) * OMAP_TILE_SIZE)
      .map((row) => row.slice(x * OMAP_TILE_SIZE, (x + 1) * OMAP_TILE_SIZE)),
  };
  const min = (x: number | [number] | [number, number]) =>
    Array.isArray(x) ? x[0] : x;
  const mx = x * OMAP_TILE_SIZE;
  const my = y * OMAP_TILE_SIZE;
  if (object.place_items)
    object.place_items = object.place_items.filter(
      (p) =>
        min(p.x) >= mx &&
        min(p.y) >= my &&
        min(p.x) < mx + OMAP_TILE_SIZE &&
        min(p.y) < my + OMAP_TILE_SIZE,
    );
  if (object.place_item)
    object.place_item = object.place_item.filter(
      (p) =>
        min(p.x) >= mx &&
        min(p.y) >= my &&
        min(p.x) < mx + OMAP_TILE_SIZE &&
        min(p.y) < my + OMAP_TILE_SIZE,
    );
  if (object.add)
    object.add = object.add.filter(
      (p) =>
        min(p.x) >= mx &&
        min(p.y) >= my &&
        min(p.x) < mx + OMAP_TILE_SIZE &&
        min(p.y) < my + OMAP_TILE_SIZE,
    );
  if (object.place_loot)
    object.place_loot = object.place_loot.filter(
      (p) =>
        min(p.x) >= mx &&
        min(p.y) >= my &&
        min(p.x) < mx + OMAP_TILE_SIZE &&
        min(p.y) < my + OMAP_TILE_SIZE,
    );
  if (object.place_nested)
    object.place_nested = object.place_nested.filter(
      (p) =>
        min(p.x) >= mx &&
        min(p.y) >= my &&
        min(p.x) < mx + OMAP_TILE_SIZE &&
        min(p.y) < my + OMAP_TILE_SIZE,
    );
  if (object.set)
    object.set = object.set.filter(
      (p) =>
        min(p.x) >= mx &&
        min(p.y) >= my &&
        min(p.x) < mx + OMAP_TILE_SIZE &&
        min(p.y) < my + OMAP_TILE_SIZE,
    );
  return { ...mapgen, object };
}

const requestIdleCallback: typeof window.requestIdleCallback =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? window.requestIdleCallback
    : function (cb: (deadline: IdleDeadline) => void): number {
        const start = Date.now();
        return setTimeout(function () {
          cb({
            didTimeout: false,
            timeRemaining: function () {
              return Math.max(0, 50 - (Date.now() - start));
            },
          });
        }, 0) as unknown as number;
      };

function yieldUntilIdle(): Promise<IdleDeadline> {
  if ((globalThis as any).__isTesting__)
    return Promise.resolve({
      didTimeout: false,
      timeRemaining: () => 100,
    });
  return new Promise<IdleDeadline>((resolve) => {
    requestIdleCallback(resolve, { timeout: IDLE_YIELD_TIMEOUT_MS });
  });
}

const canInputPending =
  "scheduling" in navigator &&
  "isInputPending" in (navigator.scheduling as any) &&
  "scheduler" in window &&
  "postTask" in (window as any).scheduler;

async function yieldable<T>(
  f: (wait: () => Promise<void>) => Promise<T>,
): Promise<T> {
  if (canInputPending) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    return f(() => {
      if ((navigator as any).scheduling.isInputPending()) {
        return new Promise((resolve) =>
          (window as any).scheduler.postTask(resolve),
        );
      }
      return Promise.resolve();
    });
  } else {
    let deadline = await yieldUntilIdle();
    return f(async () => {
      if (deadline.timeRemaining() <= 0) {
        deadline = await yieldUntilIdle();
      }
    });
  }
}

const mapgensByOmtCache = new WeakMap<CBNData, Map<string, raw.Mapgen[]>>();
function getMapgensByOmt(data: CBNData): Map<string, raw.Mapgen[]> {
  if (mapgensByOmtCache.has(data)) return mapgensByOmtCache.get(data)!;
  const mapgensByOmt = new Map<string, raw.Mapgen[]>();
  const add = (id: string, mapgen: raw.Mapgen) => {
    if (!mapgensByOmt.has(id)) mapgensByOmt.set(id, []);
    mapgensByOmt.get(id)!.push(mapgen);
  };
  for (const mapgen of data.byType("mapgen")) {
    // If om_terrain is missing, this is nested_mapgen or update_mapgen
    if (!mapgen.om_terrain) continue;

    // otherwise, om_terrain can be one of three things:
    // 1. a string. if so, this mapgen can be instantiated for that om_terrain.
    if (typeof mapgen.om_terrain === "string") {
      add(mapgen.om_terrain, mapgen);
    } else {
      if (typeof mapgen.om_terrain[0] === "string") {
        // 2. an array of strings. if so, this mapgen can be instantiated for
        // any of the given om_terrains.
        for (const id of mapgen.om_terrain as string[]) add(id, mapgen);
      } else {
        // 3. an array of arrays of strings. if so, this is actually several
        // mapgens in a trench coat, and the ids are a grid.
        for (let y = 0; y < mapgen.om_terrain.length; y++)
          for (let x = 0; x < mapgen.om_terrain[y].length; x++)
            add(mapgen.om_terrain[y][x], offsetMapgen(mapgen, x, y));
      }
    }
  }
  mapgensByOmtCache.set(data, mapgensByOmt);
  return mapgensByOmt;
}

export function lootForOmt(
  data: CBNData,
  omt_id: string,
  lootFn: (mapgen: raw.Mapgen) => Loot,
) {
  const mapgensByOmt = getMapgensByOmt(data);
  const mapgens = mapgensByOmt.get(omt_id) ?? [];
  const loot = mergeLoot(
    mapgens.map((mg) => ({
      weight: mg.weight ?? DEFAULT_MAPGEN_WEIGHT,
      loot: lootFn(mg),
    })),
  );
  return loot;
}

export async function lootForOmSpecial(
  data: CBNData,
  om_special: raw.OvermapSpecial,
  lootFn: (mapgen: raw.Mapgen) => Loot,
): Promise<Loot> {
  if (om_special.subtype === "mutable") return new Map();
  const loots: Loot[] = [];
  await yieldable(async (relinquish) => {
    for (const om of om_special.overmaps ?? []) {
      if (!om.overmap) continue;
      const overmap_id = om.overmap.replace(/_(north|east|west|south)$/, "");
      loots.push(lootForOmt(data, overmap_id, lootFn));
      await relinquish();
    }
  });
  return addLoot(loots);
}

export async function lootByOmSpecial(
  data: CBNData,
  lootFn: (mapgen: raw.Mapgen) => Loot,
) {
  const overmapSpecials = data.byType("overmap_special");

  const lootByOmSpecial = new Map<string, Loot>();
  for (const om_special of overmapSpecials)
    lootByOmSpecial.set(
      om_special.id,
      await lootForOmSpecial(data, om_special, lootFn),
    );
  return lootByOmSpecial;
}

export function overmapAppearance(
  data: CBNData,
  oms: raw.OvermapSpecial,
): string | undefined {
  if (oms.subtype === "mutable") return;
  const overmaps = [...(oms.overmaps ?? [])];
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;
  const overmapsByPoint = new Map<string, (typeof overmaps)[0]>();
  for (const om of overmaps) {
    if (!om.overmap) continue;
    const omt_id = om.overmap.replace(/_(north|south|east|west)$/, "");
    if (!data.byIdMaybe("overmap_terrain", omt_id)) continue;
    const [x, y, z] = om.point;
    if (z !== 0) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    overmapsByPoint.set(`${x}|${y}`, om);
  }
  // Skip any location that has no surface-level appearance.
  if (minX === Infinity || minY === Infinity) return;
  const appearanceComponents: any[] = [maxY - minY, maxX - minX];
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const om = overmapsByPoint.get(`${x}|${y}`);
      if (om?.overmap) {
        const omt_id = om.overmap.replace(/_(north|south|east|west)$/, "");
        const appearance = omtAppearanceString(omt_id);
        appearanceComponents.push(appearance);
      } else {
        appearanceComponents.push("no_om");
      }
    }

  return appearanceComponents.join("\0");

  function omtAppearanceString(omt_id: string): string {
    const omt = data.byId("overmap_terrain", omt_id);
    return omt
      ? `${omt.sym}\u0001${omt.color ?? "black"}\u0001${omt.name}`
      : `appearance_unk`;
  }
}

// Showing there is a bit spoilery, and also they are visually large, so hide them.
const hiddenLocations = new Set([
  "Necropolis",
  "Isherwood Farms",
  "hub_01",
  "aircraft_carrier",
  "airliner_crashed",
  "farm_abandoned",
  "ranch_camp",
  "Central Lab",
  "4x4_microlab_vent_shaft",
  "lab_subway_vent_shaft",
  "mil_base",
  "tutorial",
]);
function lazily<T extends object, U>(f: (x: T) => U): (x: T) => U {
  const cache = new WeakMap<T, U>();
  return (x) => {
    if (!cache.has(x)) cache.set(x, f(x));
    return cache.get(x)!;
  };
}
export const lootByOMSAppearance = lazily((data: CBNData) =>
  computeLootByOMSAppearance(data, (mg) => getLootForMapgen(data, mg)),
);
export const furnitureByOMSAppearance = lazily((data: CBNData) =>
  computeLootByOMSAppearance(data, (mg) => getFurnitureForMapgen(data, mg)),
);
export const terrainByOMSAppearance = lazily((data: CBNData) =>
  computeLootByOMSAppearance(data, (mg) => getTerrainForMapgen(data, mg)),
);

export const getOMSByAppearance = lazily(
  (data: CBNData): Map<string | undefined, string[]> => {
    const omsByAppearance = new Map<string | undefined, string[]>();
    for (const oms of data.byType("overmap_special")) {
      const appearance = overmapAppearance(data, oms);
      if (!omsByAppearance.has(appearance)) omsByAppearance.set(appearance, []);
      omsByAppearance.get(appearance)!.push(oms.id);
    }
    for (const v of omsByAppearance.values())
      v.sort((a, b) => a.localeCompare(b));
    return omsByAppearance;
  },
);

async function computeLootByOMSAppearance(
  data: CBNData,
  lootFn: (mapgen: raw.Mapgen) => Loot,
) {
  const lootByOMS = await lootByOmSpecial(data, lootFn);
  const lootByOMSAppearance = new Map<string, { loot: Loot; ids: string[] }>();
  await yieldable(async (relinquish) => {
    for (const [oms_id, loot] of lootByOMS.entries()) {
      if (hiddenLocations.has(oms_id)) continue;
      const appearance = overmapAppearance(
        data,
        data.byId("overmap_special", oms_id),
      );
      if (!appearance) continue;
      if (!lootByOMSAppearance.has(appearance))
        lootByOMSAppearance.set(appearance, {
          loot: undefined as any,
          ids: [],
        });
      const l = lootByOMSAppearance.get(appearance)!;
      if (l.loot)
        l.loot = mergeLoot([
          { loot: l.loot, weight: 1 },
          { loot: loot, weight: 1 },
        ]);
      else l.loot = loot;
      await relinquish();
      l.ids.push(oms_id);
    }
  });
  lootByOMSAppearance.forEach((l) => {
    l.ids.sort((a, b) => a.localeCompare(b));
  });
  return lootByOMSAppearance;
}

// Only for averaging..!
function flatAddItemChance(a: ItemChance, b: ItemChance): ItemChance {
  return {
    prob: a.prob + b.prob,
    expected: a.expected + b.expected,
  };
}

// Weighted average.
export function mergeLoot(loots: { loot: Loot; weight: number }[]): Loot {
  if (loots.length === 0) return new Map();
  if (loots.length === 1) return loots[0].loot;
  const totalWeight = loots.map((l) => l.weight).reduce((m, o) => m + o, 0);
  const mergedLoot: Loot = new Map();

  for (const { loot, weight } of loots) {
    const proportion = weight / totalWeight;
    for (const [item_id, chance] of loot.entries()) {
      mergedLoot.set(
        item_id,
        flatAddItemChance(
          mergedLoot.get(item_id) ?? zeroItemChance,
          scaleItemChance(chance, proportion),
        ),
      );
    }
  }
  return mergedLoot;
}

function addLoot(loots: Loot[]): Loot {
  const ret: Loot = new Map();
  for (const loot of loots) {
    for (const [item_id, chance] of loot.entries()) {
      const oldChance = ret.get(item_id) ?? zeroItemChance;
      ret.set(item_id, andItemChance(oldChance, chance));
    }
  }
  return ret;
}

function getMapgenValue(
  val: raw.MapgenValue,
  parameters?: Record<string, raw.MapgenParameter>,
): string | undefined {
  const distribution = getMapgenValueDistribution(val, parameters);
  let maxProb = -Infinity;
  let maxId: string | undefined;
  for (const [id, prob] of distribution.entries())
    if (prob > maxProb) {
      maxProb = prob;
      maxId = id;
    }
  return maxId;
}

function getMapgenValueDistribution(
  val: raw.MapgenValue,
  parameters?: Record<string, raw.MapgenParameter>,
): Map<string, number> {
  if (typeof val === "string") return new Map([[val, 1]]);
  if (Array.isArray(val)) {
    const totalProb = val.length;
    const dist = new Map<string, number>();
    for (const v of val) {
      const d = getMapgenValueDistribution(v, parameters);
      for (const [id, p] of d) {
        dist.set(id, (dist.get(id) ?? 0) + p / totalProb);
      }
    }
    return dist;
  }
  if ("ter" in val) return new Map([[val.ter, 1]]);
  if ("furn" in val) return new Map([[val.furn, 1]]);
  if (
    "switch" in val &&
    typeof val.switch === "object" &&
    "fallback" in val.switch &&
    val.switch.fallback &&
    val.switch.fallback in val.cases &&
    val.cases[val.switch.fallback]
  )
    return new Map([[val.cases[val.switch.fallback], 1]]);
  if ("distribution" in val) {
    const opts = val.distribution;
    const totalProb = opts.reduce(
      (m, it) => m + (typeof it === "string" ? 1 : it[1]),
      0,
    );
    return new Map(
      opts.map((it) =>
        typeof it === "string"
          ? [it, 1 / totalProb]
          : ([it[0], it[1] / totalProb] as [string, number]),
      ),
    );
  }
  if ("param" in val) {
    if (parameters && val.param in parameters) {
      return getMapgenValueDistribution(parameters[val.param].default);
    }
    if ("fallback" in val && val.fallback) {
      return new Map([[val.fallback, 1]]);
    }
  }
  return new Map();
}

/**
 * Convert a probability distribution (ID -> probability) into a Loot map.
 * In this conversion, the probability is used as both the chance of placement
 * and the expected count.
 */
function toLoot(distribution: Map<string, number>): Loot {
  return new Map(
    [...distribution.entries()].map(([id, prob]) => [
      id,
      { prob, expected: prob },
    ]),
  );
}

/**
 * Calculate the total weight of a list of chunks.
 * Each chunk can be either a plain value (default weight: 100) or a [value, weight] tuple.
 */
function sumChunkWeights(chunks: any[]): number {
  return chunks.reduce(
    (s, c) => s + (Array.isArray(c) ? c[1] : DEFAULT_CHANCE_PERCENTAGE),
    0,
  );
}

/**
 * Balance two conditional branches (chunks vs else_chunks) for mapgen placement.
 * Returns a combined list that gives equal probability to both branches.
 *
 * When conditions exist, both branches should have equal weight in the final selection.
 * This function scales the else_chunks to match the chunks weight, ensuring 50/50 split.
 */
function balanceConditionalBranches(
  chunks: any[],
  elseChunks: any[],
  wChunks: number,
  wElse: number,
): any[] {
  if (wChunks === 0 && wElse === 0) return [];

  // If one branch is empty, balance with a null entry
  if (wChunks === 0) return [...elseChunks, ["null", wElse]];
  if (wElse === 0) return [...chunks, ["null", wChunks]];

  // Both branches have content: scale else_chunks to achieve 50/50 split
  const scale = wChunks / wElse;
  const scaledElse = elseChunks.map((c) =>
    Array.isArray(c)
      ? [c[0], c[1] * scale]
      : [c, DEFAULT_CHANCE_PERCENTAGE * scale],
  );

  return [...chunks, ...scaledElse];
}

/**
 * Resolve nested mapgen chunks, handling conditional placement.
 *
 * If the nested placement has conditions (neighbors, connections, joins):
 * - Both `chunks` and `else_chunks` branches are balanced to have equal probability
 * - Empty branches are filled with null entries to maintain proper weight distribution
 *
 * If there are no conditions:
 * - Use `chunks` if available, otherwise use `else_chunks`
 */
function resolveNestedChunks(
  nested: raw.MapgenNested,
): (raw.MapgenValue | [raw.MapgenValue, number])[] {
  const hasCond = nested.neighbors || nested.connections || nested.joins;
  const chunks = nested.chunks || [];
  const elseChunks = (nested.else_chunks as any[]) || [];

  // If there are no conditions, use chunks if available, otherwise use else_chunks
  if (!hasCond) {
    return chunks.length > 0 ? chunks : elseChunks;
  }

  // Conditional placement: balance both branches for equal probability
  const wChunks = sumChunkWeights(chunks);
  const wElse = sumChunkWeights(elseChunks);

  return balanceConditionalBranches(chunks, elseChunks, wChunks, wElse);
}

function lootForChunks(
  data: CBNData,
  chunks: (raw.MapgenValue | [raw.MapgenValue, number])[],
  stack: WeakSet<raw.Mapgen>,
): Loot {
  const normalizedChunks = (chunks ?? []).map((c) =>
    Array.isArray(c) && c.length === 2 && typeof c[1] === "number"
      ? (c as [raw.MapgenValue, number])
      : ([c, DEFAULT_CHANCE_PERCENTAGE] as [raw.MapgenValue, number]),
  );
  const loot = mergeLoot(
    normalizedChunks.map(([chunkIdValue, weight]) => {
      const chunkId = getMapgenValue(chunkIdValue);
      const chunkMapgens = chunkId
        ? (data.nestedMapgensById(chunkId) ?? [])
        : [];
      const loot = mergeLoot(
        chunkMapgens.map((mg) => {
          const loot = getLootForMapgenInternal(data, mg, stack);
          const weight = mg.weight ?? DEFAULT_MAPGEN_WEIGHT;
          return { loot, weight };
        }),
      );
      return { loot, weight };
    }),
  );
  return loot;
}

const lootForMapgenCache = new WeakMap<raw.Mapgen, Loot>();
export function getLootForMapgen(data: CBNData, mapgen: raw.Mapgen): Loot {
  return getLootForMapgenInternal(data, mapgen, new WeakSet());
}

function getLootForMapgenInternal(
  data: CBNData,
  mapgen: raw.Mapgen,
  stack: WeakSet<raw.Mapgen>,
): Loot {
  if (lootForMapgenCache.has(mapgen)) return lootForMapgenCache.get(mapgen)!;
  if (stack.has(mapgen)) return new Map();
  stack.add(mapgen);
  const palette = parsePalette(data, mapgen.object, stack);
  const place_items: Loot[] = (mapgen.object.place_items ?? []).map(
    ({ item, chance = DEFAULT_CHANCE_PERCENTAGE, repeat }) =>
      parseItemGroup(data, item, repeat, chance / 100),
  );
  const place_item = [
    ...(mapgen.object.place_item ?? []),
    ...(mapgen.object.add ?? []),
  ].map(({ item, chance = DEFAULT_CHANCE_PERCENTAGE, repeat, amount }) => {
    const itemNormalized = getMapgenValue(item, mapgen.object.parameters);
    return itemNormalized
      ? new Map([
          [
            itemNormalized,
            repeatItemChance(
              applyAmount(
                { prob: chance / 100, expected: chance / 100 },
                amount ?? 1,
              ),
              normalizeMinMax(repeat),
            ),
          ],
        ])
      : new Map();
  });
  const place_loot: Loot[] = (mapgen.object.place_loot ?? []).map((v) => {
    const chance = v.chance ?? DEFAULT_CHANCE_PERCENTAGE;
    if ("item" in v) {
      return applyAmmoAndMagazine(
        new Map<string, ItemChance>([
          [
            v.item,
            repeatItemChance(
              chanceToItemChance(chance),
              normalizeMinMax(v.repeat),
            ),
          ],
        ]),
        v.ammo,
        v.magazine,
      );
    } else if ("group" in v) {
      return parseItemGroup(
        data,
        v.group,
        v.repeat,
        chance / 100,
        v.ammo,
        v.magazine,
      );
    }
    return new Map<string, ItemChance>();
  });
  const place_nested = (mapgen.object.place_nested ?? []).map((nested) => {
    const loot = lootForChunks(data, resolveNestedChunks(nested), stack);
    const multipliedLoot: Loot = new Map();
    for (const [id, chance] of loot.entries()) {
      multipliedLoot.set(
        id,
        repeatItemChance(chance, normalizeMinMax(nested.repeat)),
      );
    }
    return multipliedLoot;
  });
  const symbols = new Set([...palette.keys()]);
  const counts = countSymbols(mapgen.object.rows, symbols);
  const items: Loot[] = [...lootFromCounts(counts, palette)];
  const loot = collection([
    ...place_items,
    ...place_item,
    ...place_loot,
    ...place_nested,
    ...items,
  ]);
  loot.delete("null");
  lootForMapgenCache.set(mapgen, loot);
  stack.delete(mapgen);
  return loot;
}

const furnitureForMapgenCache = new WeakMap<raw.Mapgen, Loot>();
export function getFurnitureForMapgen(data: CBNData, mapgen: raw.Mapgen): Loot {
  if (furnitureForMapgenCache.has(mapgen))
    return furnitureForMapgenCache.get(mapgen)!;
  const palette = parseFurniturePalette(data, mapgen.object);
  const mappingPalette = parseMappingFurniture(
    mapgen.object.mapping,
    mapgen.object.parameters,
  );
  const place_furniture: Loot[] = (mapgen.object.place_furniture ?? []).map(
    ({ furn, repeat }) =>
      new Map([
        [
          furn,
          repeatItemChance({ prob: 1, expected: 1 }, normalizeMinMax(repeat)),
        ],
      ]),
  );
  const set_furniture = getSetLoot(mapgen, "furniture");
  const additional_items = collection([...place_furniture, ...set_furniture]);
  const symbols = new Set([...palette.keys(), ...mappingPalette.keys()]);
  const counts = countSymbols(mapgen.object.rows, symbols);
  const items: Loot[] = [
    ...lootFromCounts(counts, palette),
    ...lootFromCounts(counts, mappingPalette),
  ];
  items.push(additional_items);
  const loot = collection(items);
  loot.delete("f_null");
  furnitureForMapgenCache.set(mapgen, loot);
  return loot;
}

const terrainForMapgenCache = new WeakMap<raw.Mapgen, Loot>();
export function getTerrainForMapgen(data: CBNData, mapgen: raw.Mapgen): Loot {
  if (terrainForMapgenCache.has(mapgen))
    return terrainForMapgenCache.get(mapgen)!;
  const palette = parseTerrainPalette(data, mapgen.object);
  const mappingPalette = parseMappingTerrain(
    mapgen.object.mapping,
    mapgen.object.parameters,
  );
  const rows = mapgen.object.rows ?? [];
  const fill_ter = mapgen.object.fill_ter
    ? getMapgenValueDistribution(
        mapgen.object.fill_ter,
        mapgen.object.parameters,
      )
    : new Map<string, number>();
  const place_terrain = (mapgen.object.place_terrain ?? []).map(({ ter }) =>
    toLoot(getMapgenValueDistribution(ter, mapgen.object.parameters)),
  );
  const set_terrain = getSetLoot(mapgen, "terrain");
  const additional_items = collection([...place_terrain, ...set_terrain]);
  const countByPalette = new Map<string, number>();
  const terrainSymbols = new Set([...palette.keys(), ...mappingPalette.keys()]);
  let fillCount = 0;
  for (const row of rows)
    for (const char of row)
      if (terrainSymbols.has(char))
        countByPalette.set(char, (countByPalette.get(char) ?? 0) + 1);
      else fillCount += 1;
  if (rows.length === 0) {
    const [width, height] = mapgen.object.mapgensize ?? [1, 1];
    fillCount = width * height * OMAP_TILE_SIZE * OMAP_TILE_SIZE;
  }
  const items: Loot[] = [
    ...lootFromCounts(countByPalette, palette),
    ...lootFromCounts(countByPalette, mappingPalette),
  ];
  if (fillCount > 0) {
    const loot = toLoot(fill_ter);
    const multipliedLoot: Loot = new Map();
    for (const [id, chance] of loot.entries()) {
      multipliedLoot.set(id, repeatItemChance(chance, [fillCount, fillCount]));
    }
    items.push(multipliedLoot);
  }
  items.push(additional_items);
  const loot = collection(items);
  loot.delete("t_null");
  terrainForMapgenCache.set(mapgen, loot);
  return loot;
}

export function parseItemGroup(
  data: CBNData,
  group: raw.InlineItemGroup,
  repeat: undefined | number | [number] | [number, number],
  chance: chance,
  ammo?: number,
  magazine?: number,
): Loot {
  const g =
    typeof group === "string"
      ? data.convertTopLevelItemGroup(
          data.byIdMaybe("item_group", group) ?? { id: group, items: [] },
        )
      : Array.isArray(group)
        ? { subtype: "collection" as "collection", entries: group }
        : group;
  const flat = data.flattenItemGroup(g);
  return applyAmmoAndMagazine(
    new Map(
      flat.map((x) => [
        x.id,
        repeatItemChance(scaleItemChance(x, chance), normalizeMinMax(repeat)),
      ]),
    ),
    ammo,
    magazine,
  );
}

/**
 * Merge multiple palettes into one by combining loot for shared symbols.
 * Symbols across palettes are treated as independent rolls (using collection).
 */
function mergePalettes(palettes: Map<string, Loot>[]): Map<string, Loot> {
  const allEntries = palettes.flatMap((p) => [...p]);
  const grouped = multimap(allEntries);
  return new Map([...grouped].map(([k, v]) => [k, collection(v)]));
}

/**
 * Common logic for processing a mapping (Record<string, T | T[]>) where each symbol
 * can result in one or more Loots.
 *
 * @param mapping - The mapping object to process
 * @param extract - Function to turn a single entry into an iterable of Loots
 * @param strategy - 'independent' (collection) or 'alternative' (sum weights)
 */
function processMapping<T>(
  mapping: undefined | Record<string, T | T[] | [T, number][]>,
  extract: (t: T) => Iterable<Loot>,
  strategy: "independent" | "alternative" = "independent",
): Map<string, Loot> {
  return new Map(
    Object.entries(mapping ?? {}).map(([sym, val]) => {
      // Normalize to array of [value, weight]
      const entries = (Array.isArray(val) ? val : [val]).map((x) =>
        Array.isArray(x) && typeof x[1] === "number"
          ? (x as [T, number])
          : ([x, 1] as [T, number]),
      );

      if (strategy === "independent") {
        // All items roll independently: simple collect-all
        return [
          sym,
          collection(entries.flatMap(([x]) => [...extract(x)])),
        ] as const;
      } else {
        // Mutually exclusive alternatives: we sum the weighted probabilities
        const totalWeight = entries.reduce((m, x) => m + x[1], 0);
        const weightedLoots = entries.flatMap(([x, weight]) =>
          [...extract(x)].map((v) => attenuateLoot(v, weight / totalWeight)),
        );

        const combinedLoot: Loot = new Map();
        for (const loot of weightedLoots) {
          for (const [item_id, chance] of loot.entries()) {
            const current = combinedLoot.get(item_id) ?? zeroItemChance;
            combinedLoot.set(item_id, {
              prob: current.prob + chance.prob,
              expected: current.expected + chance.expected,
            });
          }
        }
        return [sym, combinedLoot] as const;
      }
    }),
  );
}

// Keep aliases for backward compatibility or clarity if preferred
function parsePlaceMapping<T>(
  mapping: undefined | Record<string, T | T[]>,
  extract: (t: T) => Iterable<Loot>,
): Map<string, Loot> {
  return processMapping(mapping, extract, "independent");
}

export function parsePlaceMappingAlternative<T>(
  mapping: undefined | Record<string, T | T[] | [T, number][]>,
  extract: (t: T) => Iterable<Loot>,
): Map<string, Loot> {
  return processMapping(mapping, extract, "alternative");
}

function parseMappingItems(
  data: CBNData,
  mapping: undefined | Record<string, raw.MapgenMapping>,
  parameters?: Record<string, raw.MapgenParameter>,
): Map<string, Loot> {
  const entries = Object.entries(mapping ?? {}).flatMap(([sym, val]) => {
    const loots: Loot[] = [];
    const items = Array.isArray(val.items)
      ? val.items
      : val.items
        ? [val.items]
        : [];
    for (const itemsEntry of items) {
      loots.push(
        parseItemGroup(
          data,
          itemsEntry.item,
          itemsEntry.repeat,
          (itemsEntry.chance ?? DEFAULT_CHANCE_PERCENTAGE) / 100,
          itemsEntry.ammo,
          itemsEntry.magazine,
        ),
      );
    }
    const itemEntries = Array.isArray(val.item)
      ? val.item
      : val.item
        ? [val.item]
        : [];
    for (const itemEntry of itemEntries) {
      const itemNormalized = getMapgenValue(itemEntry.item, parameters);
      if (!itemNormalized) continue;
      loots.push(
        new Map([
          [
            itemNormalized,
            repeatItemChance(
              applyAmount(
                {
                  prob: (itemEntry.chance ?? DEFAULT_CHANCE_PERCENTAGE) / 100,
                  expected:
                    (itemEntry.chance ?? DEFAULT_CHANCE_PERCENTAGE) / 100,
                },
                itemEntry.amount ?? 1,
              ),
              normalizeMinMax(itemEntry.repeat),
            ),
          ],
        ]),
      );
    }
    if (loots.length === 0) return [];
    return [[sym, collection(loots)] as const];
  });
  return new Map(entries);
}

/**
 * Common logic for parsing mapping entries that distribute furniture or terrain.
 */
function parseMappingDistribution(
  mapping: undefined | Record<string, raw.MapgenMapping>,
  field: "furniture" | "terrain",
  parameters?: Record<string, raw.MapgenParameter>,
): Map<string, Loot> {
  return new Map(
    Object.entries(mapping ?? {}).flatMap(([sym, val]) => {
      const dist = val[field];
      if (!dist) return [];
      return [
        [sym, toLoot(getMapgenValueDistribution(dist, parameters))] as const,
      ];
    }),
  );
}

function parseMappingFurniture(
  mapping: undefined | Record<string, raw.MapgenMapping>,
  parameters?: Record<string, raw.MapgenParameter>,
): Map<string, Loot> {
  return parseMappingDistribution(mapping, "furniture", parameters);
}

function parseMappingTerrain(
  mapping: undefined | Record<string, raw.MapgenMapping>,
  parameters?: Record<string, raw.MapgenParameter>,
): Map<string, Loot> {
  return parseMappingDistribution(mapping, "terrain", parameters);
}

function countSymbols(
  rows: string[] | undefined,
  symbols: Set<string>,
): Map<string, number> {
  const countBySymbol = new Map<string, number>();
  for (const row of rows ?? [])
    for (const char of row)
      if (symbols.has(char))
        countBySymbol.set(char, (countBySymbol.get(char) ?? 0) + 1);
  return countBySymbol;
}

function lootFromCounts(
  counts: Map<string, number>,
  palette: Map<string, Loot>,
): Loot[] {
  const items: Loot[] = [];
  for (const [sym, count] of counts.entries()) {
    const loot = palette.get(sym);
    if (!loot) continue;
    const multipliedLoot: Loot = new Map();
    for (const [id, chance] of loot.entries()) {
      multipliedLoot.set(id, repeatItemChance(chance, [count, count]));
    }
    items.push(multipliedLoot);
  }
  return items;
}

/**
 * Process palette references (raw.PaletteData["palettes"]), handling:
 * - Simple string references to other palettes
 * - Distribution of weighted palette options
 * - Parameterized palette selection
 *
 * This is shared logic used by parsePalette, parseFurniturePalette, and parseTerrainPalette.
 *
 * @param paletteRefs - The `palettes` field from a palette definition
 * @param parseFn - The specific palette parsing function to apply (e.g., parsePalette)
 * @param data - The CBN data instance
 * @param currentPalette - The current palette being processed (for parameter resolution)
 * @param stack - Optional recursion guard for nested palettes
 * @returns Array of processed palettes (possibly attenuated by distribution weights)
 */
function processPaletteDistributions(
  paletteRefs: raw.PaletteData["palettes"],
  parseFn: (
    data: CBNData,
    palette: raw.PaletteData,
    stack?: WeakSet<raw.Mapgen>,
  ) => Map<string, Loot>,
  data: CBNData,
  currentPalette: raw.PaletteData,
  stack?: WeakSet<raw.Mapgen>,
): Map<string, Loot>[] {
  return (paletteRefs ?? []).flatMap((val) => {
    // Simple string reference: just parse the referenced palette
    if (typeof val === "string") {
      return [parseFn(data, data.byId("palette", val), stack)];
    }

    // Distribution: parse each palette option and attenuate by its weight
    if ("distribution" in val) {
      const opts = val.distribution;
      const totalWeight = opts.reduce((m, it) => m + extractWeight(it), 0);
      return opts.map((it) =>
        attenuatePalette(
          parseFn(data, data.byId("palette", extractValue(it)), stack),
          extractWeight(it) / totalWeight,
        ),
      );
    }

    // Parameterized palette: resolve parameter and parse resulting palette(s)
    if ("param" in val) {
      const parameters = currentPalette.parameters;
      if (parameters && val.param in parameters) {
        const param = parameters[val.param];
        if (param.type !== "palette_id") {
          console.warn(
            `unexpected parameter type (was ${param.type}, expected palette_id)`,
          );
          return [];
        }
        const distribution = getMapgenValueDistribution(param.default);
        return [...distribution.entries()].map(([id, chance]) =>
          attenuatePalette(
            parseFn(data, data.byId("palette", id), stack),
            chance,
          ),
        );
      } else {
        console.warn(`missing parameter ${val.param}`);
        return [];
      }
    }

    return [];
  });
}

const paletteCache = new WeakMap<raw.PaletteData, Map<string, Loot>>();
function parsePaletteSealedMapping(
  data: CBNData,
  palette: raw.PaletteData,
): Map<string, Loot> {
  return parsePlaceMapping(
    palette.sealed_item,
    function* ({ item, items, chance = DEFAULT_CHANCE_PERCENTAGE }) {
      if (items)
        yield parseItemGroup(
          data,
          items.item,
          items.repeat,
          ((chance / 100) * (items.chance ?? DEFAULT_CHANCE_PERCENTAGE)) / 100,
          items.ammo,
          items.magazine,
        );
      if (item && typeof item.item === "string")
        yield applyAmmoAndMagazine(
          new Map([
            [
              item.item,
              repeatItemChance(
                applyAmount(
                  {
                    prob:
                      (chance / 100) *
                      ((item.chance ?? DEFAULT_CHANCE_PERCENTAGE) / 100),
                    expected:
                      (chance / 100) *
                      ((item.chance ?? DEFAULT_CHANCE_PERCENTAGE) / 100),
                  },
                  item.amount ?? 1,
                ),
                normalizeMinMax(item.repeat),
              ),
            ],
          ]),
          undefined,
          undefined,
        );
    },
  );
}

function parsePaletteItemMapping(
  data: CBNData,
  palette: raw.PaletteData,
): Map<string, Loot> {
  return parsePlaceMapping(
    palette.item,
    function* ({ item, chance = DEFAULT_CHANCE_PERCENTAGE, repeat, amount }) {
      if (typeof item === "string")
        yield new Map([
          [
            item,
            repeatItemChance(
              applyAmount(
                { prob: chance / 100, expected: chance / 100 },
                amount ?? 1,
              ),
              normalizeMinMax(repeat),
            ),
          ],
        ]);
    },
  );
}

function parsePaletteItemsMapping(
  data: CBNData,
  palette: raw.PaletteData,
): Map<string, Loot> {
  return parsePlaceMapping(
    palette.items,
    function* ({
      item,
      chance = DEFAULT_CHANCE_PERCENTAGE,
      repeat,
      ammo,
      magazine,
    }) {
      yield parseItemGroup(data, item, repeat, chance / 100, ammo, magazine);
    },
  );
}

function parsePaletteNestedMapping(
  data: CBNData,
  palette: raw.PaletteData,
  stack: WeakSet<raw.Mapgen>,
): Map<string, Loot> {
  return parsePlaceMappingAlternative(palette.nested, function* (nestedEntry) {
    yield lootForChunks(data, resolveNestedChunks(nestedEntry), stack);
  });
}

export function parsePalette(
  data: CBNData,
  palette: raw.PaletteData,
  stack?: WeakSet<raw.Mapgen>,
): Map<string, Loot> {
  if (paletteCache.has(palette)) return paletteCache.get(palette)!;
  const stackLocal = stack ?? new WeakSet<raw.Mapgen>();
  const palettes = processPaletteDistributions(
    palette.palettes,
    parsePalette,
    data,
    palette,
    stackLocal,
  );
  const ret = mergePalettes([
    parsePaletteItemMapping(data, palette),
    parsePaletteItemsMapping(data, palette),
    parsePaletteSealedMapping(data, palette),
    parsePaletteNestedMapping(data, palette, stackLocal),
    parseMappingItems(data, palette.mapping, palette.parameters),
    ...palettes,
  ]);
  paletteCache.set(palette, ret);
  return ret;
}

const furniturePaletteCache = new WeakMap<raw.PaletteData, Map<string, Loot>>();
export function parseFurniturePalette(
  data: CBNData,
  palette: raw.PaletteData,
): Map<string, Loot> {
  if (furniturePaletteCache.has(palette))
    return furniturePaletteCache.get(palette)!;
  const furniture = parsePlaceMappingAlternative(
    palette.furniture,
    function* (furn) {
      const value = getMapgenValueDistribution(
        extractValue(furn),
        palette.parameters,
      );
      for (const [f, prob] of value.entries())
        if (value) yield new Map([[f, { prob, expected: prob }]]);
    },
  );
  const palettes = processPaletteDistributions(
    palette.palettes,
    parseFurniturePalette,
    data,
    palette,
  );
  const ret = mergePalettes([furniture, ...palettes]);
  furniturePaletteCache.set(palette, ret);
  return ret;
}

const terrainPaletteCache = new WeakMap<raw.PaletteData, Map<string, Loot>>();
export function parseTerrainPalette(
  data: CBNData,
  palette: raw.PaletteData,
): Map<string, Loot> {
  if (terrainPaletteCache.has(palette))
    return terrainPaletteCache.get(palette)!;
  const terrain = parsePlaceMappingAlternative(
    palette.terrain,
    function* (ter) {
      const value = getMapgenValueDistribution(
        extractValue(ter),
        palette.parameters,
      );
      for (const [t, prob] of value.entries())
        if (value) yield new Map([[t, { prob, expected: prob }]]);
    },
  );
  const palettes = processPaletteDistributions(
    palette.palettes,
    parseTerrainPalette,
    data,
    palette,
  );
  const ret = mergePalettes([terrain, ...palettes]);
  terrainPaletteCache.set(palette, ret);
  return ret;
}
