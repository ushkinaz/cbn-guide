import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as TJS from "ts-json-schema-generator";

import { makeTestCBNData } from "../src/data.test-helpers";
import type { ModData } from "../src/types";

/**
 * Analyze which top-level properties declared in `SupportedTypes` are not
 * observed in the real fixture datasets.
 *
 * Purpose:
 * - give a lightweight reality check for the JSON-facing type surface in
 *   `src/types.ts`
 * - find top-level properties that are declared but appear to be unused in
 *   `_test/all.json` and `_test/all_mods.json`
 * - treat `ItemBasicInfo` specially so shared item-base fields are reported
 *   once, not repeated for every concrete item type
 *
 * Scope:
 * - only top-level properties are analyzed
 * - only `SupportedTypes` and `ItemBasicInfo` are considered
 * - only the checked-in fixture data is considered, not upstream source trees
 *   or runtime-fetched data
 *
 * Assumptions:
 * - `ts-json-schema-generator` produces a sufficiently faithful schema for the
 *   top-level shape of `SupportedTypes`
 * - `_test/all.json` and `_test/all_mods.json` are representative enough to
 *   use as a practical proxy for "real data"
 * - flattening via `CBNData._flatten()` is a reasonable approximation of the
 *   effective post-`copy-from` object shape
 *
 * Limitations:
 * - this is intentionally shallow: nested paths are not reported
 * - absence in fixtures is not proof that a property is invalid upstream; it
 *   may simply be rare or missing from the current snapshot
 * - the script reports presence/absence, not semantic correctness or value
 *   quality
 * - `ItemBasicInfo` suppression is heuristic and tied to the explicit
 *   `ITEM_TYPE_NAMES` list below
 */
type JSONSchema = TJS.Definition & {
  $ref?: string;
  additionalProperties?: unknown;
  allOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema | JSONSchema[];
  prefixItems?: JSONSchema[];
  type?: string | string[];
};

type DataBlob = {
  build_number?: string;
  data: unknown[];
  mods?: string[];
  release?: string;
};

type DeclaredPathMeta = {
  path: string;
  declaredBy: string[];
};

type PathCounts = {
  raw: number;
  flattened: number;
};

type TypeReport = {
  typeName: string;
  objectCount: number;
  declaredPathCount: number;
  usedInRaw: number;
  usedOnlyAfterFlattening: number;
  neverObserved: number;
  entries: Array<
    DeclaredPathMeta & {
      raw: number;
      flattened: number;
      status: "used_raw" | "flattened_only" | "never_seen";
    }
  >;
};

type FinalReport = {
  generatedAt: string;
  fixtures: {
    corePath: string;
    modsPath: string;
    coreObjects: number;
    modObjects: number;
    combinedObjects: number;
  };
  totals: {
    supportedTypes: number;
    declaredPaths: number;
    usedInRaw: number;
    usedOnlyAfterFlattening: number;
    neverObserved: number;
  };
  perType: TypeReport[];
};

//TODO: use SUPPORTED_TYPE_KEYS
const ITEM_TYPE_NAMES = new Set([
  "AMMO",
  "ARMOR",
  "BATTERY",
  "BIONIC_ITEM",
  "BOOK",
  "COMESTIBLE",
  "CONTAINER",
  "ENGINE",
  "GENERIC",
  "GUN",
  "GUNMOD",
  "MAGAZINE",
  "PET_ARMOR",
  "TOOL",
  "TOOLMOD",
  "TOOL_ARMOR",
  "WHEEL",
]);

const repoRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const corePath = path.join(repoRoot, "_test/all.json");
const modsPath = path.join(repoRoot, "_test/all_mods.json");

function readJSON<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

/**
 * Convert a JSON Schema local ref into a definition key name.
 */
