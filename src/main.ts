import { zaraz } from "zaraz-ts";
import * as Sentry from "@sentry/browser";
import { eventFiltersIntegration } from "@sentry/browser";
import { registerSW } from "virtual:pwa-register";
import { t, tx } from "@transifex/native";
import { mount } from "svelte";
import "./assets/fonts.css";
import App from "./App.svelte";
import { STABLE_VERSION } from "./builds.svelte";
import { isProd, RUNNING_MODE } from "./utils/env";
import { notify } from "./Notification.svelte";
import { bootstrapApplication } from "./navigation.svelte";
import { buildURL, navigateToURL } from "./routing.svelte";

tx.init({
  token: __TRANSIFEX_TOKEN__,
});

if (isProd) {
  let metricsDisabled = false;
  try {
    metricsDisabled =
      localStorage.getItem("cbn-guide:metrics-disabled") === "true";
  } catch {
    // localStorage unavailable (puppeteer, incognito, etc.) - default to enabled
  }

  zaraz.set("release_id", __RELEASE_ID__, { scope: "session" });
  zaraz.set("running_mode", RUNNING_MODE, { scope: "session" });

  Sentry.init({
    dsn: __SENTRY_DSN__,
    enableMetrics: !metricsDisabled,
    integrations: [eventFiltersIntegration],
    tracesSampleRate: 1,
    //Custom Zaraz endpoints, we ignore any error happening in Zaraz
    denyUrls: [/srv\/z\//i],
    sendDefaultPii: true,
    environment: __DEPLOY_ENV__,
    skipBrowserExtensionCheck: true,
  });
}

registerSW({
  onNeedRefresh() {
    console.log("PWA: onNeedRefresh - New content available, please refresh.");
  },
  onOfflineReady() {},
  onRegistered() {},
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

void bootstrapApplication()
  .then(() => {
    start();
    console.log(
      "Application initialized. %s @ %s",
      __DEPLOY_ENV__,
      __RELEASE_ID__,
    );
  })
  .catch((error) => {
    console.error("Failed to bootstrap application state.", error);
    Sentry.captureException(error);
    navigateToURL(buildURL(STABLE_VERSION, { kind: "home" }), "replace");
    start();
    notify(t("Failed to initialize application. Please reload."), "error");
  });

function start(): void {
  mount(App, {
    target: document.body,
  });
}
