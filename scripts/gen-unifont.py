#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
gen-unifont.py

This script optimizes the Unifont usage by creating a minimal subset containing only
the characters used in the game's ASCII art and common UI symbols.

FEATURES:
1. Self-Contained: Downloads the source WOFF2 from unpkg if not found in .cache/fonts.
2. Dynamic Extraction: Crawls _test/all.json for characters in 'ascii_art' and 'sym/symbol' fields.
3. Future-Proof: Includes safety ranges for Box Drawing, Block Elements, and Greek.
4. Tracking: Saves the used character list to scripts/unifont-chars.txt for git history.
5. Verification: Use --verify to check if current game data requires regeneration (CI ready).

USAGE:
  python3 scripts/gen-unifont.py          # Regenerate subset and tracking file
  python3 scripts/gen-unifont.py --verify # Check if subset covers current data

DEPENDENCIES:
  - fonttools (Python package) -> pip install fonttools
  - brotli (Python package, needed for WOFF2) -> pip install brotli

NOTES:
- This script attempts HTTPS download using the system CA bundle or certifi if installed.
  If you encounter SSL errors, try: python3 -m pip install certifi
- You can manually download the font and place it at .cache/fonts/unifont-latin-400-normal.woff2
  from: https://unpkg.com/@fontsource/unifont@5.2.5/files/unifont-latin-400-normal.woff2
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Set
from urllib.request import urlopen, Request

# --- Configuration ---
SOURCE_URL = "https://unpkg.com/@fontsource/unifont@5.2.5/files/unifont-latin-400-normal.woff2"

# Resolve repository root (parent of this script's directory)
REPO_ROOT = Path(__file__).resolve().parents[1]

CACHE_DIR = REPO_ROOT / ".cache" / "fonts"
INPUT_FONT = CACHE_DIR / "unifont-latin-400-normal.woff2"
OUTPUT_FONT = REPO_ROOT / "src" / "assets" / "unifont-subset.woff2"
CHARS_FILE = REPO_ROOT / "scripts" / "unifont-chars.txt"
DATA_FILE = REPO_ROOT / "_test" / "all.json"

# Safety ranges (Box Drawing, Block Elements, Misc Symbols, Dingbats, etc., and Greek)
# Matches the shell script: --unicodes="U+2500-26FF,U+0370-03FF"
UNICODE_RANGES = "U+2500-26FF,U+0370-03FF"