function normalizeRef(ref: string): string {
  return ref.replace(/^#\/definitions\//, "");
}

/**
 * Create a schema generator configured the same way as the schema tests.
 *
 * `additionalProperties: true` is deliberate: the script is only interested in
 * whether declared keys are ever observed, not in rejecting extra keys.
 */
function createGenerator(): TJS.SchemaGenerator {
  return TJS.createGenerator({
    tsconfig: path.join(repoRoot, "tsconfig.json"),
    additionalProperties: true,
  });
}

/**
 * Collect the declared top-level property names for a schema node.
 *
 * The traversal resolves local `$ref`s and merges `allOf`/`anyOf`/`oneOf`
 * branches, but it intentionally stops at the first object layer because this
 * script is now scoped to top-level fields only.
 */
function collectDeclaredTopLevelPaths(
  schema: JSONSchema | undefined,
  definitions: Record<string, JSONSchema>,
  refStack = new Set<string>(),
  source = "inline",
  output = new Map<string, Set<string>>(),
): Map<string, Set<string>> {
  if (!schema) return output;

  if (schema.$ref) {
    const refName = normalizeRef(schema.$ref);
    if (refStack.has(refName)) return output;
    const resolved = definitions[refName];
    if (!resolved) return output;

    const nextStack = new Set(refStack);
    nextStack.add(refName);
    collectDeclaredTopLevelPaths(
      resolved,
      definitions,
      nextStack,
      refName,
      output,
    );
    return output;
  }

  for (const branch of schema.allOf ?? []) {
    collectDeclaredTopLevelPaths(branch, definitions, refStack, source, output);
  }
  for (const branch of schema.anyOf ?? []) {
    collectDeclaredTopLevelPaths(branch, definitions, refStack, source, output);
  }
  for (const branch of schema.oneOf ?? []) {
    collectDeclaredTopLevelPaths(branch, definitions, refStack, source, output);
  }

  for (const key of Object.keys(schema.properties ?? {})) {
    if (!output.has(key)) output.set(key, new Set());
    output.get(key)!.add(source);
  }

  return output;
}

/**
 * Return the top-level keys present on a concrete JSON object.
 */
function collectActualTopLevelPaths(value: unknown): Set<string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Set();
  }
  return new Set(Object.keys(value));
}

/**
 * Increment occurrence counts for a batch of observed keys.
 */
function incrementPathCounts(
  counts: Map<string, PathCounts>,
  paths: Set<string>,
  key: keyof PathCounts,
): void {
  for (const path of paths) {
    const current = counts.get(path) ?? { raw: 0, flattened: 0 };
    current[key] += 1;
    counts.set(path, current);
  }
}

/**
 * Load the core and mod fixtures, then compute a flattened view of the combined
 * dataset.
 *
 * Flattening is used to distinguish keys that are never authored from keys that
 * only appear after inheritance. Warnings from `_flatten()` are muted here
 * because they are data-quality noise for this report, not failures of the
 * analysis itself.
 */
function loadFixtures(): {
  core: DataBlob;
  mods: Record<string, ModData>;
  combinedRaw: unknown[];
  flattenedCombined: unknown[];
  modObjectCount: number;
} {
  const core = readJSON<DataBlob>(corePath);
  const mods = readJSON<Record<string, ModData>>(modsPath);
  const modEntries = Object.values(mods);
  const modObjects = modEntries.flatMap((entry) => entry.data);
  const combinedRaw = [...core.data, ...modObjects];
  const data = makeTestCBNData(combinedRaw);
  const originalWarn = console.warn;
  let flattenedCombined: unknown[];
  try {
    console.warn = () => {};
    flattenedCombined = data.all().map((entry) => data._flatten(entry));
  } finally {
    console.warn = originalWarn;
  }

  return {
    core,
    mods,
    combinedRaw,
    flattenedCombined,
    modObjectCount: modObjects.length,
  };
}

/**
 * Build the full analysis report.
 *
 * Concrete item types have `ItemBasicInfo` fields removed from their individual
 * reports. Those shared fields are then checked once across all item-like
 * objects and reported under the synthetic `ItemBasicInfo` section only if they
 * never occur at all.
 */
