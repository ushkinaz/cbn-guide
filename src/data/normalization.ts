import type { ComestibleSlot, DamageInstance, DamageUnit } from "../types";

export function normalize<T>(xs: (T | T[])[] | undefined): T[][] {
  return xs?.map((x: T | T[]) => (Array.isArray(x) ? (x as T[]) : [x])) ?? [];
}

export const countsByCharges = (item: any): boolean => {
  return item.type === "AMMO" || item.type === "COMESTIBLE" || item.stackable;
};

export function normalizeDamageInstance(
  damageInstance: DamageInstance,
): DamageUnit[] {
  if (Array.isArray(damageInstance)) return damageInstance;
  else if ("values" in damageInstance) return damageInstance.values;
  else return [damageInstance];
}

export function normalizeAddictionTypes(
  comestible: ComestibleSlot,
): { addiction: string; potential: number }[] {
  const addictionType = comestible.addiction_type;
  if (typeof addictionType === "string") {
    return [
      {
        addiction: addictionType,
        potential: comestible.addiction_potential ?? 0,
      },
    ];
  } else {
    return [];
  }
}
