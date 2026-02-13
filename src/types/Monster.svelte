<script lang="ts">
import { t } from "@transifex/native";
import { getContext } from "svelte";

import {
  asKilograms,
  asLiters,
  CBNData,
  byName,
  formatPercent,
  normalizeDamageInstance,
  singular,
  singularName,
} from "../data";
import ItemLink from "./ItemLink.svelte";
import type { Harvest, Monster, MonsterGroup } from "../types";
import SpecialAttack from "./monster/SpecialAttack.svelte";
import Spoiler from "../Spoiler.svelte";
import ItemTable from "./item/ItemTable.svelte";

const _context = "Monster";

export let item: Monster;

let data = getContext<CBNData>("data");

// prettier-ignore
function difficulty(mon: Monster): number {
  const {
    melee_skill = 0,
    melee_dice = 0,
    melee_damage = [],
    melee_dice_sides: melee_sides = 0,
    dodge: sk_dodge = 0,
    diff: difficulty_base = 0,
    special_attacks = [],
    emit_fields = [],
    hp,
    speed = 0,
    attack_cost = 100,
    morale = 0,
    aggression: agro = 0,
    vision_day = 40,
    vision_night = 1
  } = mon
  const normalizedMeleeDamage = normalizeDamageInstance(melee_damage)
  const melee_dmg_total = normalizedMeleeDamage.reduce((acc, { amount = 0, damage_multiplier = 1, constant_damage_multiplier = 1 }) => acc + amount * damage_multiplier * constant_damage_multiplier, 0)
  let armor_diff = 3

  let difficulty = ( melee_skill + 1 ) * melee_dice * ( melee_dmg_total + melee_sides ) * 0.04 +
               ( sk_dodge + 1 ) * armor_diff * 0.04 +
               ( difficulty_base + special_attacks.length + 8 * emit_fields.length );
  difficulty = Math.floor(difficulty);
  difficulty *= ( (hp ?? 1) + speed - attack_cost + ( morale + agro ) * 0.1 ) * 0.01 +
                ( vision_day + 2 * vision_night ) * 0.01;
  return Math.max(1, Math.floor(difficulty));
}

function difficultyDescription(diff: number): {
  text: string;
  className: string;
} {
  if (diff < 3) {
    return {
      text: t("Minimal threat"),
      className: "difficulty-minimal",
    };
  } else if (diff < 10) {
    return {
      text: t("Mildly dangerous"),
      className: "difficulty-low",
    };
  } else if (diff < 20) {
    return {
      text: t("Dangerous"),
      className: "difficulty-medium",
    };
  } else if (diff < 30) {
    return {
      text: t("Very dangerous"),
      className: "difficulty-high",
    };
  } else if (diff < 50) {
    return {
      text: t("Extremely dangerous"),
      className: "difficulty-very-high",
    };
  }
  return {
    text: t("Fatally dangerous"),
    className: "difficulty-fatal",
  };
}

function difficultyInfo(mon: Monster): {
  value: number;
  text: string;
  className: string;
} {
  const value = difficulty(mon);
  const { text, className } = difficultyDescription(value);
  return { value, text, className };
}

function damage(mon: Monster) {
  let {
    melee_dice = 0,
    melee_dice_sides = 0,
    melee_damage = [],
    melee_cut,
  } = mon;
  const du = normalizeDamageInstance(melee_damage);
  if (melee_cut) {
    du.push({
      damage_type: "cut",
      amount: melee_cut,
    });
  }
  //melee_damage = melee_damage ?? [ { damage_type: "bash", amount: `${melee_dice}d${melee_dice_sides}` } ]
  return (
    `${melee_dice}d${melee_dice_sides} ${singularName(
      data.byIdMaybe("damage_type", "bash") ?? { id: "bash" },
    )}` +
    du
      .map(
        (u) =>
          ` + ${u.amount} ${singularName(
            data.byIdMaybe("damage_type", u.damage_type) ?? {
              id: u.damage_type,
            },
          )}`,
      )
      .join("")
  );
}