def rel(path: Path) -> str:
    """Return a REPO_ROOT-relative string for display."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except Exception:
        return str(path)


def ensure_source_font() -> None:
    """
    Ensure the source Unifont WOFF2 exists in cache; download if missing.

    Uses Python's SSL context and certifi (if installed) for TLS verification.
    """
    if INPUT_FONT.is_file():
        return
    print(f"Source font missing in {rel(INPUT_FONT)}. Downloading from unpkg...")

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    try:
        import ssl  # type: ignore
        try:
            import certifi  # type: ignore
            cafile = certifi.where()
        except Exception:
            cafile = None

        req = Request(SOURCE_URL, headers={"User-Agent": "gen-unifont.py"})
        context = ssl.create_default_context(cafile=cafile) if cafile else ssl.create_default_context()
        with urlopen(req, context=context) as resp, open(INPUT_FONT, "wb") as out:
            shutil.copyfileobj(resp, out)
    except Exception as e:
        print("Failed to download source font:", e)
        sys.exit(1)


def ascii_base_chars() -> str:
    """Return base set of printable ASCII (space 32 to tilde 126)."""
    return "".join(chr(c) for c in range(32, 127))


def iter_objects(value: Any) -> Iterable[Dict[str, Any]]:
    """Recursively yield all dict objects within the provided JSON value."""
    if isinstance(value, dict):
        yield value
        for v in value.values():
            yield from iter_objects(v)
    elif isinstance(value, list):
        for item in value:
            yield from iter_objects(item)


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_data_chars(data_root: Any) -> Set[str]:
    """
    Extract characters from the game data JSON:
    - ASCII art: items where type == "ascii_art", from each string in picture[]
    - Symbols: any 'sym' or 'symbol' string values anywhere under data items
    """
    chars: Set[str] = set()

    # Base ASCII characters
    chars.update(ascii_base_chars())

    # If JSON doesn't match expected structure, just return base
    if not isinstance(data_root, dict):
        return chars

    data_items = data_root.get("data")
    if not isinstance(data_items, list):
        return chars

    # 1) ASCII art pictures
    for item in data_items:
        if isinstance(item, dict) and item.get("type") == "ascii_art":
            pic = item.get("picture")
            if isinstance(pic, list):
                for row in pic:
                    if isinstance(row, str):
                        chars.update(row)

    # 2) Symbols anywhere: keys "sym" or "symbol"
    for item in data_items:
        for obj in iter_objects(item):
            for k in ("sym", "symbol"):
                v = obj.get(k)
                if isinstance(v, str):
                    chars.update(v)

    return chars


def get_data_chars() -> str:
    """
    Compute the current character set needed for the game data.
    - If DATA_FILE is missing, return base ASCII set only (and warn).
    - Otherwise parse and combine sets, deduplicate and sort by codepoint.
    """
    if not DATA_FILE.is_file():
        print(f"Warning: {rel(DATA_FILE)} not found.")
        chars = set(ascii_base_chars())
    else:
        try:
            data = load_json(DATA_FILE)
        except Exception as e:
            print(f"Warning: failed to read {rel(DATA_FILE)}: {e}")
            data = {}
        chars = extract_data_chars(data)

    # Deduplicate and sort by code point
    return "".join(sorted(chars, key=ord))


def human_size(num_bytes: int) -> str:
    """Return a human-readable byte size string."""
    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024.0 or unit == units[-1]:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{num_bytes} B"


def run_pyftsubset(input_font: Path, chars_text: str, output_font: Path) -> None:
    """
    Create a WOFF2 subset using the fontTools Python API (no external CLI call),
    including the given characters and extended safety unicode ranges.
    """
    # Ensure output directory exists
    output_font.parent.mkdir(parents=True, exist_ok=True)

    try:
        from fontTools import subset as ft_subset  # type: ignore
    except Exception:
        print("Error: 'fonttools' is required. Install with: pip install fonttools brotli")
        sys.exit(1)

    # Parse safety ranges into code points
    try:
        range_codepoints = ft_subset.parse_unicodes(UNICODE_RANGES)
    except Exception:
        range_codepoints = []

    try:
        options = ft_subset.Options()
        options.flavor = "woff2"
        options.verbose = True

        # Load font
        font = ft_subset.load_font(str(input_font), options)

        # Populate and subset
        subsetter = ft_subset.Subsetter(options=options)
        subsetter.populate(text=chars_text, unicodes=range_codepoints)
        subsetter.subset(font)

        # Save result
        ft_subset.save_font(font, str(output_font), options)
    except Exception as e:
        print("Font subsetting failed via fontTools API:", e)
        print("Make sure 'fonttools' and 'brotli' are installed and the input font is valid.")
        sys.exit(1)


def verify_mode() -> int:
    """Verify that the tracked character set covers the current game data."""
    print("Verifying font subset consistency...")
    print(f"1/2: Extracting current characters from {rel(DATA_FILE)}...")
    current_data_chars = get_data_chars()

    if not CHARS_FILE.is_file():
        print(f"Error: {rel(CHARS_FILE)} missing. Run 'pnpm gen:unifont' to create it.")
        return 1

    print(f"2/2: Comparing against {rel(CHARS_FILE)}...")
    tracked_chars = CHARS_FILE.read_text(encoding="utf-8")

    missing = sorted(set(current_data_chars) - set(tracked_chars), key=ord)
    if missing:
        missing_str = "".join(missing)
        print("Error: New characters found in game data! They are not covered by the current subset.")
        print(f"Missing characters: {missing_str}")
        print("Please run 'pnpm gen:unifont' to update the font subset.")
        return 1
    else:
        print("Verification successful: All characters are covered.")
        return 0


def generate_mode() -> int:
    """Generate the subsetted font and update the tracked character file."""
    print("Starting font subset generation...")

    print(f"1/3: Extracting unique characters from {rel(DATA_FILE)}...")
    current_data_chars = get_data_chars()

    print("2/3: Managing source assets...")
    ensure_source_font()

    # Save tracked characters (no trailing newline to match shell behavior)
    CHARS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CHARS_FILE, "w", encoding="utf-8", newline="") as f:
        f.write(current_data_chars)
    print(f"Updated {rel(CHARS_FILE)}")

    print("3/3: Subsetting font (this may take a minute)...")
    run_pyftsubset(INPUT_FONT, current_data_chars, OUTPUT_FONT)

    print(f"Done! Subsetted font created at {rel(OUTPUT_FONT)}")
    try:
        size = OUTPUT_FONT.stat().st_size
        print(f"Output size: {human_size(size)}")
    except OSError:
        pass

    return 0


def main(argv: List[str]) -> int:
    """Entry point for CLI usage."""
    parser = argparse.ArgumentParser(description="Generate or verify a subset of Unifont used by the app.")
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Verify if current game data requires regeneration of the font subset.",
    )
    args = parser.parse_args(argv)

    if args.verify:
        return verify_mode()
    else:
        return generate_mode()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
