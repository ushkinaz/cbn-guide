/**
 * Evacuates users from the legacy domain (cbn-guide.pages.dev) to the new domain.
 * This unregisters service workers, clears caches, and redirects.
 */
export async function evacuateLegacyDomain() {
  const legacyDomains = ["cbn-guide.pages.dev", "next.cbn-guide.pages.dev"];
  const newDomain = "cataclysmbn-guide.com";

  if (legacyDomains.includes(window.location.hostname)) {
    console.info(
      "🚨 Legacy domain detected. Initiating evacuation sequence...",
    );

    // 1. Unregister Service Workers
    if ("serviceWorker" in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log("Unregistered SW:", registration.scope);
        }
      } catch (e) {
        console.error("Failed to unregister SW:", e);
      }
    }

    // 2. Clear Caches
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        console.log("Caches cleared");
      } catch (e) {
        console.error("Failed to clear caches:", e);
      }
    }

    // 3. Clear Storage
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      // Ignore security errors
    }

    // 4. Redirect
    const targetUrl = new URL(window.location.href);
    targetUrl.hostname = newDomain;

    console.log(`Redirecting to ${targetUrl.href}`);
    window.location.replace(targetUrl.href);

    // Stop execution of the rest of the app (as much as possible)
    throw new Error("Evacuating legacy domain");
  }
}
