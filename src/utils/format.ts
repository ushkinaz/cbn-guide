export function formatPercent(prob: number): string {
  return formatFixed2(prob * 100) + "%";
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
  return value
    .replace(COLOR_TAG_REGEX, "")
    .replace(/\r?\n/g, " ")
    .replace(WHITESPACE_REGEX, " ")
    .trim();
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

export function formatL(ml: number): string {
  return `${formatFixed2(ml / 1000)} L`;
}

export function formatKg(g: number): string {
  return `${formatFixed2(g / 1000)} kg`;
}
