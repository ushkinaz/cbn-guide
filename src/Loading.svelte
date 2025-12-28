<script lang="ts">
import { loadProgress } from "./data";
import spinnerIcon from "./assets/spinner.png";

export let text: string;
export let fullScreen: boolean = false;
</script>

<div class="loading-container" class:full-screen={fullScreen}>
  <div class="loading-content">
    <div class="loading-spinner" style="--spinner-src: url({spinnerIcon})">
    </div>
    <span>
      <em>{text}</em>
      {#if $loadProgress}
        ({($loadProgress[0] / 1024 / 1024).toFixed(1)}/{(
          $loadProgress[1] /
          1024 /
          1024
        ).toFixed(1)} MB)
      {/if}
    </span>
  </div>
</div>

<style>
@keyframes bounce {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(0, 5px, 0);
  }
}

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

.loading-spinner {
  width: 32px;
  height: 32px;
  background-image: var(--spinner-src);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center bottom; /* Align image content to bottom of its box if needed */
  margin-right: 0.5rem;

  animation: bounce 0.5s;
  animation-direction: alternate;
  animation-timing-function: cubic-bezier(0.5, 0.05, 1, 0.5);
  animation-iteration-count: infinite;
}

.loading-content em {
  line-height: 1; /* Help with bottom alignment */
  display: inline-block;
}
</style>
