<script lang="ts">
import { t } from "@transifex/native";
export let obj: any;
export let buildNumber: string | undefined;
const _context = "View/Edit on GitHub";
import { GAME_REPO_URL } from "./constants";
</script>

<pre>{JSON.stringify(
    obj,
    (key, value) => (key === "__filename" ? undefined : value),
    2,
  )}</pre>
{#if obj.__filename}
  <a
    href={`${GAME_REPO_URL}/blob/${buildNumber ?? "upload"}/${obj.__filename}`}
    target="_blank">{t("View", { _context })}</a>
  /
  <a
    href={`${GAME_REPO_URL.replace("github.com", "github.dev")}/blob/${
      buildNumber ?? "upload"
    }/${obj.__filename}`}
    target="_blank">{t("Edit on GitHub", { _context })}</a>
{/if}
