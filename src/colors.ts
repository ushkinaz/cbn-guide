// jerry rigged from various cdda sources

// Terminal color palette indices (0-7) from the curses/ncurses color system.
// These are abstract references used to build color pairs, not RGB values.
// The actual RGB values for CSS generation are defined in scripts/gen-css.ts.
const black = 0x00; // RGB{0; 0; 0}
const red = 0x01; // RGB{196; 0; 0}
const green = 0x02; // RGB{0; 196; 0}
const yellow = 0x03; // RGB{196; 180; 30}
const blue = 0x04; // RGB{0; 0; 196}
const magenta = 0x05; // RGB{196; 0; 180}
const cyan = 0x06; // RGB{0; 170; 200}
const white = 0x07; // RGB{196; 196; 196}
const color_pairs: Record<number, [number, number]> = {};

const init_pair = (num: number, fg: number, bg: number) => {
  color_pairs[num] = [fg, bg];
};

init_pair(1, white, black);
init_pair(2, red, black);
init_pair(3, green, black);
init_pair(4, blue, black);
init_pair(5, cyan, black);
init_pair(6, magenta, black);
init_pair(7, yellow, black);

// Inverted Colors
init_pair(8, black, white);
init_pair(9, black, red);
init_pair(10, black, green);
init_pair(11, black, blue);
init_pair(12, black, cyan);
init_pair(13, black, magenta);
init_pair(14, black, yellow);

// Highlighted - blue background
init_pair(15, white, blue);
init_pair(16, red, blue);
init_pair(17, green, blue);
init_pair(18, blue, blue);
init_pair(19, cyan, blue);
init_pair(20, black, blue);
init_pair(21, magenta, blue);
init_pair(22, yellow, blue);

// Red background - for monsters on fire
init_pair(23, white, red);
init_pair(24, red, red);
init_pair(25, green, red);
init_pair(26, blue, red);
init_pair(27, cyan, red);
init_pair(28, magenta, red);
init_pair(29, yellow, red);

init_pair(30, black, black);
init_pair(31, white, black);

init_pair(32, black, white);
init_pair(33, white, white);
init_pair(34, red, white);
init_pair(35, green, white);
init_pair(36, yellow, white);
init_pair(37, blue, white);
init_pair(38, magenta, white);
init_pair(39, cyan, white);

init_pair(40, black, green);
init_pair(41, white, green);
init_pair(42, red, green);
init_pair(43, green, green);
init_pair(44, yellow, green);
init_pair(45, blue, green);
init_pair(46, magenta, green);
init_pair(47, cyan, green);

init_pair(48, black, yellow);
init_pair(49, white, yellow);
init_pair(50, red, yellow);
init_pair(51, green, yellow);
init_pair(52, yellow, yellow);
init_pair(53, blue, yellow);
init_pair(54, magenta, yellow);
init_pair(55, cyan, yellow);

init_pair(56, black, magenta);
init_pair(57, white, magenta);
init_pair(58, red, magenta);
init_pair(59, green, magenta);
init_pair(60, yellow, magenta);
init_pair(61, blue, magenta);
init_pair(62, magenta, magenta);
init_pair(63, cyan, magenta);

init_pair(64, black, cyan);
init_pair(65, white, cyan);
init_pair(66, red, cyan);
init_pair(67, green, cyan);
init_pair(68, yellow, cyan);
init_pair(69, blue, cyan);
init_pair(70, magenta, cyan);
init_pair(71, cyan, cyan);

function color_pair(i: number) {
  return {
    fg: color_pairs[i][0],
    bg: color_pairs[i][1],
    bold() {
      return { ...this, is_bold: true };
    },
    blink() {
      return { ...this, is_blink: true };
    },
    is_bold: false,
    is_blink: false,
    color() {
      let fg = this.fg;
      let bg = this.bg;
      if (this.is_bold) fg = fg + 8;
      if (this.is_blink) bg = bg + 8;
      return { fg, bg };
    },
  };
}

/**
 * Resolves a color name to its foreground/background indices.
 * Automatically adds "c_" prefix if missing and defaults to "c_white" for empty names.
 *
 * @param name - Color name (e.g., "c_red", "red", or "")
 * @returns Color definition with fg/bg indices
 */