function buildReport(): FinalReport {
  const generator = createGenerator();
  const schema = generator.createSchema("SupportedTypes") as JSONSchema & {
    definitions: Record<string, JSONSchema>;
  };
  const itemBasicInfoSchema = generator.createSchema(
    "ItemBasicInfo",
  ) as JSONSchema & {
    definitions: Record<string, JSONSchema>;
  };
  const supportedTypesSchema = schema.definitions.SupportedTypes as JSONSchema;
  const typeSchemas = supportedTypesSchema.properties ?? {};
  const itemBasicInfoPaths = new Set(
    collectDeclaredTopLevelPaths(
      itemBasicInfoSchema.definitions.ItemBasicInfo,
      itemBasicInfoSchema.definitions,
    ).keys(),
  );

  const { core, combinedRaw, flattenedCombined, modObjectCount } =
    loadFixtures();
  const typeNames = Object.keys(typeSchemas).sort();
  const itemRawObjects = combinedRaw.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) &&
      typeof entry === "object" &&
      "type" in entry! &&
      ITEM_TYPE_NAMES.has((entry as { type?: string }).type ?? ""),
  );
  const itemFlattenedObjects = flattenedCombined.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) &&
      typeof entry === "object" &&
      "type" in entry! &&
      ITEM_TYPE_NAMES.has((entry as { type?: string }).type ?? ""),
  );
  const itemBasicInfoCounts = new Map<string, PathCounts>();

  for (const entry of itemRawObjects) {
    incrementPathCounts(
      itemBasicInfoCounts,
      collectActualTopLevelPaths(entry),
      "raw",
    );
  }

  for (const entry of itemFlattenedObjects) {
    incrementPathCounts(
      itemBasicInfoCounts,
      collectActualTopLevelPaths(entry),
      "flattened",
    );
  }

  const perType = typeNames.map((typeName) => {
    const declaredPathsMap = collectDeclaredTopLevelPaths(
      typeSchemas[typeName],
      schema.definitions,
    );
    const filteredDeclaredPaths = new Map(
      [...declaredPathsMap.entries()].filter(
        ([declaredPath]) =>
          !(
            ITEM_TYPE_NAMES.has(typeName) &&
            itemBasicInfoPaths.has(declaredPath)
          ),
      ),
    );
    const counts = new Map<string, PathCounts>();

    const rawObjects = combinedRaw.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) &&
        typeof entry === "object" &&
        "type" in entry! &&
        (entry as { type?: unknown }).type === typeName,
    );

    const flattenedObjects = flattenedCombined.filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) &&
        typeof entry === "object" &&
        "type" in entry! &&
        (entry as { type?: unknown }).type === typeName,
    );

    for (const entry of rawObjects) {
      incrementPathCounts(counts, collectActualTopLevelPaths(entry), "raw");
    }

    for (const entry of flattenedObjects) {
      incrementPathCounts(
        counts,
        collectActualTopLevelPaths(entry),
        "flattened",
      );
    }

    const entries = [...filteredDeclaredPaths.entries()]
      .map(([declaredPath, declaredBy]): TypeReport["entries"][number] => {
        const pathCounts = counts.get(declaredPath) ?? { raw: 0, flattened: 0 };
        const status =
          pathCounts.raw > 0
            ? "used_raw"
            : pathCounts.flattened > 0
              ? "flattened_only"
              : "never_seen";

        return {
          path: declaredPath,
          declaredBy: [...declaredBy].sort(),
          raw: pathCounts.raw,
          flattened: pathCounts.flattened,
          status,
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path));

    return {
      typeName,
      objectCount: rawObjects.length,
      declaredPathCount: entries.length,
      usedInRaw: entries.filter((entry) => entry.status === "used_raw").length,
      usedOnlyAfterFlattening: entries.filter(
        (entry) => entry.status === "flattened_only",
      ).length,
      neverObserved: entries.filter((entry) => entry.status === "never_seen")
        .length,
      entries,
    } satisfies TypeReport;
  });

  const itemBasicInfoEntries: TypeReport["entries"] = [...itemBasicInfoPaths]
    .map((declaredPath): TypeReport["entries"][number] => {
      const pathCounts = itemBasicInfoCounts.get(declaredPath) ?? {
        raw: 0,
        flattened: 0,
      };

      return {
        path: declaredPath,
        declaredBy: ["ItemBasicInfo"],
        raw: pathCounts.raw,
        flattened: pathCounts.flattened,
        status: "never_seen",
      };
    })
    .filter((entry) => entry.raw === 0 && entry.flattened === 0)
    .sort((left, right) => left.path.localeCompare(right.path));

  perType.unshift({
    typeName: "ItemBasicInfo",
    objectCount: itemRawObjects.length,
    declaredPathCount: itemBasicInfoEntries.length,
    usedInRaw: 0,
    usedOnlyAfterFlattening: 0,
    neverObserved: itemBasicInfoEntries.length,
    entries: itemBasicInfoEntries,
  });

  const totals = perType.reduce(
    (acc, typeReport) => {
      acc.declaredPaths += typeReport.declaredPathCount;
      acc.usedInRaw += typeReport.usedInRaw;
      acc.usedOnlyAfterFlattening += typeReport.usedOnlyAfterFlattening;
      acc.neverObserved += typeReport.neverObserved;
      return acc;
    },
    {
      supportedTypes: perType.length,
      declaredPaths: 0,
      usedInRaw: 0,
      usedOnlyAfterFlattening: 0,
      neverObserved: 0,
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    fixtures: {
      corePath,
      modsPath,
      coreObjects: core.data.length,
      modObjects: modObjectCount,
      combinedObjects: combinedRaw.length,
    },
    totals,
    perType,
  };
}

