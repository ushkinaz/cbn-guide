import { expect, test, describe } from "vitest";
import { fastDeepClone } from "./clone";

describe("fastDeepClone", () => {
  test("clones primitives", () => {
    expect(fastDeepClone(1)).toBe(1);
    expect(fastDeepClone("a")).toBe("a");
    expect(fastDeepClone(true)).toBe(true);
    expect(fastDeepClone(null)).toBe(null);
    expect(fastDeepClone(undefined)).toBe(undefined);
  });

  test("clones simple objects", () => {
    const obj = { a: 1, b: "2" };
    const clone = fastDeepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
  });

  test("clones arrays", () => {
    const arr = [1, 2, 3];
    const clone = fastDeepClone(arr);
    expect(clone).toEqual(arr);
    expect(clone).not.toBe(arr);
  });

  test("clones nested objects", () => {
    const obj = { a: { b: { c: 1 } } };
    const clone = fastDeepClone(obj);
    expect(clone).toEqual(obj);
    expect(clone).not.toBe(obj);
    expect(clone.a).not.toBe(obj.a);
    expect(clone.a.b).not.toBe(obj.a.b);
  });

  test("clones array of objects", () => {
    const arr = [{ a: 1 }, { b: 2 }];
    const clone = fastDeepClone(arr);
    expect(clone).toEqual(arr);
    expect(clone).not.toBe(arr);
    expect(clone[0]).not.toBe(arr[0]);
  });
});
