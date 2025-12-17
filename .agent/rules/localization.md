---
trigger: model_decision
description: Enforce localization for UI strings.
---

When adding or modifying user-facing text in the UI (Svelte components), you MUST use the `t` function from `@transifex/native` to ensure the text is localizable.

1.  **Import the `t` function:**

    ```typescript
    import { t } from "@transifex/native";
    ```

2.  **Wrap strings:**
    Use `t("Your string here")` for static text.

3.  **Use Interpolation:**
    Do NOT concatenate strings with variables. Use the interpolation syntax provided by the library.

    **Bad:**

    ```typescript
    t("Cost: ") + cost + t(" coins");
    ```

    **Good:**

    ```typescript
    t("Cost: {cost} coins", { cost: someValue });
    ```

4.  **Svelte Template Usage:**
    ```svelte
    <p>{t("Hello {name}", { name: userName })}</p>
    ```
