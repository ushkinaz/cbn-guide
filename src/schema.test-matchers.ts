import { expect } from "vitest";
import type { ValidateFunction } from "ajv";
import util from "util";

declare module "vitest" {
  interface Matchers<T = any> {
    toMatchSchema(validate: ValidateFunction): T;
  }
}

expect.extend({
  toMatchSchema(obj: any, schema: ValidateFunction) {
    const valid = schema(obj);
    const errors = schema.errors?.slice();
    const filename = findFilename(obj);

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

        return (
          (filename ? `\n[Location: ${filename}]\n` : "") +
          "\n[Validation errors:\n" +
          errorMessages +
          "\n]\n" +
          "\n[Object:\n" +
          util.inspect(obj) +
          "\n]\n"
        );
      },
    };
  },
});

function findFilename(obj: any): string | undefined {
  return typeof obj?.__filename === "string" ? obj.__filename : undefined;
}
