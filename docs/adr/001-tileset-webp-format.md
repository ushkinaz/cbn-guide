# 1. Tileset WebP Format Migration

Date: 2026-01-09

## Status

Accepted

## Context

The tileset graphics have been migrated from PNG to WebP format on the data server to reduce file sizes and improve loading performance. However, the upstream tileset metadata files (`tile_config.json`) still reference `.png` file extensions, and we cannot modify these files as they come from the game repository.

This creates a mismatch:

- Server serves: `https://cbn-data.pages.dev/data/{version}/gfx/{tileset}/image.webp`
- Metadata references: `image.png`

We need a solution that:

1. Works with unmodified upstream tileset metadata
2. Correctly loads `.webp` files from the server
3. Ensures all downstream rendering components use the correct file extension

## Decision

We mutate the `chunk.file` property in `fetchJson` (src/tile-data.ts) to replace `.png` extensions with `.webp` before fetching and storing the tileset data.

```typescript
const filename = chunk.file.replace(/\.png$/, ".webp");
chunk.file = filename; // Mutate in place
const blob = await fetch(`${url}/${filename}`).then((b) => b.blob());
```

The mutation happens at the earliest point in the data pipeline, ensuring:

1. The fetch request uses the correct `.webp` URL
2. All downstream components (ItemSymbol.svelte, etc.) reference the correct filename when constructing `background-image` URLs
3. The tileset metadata cache contains the modified filenames

## Consequences

### Positive

- Single point of transformation - all downstream code works without modification
- Transparent to components that consume tileset data
- No changes needed to upstream metadata files
- Performance benefit from smaller WebP files

### Negative

- The mutation modifies the JSON object returned from the server
- Creates a divergence between server metadata and client state
- Future developers must understand this transformation exists

### Neutral

- If the server ever updates metadata to reference `.webp` directly, this will be a no-op (`.replace(/\.png$/, ".webp")` won't match)

- Implementation: [src/tile-data.ts](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/tile-data.ts#L13-L23)
- Downstream usage: [src/types/item/ItemSymbol.svelte](file:///Users/dmitry/Workspace/C-BN/cbn-guide/src/types/item/ItemSymbol.svelte#L107-L115)
- Related conversation: Initial implementation discussion 2026-01-09
