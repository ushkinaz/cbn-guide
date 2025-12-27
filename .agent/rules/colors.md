---
trigger: model_decision
description: Apply when modifying styles or UI components to ensure Game (--cata-*) and App UI colors are never mixed.
---

- **Game Colors**: Use `--cata-color-*` (from game data). ONLY for game entities.
- **App UI Colors**: Use Hex/HSL from `global.css`. ONLY for buttons, nav, text.
- **NEVER** mix them.
