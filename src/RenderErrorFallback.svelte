<script lang="ts">
import { t } from "@transifex/native";
import { untrack } from "svelte";

import type { CBNData } from "./data";
import JsonView from "./JsonView.svelte";
import { isSupportedType } from "./supported-types";
import type { SupportedTypes } from "./types";
import { isDev } from "./utils/env";

const ERROR_CONTEXT = "Render Error";

interface Props {
  data?: CBNData | null;
  error: unknown;
  item?: { id: string; type: string } | null;
}

let {
  data: sourceData,
  error: sourceError,
  item: sourceItem,
}: Props = $props();

const data = untrack(() => sourceData);
const error = untrack(() => sourceError);
const item = untrack(() => sourceItem);

function defaultFallbackJsonObject(
  type: string,
  id: string,
): { __filename: string; id: string; type: string } | undefined {
  if (type === "json_flag") {
    return { id, type, __filename: "" };
  }
  return undefined;
}

const jsonObject = untrack(() => {
  if (!item?.id || !data || !isSupportedType(item.type)) {
    return undefined;
  }

  return (
    data.byIdMaybe(item.type as keyof SupportedTypes, item.id) ??
    defaultFallbackJsonObject(item.type, item.id)
  );
});
</script>

<section>
  <div class="render-error" role="alert">
    <div class="error-card">
      <h1>{t("Error", { _context: ERROR_CONTEXT })}</h1>
      <p>
        {t(
          "There was a problem displaying this page. Not all versions of Cataclysm are supported by the Guide currently. Try selecting a different build.",
          { _context: ERROR_CONTEXT },
        )}
      </p>
      {#if isDev}
        <section>
          <h2>{t("Debug", { _context: ERROR_CONTEXT })}</h2>
          {#if error instanceof Error}
            <pre class="trace">{error.stack}</pre>
          {:else}
            <div>{String(error)}</div>
          {/if}
        </section>
      {/if}
    </div>

    {#if jsonObject}
      <JsonView obj={jsonObject} buildNumber={data?.buildVersion()} />
    {/if}
  </div>
</section>

<style>
.render-error {
  text-align: left;
}

.error-card {
  border: 1px solid var(--cata-color-red);
  padding: 1rem;
  margin: 1rem 0;
}

.trace {
  font-family: monospace;
  overflow-x: auto;
}
</style>
