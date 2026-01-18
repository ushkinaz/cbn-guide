<script lang="ts">
import { t } from "../i18n";

import { getContext } from "svelte";

import { byName, CBNData, singular, singularName } from "../data";
import LimitedList from "../LimitedList.svelte";
import type { Skill, SupportedTypesWithMapped } from "../types";
import ItemLink from "./ItemLink.svelte";

export let item: Skill;

const data = getContext<CBNData>("data");

const booksWithSkill = data
  .byType("item")
  .filter((t) => t.id && t.type === "BOOK" && t.skill === item.id)
  .sort((a, b) =>
    singularName(a).localeCompare(singularName(b)),
  ) as SupportedTypesWithMapped["BOOK"][];

const booksByLevel = new Map<number, SupportedTypesWithMapped["BOOK"][]>();
for (const book of booksWithSkill) {
  if (!booksByLevel.has(book.max_level ?? 0))
    booksByLevel.set(book.max_level ?? 0, []);
  booksByLevel.get(book.max_level ?? 0)!.push(book);
}
const booksByLevelList = [...booksByLevel.entries()].sort(
  (a, b) => a[0] - b[0],
);
booksByLevelList.forEach(([, books]) => {
  books.sort((a, b) => (a.required_level ?? 0) - (b.required_level ?? 0));
});

const itemsUsingSkill = data
  .byType("item")
  .filter(
    (i) => i.id && i.type === "GUN" && i.skill === item.id,
  ) as SupportedTypesWithMapped["GUN"][];
itemsUsingSkill.sort(byName);

const itemsTrainingSkill = data.byType("item").filter((i) => {
  if (!i.use_action) return false;
  const actions = Array.isArray(i.use_action) ? i.use_action : [i.use_action];
  if (!i.id) return false; //Abstract entity
  return actions.some((a) => {
    if (typeof a !== "object" || Array.isArray(a)) return false;
    return (
      a.type === "train_skill" &&
      a.training_skill === item.id &&
      (a.training_skill_max_level ?? 0) > 0
    );
  });
});

const itemsTrainingSkillByLevel = new Map<number, typeof itemsTrainingSkill>();
for (const i of itemsTrainingSkill) {
  let maxLevel = 0;
  const actions = Array.isArray(i.use_action) ? i.use_action : [i.use_action];
  for (const a of actions) {
    if (
      typeof a === "object" &&
      !Array.isArray(a) &&
      a.type === "train_skill" &&
      a.training_skill === item.id
    ) {
      maxLevel = Math.max(maxLevel, a.training_skill_max_level ?? 0);
    }
  }

  if (!itemsTrainingSkillByLevel.has(maxLevel)) {
    itemsTrainingSkillByLevel.set(maxLevel, []);
  }
  itemsTrainingSkillByLevel.get(maxLevel)!.push(i);
}

const itemsTrainingSkillByLevelList = [
  ...itemsTrainingSkillByLevel.entries(),
].sort((a, b) => a[0] - b[0]);

itemsTrainingSkillByLevelList.forEach(([, items]) => {
  items.sort(byName);
});
</script>

<h1>{t("Skill")}: {singularName(item)}</h1>
<section>
  <p style="color: var(--cata-color-gray)">{singular(item.description)}</p>
</section>

{#if booksWithSkill.length}
  <section>
    <h1>{t("Books", { _context: "Skill" })}</h1>
    <dl>
      {#each booksByLevelList as [level, books]}
        <dt style="font-variant: tabular-nums">Level {level}</dt>
        <dd>
          <ul>
            {#each books as book}
              <li><ItemLink id={book.id} type="item" showIcon={false} /></li>
            {/each}
          </ul>
        </dd>
      {/each}
    </dl>
  </section>
{/if}

{#if itemsTrainingSkillByLevelList.length}
  <section>
    <h1>{t("Trained By", { _context: "Skill" })}</h1>
    <dl>
      {#each itemsTrainingSkillByLevelList as [level, items]}
        <dt style="font-variant: tabular-nums">Level {level}</dt>
        <dd>
          <ul>
            {#each items as item}
              <li><ItemLink id={item.id} type="item" showIcon={false} /></li>
            {/each}
          </ul>
        </dd>
      {/each}
    </dl>
  </section>
{/if}

{#if itemsUsingSkill.length}
  <section>
    <h1>{t("Used By", { _context: "Skill" })}</h1>
    <LimitedList items={itemsUsingSkill} let:item>
      <ItemLink type="item" id={item.id} />
    </LimitedList>
  </section>
{/if}
