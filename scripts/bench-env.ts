// Polyfill environment for Node.js benchmarks
if (typeof global.location === "undefined") {
  global.location = {
    href: "http://localhost/stable/",
    pathname: "/stable/",
    search: "",
    origin: "http://localhost",
    replace: () => {},
  } as any;
}

if (typeof global.history === "undefined") {
  global.history = {
    replaceState: () => {},
    pushState: () => {},
  } as any;
}
