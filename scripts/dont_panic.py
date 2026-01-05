#!/usr/bin/env python3
"""
Generates "Don't Panic" ASCII art using Cataclysm: BN tiles.
Usage: python dont_panic.py <tileset_root> [output_base_name]
Produces 5 randomized PNG variations and a legend in ./tmp/
"""

import json
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from PIL import Image, ImageDraw, ImageFont
import sys

# ==========================================
# CONFIGURATION CONSTANTS
# ==========================================

# Grid / Density
GRID_CELL_SIZE = 28  # Cell size in final image (approx 50% overlap)
TILE_SIZE = 32       # Input tile scale

# Randomness
RANDOM_ROTATION_MAX = 15  # Max rotation degrees
RANDOM_OFFSET_X = 4       # Max horizontal jitter
RANDOM_OFFSET_Y = 2       # Max vertical jitter

# Background
BG_TRANSPARENT = True   # Transparent canvas
BG_COLOR = "#121212"    # Solid color fallback

# Sprite Background & Border
SPRITE_BG_COLOR = "#FFFFFF"     # Tile base color
SPRITE_BORDER_COLOR = "#0A0A0A" # Tile outline color
SPRITE_BORDER_WIDTH = 1         # Outline thickness
SPRITE_BG_PADDING = 0           # Space between sprite and border

# Layout
LETTER_THICKNESS_HORIZONTAL = 0
LETTER_THICKNESS_VERTICAL = 0
PADDING = 48                    # Canvas margin (3rem)

ITEMS = [
    ("mon_zombie_gasbag_fungus", 1),
    ("mon_creeper_hub", 1),
    ("mon_zombie_gasbag", 2),
    ("mon_fungaloid", 1),
    ("mon_human_snail", 0),
    ("mon_molebot", 0),
    ("mon_gator", 2),
    ("mon_zombie_grappler", 2),
    ("mon_zombie", 10),
    ("mon_zombie_fat", 8),
    ("mon_zombie_tough", 8),
    ("mon_zombie_runner", 5),
    ("mon_zombie_acidic", 3),
    ("mon_zombie_ears", 3),
    ("mon_zombie_soldier", 5),
    ("mon_zombie_spitter", 3),
    ("mon_zombie_prisoner", 2),
    ("mon_zombie_survivor", 2),
    ("mon_zombie_soldier_acid_1", 2),
    ("mon_zombie_soldier_acid_2", 2),
    ("mon_skeleton_brute", 1),

    ("jar_3l_glass", 1),
    ("bio_ads", 1),
    ("heavy_plus_battery_cell", 0),
    ("tuba", 0),
    ("american_180", 0),
    ("voltmeter", 0),
    ("towel", 2), # Essential!
    ("helmet_motor", 0),
    ("guidebook", 1),
]

# Simple grayish terrains for layer 2
TERRAINS = [
    "t_sidewalk",
    "t_concrete",
    "t_sidewalk_bg_dp",
    "t_clay",
    "t_railroad_rubble",
    "t_rock_green",
    "t_grass_long",
    "t_moss",
    "t_moss",
    "t_dirtfloor_no_roof",
    "t_grass",
    "t_floor_resin",

]

# ==========================================
# FONT DEFINITION (7x5 Bold) - Normalized to 5 chars width
# ==========================================
LETTERS: Dict[str, List[str]] = {
    "D": ["XXXX ", "X   X", "X   X", "X   X", "X   X", "X   X", "XXXX "],
    "O": [" XXX ", "X   X", "X   X", "X   X", "X   X", "X   X", " XXX "],
    "N": ["X   X", "XX  X", "XX  X", "X X X", "X  XX", "X  XX", "X   X"],
    "T": ["XXXXX", "  X  ", "  X  ", "  X  ", "  X  ", "  X  ", "  X  "],
    "P": ["XXXX ", "X   X", "X   X", "XXXX ", "X    ", "X    ", "X    "],
    "A": [" XXX ", "X   X", "X   X", "XXXXX", "X   X", "X   X", "X   X"],
    "I": ["XXXXX", "  X  ", "  X  ", "  X  ", "  X  ", "  X  ", "XXXXX"],
    "C": [" XXX ", "X   X", "X    ", "X    ", "X    ", "X   X", " XXX "],
    "'": ["X    ", " X   ", " X   ", "     ", "     ", "     ", "     "],
    " ": ["     ", "     ", "     ", "     ", "     ", "     ", "     "],
}

# Letter spacing - number of empty cells between letters
LETTER_SPACING = 1


