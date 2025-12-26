import type { OvermapSpecial } from "./types";
import { CddaData } from "./data/cddaData";
import { singularName } from "./data/i18n";

export { mapType } from "./data/mapping";
export {
  i18n,
  translate,
  singular,
  plural,
  singularName,
  pluralName,
  byName,
} from "./data/i18n";
export {
  showProbability,
  parseVolume,
  parseMass,
  parseDuration,
  asMinutes,
  asHumanReadableDuration,
  asLiters,
  asKilograms,
} from "./data/units";
export {
  normalize,
  countsByCharges,
  normalizeDamageInstance,
  normalizeAddictionTypes,
} from "./data/normalization";
export { normalizeUseAction } from "./data/useActions";
export {
  getVehiclePartIdAndVariant,
  itemGroupFromVehicle,
} from "./data/vehicle";
export { versionSlug, loadProgress, data } from "./data/loader";
export { CddaData } from "./data/cddaData";

export function omsName(data: CddaData, oms: OvermapSpecial): string {
  if (oms.subtype === "mutable") return oms.id;
  const ground_level_omts = (oms.overmaps ?? []).filter(
    (p) => p.point[2] === 0,
  );
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;
  const grid = new Map<string, (typeof ground_level_omts)[0]>();
  for (const omt of ground_level_omts) {
    const [x, y] = omt.point;
    if (!omt.overmap) continue;
    if (
      !data.byIdMaybe(
        "overmap_terrain",
        omt.overmap.replace(/_(north|south|east|west)$/, ""),
      )
    )
      continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    grid.set(`${x}|${y}`, omt);
  }
  const centerX = minX + Math.floor((maxX - minX) / 2);
  const centerY = minY + Math.floor((maxY - minY) / 2);
  const centerOmt = grid.get(`${centerX}|${centerY}`);
  if (centerOmt?.overmap) {
    const omt = data.byId(
      "overmap_terrain",
      centerOmt.overmap.replace(/_(north|south|east|west)$/, ""),
    );
    if (omt) {
      return singularName(omt);
    }
  }
  return oms.id;
}
