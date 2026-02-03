# Architecture Overview

This document provides a high-level architectural overview of the cbn-guide application — "The Hitchhiker's Guide to Cataclysm: Bright Nights."

## System Context

```mermaid
C4Context
    title System Context Diagram

    Person(user, "Player", "Cataclysm: BN player looking up game information")

    System(guide, "CBN Guide", "Web application for browsing game data")

    System_Ext(bn_repo, "Cataclysm: BN", "Game repository")
    System_Ext(data_server, "Data Server", "data.cataclysmbn-guide.com (JSON hosting)")
    System_Ext(cloudflare, "Cloudflare Pages", "Hosting & Edge Network")
    System_Ext(i18n, "Transifex", "Translation management")

    Rel(user, guide, "Browses items, recipes, monsters", "HTTPS")
    Rel(guide, data_server, "Fetches game data (runtime)", "HTTPS/JSON")
    Rel(guide, cloudflare, "Hosted on", "Pages")
    Rel(guide, i18n, "Syncs translations", "API")
```

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Browser (Single Page App)"]
        direction TB
        App[App.svelte]
        Router[Routing Module]
        DataStore[CBNData Store]
        Components[UI Components]
        TileData[Tile Data]
        ServiceWorker[Service Worker]
    end

    subgraph Infrastructure["Infrastructure"]
        HTML[index.html]
        Assets[Static Assets]
        Edge[Cloudflare Edge]
    end

    subgraph External["External Data Source"]
        GameData["/data/{version}/all.json"]
        Builds[builds.json]
        Tiles[Tileset Sprites]
        Langs[Language Files]
    end

    App --> Router
    App --> DataStore

    Router --> Builds
    DataStore --> GameData
    Components --> TileData
    TileData --> Tiles
    App --> Langs

    Client -- "Cached by" --> ServiceWorker
    ServiceWorker -- "Served from" --> Edge
    ServiceWorker -- "Fetches" --> External

    style Client fill:#1a1a2e,stroke:#16213e,color:#eee
    style Infrastructure fill:#0f3460,stroke:#16213e,color:#eee
    style External fill:#2d4a3e,stroke:#1a2f26,color:#eee
