---
description: Create comprehensive, developer-focused architectural documentation.
---

1. **Analyze the Codebase**:
   - Identify the core files related to the feature or system being documented.
   - Read these files to understand the control flow, state management, and data structures.
   - Look for specific "magic values" (defaults, constants, fallbacks) and edge cases.

2. **Draft the Documentation Structure**:
   - **Overview**: High-level summary of the system.
   - **Architecture/Design**: Explain the *decisions* (e.g., "Why full reload vs SPA?").
   - **Data Flow**: Use a mermaid diagram to visualize how data moves (e.g., URL -> Parsing -> Fetching -> Store).
   - **State Management**: Create tables listing relevant variables, stores, or database fields and their scopes.
   - **Implementation Details**: Document key functions and their side effects.
   - **Common Patterns** (CRITICAL): Provide "How-to" recipes for common maintenance tasks (e.g., "How to add a new parameter").
   - **Limitations/Edge Cases**: explicitly list what the system *doesn't* do or where it breaks.

3. **Writing Rules**:
   - **Be Specific**: Do not say "it handles errors". Say "it falls back to `default_value` if X fails".
   - **Include Rationale**: developers need to know *why* a decision was made so they don't accidentally break it.
   - **Use Visuals**: Text is hard to parse; diagrams and tables are easy.
   - **Developer Focused**: Write for the person who has to *maintain* this code next year.

4. **Review and Polish**:
   - Verify that every claim in the doc matches the actual code.
   - Ensure specific variable names and file paths are used.
   - Check if the "Common Patterns" actually work.
