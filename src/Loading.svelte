<script lang="ts">
import { loadProgress } from "./data";
import Spinner from "./Spinner.svelte";

export let text: string;
export let fullScreen: boolean = false;
</script>

<div class="loading-container" class:full-screen={fullScreen}>
  <div class="loading-content">
    <Spinner size={32} />
    <span>
      <span class="loading-text">{text}</span>
      {#if $loadProgress}
        <span class="loading-progress-stats">
          ({($loadProgress[0] / 1024 / 1024).toFixed(1)}
          MB)
        </span>
      {/if}
    </span>
  </div>
</div>

<style>
.loading-container {
  display: flex;
  justify-content: center;
  color: var(--cata-color-cyan);
  margin: 1rem 0;
}

.loading-container.full-screen {
  min-height: 100vh;
  align-items: flex-start;
  padding-top: 33vh;
  box-sizing: border-box;
  margin: 0;
}

.loading-content {
  display: flex;
  align-items: flex-end; /* Bottom alignment */
  justify-content: center;
}

.loading-text {
  font-family: UnifontSubset, monospace;
  line-height: 1; /* Help with bottom alignment */
  display: inline-block;
}

.loading-progress-stats {
  font-family: UnifontSubset, monospace;
  font-variant-numeric: tabular-nums;
  display: inline-block;
  min-width: 8.5em; /* Ensure enough space for " (XXX.X/XXX.X MB)" */
  text-align: left;
  margin-left: 0.25rem;
}
</style>
