import "svelte/elements";

declare module "svelte/elements" {
  interface SvelteWindowAttributes {
    onappinstalled?: (event: Event) => void;
    onbeforeinstallprompt?: (
      event: Event & { prompt: () => Promise<void> | void },
    ) => void;
  }
}
