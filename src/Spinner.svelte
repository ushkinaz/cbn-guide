<script lang="ts">
import spinnerIcon from "./assets/spinner.png";

export let size: number = 32;
export let position: "bottom" | "center" = "bottom";
export let bounce: number = 5;
</script>

<div
  class="spinner"
  style={`--spinner-src: url(${spinnerIcon}); --spinner-size: ${size}px; --spinner-position: ${position}; --spinner-bounce: ${bounce}px;`}
  aria-hidden="true">
</div>

<style>
@keyframes bounce {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(0, var(--spinner-bounce), 0);
  }
}

.spinner {
  width: var(--spinner-size);
  height: var(--spinner-size);
  background-image: var(--spinner-src);
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center var(--spinner-position);
  animation: bounce 0.5s;
  animation-direction: alternate;
  animation-timing-function: cubic-bezier(0.5, 0.05, 1, 0.5);
  animation-iteration-count: infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
