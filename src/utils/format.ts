export function formatPercent(prob: number): string {
  return Math.ceil(prob * 100).toFixed(0) + "%";
}

export function formatFixed2(v: number): string {
  const ret = v.toFixed(2);
  if (ret === "0.00") return "< 0.01";
  return ret;
}

const COLOR_TAG_REGEX = /<\/?(?:info|good|bad|neutral|color(?:_[^>]+)?)>/gi;
const WHITESPACE_REGEX = /\s+/g;

export function stripColorTags(value: string): string {
  return value.replace(COLOR_TAG_REGEX, "");
}

export function cleanText(value: string): string {
  return stripColorTags(value).replace(WHITESPACE_REGEX, " ").trim();
}

export function formatNumeric(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value
    .toFixed(2)
    .replace(/\.0+$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function formatDisplayValue(value: number | string): string {
  return typeof value === "number" ? formatNumeric(value) : cleanText(value);
}

function formatL(ml: number): string {
  return `${formatFixed2(ml / 1000)} L`;
}

function formatKg(g: number): string {
  return `${formatFixed2(g / 1000)} kg`;
}

const VOLUME_REGEX = /([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z]+)/g;
const VOLUME_UNIT_MAP: Record<string, number> = {
  ml: 1,
  L: 1000,
};

// Returns ml
export function parseVolume(string: string | number): number {
  if (typeof string === "undefined") return 0;
  if (typeof string === "number") return string * 250;
  let val = 0;
  VOLUME_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VOLUME_REGEX.exec(string))) {
    const [_, numStr, unit] = m;
    const unitVal = VOLUME_UNIT_MAP[unit];
    if (unitVal !== undefined) {
      val += parseFloat(numStr) * unitVal;
    }
  }
  return val;
}

// with g as 1
const massUnits: Record<string, number> = {
  μg: 1e-6,
  ug: 1e-6,
  mcg: 1e-6,
  mg: 1e-3,
  g: 1,
  kg: 1e3,
};
const MASS_REGEX = /([+-]?\d+(?:\.\d+)?)\s*([a-zA-Zμ]+)/g;

// Returns grams
export function parseMass(string: string | number): number {
  if (typeof string === "undefined") return 0;
  if (typeof string === "number") return string;
  let val = 0;
  // Reset regex lastIndex for global regex reuse
  MASS_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MASS_REGEX.exec(string))) {
    const [_, numStr, unit] = m;
    const unitVal = massUnits[unit];
    if (unitVal !== undefined) {
      val += parseFloat(numStr) * unitVal;
    }
  }
  return val;
}

const durationUnits: Record<string, number> = {
  turns: 1,
  turn: 1,
  t: 1,
  seconds: 1,
  second: 1,
  s: 1,
  minutes: 60,
  minute: 60,
  m: 60,
  hours: 3600,
  hour: 3600,
  h: 3600,
  days: 86400,
  day: 86400,
  d: 86400,
};
const DURATION_REGEX = /([+-]?\d+(?:\.\d+)?)\s*([a-z]+)/g;

// Returns seconds
export function parseDuration(duration: string | number): number {
  if (typeof duration === "undefined") return 0;
  if (typeof duration === "number") return duration / 100;
  let val = 0;
  DURATION_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DURATION_REGEX.exec(duration))) {
    const [_, numStr, unit] = m;
    const unitVal = durationUnits[unit];
    if (unitVal !== undefined) {
      val += parseFloat(numStr) * unitVal;
    }
  }
  return val;
}

export function formatDurationMinutes(duration: string | number) {
  const seconds = parseDuration(duration);
  return `${Math.round(seconds / 60)} m`;
}

export function formatDurationHuman(duration: string | number) {
  let seconds = parseDuration(duration);
  let minutes = (seconds / 60) | 0;
  seconds -= minutes * 60;
  let hours = (minutes / 60) | 0;
  minutes -= hours * 60;
  let days = (hours / 24) | 0;
  hours -= days * 24;
  return (
    [
      [days, "d"],
      [hours, "h"],
      [minutes, "m"],
      [seconds, "s"],
    ] as [number, string][]
  )
    .filter(([n]) => n)
    .map((x) => x.join(""))
    .join(" ");
}

export function formatVolume(string: string | number): string {
  const ml = parseVolume(string);
  return formatL(ml);
}

export function formatMass(string: string | number): string {
  const g = parseMass(string);
  return formatKg(g);
}

/**
 * If no prefix - it's a legacy value in inches
 */
export function formatLength(length: string | number): string {
  return typeof length === "number" ? `${length}"` : length;
}
