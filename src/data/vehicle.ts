import type { CddaData } from "./cddaData";
import type { ItemGroupData, Vehicle } from "../types";

const vpartVariants = [
  "cover_left",
  "cover_right",
  "hatch_wheel_left",
  "hatch_wheel_right",
  "wheel_left",
  "wheel_right",
  "cross_unconnected",
  "cross",
  "horizontal_front_edge",
  "horizontal_front",
  "horizontal_rear_edge",
  "horizontal_rear",
  "horizontal_2_front",
  "horizontal_2_rear",
  "ne_edge",
  "nw_edge",
  "se_edge",
  "sw_edge",
  "vertical_right",
  "vertical_left",
  "vertical_2_right",
  "vertical_2_left",
  "vertical_T_right",
  "vertical_T_left",
  "front_right",
  "front_left",
  "rear_right",
  "rear_left",
  // these have to be last to avoid false positives
  "cover",
  "vertical",
  "horizontal",
  "vertical_2",
  "horizontal_2",
  "ne",
  "nw",
  "se",
  "sw",
  "front",
  "rear",
  "left",
  "right",
];

export const getVehiclePartIdAndVariant = (
  data: CddaData,
  compositePartId: string,
): [string, string] => {
  if (data.byIdMaybe("vehicle_part", compositePartId))
    return [compositePartId, ""];
  const m = /^(.+)#(.+?)$/.exec(compositePartId);
  if (m) return [m[1], m[2]];

  // TODO: only check this for releases older than https://github.com/CleverRaven/Cataclysm-DDA/pull/65871
  for (const variant of vpartVariants) {
    if (compositePartId.endsWith("_" + variant)) {
      return [
        compositePartId.slice(0, compositePartId.length - variant.length - 1),
        variant,
      ];
    }
  }
  return [compositePartId, ""];
};

const _itemGroupFromVehicleCache = new Map<Vehicle, ItemGroupData>();
export function itemGroupFromVehicle(vehicle: Vehicle): ItemGroupData {
  if (_itemGroupFromVehicleCache.has(vehicle))
    return _itemGroupFromVehicleCache.get(vehicle)!;
  const ret: ItemGroupData = {
    subtype: "collection",
    entries: (vehicle.items ?? []).map((it) => {
      if (it.items) {
        return {
          collection: (typeof it.items === "string"
            ? [it.items]
            : it.items
          ).map((it_id) => ({ item: it_id })),
          prob: it.chance,
        };
      } else if (it.item_groups) {
        return {
          collection: (typeof it.item_groups === "string"
            ? [it.item_groups]
            : it.item_groups
          ).map((ig_id) => ({ group: ig_id })),
          prob: it.chance,
        };
      } else {
        return { distribution: [] };
      }
    }),
  };

  _itemGroupFromVehicleCache.set(vehicle, ret);
  return ret;
}