@dataclass
class CellData:
    """Metadata for a single grid cell."""
    item_id: str
    terrain_id: str
    rotation: float
    flip_h: bool
    offset_x: float
    offset_y: float


@dataclass
class TilePosition:
    file: str
    tx: int
    ty: int
    width: int
    height: int
    offx: int
    offy: int


@dataclass
class TileInfo:
    fg: Optional[TilePosition]
    bg: Optional[TilePosition]


class TileDataLoader:
    """Loads and provides access to tileset data."""

    def __init__(self, tileset_json_path: str, tiles_base_path: str):
        self.tiles_base_path = Path(tiles_base_path)

        with open(tileset_json_path, 'r') as f:
            self.tileset_data = json.load(f)

        self.tile_info = self.tileset_data['tile_info'][0]
        self.tile_width = self.tile_info['width']
        self.tile_height = self.tile_info['height']
        self.pixelscale = self.tile_info.get('pixelscale', 1)

        # Cache loaded images
        self.image_cache: Dict[str, Image.Image] = {}

    def _get_chunk_dimensions(self, chunk: dict) -> Tuple[int, int]:
        """Get or calculate nx/ny dimensions for a chunk."""
        # If nx/ny are provided, use them
        if 'nx' in chunk and 'ny' in chunk:
            return chunk['nx'], chunk['ny']

        # Otherwise, calculate from the image file
        if 'file' not in chunk:
            return 1, 1  # Fallback for chunks without files

        img_path = self.tiles_base_path / chunk['file']
        if not img_path.exists():
            print(f"Warning: Cannot calculate dimensions, file not found: {img_path}")
            return 1, 1

        # Load image to get dimensions
        if chunk['file'] not in self.image_cache:
            self.image_cache[chunk['file']] = Image.open(img_path).convert('RGBA')

        img = self.image_cache[chunk['file']]
        tile_width = chunk.get('sprite_width', self.tile_width)
        tile_height = chunk.get('sprite_height', self.tile_height)

        nx = img.width // tile_width
        ny = img.height // tile_height

        return nx, ny

    def find_tile(self, item_id: str) -> Optional[TileInfo]:
        """Find tile information for an item ID."""
        offset = 0
        ranges = []

        for chunk in self.tileset_data['tiles-new']:
            nx, ny = self._get_chunk_dimensions(chunk)
            ranges.append({
                'from': offset,
                'to': offset + nx * ny,
                'chunk': chunk,
                'nx': nx,
                'ny': ny
            })
            offset += nx * ny

        def find_range(tile_id: int):
            for r in ranges:
                if r['from'] <= tile_id < r['to']:
                    return r
            return None

        def tile_info_for_id(tile_id: Optional[int]) -> Optional[TilePosition]:
            if tile_id is None:
                return None

            tile_range = find_range(tile_id)
            if not tile_range:
                return None

            chunk = tile_range['chunk']
            nx = tile_range['nx']
            ny = tile_range['ny']
            offset_in_file = tile_id - tile_range['from']
            tx = offset_in_file % nx
            ty = offset_in_file // nx

            return TilePosition(
                file=chunk['file'],
                width=chunk.get('sprite_width', self.tile_width),
                height=chunk.get('sprite_height', self.tile_height),
                offx=chunk.get('sprite_offset_x', 0),
                offy=chunk.get('sprite_offset_y', 0),
                tx=tx,
                ty=ty
            )

        # Search for the item ID in chunks
        for chunk in self.tileset_data['tiles-new']:
            for tile_entry in chunk.get('tiles', []):
                tile_ids = tile_entry.get('id', [])
                if not isinstance(tile_ids, list):
                    tile_ids = [tile_ids]

                if item_id in tile_ids:
                    fg = tile_entry.get('fg')
                    bg = tile_entry.get('bg')

                    # Handle arrays
                    if isinstance(fg, list):
                        fg = fg[0] if fg else None
                    if isinstance(bg, list):
                        bg = bg[0] if bg else None

                    # Handle sprite objects
                    if isinstance(fg, dict):
                        fg = fg.get('sprite')
                    if isinstance(bg, dict):
                        bg = bg.get('sprite')

                    return TileInfo(
                        fg=tile_info_for_id(fg),
                        bg=tile_info_for_id(bg)
                    )

        return None

    def get_tile_image(self, tile_pos: TilePosition) -> Image.Image:
        """Extract a single tile from a spritesheet."""
        if tile_pos.file not in self.image_cache:
            img_path = self.tiles_base_path / tile_pos.file
            if not img_path.exists():
                print(f"Warning: Tile file not found: {img_path}")
                # Create a placeholder
                self.image_cache[tile_pos.file] = Image.new('RGBA', (32, 32), (255, 0, 255, 255))
            else:
                self.image_cache[tile_pos.file] = Image.open(img_path).convert('RGBA')

        spritesheet = self.image_cache[tile_pos.file]

        # Extract the tile
        x = tile_pos.tx * tile_pos.width
        y = tile_pos.ty * tile_pos.height

        tile = spritesheet.crop((
            x,
            y,
            x + tile_pos.width,
            y + tile_pos.height
        ))

        return tile


