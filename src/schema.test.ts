import * as TJS from "ts-json-schema-generator";
import * as fs from "fs";
import * as util from "util";
import Ajv from "ajv";
import type { ValidateFunction } from "ajv";
import { CddaData } from "./data";
import { test, expect } from "vitest";
import { SchemaGenerator } from "ts-json-schema-generator";

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchSchema(validate: ValidateFunction): R;
    }
  }
}

expect.extend({
  toMatchSchema(obj: any, schema: ValidateFunction) {
    const valid = schema(obj);
    const errors = schema.errors?.slice();
    const filename = findFilename(obj, parentMap);
    return {
      pass: valid,
      message: () => {
        const errorMessages =
          errors
            ?.map(
              (e) =>
                `${e.instancePath} ${e.message}, but was ${util.inspect(e.data)}`,
            )
            .join("\n") ?? "";

        return (filename ? `[File: ${filename}]\n` : "") + errorMessages;
      },
    };
  },
});

const program = TJS.createGenerator({
  tsconfig: __dirname + "/../tsconfig.json",
  additionalProperties: true, // Someday I'd like to turn this off.
});

const ajv = new Ajv({ allowUnionTypes: true, verbose: true });
const typesSchema = program.createSchema("SupportedTypes");
fs.writeFileSync("schema.json", JSON.stringify(typesSchema, null, 2));
const schemasByType = new Map(
  Object.entries(
    (typesSchema!.definitions!["SupportedTypes"] as any).properties,
  ).map(([typeName, sch]) => {
    const schemaForType = sch as TJS.Definition;
    return [
      typeName,
      ajv.compile({
        ...schemaForType,
        definitions: typesSchema!.definitions,
        $schema: typesSchema!.$schema,
      } as TJS.Definition),
    ];
  }),
);
const data = new CddaData(
  JSON.parse(fs.readFileSync(__dirname + "/../_test/all.json", "utf8")).data,
);
const id = (x: any) => {
  if (x.id) return x.id;
  if (x.result) return x.result;
  if (x.om_terrain) return JSON.stringify(x.om_terrain);
};

const findFilename = (
  obj: any,
  parentMap: WeakMap<object, object | null>,
): string | undefined => {
  let current: any = obj;

  while (current) {
    if (current.__filename) return current.__filename;
    current = parentMap.get(current) || null; // Move up to parent
  }
  return undefined;
};

// Create a parent tracking map before validation
const parentMap = new WeakMap<object, object | null>();

const buildParentMap = (obj: any, parent: any = null) => {
  if (typeof obj !== "object" || obj === null) return;
  parentMap.set(obj, parent);
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      buildParentMap(obj[key], obj);
    }
  }
};

// Build parent-child relationships
buildParentMap(data._raw);

const all = data._raw
  .filter((x) => id(x))
  .filter((x) => schemasByType.has(x.type))
  .map((x, i) => [x.type, id(x) ?? i, data._flatten(x)]);

const skipped = new Set<string>([]);

test.each(all)("schema matches %s %s", (type, id, obj) => {
  if (skipped.has(JSON.stringify(id))) {
    //pending();
    return;
  }
  expect(obj).toMatchSchema(schemasByType.get(type)!);
});