// From mtype.h
// prettier-ignore
const mon_flag_descriptions: Record<string, string> = {
  ABSORBS: "Consumes objects it moves over which gives bonus hp.",
  ABSORBS_SPLITS: "Consumes objects it moves over which gives bonus hp. If it gets enough bonus HP, it spawns a copy of itself.",
  ACID_BLOOD: "Makes monster bleed acid. Fun stuff! Does not automatically dissolve in a pool of acid on death.",
  ACIDPROOF: "Immune to acid",
  ACIDTRAIL: "Leaves a trail of acid",
  ANIMAL: "Is an \"animal\" for purposes of the Animal Empath trait",
  AQUATIC: "Confined to water",
  ARTHROPOD_BLOOD: "Forces monster to bleed hemolymph.",
  ATTACKMON: "Attacks other monsters",
  PATH_AVOID_DANGER_1: "This monster will path around some dangers instead of through them.",
  PATH_AVOID_DANGER_2: "This monster will path around most dangers instead of through them.",
  PATH_AVOID_FALL: "This monster will path around cliffs instead of off of them.",
  PATH_AVOID_FIRE: "This monster will path around heat-related dangers instead of through them.",
  BADVENOM: "Attack may SEVERELY poison the player",
  BASHES: "Bashes down doors",
  BILE_BLOOD: "Makes monster bleed bile.",
  BIOPROOF: "Immune to biological damage",
  BLEED: "Causes player to bleed",
  BONES: "May produce bones and sinews when butchered; if combined with POISON flag, tainted bones, if combined with HUMAN, human bones",
  BORES: "Tunnels through just about anything",
  CAN_BE_ORDERED: "If friendly, allow setting this monster to ignore hostiles and prioritize following the player.",
  CAN_DIG: "Can dig and walk",
  CAN_OPEN_DOORS: "This monster can open doors.",
  CANPLAY: "This monster can be played with if it's a pet.",
  CARD_OVERRIDE: "Not a mech, but can be converted to friendly using an ID card in the same way that mechs can.",
  CBM_CIV: "May produce a common CBM a power CBM when butchered.",
  CBM_OP: "May produce a bionic from bionics_op when butchered, and the power storage is mk 2.",
  CBM_POWER: "May produce a power CBM when butchered, independent of MF_CBM_wev.",
  CBM_SCI: "May produce a bionic from bionics_sci when butchered.",
  CBM_SUBS: "May produce a bionic from bionics_subs when butchered.",
  CBM_TECH: "May produce a bionic from bionics_tech when butchered.",
  CHITIN: "May produce chitin when butchered",
  CLIMBS: "Monsters that can climb certain terrain and furniture",
  COLDPROOF: "Immune to cold damage",
  CONSOLE_DESPAWN: "Despawns when a nearby console is properly hacked",
  DESTROYS: "Bashes down walls and more",
  DIGS: "Digs through the ground",
  DOGFOOD: "This monster will respond to the \"dog whistle\" item.",
  DRIPS_GASOLINE: "This monster occasionally drips gasoline on move",
  DRIPS_NAPALM: "This monster occasionally drips napalm on move",
  DROPS_AMMO: "This monster drops ammo. Check to make sure starting_ammo parameter is present for this monster type!",
  ELECTRIC: "Shocks unarmed attackers",
  ELECTRIC_FIELD: "This monster is surrounded by an electrical field that ignites flammable liquids near it",
  ELECTRONIC: "e.g. a robot; affected by EMP blasts, and other stuff",
  FAT: "May produce fat when butchered; if combined with POISON flag, tainted fat",
  FEATHER: "May produce feather when butchered",
  FILTHY: "Any clothing it drops will be filthy.",
  FIREPROOF: "Immune to fire",
  FIREY: "Burns stuff and is immune to fire",
  FISHABLE: "It is fishable.",
  FLAMMABLE: "Monster catches fire, burns, and spreads fire to nearby objects",
  FLIES: "Can fly (over water, etc)",
  FUR: "May produce fur when butchered",
  GOODHEARING: "Pursues sounds more than most monsters",
  GRABS: "Its attacks may grab us!",
  GROUP_BASH: "Monsters that can pile up against obstacles and add their strength together to break them.",
  GROUP_MORALE: "Monsters that are more courageous when near friends",
  GUILT: "You feel guilty for killing it",
  HARDTOSHOOT: "It's one size smaller for ranged attacks, no less then creature_size::tiny",
  HEARS: "It can hear you",
  HIT_AND_RUN: "Flee for several turns after a melee attack",
  HUMAN: "It's a live human, as long as it's alive",
  ID_CARD_DESPAWN: "Despawns when a science ID card is used on a nearby console",
  IMMOBILE: "Doesn't move (e.g. turrets)",
  INTERIOR_AMMO: "Monster contains its ammo inside itself, no need to load on launch. Prevents ammo from being dropped on disable.",
  KEENNOSE: "Keen sense of smell",
  LARVA: "Creature is a larva. Currently used for gib and blood handling.",
  LEATHER: "May produce leather when butchered",
  LOUDMOVES: "This monster makes move noises as if ~2 sizes louder, even if flying.",
  MAX: "Sets the length of the flags - obviously must be LAST",
  MECH_DEFENSIVE: "This mech gives you thorough protection.",
  MECH_RECON_VISION: "This mech gives you IR night-vision.",
  MILITARY_MECH: "Makes rideable mechs and card-scanner bots require a military ID instead of industrial to convert to friendly.",
  MILKABLE: "This monster is milkable.",
  NIGHT_INVISIBILITY: "Monsters that are invisible in poor light conditions",
  NO_BREATHE: "Creature can't drown and is unharmed by gas, smoke, or poison",
  NO_BREED: "This monster doesn't breed, even though it has breed data",
  NO_FUNG_DMG: "This monster can't be fungalized or damaged by fungal spores.",
  NO_NECRO: "This monster can't be revived by necros. It will still rise on its own.",
  NOGIB: "Creature won't leave gibs / meat chunks when killed with huge damage.",
  NOHEAD: "Headshots not allowed!",
  NOT_HALLUCINATION: "Monsters that will NOT appear when player's producing hallucinations",
  PACIFIST: "Monsters that will never use melee attack, useful for having them use grab without attacking the player",
  PARALYZEVENOM: "Attack may paralyze the player with venom",
  PAY_BOT: "You can pay this bot to be your friend for a time",
  PET_HARNESSABLE: "This monster can be harnessed when tamed.",
  PET_MOUNTABLE: "This monster can be mounted and ridden when tamed.",
  PET_WONT_FOLLOW: "This monster won't follow the player automatically when tamed.",
  PLASTIC: "Absorbs physical damage to a great degree",
  POISON: "Poisonous to eat",
  PRIORITIZE_TARGETS: "This monster will prioritize targets depending on their danger levels",
  PUSH_MON: "Monsters that can push creatures out of their way",
  PUSH_VEH: "Monsters that can push vehicles out of their way",
  QUEEN: "When it dies, local populations start to die off too",
  REVIVES: "Monster corpse will revive after a short period of time",
  REVIVES_HEALTHY: "When revived, this monster has full hitpoints and speed",
  RIDEABLE_MECH: "A rideable mech that is immobile until ridden.",
  SEES: "It can see you (and will run/follow)",
  SHEARABLE: "This monster is shearable.",
  SHORTACIDTRAIL: "Leaves an intermittent trail of acid",
  SLUDGEPROOF: "Ignores the effect of sludge trails",
  SLUDGETRAIL: "Causes monster to leave a sludge trap trail when moving",
  SMELLS: "It can smell you",
  STUMBLES: "Stumbles in its movement",
  STUN_IMMUNE: "This monster is immune to the stun effect",
  SUNDEATH: "Dies in full sunlight",
  SWARMS: "Monsters that like to group together and form loose packs",
  SWIMS: "Treats water as 50 movement point terrain",
  VENOM: "Attack may poison the player",
  VERMIN: "Obsolete flag labeling \"nuisance\" or \"scenery\" monsters, now used to prevent loading the same.",
  WARM: "Warm blooded",
  WEBWALK: "Doesn't destroy webs",
  WOOL: "May produce wool when butchered",
};

