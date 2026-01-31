<script lang="ts">
import { t } from "./i18n";
import { GAME_REPO_URL } from "./constants";
import { metrics } from "./metrics";

export let obj: any;
export let buildNumber: string | undefined;

const _context = "View/Edit on GitHub";

let expanded = false;

function toggle() {
  expanded = !expanded;
  if (expanded) {
    metrics.count("ui.json_view.open", 1, { type: obj.type, id: obj.id });
  }
}

let copied = false;
let timeout: ReturnType<typeof setTimeout>;

async function copyJson() {
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(
        obj,
        (key, value) => (key === "__filename" ? undefined : value),
        2,
      ),
    );
    copied = true;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      copied = false;
    }, 2000);
    metrics.count("ui.json_view.copy", 1, { type: obj.type, id: obj.id });
  } catch (e) {
    console.error(e);
  }
}

const githubUrl = `${GAME_REPO_URL}/blob/${buildNumber ?? "upload"}/${obj.__filename}`;
</script>

<section class="json-view">
  <div class="json-header">
    <button class="toggle-button" aria-expanded={expanded} on:click={toggle}>
      <span>{t("Raw JSON")}</span>
      <span class="icon" aria-hidden="true">{expanded ? "▼" : "▶"}</span>
    </button>

    <div class="actions">
      {#if expanded}
        <button class="action-button" on:click={copyJson}>
          {copied ? t("Copied!") : t("Copy")}
        </button>
      {/if}
      {#if obj.__filename}
        <a href={githubUrl} target="_blank" class="github-link"
          >{t("GitHub", { _context })}</a>
      {/if}
    </div>
  </div>

  {#if expanded}
    <div class="json-content">
      <pre>{JSON.stringify(
          obj,
          (key, value) => (key === "__filename" ? undefined : value),
          2,
        )}</pre>
    </div>
  {/if}
</section>

<style>
.json-view {
  margin-top: 1rem;
  margin-bottom: 1rem;
}

.json-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem; /* Tighter padding for technical feel */
}

.toggle-button {
  background: none;
  border: none;
  /* Use cyan for the action label to match your search/toggles */
  color: hsl(185deg, 45%, 45%);
  text-transform: uppercase;
  font-size: 0.8rem;
  font-style: normal;
  letter-spacing: 1px;
  cursor: pointer;
}

.toggle-button .icon {
  margin-left: 0.5rem;
  font-size: 0.7rem;
  color: var(--cata-color-dark_gray);
}

.github-link {
  color: hsl(185deg, 45%, 45%);
  font-size: 0.8rem;
  text-transform: uppercase;
}

.action-button {
  background: none;
  border: none;
  color: hsl(185deg, 45%, 45%);
  font-size: 0.8rem;
  text-transform: uppercase;
  cursor: pointer;
  margin-right: 1rem;
}

.github-link:hover,
.action-button:hover {
  text-decoration: underline;
}

.json-content {
  padding: 0.25rem 1rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid hsl(190, 100%, 10%);
  max-height: 500px;
  overflow: auto;
  scrollbar-color: hsl(190, 100%, 10%) var(--cata-color-black);
}

pre {
  margin: 1em;
  font-family:
    "Spline Sans Mono", Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 0.85rem;
  color: var(--cata-color-gray);
  line-height: 1.2;
}
</style>
