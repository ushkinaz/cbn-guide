# Architecture Overview

This document provides a high-level architectural overview of the cbn-guide application — "The Hitchhiker's Guide to Cataclysm: Bright Nights."

## System Context

```mermaid
C4Context
    title System Context Diagram

    Person(user, "Player", "Cataclysm: BN player looking up game information")

    System(guide, "CBN Guide", "Web application for browsing game data")

    System_Ext(bn_repo, "Cataclysm: BN", "Game repository with JSON data")
    System_Ext(cloudflare, "Cloudflare Pages", "Hosting & CDN")
    System_Ext(i18n, "Transifex", "Translation management")

    Rel(user, guide, "Browses items, recipes, monsters", "HTTPS")
    Rel(guide, bn_repo, "Extracts game data", "GitHub API")
    Rel(guide, cloudflare, "Deployed to", "CI/CD")
    Rel(guide, i18n, "Syncs translations", "API")
```

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Browser (SPA)"]
        App[App.svelte]
        Router[Routing Module]
        DataStore[CBNData Store]
        Components[UI Components]
        TileData[Tile Data]
    end

    subgraph Static["Static Assets (Cloudflare)"]
        HTML[index.html]
        JS[Bundle JS/CSS]
        GameData["/data/{version}/all.json"]
        Builds[builds.json]
        Tiles[Tileset Sprites]
        Langs[Language Files]
    end

    App --> Router
    App --> DataStore
    App --> Components
    Components --> TileData

    Router --> Builds
    DataStore --> GameData
    TileData --> Tiles
    App --> Langs

    style Client fill:#1a1a2e,stroke:#16213e,color:#eee
    style Static fill:#0f3460,stroke:#16213e,color:#eee
```

## Application Layers

```mermaid
flowchart LR
    subgraph Presentation["Presentation Layer"]
        direction TB
        AppSvelte[App.svelte]
        Thing[Thing.svelte]
        Catalog[Catalog.svelte]
        TypeViews[Type Views<br/>Item, Monster, Recipe...]
    end

    subgraph Business["Business Logic Layer"]
        direction TB
        DataTS[data.ts<br/>CBNData class]
        RoutingTS[routing.ts]
        ColorsTS[colors.ts]
        TypesTS[types.ts]
    end

    subgraph Data["Data Layer"]
        direction TB
        AllJSON[all.json<br/>~30MB game data]
        BuildsJSON[builds.json]
        TileSprites[Tile Sprites]
        LangFiles[i18n Files]
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
    participant App as App.svelte
    participant Routing as routing.ts
    participant Data as data.ts
    participant Server as Static Files

    Browser->>App: Page Load
    App->>Routing: initializeRouting()
    Routing->>Server: fetch(builds.json)
    Server-->>Routing: BuildInfo[]
    Routing->>Routing: Resolve version alias
    Routing-->>App: InitialAppState

    App->>Data: setVersion(resolvedVersion)
    Data->>Server: fetch(all.json)
    Server-->>Data: Raw game data (~30MB)
    Data->>Data: CBNData constructor<br/>(parse, index, flatten)
    Data-->>App: CBNData instance

    App->>App: Render UI with $data store
