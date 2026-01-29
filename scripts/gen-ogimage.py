from PIL import Image, ImageDraw, ImageFont
import os

# --- PALETTE (Extracted from cataclysmbn-guide.com) ---
BG_COLOR = (24, 26, 27)      # #181a1b
CARD_BG = (30, 33, 35)       # #1e2123
ACCENT_GREEN = (102, 255, 102) # #66ff66
TEXT_MAIN = (232, 230, 227)  # #e8e6e3
TEXT_DIM = (168, 160, 149)   # #a8a095
BORDER_COLOR = (53, 59, 62)  # #353b3e

def get_font(size, bold=False, mono=False):
    """Portable font loader for Linux, Windows, and macOS."""
    home = os.path.expanduser("~")
    if mono:
        mac_fonts = [os.path.join(home, "Library/Fonts/3270NerdFont-Regular.ttf"), "/System/Library/Fonts/Menlo.ttc"]
    else:
        mac_fonts = [os.path.join(home, "Library/Fonts/DejaVuSansMono.ttf"), "/System/Library/Fonts/Helvetica.ttc"]

    for path in mac_fonts:
        if os.path.exists(path):
            try:
                # Pillow's truetype can handle .ttc and .ttf
                # If it's Helvetica.ttc, index 1 is usually Bold, 0 is Regular
                # For Menlo, index 1 is Bold
                index = 1 if bold and path.endswith('.ttc') else 0
                return ImageFont.truetype(path, size, index=index)
            except Exception:
                continue
                
    return ImageFont.load_default()

# Image dimensions
w, h = 1200, 630
img = Image.new('RGB', (w, h), color=BG_COLOR)
draw = ImageDraw.Draw(img)

# Load fonts
f_header = get_font(20)
f_bold = get_font(34, bold=True)
f_main = get_font(24)
f_code = get_font(20, mono=True)

# 1. Header Bar
draw.rectangle([0, 0, w, 50], fill=(21, 23, 24))
draw.text((30, 15), "CATACLYSM: BRIGHT NIGHTS // HITCHHIKER'S GUIDE", font=f_header, fill=TEXT_DIM)
draw.text((w - 250, 15), "VERSION: NIGHTLY", font=f_header, fill=ACCENT_GREEN)

# 2. JSON Snippet (Faded background detail)
json_lines = [
    '{',
    '  "id": "mon_boomer",',
    '  "type": "MONSTER",',
    '  "name": { "str": "boomer" },',
    '  "bodytype": "human",',
    '  "weight": "120 kg",',
    '  "hp": 40',
    '  "speed": 55 ',
    '  "material": [ "flesh" ], ',
    '  "aggression": 100, ',
    '  "morale": 100, ',
    '  "vision_night": 3, ',
    '  "death_drops": "default_zombie_items", ',
    '}'
]
y_json = 120
for line in json_lines:
    draw.text((60, y_json), line, font=f_code, fill=(150, 150, 150))
    y_json += 25

# 3. Main Card
cx, cy, cw, ch = 580, 120, 540, 380
draw.rectangle([cx+8, cy+8, cx+cw+8, cy+ch+8], fill=(15, 17, 18)) # Shadow
draw.rectangle([cx, cy, cx+cw, cy+ch], fill=CARD_BG, outline=BORDER_COLOR, width=2)

icon_path = "tmp/item-icons/undead_people-v0.9.1/icons/monster/mon_boomer.png"
if os.path.exists(icon_path):
    icon = Image.open(icon_path).convert("RGBA")
    # Resize icon to fit nicely (original tile was 80x80)
    icon_size = 100
    icon = icon.resize((icon_size, icon_size), Image.Resampling.BOX)
    # Center it in the previous tile spot
    img.paste(icon, (cx + 20, cy + 25), icon)
else:
    draw.rectangle([cx + 30, cy + 30, cx + 110, cy + 110], outline=ACCENT_GREEN, width=1)
    draw.text((cx + 45, cy + 60), "TILE", font=f_code, fill=ACCENT_GREEN)

draw.text((cx + 135, cy + 60), "Boomer", font=f_bold, fill=TEXT_MAIN)

# Stats
stats = [("Species:", "zombie, human"), ("HP:", "40"), ("Speed:", "55"), ("Drops:", "joint, thermos, M17")]
y_s = cy + 140
for label, val in stats:
    draw.text((cx + 30, y_s), label, font=f_main, fill=TEXT_DIM)
    draw.text((cx + 180, y_s), val, font=f_main, fill=TEXT_MAIN)
    y_s += 45

# Search Bar
draw.rectangle([cx + 30, cy + 320, cx + cw - 30, cy + 355], fill=BG_COLOR, outline=BORDER_COLOR)
draw.text((cx + 45, cy + 327), "> FIND AK-47...", font=f_code, fill=ACCENT_GREEN)

# 4. Footer
draw.line([50, h - 80, w - 50, h - 80], fill=BORDER_COLOR, width=1)
draw.text((w//2 - 320, h - 60), "INSTANT SEARCH // 100% BUILD ACCURACY // OFFLINE-READY PWA", font=f_header, fill=TEXT_DIM)

img.save('og-image.png')
print("Image generated: og-image.png")