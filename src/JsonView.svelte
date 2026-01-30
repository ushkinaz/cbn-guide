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

const githubUrl = `${GAME_REPO_URL}/blob/${buildNumber ?? "upload"}/${obj.__filename}`;
</script>

<section class="json-view">
  <div class="json-header">
    <button class="toggle-button" on:click={toggle}>
      <span>{t("Raw JSON")}</span>
      <span class="icon">{expanded ? "▼" : "▶"}</span>
    </button>

    <div class="actions">
      {#if obj.__filename}
        <a href={githubUrl} target="_blank" class="action-link"
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
  overflow: hidden;
  padding: 0;
  box-shadow: none;
}

.json-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
}

.toggle-button {
  background: none;
  border: none;
  color: var(--cata-color-gray);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 0;
  margin: 0;
}

.toggle-button .icon {
  width: 1.25rem;
  text-align: right;
  display: inline-block;
}

.actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.action-link {
  color: var(--cata-color-gray);
  text-decoration: none;
}

.action-link:hover {
  color: var(--cata-color-white);
  text-decoration: underline;
}

.json-content {
  padding: 0.25rem 1rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  max-height: 500px;
  overflow: auto;
}

pre {
  margin: 0;
  font-family: "UnifontSubset", monospace;
  font-size: 0.85rem;
  color: var(--cata-color-gray);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