_PICK_CACHE = {}

def pick_item() -> str:
    """Pick a random item from the items list based on weights."""
    if "ids" not in _PICK_CACHE:
        item_ids = []
        weights = []
        for item in ITEMS:
            if isinstance(item, (tuple, list)):
                item_ids.append(item[0])
                weights.append(item[1])
            else:
                item_ids.append(item)
                weights.append(1)
        _PICK_CACHE["ids"] = item_ids
        _PICK_CACHE["weights"] = weights
    
    return random.choices(_PICK_CACHE["ids"], weights=_PICK_CACHE["weights"], k=1)[0]


def expand_pattern(pattern: List[str], h_expand: int, v_expand: int) -> List[str]:
    """Expand or contract a letter pattern for thickness control."""
    if h_expand == 0 and v_expand == 0:
        return pattern

    # Vertical expansion - duplicate rows
    expanded = []
    for row in pattern:
        expanded.append(row)
        if v_expand > 0:
            for _ in range(v_expand):
                expanded.append(row)

    # Remove rows for negative vertical expansion
    if v_expand < 0:
        step = max(1, int(1 / (1 + abs(v_expand))))
        expanded = [expanded[i] for i in range(0, len(expanded), step + 1)]

    # Horizontal expansion - expand each character
    if h_expand != 0:
        result = []
        for row in expanded:
            new_row = ""
            for char in row:
                if h_expand > 0:
                    new_row += char * (1 + h_expand)
                else:
                    # Thin out characters
                    new_row += char
            result.append(new_row)
        expanded = result

    return expanded


def build_grid(text: str) -> List[List[Optional[CellData]]]:
    """Build a grid of cells for the given text."""
    # Apply thickness transformations to all letters
    adjusted_letters = {}
    for letter, pattern in LETTERS.items():
        adjusted_letters[letter] = expand_pattern(
            pattern,
            LETTER_THICKNESS_HORIZONTAL,
            LETTER_THICKNESS_VERTICAL
        )

    rows = max(len(pattern) for pattern in adjusted_letters.values())
    grid: List[List[Optional[CellData]]] = [[] for _ in range(rows)]

    for char_idx, char in enumerate(text):
        pattern = adjusted_letters.get(char, adjusted_letters[' '])

        for r in range(rows):
            row_pattern = pattern[r] if r < len(pattern) else '     '

            for c in row_pattern:
                if c != ' ':
                    grid[r].append(CellData(
                        item_id=pick_item(),
                        terrain_id=random.choice(TERRAINS),
                        rotation=random.uniform(0, RANDOM_ROTATION_MAX),
                        flip_h=random.choice([True, False]),
                        offset_x=(random.random() - 0.5) * RANDOM_OFFSET_X,
                        offset_y=(random.random() - 0.5) * RANDOM_OFFSET_Y
                    ))
                else:
                    grid[r].append(None)

            # Add spacing between letters (but not after the last letter)
            if char_idx < len(text) - 1:
                for _ in range(LETTER_SPACING):
                    grid[r].append(None)

    return grid


