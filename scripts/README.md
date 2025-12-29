# Build scripts

This folder contains build-only scripts for data processing and asset management.

For detailed documentation, parameters, and usage instructions for each script, please refer to the header comments within the respective files.

## Available Scripts

- **`fetch-icons.ts`** (`yarn fetch:icons`): Extracts and renders icons for game entities using a specified tileset.
- **`fetch-fixtures.ts`** (`yarn fetch:fixtures`): Fetches game data (`all.json`) for local development and testing.
- **`gen-css.ts`** (`yarn gen:css`): Generates CSS variables and classes based on CDDA color definitions.
- **`gen-sitemap.ts`** (`yarn gen:sitemap`): Generates a static `sitemap.xml` for the guide, including all supported game entities.
- **`gen-unifont.sh`** (`yarn gen:unifont`): Optimizes Unifont by creating a minimal subset for ASCII art and symbols.
