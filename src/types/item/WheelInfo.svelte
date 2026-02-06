<script lang="ts">
import { t } from "@transifex/native";

import type { WheelSlot } from "../../types";

export let item: WheelSlot;
</script>

<section>
  <h1>{t("Wheel")}</h1>
  <dl>
    <dt>{t("Diameter")}</dt>
    <dd>{item.diameter ?? 0}"</dd>
    <dt>{t("Width")}</dt>
    <dd>{item.width ?? 0}"</dd>
  </dl>
</section>