// From mtype.h: mon_trigger
// prettier-ignore
const trigger_descriptions: Record<string, string> = {
  FIRE: "Fire nearby",
  FRIEND_ATTACKED: "A monster of the same type attacked",
  FRIEND_DIED: "A monster of the same type died",
  PLAYER_CLOSE: "Hostile creature within a few tiles",
  PLAYER_WEAK: "Hurt hostile player/npc/monster seen",
  HURT: "We are hurt",
  MATING_SEASON: "It's the monster's mating season (defined by baby_flags)",
  MEAT: "Meat or a corpse nearby",
  NETHER_ATTENTION: "Player/npc currently has effect_attention",
  PLAYER_NEAR_BABY: "Player/npc is near a baby monster of this type",
  SOUND: "Heard a sound",
  STALK: "Increases when following the player",
}

let materials = item.material ?? [];

let harvest: Harvest | undefined = item.harvest
  ? data.byId("harvest", item.harvest)
  : undefined;

function flattenGroup(mg: MonsterGroup): string[] {
  const results = new Set<string>();
  if (mg.default) results.add(mg.default);
  for (const m of mg.monsters ?? []) {
    if (m.monster) results.add(m.monster);
    if (m.group)
      for (const n of flattenGroup(data.byId("monstergroup", m.group)))
        results.add(n);
  }
  return [...results];
}

