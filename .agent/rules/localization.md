---
trigger: model_decision
description: Apply when adding or modifying user-facing text in the UI to ensure total localizability using the @transifex/native "t" function.
---

Use `t` from `@transifex/native`.

- **Static**: `t("Text")`
- **Interpolation**: `t("Cost: {n}", { n: value })`
- **Svelte**: `<p>{t("Hello {name}", { name })}</p>`
- **Avoid**: String concatenation (`t("A") + b`).