export function colorForName(name: string): {
  fg: number;
  bg: number;
} {
  if (!name) return colorForName("c_white");
  if (name[1] != "_") return colorForName("c_" + name);
  return all_colors[name];
}
/**
 * Complete mapping of color names to their terminal color pair definitions.
 * Used by both runtime code (ItemSymbol.svelte) and build scripts (gen-css.ts).
 */
export const all_colors: Record<string, { fg: number; bg: number }> = {};

function add_color(name: string, pair: ReturnType<typeof color_pair>) {
  all_colors[name] = {
    ...pair.color(),
  };
}

add_color("c_black", color_pair(30));
add_color("c_white", color_pair(1).bold());
add_color("c_light_gray", color_pair(1));
add_color("c_dark_gray", color_pair(30).bold());
add_color("c_red", color_pair(2));
add_color("c_green", color_pair(3));
add_color("c_blue", color_pair(4));
add_color("c_cyan", color_pair(5));
add_color("c_magenta", color_pair(6));
add_color("c_brown", color_pair(7));
add_color("c_light_red", color_pair(2).bold());
add_color("c_light_green", color_pair(3).bold());
add_color("c_light_blue", color_pair(4).bold());
add_color("c_light_cyan", color_pair(5).bold());
add_color("c_pink", color_pair(6).bold());
add_color("c_yellow", color_pair(7).bold());

add_color("h_black", color_pair(20));
add_color("h_white", color_pair(15).bold());
add_color("h_light_gray", color_pair(15));
add_color("h_dark_gray", color_pair(20).bold());
add_color("h_red", color_pair(16));
add_color("h_green", color_pair(17));
add_color("h_blue", color_pair(20));
add_color("h_cyan", color_pair(19));
add_color("h_magenta", color_pair(21));
add_color("h_brown", color_pair(22));
add_color("h_light_red", color_pair(16).bold());
add_color("h_light_green", color_pair(17).bold());
add_color("h_light_blue", color_pair(18).bold());
add_color("h_light_cyan", color_pair(19).bold());
add_color("h_pink", color_pair(21).bold());
add_color("h_yellow", color_pair(22).bold());

add_color("i_black", color_pair(32));
add_color("i_white", color_pair(8).blink());
add_color("i_light_gray", color_pair(8));
add_color("i_dark_gray", color_pair(32).blink());
add_color("i_red", color_pair(9));
add_color("i_green", color_pair(10));
add_color("i_blue", color_pair(11));
add_color("i_cyan", color_pair(12));
add_color("i_magenta", color_pair(13));
add_color("i_brown", color_pair(14));
add_color("i_light_red", color_pair(9).blink());
add_color("i_light_green", color_pair(10).blink());
add_color("i_light_blue", color_pair(11).blink());
add_color("i_light_cyan", color_pair(12).blink());
add_color("i_pink", color_pair(13).blink());
add_color("i_yellow", color_pair(14).blink());

add_color("c_black_red", color_pair(9).bold());
add_color("c_white_red", color_pair(23).bold());
add_color("c_light_gray_red", color_pair(23));
add_color("c_dark_gray_red", color_pair(9));
add_color("c_red_red", color_pair(9));
add_color("c_green_red", color_pair(25));
add_color("c_blue_red", color_pair(26));
add_color("c_cyan_red", color_pair(27));
add_color("c_magenta_red", color_pair(28));
add_color("c_brown_red", color_pair(29));
add_color("c_light_red_red", color_pair(24).bold());
add_color("c_light_green_red", color_pair(25).bold());
add_color("c_light_blue_red", color_pair(26).bold());
add_color("c_light_cyan_red", color_pair(27).bold());
add_color("c_pink_red", color_pair(28).bold());
add_color("c_yellow_red", color_pair(29).bold());

add_color("c_unset", color_pair(31));

