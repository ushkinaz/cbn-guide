<script lang="ts">
import { getContext } from "svelte";
import { byName, CddaData } from "../../data";
import LimitedList from "../../LimitedList.svelte";
import ThingLink from "../ThingLink.svelte";
import type { Furniture, Terrain } from "../../types";
import ItemSymbol from "./ItemSymbol.svelte";
import { t } from "@transifex/native";

export let item_id: string;

const data = getContext<CddaData>("data");

const harvestedFrom = (data.byType("terrain") as (Terrain | Furniture)[])
  .concat(data.byType("furniture"))
  .filter((ter) =>
    (ter.harvest_by_season ?? []).some((h) => {
      if (ter.harvest_by_season && Array.isArray(ter.harvest_by_season)) {
        for (const harvestDef of ter.harvest_by_season) {
          for (const h of harvestDef.entries ?? []) {
            if (h.drop === item_id) return true;
          }
        }
      }
      if (!h.id) return false;
      const harvest = data.byId("harvest", h.id);
      return harvest.entries.some((e) => {
        if (e.type === "bionic_group") {
          return data
            .flattenTopLevelItemGroup(data.byId("item_group", e.drop))
            .some((x) => x.id === item_id);
        } else {
          return e.drop === item_id;
        }
      });
    }),
  );

harvestedFrom.sort(byName);
</script>

{#if harvestedFrom.length}
  <section>
    <h1>{t("Harvest", { _context: "Obtaining" })}</h1>
    <LimitedList items={harvestedFrom} let:item>
      <ItemSymbol {item} />
      <ThingLink type={item.type} id={item.id} />
    </LimitedList>
  </section>
{/if}
