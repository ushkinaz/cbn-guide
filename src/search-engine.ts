import fuzzysort from "fuzzysort";
import { type CBNData, mapType } from "./data";
import type { SupportedTypeMapped, SupportedTypesWithMapped } from "./types";
import { metrics } from "./metrics";
import { nowTimeStamp } from "./utils/perf";
import { i18n, gameSingularName } from "./utils/i18n";

export const SEARCHABLE_TYPES = new Set<keyof SupportedTypesWithMapped>([
  "item",
  "monster",
  "furniture",
  "vehicle_part",
  "tool_quality",
  "martial_art",
  "mutation",
  "mutation_category",
  "vehicle",
  "terrain",
  "skill",
  "overmap_special",
]);

export type SearchTarget = {
  id: string;
  name: string;
  type: keyof SupportedTypesWithMapped;
};

export type SearchResult = {
  item: SupportedTypeMapped & {
    id: string;
    type: keyof SupportedTypesWithMapped;
  } & { __filename?: string };
};

export type SearchResultsMap = Map<string, SearchResult[]>;

const OVERMAP_DIRECTION_SUFFIX = /_(north|south|east|west)$/;

export const cjkRegex =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\u3131-\ud79d]/;

export function searchableName(data: CBNData, item: SupportedTypeMapped) {
  if (item.type === "overmap_special" || item.type === "city_building") {
    const flat = data._flatten(item);
    if (flat.subtype === "mutable") return flat.id;
    else
      return (
        flat.overmaps
          ?.filter((omEntry) => omEntry.overmap)
          .map((omEntry) => {
            const normalizedId = omEntry.overmap!.replace(
              OVERMAP_DIRECTION_SUFFIX,
              "",
            );
            const om = data.byIdMaybe("overmap_terrain", normalizedId);
            return om ? gameSingularName(om) : normalizedId;
          })
          .join("\0") ?? flat.id
      );
  }

  let name = data.resolveOne(item, "name");
  let type = item.type;
  let id = (item as any).id;

  if (item.type === "vehicle_part" && !name && (item as any).item) {
    const underlying = data.byId("item", (item as any).item);
    name = underlying.name;
    type = underlying.type;
    id = underlying.id;
  }

  if (i18n.getLocale().startsWith("zh_")) {
    const pseudoObj = { id, type, name };
    return (
      gameSingularName(pseudoObj) + " " + gameSingularName(pseudoObj, "pinyin")
    );
  }
  return gameSingularName({ id, type, name });
}

export function buildSearchIndex(data: CBNData): SearchTarget[] {
  const start = nowTimeStamp();
  const raw = data?.all() ?? [];
  const targets: SearchTarget[] = [];
  for (const x of raw) {
    if (!("id" in x) || typeof x.id !== "string") continue;
    const mappedType = mapType(x.type);
    if (!SEARCHABLE_TYPES.has(mappedType)) continue;

    if (x.type === "mutation" && /Fake\d$/.test(x.id as string)) continue;

    if (
      x.type === "MONSTER" &&
      !data.isMonsterVisible((x as { id: string }).id)
    )
      continue;

    targets.push({
      id: (x as any).id,
      name: searchableName(data, x),
      type: mappedType,
    });
  }
  metrics.distribution(
    "search.index.calc_duration_ms",
    Math.round(nowTimeStamp() - start),
    {
      unit: "millisecond",
    },
  );
  return targets;
}

export function performSearch(
  text: string,
  targets: SearchTarget[],
  data: CBNData,
): SearchResultsMap {
  const results = fuzzysort.go(text, targets, {
    keys: ["id", "name"],
    threshold: -10000,
  });

  if (results.length === 0) {
    metrics.count("search.query.empty", 1);
  }
  const byType = new Map<string, SearchResult[]>();
  const seen = new Set<string>();

  for (const { obj: item } of results) {
    const mappedType = item.type;
    if (!SEARCHABLE_TYPES.has(mappedType)) continue;

    let list = byType.get(mappedType);
    if (!list) {
      list = [];
      byType.set(mappedType, list);
    }

    const key = mappedType + ":" + item.id;
    if (seen.has(key)) continue;
    seen.add(key);

    const obj = data.byId(mappedType, item.id) as SearchResult["item"];
    list.push({ item: obj });
  }
  return byType;
}
