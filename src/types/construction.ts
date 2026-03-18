import type { Construction } from "../types";

export type ConstructionSurfaceTarget = {
  id: string;
  type: "terrain" | "furniture";
};

/**
 * Collect prerequisite terrain/furniture targets using explicit fields.
 */
export function getConstructionPrerequisites(
  construction: Pick<Construction, "pre_terrain" | "pre_furniture">,
): ConstructionSurfaceTarget[] {
  const prerequisites: ConstructionSurfaceTarget[] = [];

  if (construction.pre_terrain) {
    prerequisites.push({ id: construction.pre_terrain, type: "terrain" });
  }

  if (construction.pre_furniture) {
    prerequisites.push({ id: construction.pre_furniture, type: "furniture" });
  }

  return prerequisites;
}

/**
 * Collect output terrain/furniture targets using explicit fields.
 */
export function getConstructionResults(
  construction: Pick<Construction, "post_terrain" | "post_furniture">,
): ConstructionSurfaceTarget[] {
  const results: ConstructionSurfaceTarget[] = [];

  if (construction.post_terrain) {
    results.push({ id: construction.post_terrain, type: "terrain" });
  }

  if (construction.post_furniture) {
    results.push({ id: construction.post_furniture, type: "furniture" });
  }

  return results;
}

export function isNullConstructionResult(
  result: ConstructionSurfaceTarget,
): boolean {
  return (
    (result.type === "terrain" && result.id === "t_null") ||
    (result.type === "furniture" && result.id === "f_null")
  );
}
