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
import { tx } from "@transifex/native";

tx.init({
  token: process.env.TRANSIFEX_TOKEN,
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
    //Custom Zaraz endpoints, we ignore any error happening in Zaraz
    denyUrls: [/srv\/z\/s\.js/i, /srv\/z\/t/i],
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

registerSW({
  onNeedRefresh() {
    console.log("PWA: onNeedRefresh - New content available, please refresh.");
  },
  onOfflineReady() {},
  onRegistered(registration) {},
  onRegisterError(error) {
    if (error?.message === "Rejected") {
      console.warn(
        "PWA registration rejected (likely by external software). Ignored.",
      );
      return;
    }
    Sentry.captureException(error);
  },
});

const url = new URL(location.href);

/**
 * Hardcoded locale mappings for Transifex.
 * Maps game data locales (with region codes) to Transifex locale codes (language-only).
 * This ensures proper translation loading for regional variants.
 */
const LOCALE_TO_TRANSIFEX: Record<string, string> = {
  es_AR: "es",
  it_IT: "it",
  pl_PL: "pl",
  ru_RU: "ru",
  uk_UA: "uk",
};

/**
 * Build a locale fallback chain for Transifex lookup.
 *
 * Strategy:
 * 1. Try known hardcoded mappings first (e.g., es_AR → es)
 * 2. Try the original locale value as-is
 * 3. Try language-only locale (strip region code: es_AR → es)
 *
 * @param locale - The locale string to resolve (e.g., "es_AR", "ru_RU")
 * @returns Array of locale candidates to try in order
 */
function getTransifexLocaleCandidates(locale: string): string[] {
  const candidates: string[] = [];
  const mapped = LOCALE_TO_TRANSIFEX[locale];
  if (mapped) {
    candidates.push(mapped);
  }
  candidates.push(locale);

  const languageOnly = locale.split(/[_-]/u)[0];
  if (languageOnly && !candidates.includes(languageOnly)) {
    candidates.push(languageOnly);
  }
  return candidates;
}

/**
 * Attempt to set the Transifex locale with fallback support.
 *
 * Tries each locale candidate in sequence until one succeeds.
 * If all candidates fail, silently ignores the error (keeping the default locale).
 *
 * @param locale - The requested locale string
 */
async function setLocaleWithFallback(locale: string): Promise<void> {
  const candidates = getTransifexLocaleCandidates(locale);
  let chain = Promise.reject<void>(new Error("start locale chain"));
  for (const candidate of candidates) {
    chain = chain.catch(() => tx.setCurrentLocale(candidate));
  }
  try {
    await chain;
  } catch {
    // All candidates failed; keep default locale
  }
}

const locale = url.searchParams.get("lang");
if (locale) {
  setLocaleWithFallback(locale).then(start, start);
} else {
  start();
}
function start() {
  new App({
    target: document.body,
  });
}
