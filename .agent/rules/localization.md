---
trigger: model_decision
description: Apply when adding or modifying user-facing text in the UI to ensure total localizability.
---

Use `t` from `@transifex/native`.

- **Static**: `t("Text")`
- **Interpolation**: `t("Cost: {n}", { n: value })`
- **Svelte**: `<p>{t("Hello {name}", { name })}</p>`
- **Avoid**: String concatenation (`t("A") + b`).
- **Transifex extraction rule**: The first argument to `t()` must be a string literal.
- **Do not use variables/expressions as the key**: `t(label)`, `t(plural(type))`, `t(condition ? "A" : "B")` (extractor will miss these).

## Context usage (`_context`)

- Use `_context` only when a short key is ambiguous (same English string, different meaning).
- Do not add `_context` for already specific UI labels (for example: `Calories`, `Read Time`, `Diameter`).
- Keep context short and stable when needed (for example: `"_context": "Verb"` vs `"_context": "Noun"`).

Examples:
- Good: `t("Search", { _context: "Verb" })`, `t("Search", { _context: "Noun" })`
- Avoid: `t("Calories", { _context: "Item Comestible Info" })`
