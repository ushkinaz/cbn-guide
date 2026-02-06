<script lang="ts">
import { t } from "@transifex/native";
import { mapType } from "./data";

export let item: any;
</script>

<section class="obsolete-banner">
  <span class="icon">†</span>
  <span
    >{t("This {type} is marked as", { type: mapType(item.type) })}
    <strong>{t("obsolete")}</strong>,
    {t(
      "meaning that it is likely not possible to obtain in this version.",
    )}</span>
</section>

<style>
.obsolete-banner {
  color: var(--cata-color-white);
  background-color: var(--cata-color-brown);
  padding: 12px 18px;
  display: flex;
  align-items: flex-start;
  font-family: UnifontSubset, monospace;
  line-height: 1.4;
}

.obsolete-banner .icon {
  color: var(--cata-color-gray);
  font-weight: bold;
  width: 2ch;
  display: inline-block;
  flex-shrink: 0;
}

.obsolete-banner strong {
  color: var(--cata-color-yellow);
  letter-spacing: 1px;
}
</style>
