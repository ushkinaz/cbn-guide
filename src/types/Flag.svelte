<script lang="ts">
import { t } from "../i18n";

import { getContext } from "svelte";
import { byName, CBNData, singular } from "../data";
import LimitedList from "../LimitedList.svelte";
import type { JsonFlag } from "../types";
import ItemLink from "./ItemLink.svelte";

export let item: JsonFlag;

let data = getContext<CBNData>("data");

const itemsWithFlag = data
  .byType("item")
  .filter((f) => f.id && f.flags?.includes(item.id));
const vpartsWithFlag = data
  .byType("vehicle_part")
  .filter((f) => f.id && f.flags?.includes(item.id));
const furnitureWithFlag = data
  .byType("furniture")
  .filter((f) => f.id && f.flags?.includes(item.id));
const terrainWithFlag = data
  .byType("terrain")
  .filter((f) => f.id && f.flags?.includes(item.id));
const bionicWithFlag = data
  .byType("bionic")
  .filter(
    (f) =>
      f.id &&
      (f.flags?.includes(item.id) ||
        f.active_flags?.includes(item.id) ||
        f.inactive_flags?.includes(item.id)),
  );
</script>

<h1>{t("Flag", { _comment: "Section heading" })}: {item.id}</h1>
{#if item.info}
  <section>
    <p>{singular(item.info)}</p>
  </section>
{/if}
{#if itemsWithFlag.length}
  <section>
    <h1>{t("Items", { _comment: "Section heading" })}</h1>
    <LimitedList items={itemsWithFlag.sort(byName)} let:item>
      <ItemLink type="item" id={item.id} />
    </LimitedList>
  </section>
{/if}
{#if vpartsWithFlag.length}
  <section>
    <h1>{t("Vehicle Parts")}</h1>
    <LimitedList items={vpartsWithFlag.sort(byName)} let:item>
      <ItemLink type="vehicle_part" id={item.id} />
    </LimitedList>
  </section>
{/if}
{#if terrainWithFlag.length}
  <section>
    <h1>{t("Terrain")}</h1>
    <LimitedList items={terrainWithFlag.sort(byName)} let:item>
      <ItemLink type="terrain" id={item.id} />
    </LimitedList>
  </section>
{/if}
{#if furnitureWithFlag.length}
  <section>
    <h1>{t("Furniture")}</h1>
    <LimitedList items={furnitureWithFlag.sort(byName)} let:item>
      <ItemLink type="furniture" id={item.id} />
    </LimitedList>
  </section>
{/if}
{#if bionicWithFlag.length}
  <section>
    <h1>{t("Bionics")}</h1>
    <LimitedList items={bionicWithFlag.sort(byName)} let:item>
      <ItemLink type="bionic" id={item.id} />
    </LimitedList>
  </section>
{/if}
