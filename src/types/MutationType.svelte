<script lang="ts">
import { t } from "@transifex/native";

import { getContext } from "svelte";

import { CBNData } from "../data";
import type { MutationType } from "../types";
import MutationList from "./MutationList.svelte";

import { gameSingularName } from "../i18n/game-locale";

interface Props {
  item: MutationType;
}

let { item }: Props = $props();

let data = getContext<CBNData>("data");

const mutationsWithType = data
  .byType("mutation")
  .filter((m) => (m.types ?? []).includes(item.id));
</script>

<h1>{t("Mutation Type")}: {gameSingularName(item)}</h1>
<section>
  <dl>
    <dt>{t("Mutations")}</dt>
    <dd>
      <MutationList mutations={mutationsWithType} />
    </dd>
  </dl>
</section>