def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert hex color to RGB tuple."""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


def render_dont_panic(tile_loader: TileDataLoader, output_path: str, word1: str = "DON'T", word2: str = "PANIC"):
    """
    Renders layered tiles into a single canvas.
    Layers: 1.Solid BG -> 2.Terrain -> 3.Monster -> 4.Outline.
    """

    # Build grids
    grid1 = build_grid(word1)
    grid2 = build_grid(word2)
    grids = [grid1, grid2]

    # Calculate image dimensions
    max_cols = max(len(row) for grid in grids for row in grid)
    total_rows = sum(len(grid) for grid in grids)

    # Add spacing between words (increased from 20px)
    word_spacing = 40  # Vertical spacing between DONT and PANIC

    img_width = max_cols * GRID_CELL_SIZE + 2 * PADDING
    img_height = total_rows * GRID_CELL_SIZE + word_spacing + 2 * PADDING

    # Create image with background
    if BG_TRANSPARENT:
        img = Image.new('RGBA', (img_width, img_height), (0, 0, 0, 0))
    else:
        bg_rgb = hex_to_rgb(BG_COLOR)
        img = Image.new('RGBA', (img_width, img_height), bg_rgb + (255,))

    # Render each grid
    y_offset = PADDING

    for grid_idx, grid in enumerate(grids):
        for row_idx, row in enumerate(grid):
            x_offset = PADDING

            for cell in row:
                if cell:
                    # Find tile for this item
                    tile_info = tile_loader.find_tile(cell.item_id)

                    if tile_info and tile_info.fg:
                        # Get the tile image
                        tile_img = tile_loader.get_tile_image(tile_info.fg)

                        # Resize if needed (user set TILE_SIZE=16)
                        if tile_img.size != (TILE_SIZE, TILE_SIZE):
                            tile_img = tile_img.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.NEAREST)

                        # Create the square background with border
                        box_size = TILE_SIZE + SPRITE_BG_PADDING * 2
                        sprite_box = Image.new('RGBA', (box_size, box_size), (0, 0, 0, 0))

                        # Layer 1: Draw Solid BG
                        bg_rgb = hex_to_rgb(SPRITE_BG_COLOR)
                        sprite_draw = ImageDraw.Draw(sprite_box)
                        sprite_draw.rectangle([0, 0, box_size - 1, box_size - 1], fill=bg_rgb + (255,))

                        # Layer 2: Render Terrain
                        terrain_info = tile_loader.find_tile(cell.terrain_id)
                        if terrain_info and terrain_info.fg:
                            terrain_img = tile_loader.get_tile_image(terrain_info.fg)
                            if terrain_img.size != (TILE_SIZE, TILE_SIZE):
                                terrain_img = terrain_img.resize((TILE_SIZE, TILE_SIZE), Image.Resampling.NEAREST)
                            sprite_box.paste(terrain_img, (SPRITE_BG_PADDING, SPRITE_BG_PADDING), terrain_img)

                        # Layer 3: Paste Monster Sprite on BG
                        sprite_box.paste(tile_img, (SPRITE_BG_PADDING, SPRITE_BG_PADDING), tile_img)

                        # Layer 4: Draw Border
                        if SPRITE_BORDER_WIDTH > 0:
                            border_rgb = hex_to_rgb(SPRITE_BORDER_COLOR)
                            for w in range(SPRITE_BORDER_WIDTH):
                                sprite_draw.rectangle(
                                    [w, w, box_size - 1 - w, box_size - 1 - w],
                                    outline=border_rgb + (255,)
                                )

                        tile_img = sprite_box

                        # Apply horizontal flip if needed
                        if cell.flip_h:
                            tile_img = tile_img.transpose(Image.FLIP_LEFT_RIGHT)

                        # Apply rotation
                        rotated = tile_img.rotate(
                            -cell.rotation,  # PIL rotates counter-clockwise
                            resample=Image.BICUBIC,
                            expand=True
                        )

                        # Calculate paste position (centered in cell)
                        paste_x = int(x_offset + GRID_CELL_SIZE / 2 - rotated.width / 2 + cell.offset_x)
                        paste_y = int(y_offset + GRID_CELL_SIZE / 2 - rotated.height / 2 + cell.offset_y)

                        # Paste with alpha channel
                        img.paste(rotated, (paste_x, paste_y), rotated)

                x_offset += GRID_CELL_SIZE

            y_offset += GRID_CELL_SIZE

        # Add spacing between words
        if grid_idx == 0:
            y_offset += word_spacing

    # Save the image
    img.save(output_path)
    print(f"Image saved to: {output_path}")


def find_tileset_json(root_path: Path) -> Optional[Path]:
    """Find the tileset JSON file in the root path."""
    # Common tileset JSON filenames
    candidates = [
        root_path / "tileset" / "tile_config.json",
        root_path / "tileset" / "tileset.json",
        root_path / "tile_config.json",
        root_path / "tileset.json",
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return None


def render_legend(tile_loader: TileDataLoader, output_path: str, items_list: List, terrains_list: List[str]):
    """Render an index image showing entries in items_list and terrains_list."""
    active_items = []
    for i in items_list:
        if isinstance(i, (tuple, list)):
            active_items.append(i[0])
        elif isinstance(i, str):
            active_items.append(i)
    
    active_terrains = [t for t in terrains_list if isinstance(t, str)]

    # Dimensions
    ROW_HEIGHT = 40
    COL_WIDTH = 350
    COLS = 2

    item_rows = (len(active_items) + COLS - 1) // COLS
    terrain_rows = (len(active_terrains) + COLS - 1) // COLS

    img_width = COLS * COL_WIDTH + 40
    # Add space for two headers and some padding
    img_height = (item_rows + terrain_rows) * ROW_HEIGHT + 140

    # Create image
    img = Image.new('RGBA', (img_width, img_height), (18, 18, 18, 255))
    draw = ImageDraw.Draw(img)

    # Try to load a font, fallback to default
    try:
        # Common locations for fonts on macOS/Linux
        font_paths = [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/SFNSMono.ttf"
        ]
        font = None
        for p in font_paths:
            if Path(p).exists():
                font = ImageFont.truetype(p, 16)
                break
        if not font:
            font = ImageFont.load_default()
    except:
        font = ImageFont.load_default()

    curr_y = 15
    draw.text((20, curr_y), "Monster / Item Index", fill=(200, 200, 200, 255), font=font)
    draw.line((20, curr_y + 25, img_width - 20, curr_y + 25), fill=(60, 60, 60, 255))
    curr_y += 40

    for idx, item_id in enumerate(active_items):
        col = idx % COLS
        row = idx // COLS
        x = 20 + col * COL_WIDTH
        y = curr_y + row * ROW_HEIGHT

        tile_info = tile_loader.find_tile(item_id)
        if tile_info and tile_info.fg:
            tile_img = tile_loader.get_tile_image(tile_info.fg)
            img.paste(tile_img, (x, y + (ROW_HEIGHT - 32) // 2), tile_img)

        draw.text((x + 40, y + (ROW_HEIGHT - 20) // 2), item_id, fill=(170, 170, 170, 255), font=font)

    # Shift Y for Terrains
    curr_y += item_rows * ROW_HEIGHT + 30
    draw.text((20, curr_y), "Terrain Index", fill=(200, 200, 200, 255), font=font)
    draw.line((20, curr_y + 25, img_width - 20, curr_y + 25), fill=(60, 60, 60, 255))
    curr_y += 40

    for idx, terrain_id in enumerate(active_terrains):
        col = idx % COLS
        row = idx // COLS
        x = 20 + col * COL_WIDTH
        y = curr_y + row * ROW_HEIGHT

        tile_info = tile_loader.find_tile(terrain_id)
        if tile_info and tile_info.fg:
            tile_img = tile_loader.get_tile_image(tile_info.fg)
            img.paste(tile_img, (x, y + (ROW_HEIGHT - 32) // 2), tile_img)

        draw.text((x + 40, y + (ROW_HEIGHT - 20) // 2), terrain_id, fill=(170, 170, 170, 255), font=font)

    img.save(output_path)
    print(f"Index image saved to: {output_path}")


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python dont_panic.py <tileset_root_folder> [base_name]")
        print()
        print("Generates 5 variations and an index image in tmp/")
        print()
        print("Examples:")
        print("  python dont_panic.py ./tmp/item-icons/UNDEAD_PEOPLE-v0.9.1")
        print("  python dont_panic.py ./tmp/item-icons/UNDEAD_PEOPLE-v0.9.1 dont_panic")
        sys.exit(1)

    root_path = Path(sys.argv[1])
    base_name = sys.argv[2] if len(sys.argv) > 2 else "dont_panic"

    # Find tileset JSON
    tileset_json_path = find_tileset_json(root_path)
    if not tileset_json_path:
        print(f"Error: Could not find tileset JSON in {root_path}")
        print("Looked for: tileset/tile_config.json, tileset/tileset.json, tile_config.json, tileset.json")
        sys.exit(1)

    # Tiles directory is in the same directory as the JSON file
    tiles_directory = tileset_json_path.parent

    # Load tile data
    print(f"Loading tileset from: {tileset_json_path}")
    print(f"Using tiles from: {tiles_directory}")
    tile_loader = TileDataLoader(str(tileset_json_path), str(tiles_directory))

    # Create tmp directory if it doesn't exist
    tmp_dir = Path("tmp")
    tmp_dir.mkdir(exist_ok=True)

    # Generate Index/Legend
    legend_path = tmp_dir / f"{base_name}_index.png"
    render_legend(tile_loader, str(legend_path), ITEMS, TERRAINS)

    # Generate 5 variations
    print(f"\nGenerating 5 variations...")
    for i in range(1, 6):
        # Set different random seed for each variation
        random.seed(i * 42)

        output_path = tmp_dir / f"{base_name}_{i}.png"
        print(f"  [{i}/5] Rendering variation {i}...")
        render_dont_panic(tile_loader, str(output_path))

    print(f"\n✓ All variations saved to {tmp_dir}/")
    print(f"  Index: {base_name}_index.png")
    print(f"  Files: {base_name}_1.png through {base_name}_5.png")


if __name__ == "__main__":
    main()
