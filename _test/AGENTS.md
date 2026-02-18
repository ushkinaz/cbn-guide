# JSON Exploration Guide (`_test/all*.json`, `_test/all_mods*.json`)

## Scope
- We are JSON consumers.
- Goal: explore data (`what exists`, `values`, `types`, `relations`).
- Data validity/parity is upstream concern.

## Hard Rules
- Use `jq` for JSON queries. Never grep these blobs.
- Identity key is `(type, id_or_abstract)`.
- Default source is `_test/all.json`.

## Sources
- Current merged dataset: `_test/all.json`.
- Current per-mod dataset: `_test/all_mods.json`.
- Additional versioned datasets: `_test/all.XXX.json` and `_test/all_mods.XXX.json`.

## File Shapes
- `_test/all.json` shape: `{ build_number, release, mods, data }`.
- `_test/all.json` objects: `.data[]`.
- `_test/all.json` mod metadata: `.mods[mod_id]`.
- `_test/all_mods.json` shape: `{ mod_id: { info, data } }`.
- `_test/all_mods.json` object array location: `.[mod_id].data[]`.
- `_test/all_mods.json` object shape note: same style as `_test/all.json .data[]`.

## Identity + Inheritance
- `id` vs `abstract`: both identifiers; `id` concrete, `abstract` template/base.
- Safe matcher: `jq '.data[] | select((.id // .abstract // "")=="9mm")' _test/all.json`
- Children by parent id: `jq '.data[] | select(."copy-from"=="9mm") | {type,id,abstract,__filename}' _test/all.json`
- Parent + children set: `jq '.data[] | select((.id // .abstract // "")=="9mm" or (."copy-from" // "")=="9mm")' _test/all.json`

## Taxonomy (Short)
- List all types: `jq '[.data[].type] | unique | sort' _test/all.json`
- Count per type: `jq '[.data[].type] | group_by(.) | map({type:.[0],n:length}) | sort_by(-.n)' _test/all.json`
- Categories for one type: `jq '[.data[] | select(.type=="COMESTIBLE") | .category // empty] | unique | sort' _test/all.json`

## Real Tasks
- Find exact object (`type` + id/abstract): `jq '.data[] | select(.type=="AMMO" and (.id // .abstract // "")=="9mm")' _test/all.json`
- Find by source file fragment: `jq '.data[] | select((.__filename // "") | contains("data/json/mapgen/"))' _test/all.json`
- List fields used by type: `jq '[.data[] | select(.type=="AMMO") | keys[]] | unique | sort' _test/all.json`
- Field frequency for type: `jq '[.data[] | select(.type=="AMMO") | keys[]] | group_by(.) | map({field:.[0],n:length}) | sort_by(-.n)' _test/all.json`
- Types that have field `gun_data`: `jq '[.data[] | select(has("gun_data")) | .type] | unique | sort' _test/all.json`
- Values of scalar field `ammo_type` (optionally filter by type): `jq '[.data[] | select((.type=="AMMO") and has("ammo_type")) | .ammo_type] | unique | sort' _test/all.json`
- Values of array field `flags` (optionally filter by type): `jq '[.data[] | select(.type=="AMMO") | (.flags? // [])[]] | unique | sort' _test/all.json`
- Types using array value `NO_SALVAGE`: `jq '[.data[] | select((.flags? // []) | index("NO_SALVAGE")) | .type] | unique | sort' _test/all.json`
- Reverse refs to id in common relation fields: `jq '.data[] | select((."copy-from" // "")=="9mm" or ((.items? // []) | index("9mm")) or (.result? // "")=="9mm") | {type,id,abstract,__filename}' _test/all.json`

## Mod-Scoped Exploration (When Needed)
- List mod ids: `jq 'keys[]' -r _test/all_mods.json`
- Types present in one mod: `jq '[.aftershock.data[].type] | unique | sort' _test/all_mods.json`
- Find object in one mod: `jq '.aftershock.data[] | select(.type=="AMMO" and (.id // .abstract // "")=="9mm")' _test/all_mods.json`

## Practical Note
- Older-fork mods may contain outdated/odd fields or values.
- Treat this as exploration signal, not consumer-side validation failure.
