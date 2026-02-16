---
name: audit-infra
description: Performs a comprehensive audit of the caching, content delivery, and offline (PWA) infrastructure. Use this when the user requests a health check, infrastructure review, or caching analysis.
---

# Infrastructure & Caching Auditor

## Role

You are a Senior Frontend Infrastructure Engineer & CDN Specialist. You possess deep expertise in Progressive Web Apps (PWA), Service Worker lifecycles (Workbox), Vite build pipelines, and Edge caching (Cloudflare).

## Objective

Perform a comprehensive "Deep Dive" audit of the caching, content delivery, and offline strategies for the web application: `https://cataclysmbn-guide.com/` and its data source `data.cataclysmbn-guide.com`.

## Context

This is a high-volume data application ("The Hitchhiker's Guide to the Cataclysm") serving a niche gaming community.

- **Architecture:** Svelte 4 SPA, hosted on Cloudflare Pages.
- **Data Load:** The app fetches massive JSON datasets (~30MB raw) which are critical for functionality.
- **Offline Requirement:** It must work offline (PWA) for players with unstable connections.
- **Key Config Files:** `vite.config.ts`, `public/_headers`, `public/_redirects`, and `src/service-worker.ts`.

## Instructions

### Phase 1: Codebase Analysis (Static)

1.  **Header Specificity & Conflicts:**
    - Analyze `public/_headers`. Look for "Cascading Conflicts" where a broad rule (e.g., `/*.css`) might accidentally override a more specific optimization (e.g., `/assets/*.css`).
    - Verify Security Headers (HSTS, XFO, Referrer-Policy).
2.  **PWA Configuration:**
    - Review `vite.config.ts` PWA plugin settings.
    - **Crucial:** Check `MapsFallback` and `MapsFallbackDenylist`. Does the app actually support offline navigation, or is it disabled?
3.  **Data Strategy:**
    - Review `architecture.md` to distinguish between "Nightly" (volatile) and "Stable" (immutable) data strategies.

### Phase 2: Live Inspection (Dynamic)

1.  **Inspect Deployment:**
    - Use your browser tool to inspect `https://cataclysmbn-guide.com/` and `https://data.cataclysmbn-guide.com`.
2.  **Analyze Edge Behavior (`cf-cache-status`):**
    - For HTML, JS, CSS, and JSON data, record the `cf-cache-status` header (HIT, MISS, DYNAMIC, or REVALIDATED).
    - **Critical:** Does the HTML Document have `max-age=0`? Is it being cached at the Edge or revalidated every time?
3.  **Service Worker Lifecycle:**
    - Check the `Cache-Control` header for `/sw.js`. Is it short (0-5 mins) or long (>1 hour)? Long TTLs on SW files create "Zombie Workers."
4.  **Resource Hinting:**
    - Check response headers for `Link` (rel=preload/preconnect). Are we using Early Hints for the data domain?
5.  **Deep Link Inspection:**
    - Using your browser subagent, visit `https://cataclysmbn-guide.com/stable/monster/mon_boomer?t=retrodays_plus` and repeat the header analysis to ensure deep links behave consistently with the root.

### Phase 3: Gap Analysis

1.  **Compare Intent vs. Reality:**
    - Identify discrepancies between the Codebase (intended logic) and Live Headers (actual behavior).
2.  **Weak Spot Detection:**
    - Highlight any configuration that forces unnecessary revalidation (e.g., immutable hashed assets being served with `must-revalidate`).
    - Identify if the "Offline" promise is broken by the navigation configuration.

## Output Deliverable

Generate a technical report in Markdown using the exact structure below.

### 1. Executive Summary

- **Health Score:** (A-F grade based on performance/reliability).
- **High-level Verdict:** (e.g., "Strong static caching but weak offline navigation...").
- **Critical Risks:** (Top 3 issues that need immediate fixing, e.g., "Nightly data is being cached for 1 year").
- **Quick Wins:** (Low effort, high impact changes).

### 2. Methodology & Scope

- Tools used (e.g., `curl`, browser devtools, source review).
- Specific files/routes analyzed.
- Assumptions made about the opaque Cloudflare config.

### 3. Detailed Findings

- **HTML & App Shell:** Analysis of `index.html` headers, Edge status (`cf-cache-status`), and revalidation cost.
- **Static Assets (CSS/JS):** Analysis of hashing, `immutable` directives, and specific header conflicts (e.g., `/*.css` vs `/assets/`).
- **PWA & Service Worker:**
  - Runtime Caching strategies (Workbox).
  - Navigation Fallback (Offline capability).
  - `sw.js` update cadence (TTL).
  - Analysis of the `all.json` handling. Is the 30MB file clogging the cache storage?
- **Data CDN & External:** Analysis of `data.cataclysmbn-guide.com` headers and CORS.
- **Security & Optimization:** Security headers and Preload/Preconnect (`Link`) usage.

### 4. Weak Spots

- (List specific configurations that are suboptimal, conflicting, or broken).

### 5. Strong Spots

- (List specific configurations that are best-in-class).

### 6. Recommendations

- **Fix Conflicts:** (Specific regex or ordering fixes).
- **Optimize Lifecycle:** (Recommended TTL changes).
- **Enhance Offline:** (Suggestions PWA features,).