```

## Component Architecture

```mermaid
flowchart TB
    subgraph Root["Root"]
        App[App.svelte]
    end

    subgraph Layout["Layout Components"]
        Logo[Logo.svelte]
        Search[SearchResults.svelte]
        Loading[Loading.svelte]
        Error[ErrorBoundary.svelte]
    end

    subgraph Views["View Components"]
        Thing[Thing.svelte<br/>Dynamic type router]
        Catalog[Catalog.svelte]
        CategoryGrid[CategoryGrid.svelte]
    end

    subgraph Types["Type-Specific Views"]
        Item[Item.svelte]
        Monster[Monster.svelte]
        Recipe[Recipe.svelte]
        Mutation[Mutation.svelte]
        Bionic[Bionic.svelte]
        Vehicle[Vehicle.svelte]
        More[...30+ more types]
    end

    subgraph Shared["Shared Components"]
        ItemLink[ItemLink.svelte]
        Spoiler[Spoiler.svelte]
        LimitedList[LimitedList.svelte]
    end

    App --> Layout
    App --> Views
    Views --> Thing
    Thing --> Types
    Types --> Shared

    style Root fill:#1a1a2e,stroke:#e94560,color:#eee
    style Layout fill:#16213e,stroke:#0f3460,color:#eee
    style Views fill:#0f3460,stroke:#1a1a2e,color:#eee
    style Types fill:#533483,stroke:#0f3460,color:#eee
    style Shared fill:#2d4a3e,stroke:#1a2f26,color:#eee
```

## CBNData Class Structure

```mermaid
classDiagram
    class CBNData {
        -_raw: any[]
        -_byType: Map~string, any[]~
        -_byTypeById: Map~string, Map~string, any~~
        -_abstractsByType: Map~string, Map~string, any~~
        -_toolReplacements: Map~string, string[]~
        +constructor(raw: any[], build_number?: string)
        +byId(type, id): T
        +byIdMaybe(type, id): T | undefined
        +byType(type): T[]
        +abstractById(type, id): object
        +replacementTools(type): string[]
        +all(): SupportedTypeMapped[]
        +flatten(obj, type): T
        +allLoot(): Loot[]
        +itemByName(name): Item
    }

    class Translation {
        +str: string
        +str_pl?: string
        +str_sp?: string
        +ctxt?: string
    }

    class Item {
        +id: string
        +type: string
        +name: Translation
        +description: Translation
        +weight: string
        +volume: string
        +flags: string[]
    }

    class Monster {
        +id: string
        +type: string
        +name: Translation
        +hp: number
        +speed: number
        +melee_damage: DamageInstance[]
    }

    CBNData --> Item : manages
    CBNData --> Monster : manages
    Item --> Translation : uses
    Monster --> Translation : uses
```

## Text Rendering

Game data can include inline color tags like `<color_red>` or `<info>`. These
tags are stripped at the translation layer, so UI components should treat
translated strings as plain text and apply styling explicitly where needed.

## Routing System

```mermaid
flowchart TB
    subgraph URL["URL Structure"]
        direction LR
        Version["/{version}"]
        Type["/{type}"]
        Id["/{id}"]
        Query["?lang=&t="]
    end

    subgraph Resolution["Version Resolution"]
        ParseURL[Parse URL segments]
        CheckAlias{Is alias?}
        ResolveAlias[Resolve stable/nightly]
        ValidateVersion{Version exists?}
        PrependStable[Prepend /stable/]
        UseFallback[Use fallback version]
    end

    subgraph Navigation["Navigation Types"]
        HardNav[Hard Navigation<br/>Full page reload]
        SoftNav[SPA Navigation<br/>pushState/replaceState]
    end

    URL --> ParseURL
    ParseURL --> CheckAlias
    CheckAlias -->|Yes| ResolveAlias
    CheckAlias -->|No| ValidateVersion
    ResolveAlias --> ValidateVersion
    ValidateVersion -->|Yes| SoftNav
    ValidateVersion -->|No| PrependStable
    PrependStable --> HardNav

    style URL fill:#1a1a2e,stroke:#16213e,color:#eee
    style Resolution fill:#0f3460,stroke:#16213e,color:#eee
    style Navigation fill:#2d4a3e,stroke:#1a2f26,color:#eee
