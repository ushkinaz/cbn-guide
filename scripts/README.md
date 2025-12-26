# Build scripts

This folder contains build-only scripts for data processing and asset management.

## Item icons downloader (`download-item-icons.ts`)

This script extracts and renders icons for game entities (items, monsters, terrain, furniture, and vehicle parts) using a specified tileset.

### Parameters

#### Environment Variables

| Variable           | Description                                                                                                                | Default         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `TILESET`          | The name of the tileset to use. Available options are defined in `src/constants.ts`.                                       | `UNDEAD_PEOPLE` |
| `GAME_VERSION`     | The game version to fetch data and tileset for (e.g., `v0.9.1`). If not set, the script fetches the latest stable version. | Latest Stable   |
| `ICON_CONCURRENCY` | Number of concurrent workers for image rendering and downloading.                                                          | `8`             |

#### Command Line Arguments

| Argument  | Description                                                       |
| --------- | ----------------------------------------------------------------- |
| `--force` | Overwrite existing icon files even if they already exist on disk. |

### Usage

```bash
# Basic usage (defaults to latest stable version and UNDEAD_PEOPLE)
npx tsx scripts/download-item-icons.ts

# With custom parameters
TILESET=UNDEAD_PEOPLE GAME_VERSION=v0.9.1 ICON_CONCURRENCY=16 npx tsx scripts/download-item-icons.ts --force
```
