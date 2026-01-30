## 2026-01-30 - Focus Loss on Element Replacement
**Learning:** Swapping buttons (e.g., `if expanded then Button A else Button B`) causes keyboard focus to be lost to the body, forcing users to navigate again.
**Action:** Use a single persistent interactive element and toggle its state/attributes (aria-expanded, text content) instead of replacing it.