```

## Data Pipeline (CI/CD)

```mermaid
flowchart LR
    subgraph Source["Source"]
        BNRepo[Cataclysm: BN<br/>GitHub Repo]
        Releases[GitHub Releases]
    end

    subgraph Processing["Data Processing"]
        PullData[pull-data.mjs]
        GenCSS[gen-css.ts]
        GenSitemap[gen-sitemap.ts]
        FetchIcons[fetch-icons.ts]
    end

    subgraph Output["Build Output"]
        AllJSON[all.json per version]
        BuildsJSON[builds.json]
        ColorsCSS[game-palette.css]
        Sitemap[sitemap.xml]
        Sprites[Tile sprites]
    end

    subgraph Deploy["Deployment"]
        Cloudflare[Cloudflare Pages]
        CDN[Global CDN]
    end

    BNRepo --> PullData
    Releases --> PullData
    PullData --> AllJSON
    PullData --> BuildsJSON
    AllJSON --> GenCSS
    GenCSS --> ColorsCSS
    AllJSON --> GenSitemap
    GenSitemap --> Sitemap
    BNRepo --> FetchIcons
    FetchIcons --> Sprites

    AllJSON --> Cloudflare
    BuildsJSON --> Cloudflare
    ColorsCSS --> Cloudflare
    Sitemap --> Cloudflare
    Sprites --> Cloudflare
    Cloudflare --> CDN

    style Source fill:#4a3f2d,stroke:#2f2a1a,color:#eee
    style Processing fill:#2d4a3e,stroke:#1a2f26,color:#eee
    style Output fill:#3f2d4a,stroke:#2a1a2f,color:#eee
    style Deploy fill:#0f3460,stroke:#16213e,color:#eee
```

## Technology Stack

```mermaid
mindmap
    root((CBN Guide))
        Frontend
            Svelte 4
            TypeScript
            Vite
            Scoped CSS
        Data
            JSON Game Data
            copy-from Resolution
            i18n via Gettext
        Testing
            Vitest
            svelte-check
            Component Rendering Tests
        Tooling
            Prettier
            ESLint
            Husky
        Infrastructure
            Cloudflare Pages
            GitHub Actions CI
            Transifex
```

## File Structure Overview

```
cbn-guide/
├── src/
│   ├── App.svelte          # Main application component
│   ├── main.ts             # Entry point
│   ├── data.ts             # CBNData class & utilities
│   ├── routing.ts          # URL routing logic
│   ├── types.ts            # TypeScript type definitions
│   ├── colors.ts           # Game color palette handling
│   ├── tile-data.ts        # Tileset sprite management
│   ├── types/              # Type-specific components
│   │   ├── Item.svelte
│   │   ├── Monster.svelte
│   │   ├── Recipe.svelte
│   │   └── ...             # 30+ type views
│   └── assets/             # Static assets
├── public/
│   ├── game-palette.css    # Game color palette
│   ├── _headers            # Cloudflare headers config
│   ├── _redirects          # Cloudflare redirects
│   └── ...
├── scripts/                # Build & data processing scripts
├── docs/                   # Documentation
│   ├── adr/               # Architecture Decision Records
│   ├── routing.md         # Routing documentation
│   └── architecture.md    # This file
└── _test/                  # Test fixtures
```

## Key Design Decisions

| Decision                           | Rationale                                                  |
| ---------------------------------- | ---------------------------------------------------------- |
| **Singleton CBNData**              | ~30MB game data loaded once; immutable after construction  |
| **URL as state**                   | Single source of truth; enables deep linking & bookmarking |
| **Full reload for version change** | Different versions = completely different data files       |
| **SPA for item navigation**        | Fast browsing once data is loaded                          |
| **Scoped CSS**                     | Component isolation; no global class conflicts             |
| **copy-from flattening**           | Game data uses inheritance; resolved at parse time         |

## Related Documentation

- [Routing Architecture](./routing.md) — Detailed routing documentation
- [Reactivity Guide](./reactivity.md) — How reactivity works in this app
- [Development Guide](../DEVELOPMENT.md) — Development workflows
- [Architecture Decision Records](./adr/) — Design decision history
- [AGENTS.md](../AGENTS.md) — AI agent guidelines
