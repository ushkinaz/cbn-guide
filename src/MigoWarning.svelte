<script lang="ts">
import { onMount } from "svelte";
import { fly } from "svelte/transition";
import { quintOut } from "svelte/easing";
import reconImage from "./assets/migo_recon.webp";
import { metrics } from "./metrics";

/**
 * Mi-Go Bio-Terminal Warning Banner
 * Renders a "breach notification" from an extra-dimensional intelligence.
 * Persists dismissal via sessionStorage so it resets after the session ends.
 */
const SEEN_WARNING = "cbn-guide:next-warning-seen";
const DEV_DISABLE = "cbn-guide:next-warning-disabled";

export let visible = true;

/**
 * Dismisses the banner and records the action in sessionStorage.
 */
function dismiss() {
  visible = false;
  try {
    sessionStorage.setItem(SEEN_WARNING, "1");
  } catch (e) {
    // Ignore security errors
  }
}

onMount(() => {
  try {
    const isDevDisabled =
      typeof localStorage !== "undefined" &&
      localStorage.getItem(DEV_DISABLE) === "1";
    const isSeenInSession =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(SEEN_WARNING) === "1";

    if (isDevDisabled || isSeenInSession) {
      visible = false;
    } else {
      metrics.count("nav.next.triggered", 1);
    }
  } catch (e) {
    // Ignore security errors
  }
});
</script>

{#if visible}
  <div
    class="migo-terminal"
    transition:fly={{ y: -50, duration: 400, easing: quintOut }}
    role="alert">
    <div class="terminal-overlay">
      <div class="scanlines"></div>
      <div class="grain"></div>
    </div>

    <div class="recon-frame">
      <img src={reconImage} alt="Visual data corrupted." class="recon-img" />
    </div>

    <div class="content">
      <header class="headline">
        [ NXT-13 ] : MI-GO ENGINEERING ENVIRONMENT
      </header>
      <p class="body-text">
        Biological stability is not guaranteed. This habitat is undergoing
        active reconfiguration.
      </p>
      <p class="body-text">
        Human cognitive patterns may be corrupted by further exposure.
      </p>
      <a href="https://cataclysmbn-guide.com" class="retreat-link">
        [ RETREAT TO STABLE: CataclysmBN-Guide.com ]
      </a>
      <span class="subtext">event logged</span>
    </div>

    <button
      class="dismiss-btn"
      on:click={dismiss}
      aria-label="Dismiss warning"
      title="Dismiss warning">
      ✕
    </button>
  </div>
{/if}

<style>
.migo-terminal {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  z-index: 1000;
  width: 90%;
  max-width: 900px;
  margin: 0 auto;
  background: var(--cata-color-black);
  border: 2px solid var(--cata-color-green);
  display: flex;
  padding: 16px;
  gap: 20px;
  font-family: "UnifontSubset", "Courier New", Courier, monospace;
  color: var(--cata-color-light_green);
  overflow: hidden;
  box-sizing: border-box;
}

.terminal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.scanlines {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
    linear-gradient(
      90deg,
      rgba(255, 0, 0, 0.06),
      rgba(0, 255, 0, 0.02),
      rgba(0, 0, 118, 0.06)
    );
  background-size:
    100% 4px,
    3px 100%;
  animation: scanline 10s linear infinite;
}

@keyframes scanline {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 0 100%;
  }
}

.grain {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.05;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}

.recon-frame {
  flex: 0 0 120px;
  height: auto;
  border: 1px solid var(--cata-color-green);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
}

.recon-img {
  width: 100%;
  height: auto;
  display: block;
  filter: grayscale(1) contrast(1.2) brightness(0.8);
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 10;
}

.headline {
  font-weight: bold;
  font-size: 1rem;
  letter-spacing: 1px;
  color: var(--cata-color-yellow);
}

.body-text {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.4;
}

.retreat-link {
  align-self: center;
  color: var(--cata-color-light_cyan);
  text-decoration: none;
  font-weight: bold;
  font-size: 0.85rem;
  margin-top: 4px;
  display: inline-block;
  width: fit-content;
  border: 1px solid transparent;
  padding: 2px 4px;
  transition: all 0.2s ease;
}

.retreat-link:hover {
  color: var(--cata-color-light_cyan);
  transform: translateY(-2px) scale(1.1);
}

.subtext {
  align-self: flex-end;
  font-size: 0.7rem;
  opacity: 0.3;
  margin-top: auto;
}

.dismiss-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: var(--cata-color-green);
  cursor: pointer;
  padding: 4px;
  font-size: 1.2rem;
  line-height: 1;
  transition: opacity 0.2s;
  opacity: 0.8;
  z-index: 20;
}

.dismiss-btn:hover {
  opacity: 1;
}

@media (max-width: 600px) {
  .migo-terminal {
    flex-direction: column;
    width: 95%;
  }

  .recon-frame {
    flex: 0 0 auto;
    width: 100%;
    max-height: 150px;
  }
}
</style>
