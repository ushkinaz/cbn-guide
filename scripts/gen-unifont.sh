#!/bin/sh

# gen-unifont.sh
#
# This script optimizes the Unifont usage by creating a minimal subset containing only
# the characters used in the game's ASCII art and common UI symbols.
#
# FEATURES:
# 1. Self-Contained: Downloads the source WOFF2 from unpkg if not found in .cache/fonts.
# 2. Dynamic Extraction: Uses jq to crawl _test/all.json for characters in 'ascii_art' 
#    and 'sym/symbol' fields.
# 3. Future-Proof: Includes safety ranges for Box Drawing, Block Elements, and Greek.
# 4. Tracking: Saves the used character list to scripts/unifont-chars.txt for git history.
# 5. Verification: Use --verify to check if current game data requires regeneration (CI ready).
#
# USAGE:
#   sh scripts/gen-unifont.sh          # Regenerate subset and tracking file
#   sh scripts/gen-unifont.sh --verify # Check if subset covers current data
#
# DEPENDENCIES:
#   - pyftsubset (from fonttools python package)
#   - brotli (python package for WOFF2 support)
#   - jq
#   - curl

# --- Configuration ---
SOURCE_URL="https://unpkg.com/@fontsource/unifont@5.2.5/files/unifont-latin-400-normal.woff2"
CACHE_DIR=".cache/fonts"
INPUT_FONT="$CACHE_DIR/unifont-latin-400-normal.woff2"
OUTPUT_FONT="src/assets/unifont-subset.woff2"
CHARS_FILE="scripts/unifont-chars.txt"
DATA_FILE="_test/all.json"

# --- Modes ---
VERIFY_MODE=false
if [ "$1" = "--verify" ]; then
    VERIFY_MODE=true
fi

# --- Functions ---

# 1. Ensure source font exists
ensure_source_font() {
    if [ ! -f "$INPUT_FONT" ]; then
        echo "Source font missing in $INPUT_FONT. Downloading from unpkg..."
        mkdir -p "$CACHE_DIR"
        curl -fSL "$SOURCE_URL" -o "$INPUT_FONT" || { echo "Failed to download source font"; exit 1; }
    fi
}

# 2. Extract current characters from data
get_data_chars() {
    # Base set (ASCII + Common Logo)
    BASE=" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_\`abcdefghijklmnopqrstuvwxyz{|}~"
    
    if [ ! -f "$DATA_FILE" ]; then
        echo "Warning: $DATA_FILE not found."
        printf "%s" "$BASE"
        return
    fi

    # Extract dynamic characters
    DATA_CHARS=$(cat "$DATA_FILE" | jq -r '.data[] | select(.type? == "ascii_art") | .picture[]?' | sed 's/./&\n/g' | sort -u | tr -d '\n')
    DATA_SYMBOLS=$(cat "$DATA_FILE" | jq -r '.data[] | (.. | objects | select(.sym? or .symbol?) | .sym // .symbol | select(type == "string"))' | sed 's/./&\n/g' | sort -u | tr -d '\n')
    
    # Combined and deduplicated list
    printf "%s" "${BASE}${DATA_CHARS}${DATA_SYMBOLS}" | sed 's/./&\n/g' | sort -u | tr -d '\n'
}

# --- Main Logic ---

if [ "$VERIFY_MODE" = true ]; then
    echo "Verifying font subset consistency..."
    echo "1/2: Extracting current characters from $DATA_FILE..."
    CURRENT_DATA_CHARS=$(get_data_chars)
    
    if [ ! -f "$CHARS_FILE" ]; then
        echo "Error: $CHARS_FILE missing. Run 'yarn gen:unifont' to create it."
        exit 1
    fi
    
    echo "2/2: Comparing against $CHARS_FILE..."
    TRACKED_CHARS=$(cat "$CHARS_FILE")
    
    # Check if any character in CURRENT_DATA_CHARS is NOT in TRACKED_CHARS
    # Using python for reliable character comparison
    MISSING_CHARS=$(python3 -c "import sys; c = set('$CURRENT_DATA_CHARS'); t = set('$TRACKED_CHARS'); diff = c - t; print(''.join(sorted(diff)))" 2>/dev/null)
    
    if [ -n "$MISSING_CHARS" ]; then
        echo "Error: New characters found in game data! They are not covered by the current subset."
        echo "Missing characters: $MISSING_CHARS"
        echo "Please run 'yarn gen:unifont' to update the font subset."
        exit 1
    else
        echo "Verification successful: All characters are covered."
        exit 0
    fi
else
    # GENERATE MODE
    echo "Starting font subset generation..."
    
    echo "1/3: Extracting unique characters from $DATA_FILE..."
    CURRENT_DATA_CHARS=$(get_data_chars)
    
    echo "2/3: Managing source assets..."
    ensure_source_font
    
    # Save tracked characters
    printf "%s" "$CURRENT_DATA_CHARS" > "$CHARS_FILE"
    echo "Updated $CHARS_FILE"

    echo "3/3: Subsetting font (this may take a minute)..."
    # Note: Requires 'brotli' python package for WOFF2 output
    pyftsubset "$INPUT_FONT" \
        --text="$CURRENT_DATA_CHARS" \
        --unicodes="U+2500-26FF,U+0370-03FF" \
        --flavor=woff2 \
        --verbose \
        --output-file="$OUTPUT_FONT"

    echo "Done! Subsetted font created at $OUTPUT_FONT"
    ls -lh "$OUTPUT_FONT"
fi



