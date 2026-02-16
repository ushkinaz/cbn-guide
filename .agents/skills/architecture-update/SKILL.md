---
name: architecture-update
description: Architectural Documentation Audit & Refresh
---

# Architectural Documentation Audit & Refresh

**Role:** You are a Principal Software Architect and Technical Writer acting as an auditor for the _Cataclysm: Bright Nights Guide_ project.

**Objective:** specific Review the current state of the codebase, infrastructure configurations, and live deployment to update the `architecture.md` document. Your goal is to ensure the documentation reflects the _actual_ system state, emphasizing High-Level Design (HLD) over implementation details.

## Phase 1: Discovery & Context Gathering

Before writing, you must scan the following resources to build a mental model of the system:

1. **Infrastructure & Deployment:**

- Analyze `.github/workflows/` to understand the CI/CD pipeline and data ingestion frequency.
- Analyze `wrangler.toml`, `public/_headers`, `public/_redirects` to understand hosting, headers, and edge configuration.
- Analyze `vite.config.ts` and `package.json` to understand the build process.

2. **Application Logic & State:**

- Review `src/` to understand the current component hierarchy and state management.
- Review PWA configuration to understand the offline/caching strategy.

3. **Historical Context:**

- Read `docs/adr/` to incorporate Architectural Decision Records (e.g., Tileset formats).
- Scan recent Git Commit History (last 3 months) to identify major refactors that may have drifted from the docs.

4. **Live Verification:**

- Access [https://cataclysmbn-guide.com/](https://cataclysmbn-guide.com/) to verify loading behavior, network requests (CDN interaction), and PWA installability.

## Phase 2: Analysis & Gap Detection

Compare your findings against the provided `architecture.md`. Identify:

- **Drift:** Where does the code diverge from the current diagrams?
- **Gaps:** Specifically look for missing information regarding:
- **Deployment:** How is the app hosted? (Cloudflare Pages, etc.).
- **External Communications:** Exact interactions with GitHub API (raw content), Transifex (i18n), and any other 3rd party APIs.
- **Caching & Content Delivery:** How are 30MB+ of JSON data and tilesets cached? How does the PWA handle version updates?.

- **Verbosity:** Identify sections that are too low-level (e.g., lists of class methods or variable names) and mark them for abstraction.

## Phase 3: Documentation Update Rules

Rewrite `architecture.md`. You may keep valid existing sections, but strictly adhere to these rules:

1. **Scope:** Focus on _High-Level Design_. Do not include code snippets unless absolutely necessary for architectural clarity.
2. **New Section - "Infrastructure & Deployment":** Detail the hosting provider, CDN usage, and edge rules.
3. **New Section - "Data & Caching Strategy":** Explain the "Single Source of Truth" pipeline (JSON ingestion) and the client-side caching strategy (IndexedDB/CacheAPI vs. Runtime memory).
4. **Diagrams:** Update or create Mermaid.js diagrams.

- _Constraint:_ Diagrams must be concise. Separate "Data Flow" from "Component Hierarchy."
- _Requirement:_ Ensure the C4 Context diagram accurately shows external systems (GitHub, Transifex, CDN).

5. **Integration of ADRs:** Briefly reference relevant Architectural Decision Records where appropriate (e.g., "Tilesets use WebP format per ADR-001 for performance").

## Phase 4: Output Deliverables

### Part 1: The Updated `architecture.md`

### Part 2: Structured Summary of Changes

At the very end of your response, provide a strictly structured summary of what was altered. Use the following format:

**Change Log:**

- **Added:** [List new sections or major concepts added, e.g., "Cloudflare Pages deployment details"]
- **Updated:** [List sections that were modified for accuracy, e.g., "Refined Data Pipeline diagram to show nightly vs. stable fetch"]
- **Removed:** [List implementation details removed, e.g., "Deleted specific method lists from CBNData class section"]
- **Drift Fixed:** [List specific discrepancies fixed between code and docs]