/**
 * Render a human-readable Markdown report.
 */
function formatSummary(report: FinalReport): string {
  const lines: string[] = [];

  lines.push("# Unused SupportedTypes Property Report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push("");
  lines.push("Legend:");
  lines.push(
    "- `used_raw`: path appears directly in at least one fixture object.",
  );
  lines.push(
    "- `flattened_only`: path is absent in raw fixtures but appears after `copy-from` flattening.",
  );
  lines.push(
    "- `never_seen`: path does not appear in either raw fixtures or flattened objects.",
  );
  lines.push(
    "- `ItemBasicInfo` is special: its shared props are hidden from concrete item types and only reported when absent across all item-like data.",
  );
  lines.push("");
  lines.push("Fixture coverage:");
  lines.push(`- core objects: ${report.fixtures.coreObjects}`);
  lines.push(`- mod objects: ${report.fixtures.modObjects}`);
  lines.push(`- combined objects: ${report.fixtures.combinedObjects}`);
  lines.push("");
  lines.push("Totals:");
  lines.push(`- supported types: ${report.totals.supportedTypes}`);
  lines.push(`- declared paths: ${report.totals.declaredPaths}`);
  lines.push(`- used in raw: ${report.totals.usedInRaw}`);
  lines.push(
    `- used only after flattening: ${report.totals.usedOnlyAfterFlattening}`,
  );
  lines.push(`- never seen: ${report.totals.neverObserved}`);

  for (const typeReport of report.perType) {
    lines.push("");
    lines.push(`## ${typeReport.typeName}`);
    lines.push(
      `objects=${typeReport.objectCount}, declared=${typeReport.declaredPathCount}, raw=${typeReport.usedInRaw}, flattened_only=${typeReport.usedOnlyAfterFlattening}, never_seen=${typeReport.neverObserved}`,
    );

    const neverSeen = typeReport.entries.filter(
      (entry) => entry.status === "never_seen",
    );
    if (neverSeen.length === 0) {
      lines.push("- no never-seen declared paths");
      continue;
    }

    for (const entry of neverSeen) {
      const via = entry.declaredBy.join(", ");
      lines.push(`- ${entry.path} (declared via ${via})`);
    }
  }

  return lines.join("\n");
}

/**
 * Parse a very small CLI surface.
 */
function parseArgs(argv: string[]): {
  outputPath?: string;
  json: boolean;
} {
  let outputPath: string | undefined;
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--output") {
      outputPath = argv[index + 1];
      index += 1;
    }
  }

  return { outputPath, json };
}

/**
 * Entry point for CLI execution.
 */
function main(): void {
  const { outputPath, json } = parseArgs(process.argv.slice(2));
  const report = buildReport();
  const rendered = json
    ? JSON.stringify(report, null, 2)
    : formatSummary(report);

  if (outputPath) {
    const absoluteOutputPath = path.resolve(process.cwd(), outputPath);
    fs.mkdirSync(path.dirname(absoluteOutputPath), { recursive: true });
    fs.writeFileSync(absoluteOutputPath, rendered + "\n");
  }

  process.stdout.write(rendered + "\n");
}

main();
