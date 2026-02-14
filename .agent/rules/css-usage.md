---
trigger: model_decision
description: Writing or reviewing any CSS
---

- Use border-box globally
- prefer Grid for page layout and Flex for component alignment
- size with clamp() and design tokens (CSS variables)
- use logical properties (padding-inline, inset) and container queries for responsive components
- favor min()/max()/clamp() over hard breakpoints
- use dvh/dvw + safe-area insets for full-screen UI
- animate only transform/opacity and honor prefers-reduced-motion
- keep specificity low, avoid !important