let upgrades =
  item.upgrades && (item.upgrades.into || item.upgrades.into_group)
    ? {
        ...item.upgrades,
        monsters: (item.upgrades.into
          ? [item.upgrades.into]
          : item.upgrades.into_group
            ? flattenGroup(data.byId("monstergroup", item.upgrades.into_group))
            : []
        )
          .filter((id) => id !== item.id)
          .map((id) => data.byIdMaybe("monster", id))
          .filter((m): m is NonNullable<typeof m> => !!m)
          .sort(byName)
          .map((m) => m.id),
      }
    : null;

type TimingType = "age_grow" | "half_life" | "no_timing";

interface UpgradeGroup {
  type: TimingType;
  value: number;
  monsters: string[];
}

const TIMING_PRIORITY: Record<TimingType, number> = {
  age_grow: 0,
  half_life: 1,
  no_timing: 2,
};

const upgradesFromGrouped = new Map<string, UpgradeGroup>();

// TODO: This iterates over all monsters (~900 items), see if we can/need optimize
for (const monster of data.byType("monster")) {
  const { upgrades } = monster;
  if (!upgrades || monster.id === item.id) continue;

  const matches =
    upgrades.into === item.id ||
    (upgrades.into_group &&
      flattenGroup(data.byId("monstergroup", upgrades.into_group)).includes(
        item.id,
      ));

  if (!matches) continue;

  const [type, value]: [TimingType, number] = upgrades.age_grow
    ? ["age_grow", upgrades.age_grow]
    : upgrades.half_life
      ? ["half_life", upgrades.half_life]
      : ["no_timing", 0];
  const key = `${type}:${value}`;
  let group = upgradesFromGrouped.get(key);
  if (!group) {
    group = { type, value, monsters: [] };
    upgradesFromGrouped.set(key, group);
  }
  group.monsters.push(monster.id);
}

const sortedGroups = Array.from(upgradesFromGrouped.values()).sort((a, b) => {
  if (a.type !== b.type) {
    return TIMING_PRIORITY[a.type] - TIMING_PRIORITY[b.type];
  }
  return a.value - b.value;
});

for (const group of sortedGroups) {
  group.monsters.sort((a, b) =>
    byName(data.byIdMaybe("monster", a), data.byIdMaybe("monster", b)),
  );
}
</script>

<h1 style="text-transform: capitalize">
  <ItemLink type="monster" id={item.id} link={false} />
