import { evacuateLegacyDomain } from "./utils/legacy-evacuation";

evacuateLegacyDomain();

import { zaraz } from "zaraz-ts";
import * as Sentry from "@sentry/browser";
import {
  browserTracingIntegration,
  eventFiltersIntegration,
} from "@sentry/browser";
import { registerSW } from "virtual:pwa-register";
import "./assets/fonts.css";
import App from "./App.svelte";
import { RUNNING_MODE } from "./utils/env";
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
  let releaseID = `${process.env.COMMIT_DATE ? process.env.COMMIT_DATE + "_" : "unknown"}${commitSHA}`;
  let buildID = commitSHA;
  let releaseTag = `cbn-guide@${releaseID}`;

  let running_mode = RUNNING_MODE;

  // Check metrics opt-out flag (defensive for puppeteer/restricted browsers)
  let metricsDisabled = false;
  try {
    metricsDisabled =
      localStorage.getItem("cbn-guide:metrics-disabled") === "true";
  } catch {
    // localStorage unavailable (puppeteer, incognito, etc.) - default to enabled
  }

  zaraz.set("release_id", releaseID, { scope: "session" });
  zaraz.set("build_id", buildID, { scope: "session" });
  zaraz.set("running_mode", running_mode, { scope: "session" });

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enableMetrics: !metricsDisabled,
    integrations: [browserTracingIntegration, eventFiltersIntegration],
    tracesSampleRate: 1,
    ignoreErrors: [/srv/i, "zaraz"],
    // Runtime filter for dynamic toggling without reload
    beforeSendMetric: (metric) => {
      try {
        if (localStorage.getItem("cbn-guide:metrics-disabled") === "true") {
          return null;
        }
      } catch {
        // localStorage unavailable - allow metric through
      }
      return metric;
    },
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
