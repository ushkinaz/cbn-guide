---
name: write-documentation
description: Create comprehensive, developer-focused architectural documentation.
---

1. **Analyze the Codebase**:
   - Identify the core files that own the feature or system being documented.
   - Read them to understand responsibilities, boundaries, control flow, and the few edge cases that materially affect behavior.
   - Distinguish between raw state, derived state, persisted state, and UI state.
   - Look for notable exceptions to the main model. Those are usually more important than obvious happy-path mechanics.

2. **Draft the Documentation Structure**:
   - Prefer preserving the existing document structure when updating an established doc. Change structure only when the concepts changed enough that the old shape is misleading.
   - **Overview**: High-level summary of what the system is and what kinds of state or responsibilities it coordinates.
   - **Architecture/Design**: Explain the boundaries and the rationale for those boundaries.
   - **Data Flow**: Use a mermaid diagram when it clarifies how information moves across layers.
   - **State Management**: Describe categories of state and ownership in conceptual terms. Tables are good when they clarify ownership or lifecycle.
   - **Implementation Details**: Focus on meaningful behavior, side effects, and notable exceptions. Do not turn this into JSDoc.
   - **Common Patterns** (CRITICAL): Provide maintenance recipes such as "how to add a new route parameter" or "how to extend this subsystem safely".
   - **Limitations/Edge Cases**: explicitly list what the system does not do, where behavior is surprising, and where exceptions to the main rule exist.

3. **Writing Rules**:
   - **Document the system as it is**: no branch history, refactor diary, "before this", "previously", or migration storytelling unless the user explicitly asks for history.
   - **Use present tense**: describe current behavior, ownership, and constraints.
   - **Be conceptual first**: explain build version, locale, mods, display preference, ownership, lifecycle, and transport. Do not default to variable names or type shapes.
   - **Do not transcribe code**: avoid copying method signatures, type definitions, field-by-field tables, or obvious control flow that a reader can get from source.
   - **Be specific only where it matters**: mention a fallback, normalization rule, or exception when it changes behavior in a way a maintainer must know.
   - **Include rationale**: developers need to know why a boundary or rule exists so they do not break it accidentally.
   - **Use visuals selectively**: diagrams and tables should reduce cognitive load, not duplicate prose.
   - **Developer focused**: write for the person who has to maintain the code next year.
   - **Follow normal markdown conventions**: avoid forced line breaks in prose; let paragraphs and lists flow naturally.
   - **Avoid obvious statements**: skip details whose only value is that they are literally present in the code.
   - **Highlight notable exceptions**: if one thing behaves differently from the main rule, document that explicitly.

4. **Review and Polish**:
   - Verify that every claim matches the code.
   - Remove code-shaped exposition that belongs in source or JSDoc instead of architecture docs.
   - Check whether each section explains purpose, ownership, and usage rather than naming internals.
   - Ensure file references point to the real owners of the behavior.
   - Check that the "Common Patterns" are actionable and align with the actual architecture.
