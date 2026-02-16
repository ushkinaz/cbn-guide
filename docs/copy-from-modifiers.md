# copy-from Modifier Handling

How our `_flatten()` implementation handles `copy-from` inheritance modifiers,
and why certain fields are included or excluded.

## Rules (from C-BN C++ code)

The game applies modifiers from `copy-from` depending on the **shape** of the
field's value:

| Modifier            | Applies to                                 | C++ mechanism                                             |
| ------------------- | ------------------------------------------ | --------------------------------------------------------- |
| `proportional`      | scalar values (int/float/string-with-unit) | `assign()` in `assign.h`                                  |
| `relative`          | scalar values (int/float/string-with-unit) | `assign()` in `assign.h`                                  |
| `proportional`      | `damage_instance` objects                  | `assign()` overload for `damage_instance` in `assign.cpp` |
| `relative`          | `damage_instance` objects                  | `assign()` overload for `damage_instance` in `assign.cpp` |
| `extend` / `delete` | arrays (flags, etc.)                       | `details::assign_set` / custom per-field                  |

**Only fields loaded via `assign()` support `proportional`/`relative`.** Fields
loaded via `load_damage_instance()` or `optional()` do NOT.

## damage_instance Fields

### Fields that support proportional/relative (use `assign()`)

These are loaded via the `assign(jo, name, damage_instance&, ...)` overload in
`assign.cpp`, which checks `proportional` and `relative` sub-objects.

| JSON field        | C++ location                             | Game type |
| ----------------- | ---------------------------------------- | --------- |
| `damage`          | `item_factory.cpp` `islot_ammo::load`    | AMMO      |
| `ranged_damage`   | `item_factory.cpp` `load(islot_gun&)`    | GUN       |
| `damage_modifier` | `item_factory.cpp` `load(islot_gunmod&)` | GUNMOD    |

Both scalar (numeric) and object (damage_instance) forms of `proportional` /
`relative` are supported for these fields. For example:

```json
{ "proportional": { "damage": { "damage_type": "bullet", "amount": 0.8 } } }
```

### Fields that do NOT support proportional/relative (use `load_damage_instance()`)

These are loaded directly and skip the `assign()` mechanism entirely:

| JSON field            | C++ location                                      | Game type       | Notes                                           |
| --------------------- | ------------------------------------------------- | --------------- | ----------------------------------------------- |
| `melee_damage`        | `monstergenerator.cpp:831` `mtype::load`          | MONSTER         | Has TODO: "make this work with `was_loaded`"    |
| `thrown_damage`       | `item_factory.cpp` `load_basic_info`              | item (generic)  |                                                 |
| attacks[].`damage`    | `item_factory.cpp` `load_basic_info`              | item (generic)  | Has TODO: "Implement proportional and relative" |
| `base_damage`         | `mutation_data.cpp` `load_mutation_attack`        | mutation_attack |                                                 |
| `strength_damage`     | `mutation_data.cpp` `load_mutation_attack`        | mutation_attack |                                                 |
| `damage_max_instance` | `mattack_actors.cpp` `melee_actor::load_internal` | monster_attack  |                                                 |

## Known Mod Issues

DinoMod (ported from Cataclysm-DDA) uses `"proportional": { "melee_damage": 0.65 }`
for some monsters. This is **not functional** in C-BN because monster
`melee_damage` does not use `assign()`. We intentionally do not support this in
our flattening code to match actual game behavior.

## Implementation Reference

Our `_flatten()` in `src/data.ts` mirrors the C++ `assign()` behavior:

- **Scalar `proportional`/`relative`**: applied to any numeric field via
  `ret[k] *= scalar` / `ret[k] += delta`
- **damage_instance `proportional`/`relative`**: applied only to `damage` and
  `ranged_damage` via `applyProportionalDamageInstance()` /
  `applyRelativeDamageInstance()`
- **`extend`/`delete`**: applied to array fields (flags, etc.)

## Source References

- `Cataclysm-BN/src/assign.h` -- template `assign()` for scalars; overloads for
  `damage_instance`, `units::*`, etc.
- `Cataclysm-BN/src/assign.cpp` -- `assign()` for `damage_instance` with
  `assign_dmg_proportional()` / `assign_dmg_relative()`
- `Cataclysm-BN/src/monstergenerator.cpp:831` -- monster `melee_damage` loading
- `Cataclysm-BN/src/item_factory.cpp:1774,1891,2410` -- item damage field loading