```

## Infrastructure & Deployment

The application is a purely static site (SPA) hosted on **Cloudflare Pages**.

- **Hosting**: Cloudflare Pages
- **Routing**: Client-side routing (SPA). Server-side routing rules configured via generic `_redirects` and `_headers`.
- **Configuration**:
  - `public/_headers`: Controls caching policies and preload headers.
  - `public/_redirects`: Manages version aliases (e.g., `/latest -> /nightly`) and legacy path redirections.
  - **Note**: No `wrangler.toml` is present; configuration is file-based or managed via Cloudflare Dashboard.
- **CI/CD**:
  - **GitHub Actions**: Runs tests (`pnpm test`), linting, and builds `dist` artifact for verification.
  - **Cloudflare Integration**: Automatically deploys the `dist` folder on push to `main` (via Cloudflare's git integration).

## Data & Caching Strategy

The application separates **Application Logic** (this repo) from **Game Data** (external).

### Source of Truth

All game data is hosted on `data.cataclysmbn-guide.com`. The app acts as a viewer for this external data.

### Runtime Caching (PWA)

We use `vite-plugin-pwa` (Workbox) to provide offline capability and efficient caching:

| Resource Type      | Pattern                   | Strategy                 | Rationale                                       |
| :----------------- | :------------------------ | :----------------------- | :---------------------------------------------- |
| **App Shell**      | `index.html`, `js`, `css` | **StaleWhileRevalidate** | Immediate load, update in background.           |
| **Build Index**    | `builds.json`             | **StaleWhileRevalidate** | Frequent updates, but stale is acceptable.      |
| **Nightly Data**   | `/data/nightly/*`         | **NetworkFirst**         | Nightly builds change daily; prefer fresh data. |
| **Stable Data**    | `/data/stable/*`          | **StaleWhileRevalidate** | Rarely changes.                                 |
| **Versioned Data** | `/data/v*`, `/data/20*`   | **CacheFirst**           | Immutable specific versions.                    |
| **Assets**         | Images, Fonts             | **CacheFirst**           | Long-term caching.                              |

### Data Generation (Development)

For local development and testing, scripts are used to fetch data snapshots:

- `fetch-fixtures.ts`: Downloads `all.json` to `_test/` for unit tests and local dev.
- `gen-sitemap.ts`: Fetches list of all items and generates `public/sitemap.xml`.
- `gen-css.ts`: Generates `public/game-palette.css` from `src/colors.ts` (Application defined colors).

## Application Layers

```mermaid
flowchart TD
    subgraph Presentation["Presentation Layer"]
        direction TB
        AppSvelte[App.svelte]
        Thing[Thing.svelte]
        Catalog[Catalog.svelte]
    end

    subgraph Business["Business Logic Layer"]
        direction TB
        DataTS[data.ts]
        RoutingTS[routing.ts]
        TileDataTS[tile-data.ts]
    end

    subgraph Data["Data Layer"]
        direction TB
        AllJSON[all.json<br/>external]
        BuildsJSON[builds.json<br/>external]
    end

    Presentation --> Business
    Business --> Data

    style Presentation fill:#2d4a3e,stroke:#1a2f26,color:#eee
    style Business fill:#4a3f2d,stroke:#2f2a1a,color:#eee
    style Data fill:#3f2d4a,stroke:#2a1a2f,color:#eee
```

## Core Data Flow

```mermaid
sequenceDiagram
    participant Browser
    participant SW as Service Worker
    participant App as App.svelte
    participant Data as data.ts
    participant Ext as data.cataclysmbn-guide.com

    Browser->>App: Page Load
    App->>App: Initialize Routing
    App->>SW: fetch(builds.json)
    SW->>Ext: Network/Cache Request
    Ext-->>App: BuildInfo[]

    App->>Data: setVersion(resolvedVersion)
    Data->>SW: fetch(/data/version/all.json)
    SW->>Ext: Network/Cache Request
    Ext-->>Data: Raw game data (~30MB)

    Data->>Data: CBNData constructor<br/>(parse, index, flatten)
    Data-->>App: Ready

    App->>App: Render UI
```

## Component Architecture

```mermaid
flowchart TB
    subgraph Root["Root"]
        App[App.svelte]
    end

    subgraph Layout["Layout"]
        Search[SearchResults.svelte]
        Loading[Loading.svelte]
    end

    subgraph Views["Views"]
        Thing[Thing.svelte]
        Catalog[Catalog.svelte]
    end

    subgraph Types["Types"]
        Item[Item.svelte]
        Monster[Monster.svelte]
        Recipe[Recipe.svelte]
    end

    App --> Layout
    App --> Views
    Views --> Thing
    Thing --> Types

    style Root fill:#1a1a2e,stroke:#e94560,color:#eee
    style Layout fill:#16213e,stroke:#0f3460,color:#eee
    style Views fill:#0f3460,stroke:#1a1a2e,color:#eee
    style Types fill:#533483,stroke:#0f3460,color:#eee
```

## CBNData Class Structure

```mermaid
classDiagram
    class CBNData {
        -_raw: any[]
        -_byType: Map
        -_byTypeById: Map
        +constructor(raw: any[])
        +byId(type, id): T
        +byType(type): T[]
        +flatten(obj, type): T
    }
```

## Routing System

The routing system manages state primarily via the URL, supporting both SPA navigation and hard reloads for version switches.

```mermaid
flowchart TB
    URL["/{version}/{type}/{id}"]
    Resolve["Resolve Version/Alias"]
    Nav{"Same Version?"}
    Soft["SPA Navigate"]
    Hard["Hard Reload"]

    URL --> Resolve
    Resolve --> Nav
    Nav -->|Yes| Soft
    Nav -->|No| Hard
```

## Development & Build Pipeline

```mermaid
flowchart TD
    subgraph Dev["Development"]
        Fetch["fetch-fixtures.ts<br/>(Download Test Data)"]
        GenCSS["gen-css.ts<br/>(Generate Palette)"]
    end

    subgraph Build["Build Process"]
        Vite["vite build"]
        SWGen["VitePWA<br/>(Generate SW)"]
        Output["dist/"]
    end

    Fetch -->|Used in| Dev
    GenCSS -->|Output to| Public["public/game-palette.css"]
    Public --> Vite
    Vite --> SWGen
    SWGen --> Output

    style Dev fill:#4a3f2d,stroke:#2f2a1a,color:#eee
    style Build fill:#2d4a3e,stroke:#1a2f26,color:#eee
```

## Technology Stack

- **Frontend**: Svelte 4, TypeScript, Vite
- **PWA**: vite-plugin-pwa, Workbox (Offline support)
- **Styling**: Scoped CSS, CSS Variables
- **Data**: External JSON (fetched runtime), copy-from inheritance, Transifex i18n
- **Infrastructure**: Cloudflare Pages
- **Testing**: Vitest, Puppeteer, svelte-check

## File Structure Overview

```
cbn-guide/
├── src/
│   ├── App.svelte          # Main application component
│   ├── data.ts             # CBNData class & utilities
│   ├── routing.ts          # URL routing logic
│   ├── tile-data.ts        # Tileset sprite management (ADR-001)
│   ├── assets/             # Static assets
│   └── ...
├── public/
│   ├── game-palette.css    # Generated game colors
│   ├── _headers            # Cloudflare headers config
│   ├── _redirects          # Cloudflare redirects
│   └── sitemap.xml         # Generated sitemap
├── scripts/
│   ├── fetch-fixtures.ts   # Fetch data for local dev/test
│   ├── gen-css.ts          # Generate CSS palette
│   └── gen-sitemap.ts      # Generate sitemap
├── docs/
│   ├── adr/                # Architecture Decision Records
│   └── architecture.md     # This file
└── _test/                  # Test fixtures (all.json)
```

## Related Documentation

- [Routing Architecture](./routing.md)
- [Reactivity Guide](./reactivity.md)
- [Development Guide](../DEVELOPMENT.md)
- [Architecture Decision Records](./adr/)
- [AGENTS.md](../AGENTS.md)