add_color("c_black_white", color_pair(32));
add_color("c_dark_gray_white", color_pair(32).bold());
add_color("c_light_gray_white", color_pair(33));
add_color("c_white_white", color_pair(33).bold());
add_color("c_red_white", color_pair(34));
add_color("c_light_red_white", color_pair(34).bold());
add_color("c_green_white", color_pair(35));
add_color("c_light_green_white", color_pair(35).bold());
add_color("c_brown_white", color_pair(36));
add_color("c_yellow_white", color_pair(36).bold());
add_color("c_blue_white", color_pair(37));
add_color("c_light_blue_white", color_pair(37).bold());
add_color("c_magenta_white", color_pair(38));
add_color("c_pink_white", color_pair(38).bold());
add_color("c_cyan_white", color_pair(39));
add_color("c_light_cyan_white", color_pair(39).bold());

add_color("c_black_green", color_pair(40));
add_color("c_dark_gray_green", color_pair(40).bold());
add_color("c_light_gray_green", color_pair(41));
add_color("c_white_green", color_pair(41).bold());
add_color("c_red_green", color_pair(42));
add_color("c_light_red_green", color_pair(42).bold());
add_color("c_green_green", color_pair(43));
add_color("c_light_green_green", color_pair(43).bold());
add_color("c_brown_green", color_pair(44));
add_color("c_yellow_green", color_pair(44).bold());
add_color("c_blue_green", color_pair(45));
add_color("c_light_blue_green", color_pair(45).bold());
add_color("c_magenta_green", color_pair(46));
add_color("c_pink_green", color_pair(46).bold());
add_color("c_cyan_green", color_pair(47));
add_color("c_light_cyan_green", color_pair(47).bold());

add_color("c_black_yellow", color_pair(48));
add_color("c_dark_gray_yellow", color_pair(48).bold());
add_color("c_light_gray_yellow", color_pair(49));
add_color("c_white_yellow", color_pair(49).bold());
add_color("c_red_yellow", color_pair(50));
add_color("c_light_red_yellow", color_pair(50).bold());
add_color("c_green_yellow", color_pair(51));
add_color("c_light_green_yellow", color_pair(51).bold());
add_color("c_brown_yellow", color_pair(52));
add_color("c_yellow_yellow", color_pair(52).bold());
add_color("c_blue_yellow", color_pair(53));
add_color("c_light_blue_yellow", color_pair(53).bold());
add_color("c_magenta_yellow", color_pair(54));
add_color("c_pink_yellow", color_pair(54).bold());
add_color("c_cyan_yellow", color_pair(55));
add_color("c_light_cyan_yellow", color_pair(55).bold());

add_color("c_black_magenta", color_pair(56));
add_color("c_dark_gray_magenta", color_pair(56).bold());
add_color("c_light_gray_magenta", color_pair(57));
add_color("c_white_magenta", color_pair(57).bold());
add_color("c_red_magenta", color_pair(58));
add_color("c_light_red_magenta", color_pair(58).bold());
add_color("c_green_magenta", color_pair(59));
add_color("c_light_green_magenta", color_pair(59).bold());
add_color("c_brown_magenta", color_pair(60));
add_color("c_yellow_magenta", color_pair(60).bold());
add_color("c_blue_magenta", color_pair(61));
add_color("c_light_blue_magenta", color_pair(61).bold());
add_color("c_magenta_magenta", color_pair(62));
add_color("c_pink_magenta", color_pair(62).bold());
add_color("c_cyan_magenta", color_pair(63));
add_color("c_light_cyan_magenta", color_pair(63).bold());

add_color("c_black_cyan", color_pair(64));
add_color("c_dark_gray_cyan", color_pair(64).bold());
add_color("c_light_gray_cyan", color_pair(65));
add_color("c_white_cyan", color_pair(65).bold());
add_color("c_red_cyan", color_pair(66));
add_color("c_light_red_cyan", color_pair(66).bold());
add_color("c_green_cyan", color_pair(67));
add_color("c_light_green_cyan", color_pair(67).bold());
add_color("c_brown_cyan", color_pair(68));
add_color("c_yellow_cyan", color_pair(68).bold());
add_color("c_blue_cyan", color_pair(69));
add_color("c_light_blue_cyan", color_pair(69).bold());
add_color("c_magenta_cyan", color_pair(70));
add_color("c_pink_cyan", color_pair(70).bold());
add_color("c_cyan_cyan", color_pair(71));
add_color("c_light_cyan_cyan", color_pair(71).bold());