</h1>
<section>
  <dl>
    {#if item.bodytype}
      <dt>{t("Body Type", { _context })}</dt>
      <dd>{item.bodytype}</dd>
    {/if}
    {#if item.species && item.species.length}
      <dt>{t("Species", { _context })}</dt>
      <dd>{[item.species ?? []].flat().join(", ")}</dd>
    {/if}
    <dt>{t("Volume")}</dt>
    <dd>{asLiters(item.volume ?? 0)}</dd>
    <dt>{t("Weight")}</dt>
    <dd>{asKilograms(item.weight ?? 0)}</dd>
    {#if materials.length}
      <dt>{t("Material")}</dt>
      <dd>
        <ul class="comma-separated">
          {#each materials as id}
            <li><ItemLink type="material" {id} showIcon={false} /></li>
          {/each}
        </ul>
      </dd>
    {/if}
    <dt>{t("Difficulty", { _context })}</dt>
    <dd>
      {#each [difficultyInfo(item)] as info}
        {info.value}
        (<span class={`difficulty-label ${info.className}`}>{info.text}</span>)
      {/each}
    </dd>
  </dl>
  {#if item.description}
    <p style="color: var(--cata-color-gray)">{singular(item.description)}</p>
  {/if}
</section>
<Spoiler spoily={item.id === "mon_dragon_dummy"}>
  <div class="side-by-side">
    <section>
      <h1>{t("Attack", { _context, _comment: "Section heading" })}</h1>
      <dl>
        <dt>{t("Speed", { _context })}</dt>
        <dd>{item.speed ?? 0}</dd>
        <dt>{t("Melee Skill", { _context })}</dt>
        <dd>{item.melee_skill ?? 0}</dd>
        <dt>{t("Damage", { _context })}</dt>
        <dd>{damage(item)}</dd>
        {#if item.special_attacks}
          <dt>{t("Special Attacks", { _context })}</dt>
          <dd>
            <ul class="no-bullets">
              {#each item.special_attacks as special_attack}
                <li>
                  {#if Array.isArray(special_attack) && special_attack[0] && data.byIdMaybe("monster_attack", special_attack[0])}
                    <ItemLink
                      type="monster_attack"
                      id={special_attack[0]}
                      showIcon={false} />
                  {:else}
                    <SpecialAttack {special_attack} />
                  {/if}
                </li>
              {/each}
            </ul>
          </dd>
        {/if}
      </dl>
    </section>
    <section>
      <h1>{t("Defense", { _context, _comment: "Section heading" })}</h1>
      <dl style="flex: 1">
        <dt>{t("HP", { _context })}</dt>
        <dd>{item.hp}</dd>
        {#if item.regenerates}
          <dt>{t("Regenerates", { _context })}</dt>
          <dd>{item.regenerates} hp/turn</dd>
        {/if}
        <dt>{t("Dodge", { _context })}</dt>
        <dd>{item.dodge ?? 0}</dd>
        <dt>{t("Armor", { _context })}</dt>
        <dd>
          <dl>
            <dt>{t("Bash", { _context: "Damage Type" })}</dt>
            <dd>{item.armor_bash ?? 0}</dd>
            <dt>{t("Cut", { _context: "Damage Type" })}</dt>
            <dd>{item.armor_cut ?? 0}</dd>
            <dt>{t("Stab", { _context: "Damage Type" })}</dt>
            <dd>
              {item.armor_stab ?? Math.floor((item.armor_cut ?? 0) * 0.8)}
            </dd>
            <dt>{t("Ballistic", { _context: "Damage Type" })}</dt>
            <dd>{item.armor_bullet ?? 0}</dd>
            <dt>{t("Acid", { _context: "Damage Type" })}</dt>
            <dd>
              {item.armor_acid ?? Math.floor((item.armor_cut ?? 0) * 0.5)}
            </dd>
            <dt>{t("Heat", { _context: "Damage Type" })}</dt>
            <dd>{item.armor_fire ?? 0}</dd>
          </dl>
        </dd>
        {#if item.special_when_hit}
          <dt>{t("When Hit", { _context })}</dt>
          <dd>{item.special_when_hit[0]} ({item.special_when_hit[1]}%)</dd>
        {/if}
      </dl>
    </section>
  </div>
  <section>
    <h1>{t("Behavior", { _context, _comment: "Section heading" })}</h1>
    <dl>
      <dt
        title="Monsters with high aggression are more likely to be hostile. Ranges from -100 to 100">
        {t("Aggression", { _context })}
      </dt>
      <dd>{item.aggression ?? 0}</dd>
      <dt title="Morale at spawn. Monsters with low morale will flee.">
        {t("Morale", { _context })}
      </dt>
      <dd>{item.morale ?? 0}</dd>
      <dt>{t("Vision Range", { _context })}</dt>
      <dd>
        {item.vision_day ?? 40} ({t("day", { _context })}) / {item.vision_night ??
          1} ({t("night", { _context })})
      </dd>
      <dt>{t("Default Faction", { _context })}</dt>
      <dd>{item.default_faction}</dd>
      {#if item.anger_triggers?.length}
        <dt>{t("Anger Triggers", { _context })}</dt>
        <dd>
          <ul class="comma-separated">
            {#each item.anger_triggers as t}
              <li><abbr title={trigger_descriptions[t]}>{t}</abbr></li>
            {/each}
          </ul>
        </dd>
      {/if}
      {#if item.placate_triggers?.length}
        <dt>{t("Placate Triggers", { _context })}</dt>
        <dd>
          <ul class="comma-separated">
            {#each item.placate_triggers as t}
              <li><abbr title={trigger_descriptions[t]}>{t}</abbr></li>
            {/each}
          </ul>
        </dd>
      {/if}
      {#if item.fear_triggers?.length}
        <dt>{t("Fear Triggers", { _context })}</dt>
        <dd>
          <ul class="comma-separated">
            {#each item.fear_triggers as t}
              <li><abbr title={trigger_descriptions[t]}>{t}</abbr></li>
            {/each}
          </ul>
        </dd>
      {/if}
      {#if item.flags?.length}
        <dt>{t("Flags")}</dt>
        <dd>
          <ul class="comma-separated">
            {#each item.flags ?? [] as flag}
              <li><abbr title={mon_flag_descriptions[flag]}>{flag}</abbr></li>
            {/each}
          </ul>
        </dd>
      {/if}
      {#if item.death_function}
        <dt>{t("On Death", { _context })}</dt>
        <dd>
          <ul class="comma-separated">
            {#each item.death_function as f}
              <li>{f ?? "NORMAL"}</li>
            {/each}
          </ul>
        </dd>
      {/if}
      {#if upgrades}
        <dt>{t("Upgrades Into", { _context })}</dt>
        <dd>
          <ul class="comma-separated">
            <!-- prettier-ignore -->
            {#each upgrades.monsters as mon}
			<li><ItemLink type="monster" id={mon} showIcon={false} /></li>{/each}
          </ul>
          {#if upgrades.age_grow}
            {t("in {days} {days, plural, =1 {day} other {days}}", {
              _context,
              days: upgrades.age_grow,
            })}
          {:else if upgrades.half_life}
            {t(
              "with a half-life of {half_life} {half_life, plural, =1 {day} other {days}}",
              { _context, half_life: upgrades.half_life },
            )}
          {/if}
        </dd>
      {/if}
      {#if sortedGroups.length}
        <dt>{t("Upgrades From", { _context })}</dt>
        <dd>
          {#each sortedGroups as group, i}
            {#if i > 0};
            {/if}
            <span>
              {#each group.monsters as monId, j}
                {#if j > 0},
                {/if}<ItemLink type="monster" id={monId} showIcon={false} />
              {/each}
            </span>
            {#if group.type === "age_grow"}
              &nbsp;{t("in {days} {days, plural, =1 {day} other {days}}", {
                _context,
                days: group.value,
              })}
            {:else if group.type === "half_life"}
              &nbsp;({t(
                "with a half-life of {half_life} {half_life, plural, =1 {day} other {days}}",
                { _context, half_life: group.value },
              )})
            {/if}
          {/each}
        </dd>
      {/if}
    </dl>
  </section>

  {#if item.death_drops}
    <ItemTable loot={() => data.flatDeathDrops(item.id)} heading={t("Drops")} />
  {/if}

  {#if harvest && (harvest.entries ?? []).length}
    <section>
      <h1>{t("Butchering Results", { _context })}</h1>
      <ul>
        {#each harvest.entries as harvest_entry}
          {#if (harvest_entry.type && data.byIdMaybe("harvest_drop_type", harvest_entry.type)?.group) || harvest_entry.type === "bionic_group"}
            {#each data.flattenTopLevelItemGroup(data.byId("item_group", harvest_entry.drop)) as { id, prob }}
              <li>
                <ItemLink type="item" {id} /> ({formatPercent(prob)})
              </li>
            {/each}
          {:else}
            <li>
              <ItemLink type="item" id={harvest_entry.drop} />
            </li>
          {/if}
        {/each}
      </ul>
    </section>
  {/if}
</Spoiler>

<style>
.difficulty-label {
  font-weight: 600;
}
.difficulty-minimal {
  color: hsl(210deg 12% 70%);
}
.difficulty-low {
  color: hsl(145deg 45% 55%);
}
.difficulty-medium {
  color: hsl(45deg 90% 60%);
}
.difficulty-high {
  color: hsl(20deg 85% 60%);
}
.difficulty-very-high {
  color: hsl(5deg 80% 58%);
}
.difficulty-fatal {
  color: hsl(350deg 70% 60%);
}
</style>
