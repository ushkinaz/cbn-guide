<script lang="ts">
import { t } from "@transifex/native";

import type { WheelSlot } from "../../types";
import { formatLength } from "../../utils/format";

interface Props {
  item: WheelSlot;
}

let { item }: Props = $props();
</script>

<section>
  <h2>{t("Wheel")}</h2>
  <dl>
    <dt>{t("Diameter")}</dt>
    <dd>{formatLength(item.diameter ?? 0)}</dd>
    <dt>{t("Width")}</dt>
    <dd>{formatLength(item.width ?? 0)}</dd>
  </dl>
</section>
