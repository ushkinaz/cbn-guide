export function multimap<K, V>(entries: [K, V][]): Map<K, V[]> {
  let ret = new Map<K, V[]>();
  for (const [k, v] of entries) {
    const list = ret.get(k) ?? [];
    list.push(v);
    ret.set(k, list);
  }
  return ret;
}

export function groupBy<T>(
  things: T[],
  groupsFor: (x: T) => string[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const thing of things) {
    const groups = groupsFor(thing);
    for (const group of groups) {
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(thing);
    }
  }
  return map;
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}
