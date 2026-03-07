import "svelte/elements";

declare module "svelte/elements" {
  interface SvelteWindowAttributes {
    "on:appinstalled"?: (event: Event) => void;
  }
}
