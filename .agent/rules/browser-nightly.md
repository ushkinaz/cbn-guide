---
trigger: model_decision
description: Use when the browser agent needs to select a data version. specifies that it must always choose the nightly version unless otherwise specified.
---

# Browser Data Selection

- **Nightly by Default**: When using `browser_subagent`, always choose the **nightly** version of the game data (e.g., via the version dropdown or by ensuring the URL includes `/nightly/`).
- **Exception**: Only use a different version if the user explicitly specifies it in their request.
