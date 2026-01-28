import { evacuateLegacyDomain } from "./utils/legacy-evacuation";
evacuateLegacyDomain();

import App from "./App.svelte";
import * as Sentry from "@sentry/browser";
import { browserTracingIntegration } from "@sentry/browser";
import "./assets/fonts.css";
import { registerSW } from "virtual:pwa-register";
import { tx } from "./i18n";

tx.init({
  token: "1/1d8c1f9e14b4c21d70dd3f6fccdd0ab16b691105",
});

if (import.meta.env.PROD) {
  //The SHA1 is taken from either the GitHub var or the Cloudflare var.
  const commitSHA = (
    process.env.CF_PAGES_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    "none"
  ).slice(0, 8);
  let releaseTag = `cbn-guide@${process.env.COMMIT_DATE ? process.env.COMMIT_DATE + "_" : "unknown"}${commitSHA}`;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enableMetrics: true,
    integrations: [browserTracingIntegration],
    tracesSampleRate: 1,
    ...(commitSHA && {
      release: releaseTag,
    }),
  });
}

registerSW({});

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
