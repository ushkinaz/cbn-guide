---
trigger: model_decision
description: Apply when adding or modifying user-facing text in the UI to ensure total localizability using the @i18n/native "t" function.
---

Use `t` from `@i18n/native`.

- **Static**: `t("Text")`
- **Interpolation**: `t("Cost: {n}", { n: value })`
- **Svelte**: `<p>{t("Hello {name}", { name })}</p>`
- **Avoid**: String concatenation (`t("A") + b`).
- **Transifex extraction rule**: The first argument to `t()` must be a string literal.
- **Do not use variables/expressions as the key**: `t(label)`, `t(plural(type))`, `t(condition ? "A" : "B")` (extractor will miss these).
