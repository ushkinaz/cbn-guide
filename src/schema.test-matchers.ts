import { expect } from "vitest";
import type { ValidateFunction } from "ajv";
import util from "util";

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

//
// const findFilename = (
//   obj: any,
//   parentMap: WeakMap<object, object | null>,
// ): string | undefined => {
//   let current: any = obj;
//
//   while (current) {
//     if (current.__filename) return current.__filename;
//     current = parentMap.get(current) || null; // Move up to parent
//   }
//   return undefined;
// };
