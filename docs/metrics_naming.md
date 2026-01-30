# Metrics Naming Convention

> **Goal:** Consistent, discoverable, and meaningful metric names via `<domain>.<subject>.<action>[.unit]` format.

## Structure

| Segment     | Usage                            | Examples                  |
| ----------- | -------------------------------- | ------------------------- |
| **Domain**  | Top-level system area            | `app`, `search`, `data`   |
| **Subject** | Entity being measured            | `index`, `query`, `route` |
| **Action**  | Event or state change            | `click`, `load`, `change` |
| **Unit**    | **Mandatory** for physical units | `_ms`, `_bytes`, `_count` |

---

## Controlled Vocabulary

### 1. Domains

| Domain    | Scope                                                    |
| --------- | -------------------------------------------------------- |
| `app`     | Application lifecycle (init, global errors, performance) |
| `data`    | Game data processing (fetching, parsing, validating)     |
| `feature` | Specific tool usage (calculators, localized tools)       |
| `nav`     | Navigation, routing, URL state                           |
| `search`  | Search engine internals and user queries                 |
| `ui`      | Visual interface interactions (theming, modals)          |

### 2. Actions

| Action   | Usage                                                |
| -------- | ---------------------------------------------------- |
| `change` | State transition (often with `from`/`to` attributes) |
| `click`  | User interaction with an element                     |
| `load`   | Data fetching or preparation process                 |
| `submit` | Explicit user submission (forms)                     |
| `open`   | Modal or view becoming visible                       |

### ✅ Standardize Verbs

Use consistent verbs for similar actions.

- `click`: Interactive element usage associated with a user action
- `load`: Data being fetched/prepared
- `change`: State transitions (with `from`/`to` attributes)
- `submit`: Form submissions

### ✅ Context via Attributes (Not Names)

Do not create new metric names for every screen or button. Use attributes to distinguish context.
**Note:** `url_path` is automatically added to all metrics, so you don't need to manually track the page.

- **Question:** How do I distinguish the "Save" button on Settings vs. Profile?
- **Answer:** Use the generic name `ui.button.click` and add a `widget_id` attribute.

```typescript
// Good
metrics.count("ui.button.click", 1, { widget_id: "settings_save" });
metrics.count("ui.button.click", 1, { widget_id: "profile_save" });

// Bad
metrics.count("ui.settings.save_button.click");
metrics.count("ui.profile.save_button.click");
```

### ✅ Fact vs. Wish

Distinguish between the user *requesting* an action (UI interaction) and the system *completing* it (Application state change).

- `ui.version.change`: User clicked the dropdown to switch versions (The "Wish").
- `app.version.change`: The version actually switched successfully (The "Fact").

### ✅ Logical > UI Centric

Name metrics based on **user intent** or **business logic**, not the UI implementation. UI changes often (buttons become gestures, forms become wizards), but the intent remains.

- **Question:** Should I use `form.completed` or `auth.login.success`?
- **Answer:** Use `auth.login.success`.

| UI-Centric (Avoid)            | Logical / Intent (Prefer)  | Why?                                                   |
| ----------------------------- | -------------------------- | ------------------------------------------------------ |
| `registration.form.submitted` | `auth.registration.submit` | The form might become a modal or 2-step process later. |
| `search.input.enter_pressed`  | `search.query.submit`      | User might submit via button click or voice later.     |
| `banner.blue_button.click`    | `promo.offer.accept`       | The button might turn green or change shape.           |

### 3. Suffixes (Units)

| Suffix   | Meaning                                            |
| -------- | -------------------------------------------------- |
| `_ms`    | Time in milliseconds                               |
| `_bytes` | Size in bytes                                      |
| `_count` | Raw count (optional for simple increment counters) |

---

## Examples

### ✅ Good Examples

| Metric Name                  | Type         | Meaning                         |
| ---------------------------- | ------------ | ------------------------------- |
| `ui.item.render_duration_ms` | Distribution | Time to render item details     |
| `nav.route.change`           | Counter      | User navigated to a new page    |
| `data.items.count`           | Gauge        | Total number of items in memory |
| `app.init.duration_ms`       | Distribution | Time to interactive             |

### ❌ Bad Examples

| Bad Name               | Why it's bad                                  | Correction                                  |
| ---------------------- | --------------------------------------------- | ------------------------------------------- |
| `search.queryTime`     | **CamelCase** used instead of snake_case      | `search.query.duration_ms`                  |
| `clicked_button`       | **Verb first** breaks hierarchy               | `ui.button.click`                           |
| `search.duration`      | **Missing unit** is ambiguous                 | `ui.item.render_duration_ms`                |
| `search.click_monster` | **Cardinality in name** (monster, item, etc.) | `search.result.click` (tag: `type=monster`) |
| `item.view`            | **Ambiguous action** (viewed? loaded?)        | `nav.route.change` (tag: `view=item`)       |
