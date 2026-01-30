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

// Polyfill import.meta.env for Node.js
if (typeof import.meta.env === "undefined") {
  (import.meta as any).env = {
    BASE_URL: "/stable/",
    MODE: "production",
    DEV: false,
    PROD: true,
  };
}
