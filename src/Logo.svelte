<script lang="ts">
import { getVersionedBasePath } from "./routing";

// https://patorjk.com/software/taag/#p=display&f=Terrace&t=Don%27t%0APanic%21&x=none&v=4&h=0&w=80&we=false
const asciiArt = `
░███████                         ░██    ░██
░██   ░██                        ░██    ░██
░██    ░██  ░███████  ░████████  ░██ ░████████
░██    ░██ ░██    ░██ ░██    ░██        ░██
░██    ░██ ░██    ░██ ░██    ░██        ░██
░██   ░██  ░██    ░██ ░██    ░██        ░██
░███████    ░███████  ░██    ░██         ░████



░█████████                        ░██           ░██
░██     ░██                                     ░██
░██     ░██  ░██████   ░████████  ░██ ░███████  ░██
░█████████        ░██  ░██    ░██ ░██░██    ░██ ░██
░██          ░███████  ░██    ░██ ░██░██        ░██
░██         ░██   ░██  ░██    ░██ ░██░██    ░██
░██          ░█████░██ ░██    ░██ ░██ ░███████  ░██
`;
</script>

<a href="{getVersionedBasePath()}item/guidebook" class="logo-link">
  <aside class="ascii-art-container large">
    <pre class="ascii-art">{asciiArt}</pre>
  </aside>
</a>

<style>
.ascii-art {
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 8px;
  line-height: 0.9;
  color: var(--cata-color-gray);
  background: transparent;
  border: none;
  margin: 0;
  padding: 0;
  white-space: pre;
}

.logo-link:hover {
  text-decoration: none;
}

.ascii-art-container {
  margin: 0;
}
</style>
