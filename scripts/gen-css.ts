/**
 * @file gen-css.ts
 * @description Generates CSS variables and classes based on Cataclysm: Dark Days Ahead (CDDA)
 * color definitions. This includes standard colors, highlighted, inverted, and background-specific pairs.
 * The output is written to stdout as CSS.
 *
 * @usage
 * ```bash
 * npx tsx scripts/gen-css.ts > /src/assets/game-palette.css
 * ```
 */

import { all_colors } from "../src/colors";

// RGB color values for CSS generation.
// Maps terminal color indices (0-15) to actual RGB values for web display.
// Indices 0-7 are base colors, 8-15 are bright/bold variants.
const colors: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 110, 0],
  brown: [97, 56, 28],
  blue: [10, 10, 220],
  magenta: [139, 58, 98],
  cyan: [0, 150, 180],
  gray: [150, 150, 150],

  dark_gray: [99, 99, 99],
  light_red: [255, 150, 150],
  light_green: [0, 255, 0],
  yellow: [255, 255, 0],
  light_blue: [100, 100, 255],
  light_magenta: [254, 0, 254],
  light_cyan: [0, 240, 255],
  white: [255, 255, 255],
};
const colors_by_num = Object.keys(colors);

// Generate CSS custom properties for color palette
process.stdout.write(":root {\n");
for (const color in colors) {
  process.stdout.write(
    `  --cata-color-${color}: rgb(${colors[color].join(",")});\n`,
  );
}
process.stdout.write("}\n");

// Generate CSS classes for each color combination from colors.ts
for (const c in all_colors) {
  let { fg, bg } = all_colors[c];
  const fgName = colors_by_num[fg];
  const bgName = colors_by_num[bg];
  const className = c.startsWith("c_") ? c : "c_" + c;
  process.stdout.write(
    `.${className} { color: var(--cata-color-${fgName}); background: var(--cata-color-${bgName}); }\n`,
  );
}
