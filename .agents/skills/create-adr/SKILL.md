---
name: create-adr
description: Create an Architecture Decision Record
---

This workflow guides you through creating an Architecture Decision Record (ADR) to document significant architectural choices.

1. **Determine if an ADR is needed**

   Create an ADR when making decisions about:
   - System architecture or major refactorings
   - Technology choices (libraries, frameworks, patterns)
   - Data formats or protocols
   - Performance/security trade-offs
   - Breaking changes or migrations

2. **Find the next ADR number**

   ```bash
   ls docs/adr/*.md | tail -1
   ```

   Increment the number for your new ADR (e.g., if last is `001-...`, use `002`).

3. **Copy the template**

   ```bash
   cp docs/adr/000-template.md docs/adr/XXX-short-title.md
   ```

   Replace `XXX` with the number (zero-padded to 3 digits) and `short-title` with a kebab-case slug.

4. **Fill in the ADR sections**
   - **Title**: Clear, concise description of the decision
   - **Date**: Current date (YYYY-MM-DD)
   - **Status**: Usually "Accepted" for new decisions
   - **Context**: Problem statement and constraints
   - **Decision**: What you decided and why
   - **Consequences**: Positive, negative, and neutral implications
   - **References**: Link to implementation files, related ADRs, issues

5. **Add inline code references**

   In the code that implements the decision, add a comment:

   ```typescript
   // ARCHITECTURE: [ADR Title] (see docs/adr/XXX-title.md)
   // Brief explanation of how this code relates to the decision
   ```

6. **Update the ADR index**

   Edit `docs/adr/README.md` to add your new ADR to the index:

   ```markdown
   - [ADR-XXX](XXX-title.md) - [Short Description]
   ```

7. **Commit the ADR**

   Commit the ADR with your implementation changes, or as a separate commit:

   ```bash
   git add docs/adr/XXX-*.md docs/adr/README.md
   git commit -m "docs: add ADR-XXX for [decision]"
   ```

## Template Sections Explained

- **Status**: Track the lifecycle (Proposed → Accepted → [optionally Deprecated/Superseded])
- **Context**: Answer "Why do we need to make a decision?" Include constraints and requirements
- **Decision**: Answer "What did we decide?" Be specific about the implementation approach
- **Consequences**: Answer "What happens because of this decision?" Include trade-offs
- **References**: Link to actual code, related decisions, and external resources
