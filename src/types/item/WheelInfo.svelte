<script lang="ts">
import { t } from "@transifex/native";

import { asLength } from "../../data";
import type { WheelSlot } from "../../types";

interface Props {
  item: WheelSlot;
}

let { item }: Props = $props();
</script>

<section>
  <h2>{t("Wheel")}</h2>
  <dl>
    <dt>{t("Diameter")}</dt>
    <dd>{asLength(item.diameter ?? 0)}</dd>
    <dt>{t("Width")}</dt>
    <dd>{asLength(item.width ?? 0)}</dd>
  </dl>
</section>
