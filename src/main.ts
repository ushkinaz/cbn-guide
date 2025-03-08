import App from "./App.svelte";
import * as Sentry from "@sentry/browser";
import { browserTracingIntegration } from "@sentry/browser";
import "@fontsource/unifont";
import { registerSW } from "virtual:pwa-register";
import { tx } from "@transifex/native";

tx.init({
  token: "1/1d8c1f9e14b4c21d70dd3f6fccdd0ab16b691105",
});

if (import.meta.env.PROD) {
  //The SHA1 is taken from either the GitHub var or the Cloudflare var.
  const commitSHA =
    process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? "none";
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [browserTracingIntegration],
    tracesSampleRate: 0.2,
    ...(commitSHA && {
      release: `cdda-guide@${commitSHA.slice(0, 8)}`,
    }),
  });
}

registerSW({});

if (location.hash) {
  history.replaceState(
    null,
    "",
    import.meta.env.BASE_URL + location.hash.slice(2) + location.search,
  );
}

const url = new URL(location.href);
const locale = url.searchParams.get("lang");
if (locale) {
  tx.setCurrentLocale(locale).then(start, start);
} else {
  start();
}
function start() {
  new App({
    target: document.body,
  });
}
