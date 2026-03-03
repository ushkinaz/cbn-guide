export function createLiveContextProxy<T extends object>(getValue: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const current = getValue();
      const value = Reflect.get(current, property, current);
      return typeof value === "function" ? value.bind(current) : value;
    },
    has(_target, property) {
      return property in getValue();
    },
    ownKeys() {
      return Reflect.ownKeys(getValue());
    },
    getOwnPropertyDescriptor(_target, property) {
      const descriptor = Reflect.getOwnPropertyDescriptor(getValue(), property);
      if (descriptor) {
        descriptor.configurable = true;
      }
      return descriptor;
    },
  });
}
