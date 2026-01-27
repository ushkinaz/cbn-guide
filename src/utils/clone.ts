/**
 * Fast deep clone for simple objects (JSON-serializable).
 * Significantly faster than JSON.parse(JSON.stringify(x)) for small objects.
 *
 * Note: Does not handle Map, Set, Date, RegExp, etc.
 * Use for Game Data objects like DamageInstance.
 */
export function fastDeepClone<T>(val: T): T {
  if (val === null || typeof val !== "object") {
    return val;
  }

  if (Array.isArray(val)) {
    const arr: any[] = new Array(val.length);
    for (let i = 0; i < val.length; i++) {
      arr[i] = fastDeepClone(val[i]);
    }
    return arr as any;
  }

  const obj = val as any;
  const res = {} as any;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      res[key] = fastDeepClone(obj[key]);
    }
  }
  return res;
}
