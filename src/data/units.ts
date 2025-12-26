export function showProbability(prob: number) {
  const ret = (prob * 100).toFixed(2);
  if (ret === "0.00") return "< 0.01%";
  return ret + "%";
}

// Returns ml
export function parseVolume(string: string | number): number {
  if (typeof string === "undefined") return 0;
  if (typeof string === "number") return string * 250;
  if (string.endsWith("ml")) return parseInt(string);
  else if (string.endsWith("L")) return parseInt(string) * 1000;
  throw new Error("unknown volume unit: " + string);
}

// with g as 1
const massUnitMultiplier = {
  μg: 1e-6,
  ug: 1e-6,
  mcg: 1e-6,
  mg: 1e-3,
  g: 1,
  kg: 1e3,
};

// Returns grams
export function parseMass(string: string | number): number {
  if (typeof string === "undefined") return 0;
  if (typeof string === "number") return string;
  let m: RegExpExecArray | null;
  let val = 0;
  const re = new RegExp(
    `(\\d+)\\s+(${Object.keys(massUnitMultiplier).join("|")})`,
    "g",
  );
  while ((m = re.exec(string))) {
    const [_, num, unit] = m;
    val +=
      parseInt(num) *
      massUnitMultiplier[unit as keyof typeof massUnitMultiplier];
  }
  return val;
}

// Returns seconds
export function parseDuration(duration: string | number): number {
  if (typeof duration === "number") return duration / 100;
  const turns = 1;
  const seconds = 1;
  const minutes = 60;
  const hours = minutes * 60;
  const days = hours * 24;
  // noinspection PointlessArithmeticExpressionJS
  const units: [string, number][] = [
    ["turns", 1 * turns],
    ["turn", 1 * turns],
    ["t", 1 * turns],
    ["seconds", 1 * seconds],
    ["second", 1 * seconds],
    ["s", 1 * seconds],
    ["minutes", 1 * minutes],
    ["minute", 1 * minutes],
    ["m", 1 * minutes],
    ["hours", 1 * hours],
    ["hour", 1 * hours],
    ["h", 1 * hours],
    ["days", 1 * days],
    ["day", 1 * days],
    ["d", 1 * days],
  ];
  const [num, unit] = duration.trim().split(/\s+/);
  const multiplier = units.find((x) => x[0] === unit);
  if (!multiplier) throw new Error(`bad duration: ${JSON.stringify(duration)}`);
  return Number(num) * multiplier[1];
}

export function asMinutes(duration: string | number) {
  const seconds = parseDuration(duration);
  return `${Math.round(seconds / 60)} m`;
}

export function asHumanReadableDuration(duration: string | number) {
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

export function asLiters(string: string | number): string {
  const ml = parseVolume(string);
  return `${(ml / 1000).toFixed(2)} L`;
}

export function asKilograms(string: string | number): string {
  const g = parseMass(string);
  return `${(g / 1000).toFixed(2)} kg`;
}
