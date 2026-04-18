import * as TJS from "ts-json-schema-generator";
import * as fs from "fs";
import Ajv from "ajv";
import { makeTestCBNData } from "./data.test-helpers";
import { expect, describe, test } from "vitest";

const program = TJS.createGenerator({
  tsconfig: __dirname + "/../tsconfig.json",
  additionalProperties: true, // Someday I'd like to turn this off.
});

const ajv = new Ajv({ allowUnionTypes: true, verbose: true });
const typesSchema = program.createSchema("SupportedTypes");
if (process.env.WRITE_SCHEMA)
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
const data = makeTestCBNData(
  JSON.parse(fs.readFileSync(__dirname + "/../_test/all.json", "utf8")).data,
);
const getEntityId = (x: any): string | undefined => {
  if (x.id) return x.id;
  if (x.result) return x.result;
  if (x.om_terrain) return JSON.stringify(x.om_terrain);
};

type TestCase = [id: string, obj: any];
type TypeGroups = Map<string, TestCase[]>;

function buildSchemaCases(): TypeGroups {
  const groupedCases: TypeGroups = new Map();

  for (const entity of data.all()) {
    const id = getEntityId(entity);
    if (!id || !schemasByType.has(entity.type)) continue;

    if (!groupedCases.has(entity.type)) {
      groupedCases.set(entity.type, []);
    }

    groupedCases.get(entity.type)!.push([id, data._flatten(entity)]);
  }

  return groupedCases;
}

const groupedCases = buildSchemaCases();

const skipped = new Set<string>([]);

for (const [type, cases] of groupedCases) {
  describe(`type: ${type}`, () => {
    test.each(cases)("id:%s schema match", (id, obj) => {
      if (skipped.has(JSON.stringify(id))) {
        return;
      }
      expect(obj).toMatchSchema(schemasByType.get(type)!);
    });
  });
}
