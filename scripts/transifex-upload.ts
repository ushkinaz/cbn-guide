import * as fs from "node:fs/promises";
import * as path from "node:path";

type CliArgs = {
  token: string;
  resourceId: string;
  dir: string;
  file: string | null;
  locale: string | null;
  locales: string[] | null;
  dryRun: boolean;
  verbose: boolean;
};

type JsonApiList<T> = {
  data: T[];
  included?: Array<{
    id: string;
    type: string;
    attributes?: {
      key?: string;
      strings?: Record<string, string>;
    };
  }>;
  links?: {
    next?: string | null;
  };
};

type ResourceTranslationItem = {
  id: string;
  type: string;
  attributes?: {
    strings?: Record<string, string>;
  };
  relationships?: {
    resource_string?: {
      data?: {
        id?: string;
      };
    };
  };
};

type InputValue = string | Record<string, string>;

const API_BASE = "https://rest.api.transifex.com";
const DEFAULT_RESOURCE_ID = "o:cataclysmbn-guide:p:web-guide:r:ui";
const SOURCE_LOCALE = "en";
const ALLOWED_STRING_KEYS = new Set([
  "zero",
  "one",
  "two",
  "few",
  "many",
  "other",
]);

function parseBool(value: string): boolean {
  return /^(true|1|yes)$/i.test(value);
}

function logVerbose(args: CliArgs, message: string): void {
  if (!args.verbose) return;
  console.log(`[verbose] ${message}`);
}

function parseArgs(argv: string[]): CliArgs {
  const kv = new Map<string, string>();
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const [k, ...rest] = raw.slice(2).split("=");
    if (!k || rest.length === 0) continue;
    kv.set(k, rest.join("="));
  }

  const token = kv.get("token") || process.env.TRANSIFEX_API_TOKEN || "";
  const resourceId = kv.get("resource") || DEFAULT_RESOURCE_ID;
  const dir = kv.get("dir") || "./tmp/transifex-download";
  const file = kv.get("file") || null;
  const locale = kv.get("locale") || null;
  const localesRaw = kv.get("locales") || "";
  const dryRunRaw = kv.get("dry-run") || "false";
  const verboseRaw = kv.get("verbose") || "false";

  if (!token)
    throw new Error(
      "Missing API token. Use --token=... or TRANSIFEX_API_TOKEN.",
    );
  if (file && !locale)
    throw new Error("When --file is provided, --locale is required.");

  const locales = localesRaw
    ? localesRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : null;

  const dryRun = parseBool(dryRunRaw);
  const verbose = parseBool(verboseRaw);

  return {
    token,
    resourceId,
    dir,
    file,
    locale,
    locales,
    dryRun,
    verbose,
  };
}

function ensureLanguageId(value: string): string {
  return value.startsWith("l:") ? value : `l:${value}`;
}

function localeCodeFromLanguageId(languageId: string): string {
  return languageId.replace(/^l:/, "");
}

function isSourceLocale(locale: string): boolean {
  return localeCodeFromLanguageId(ensureLanguageId(locale)) === SOURCE_LOCALE;
}

function resolveNextUrl(next: string | null | undefined): string | null {
  if (!next) return null;
  if (/^https?:\/\//.test(next)) return next;
  return `${API_BASE}${next}`;
}

async function txFetch(
  token: string,
  url: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      ...(init.headers || {}),
    },
  });
}

async function txFetchJson<T>(
  token: string,
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await txFetch(token, url, init);
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${url}\n${raw}`,
    );
  }
  if (!raw) throw new Error(`Empty response from ${url}`);
  return JSON.parse(raw) as T;
}

function parseInputMap(raw: string): Map<string, InputValue> {
  const parsed = JSON.parse(raw) as Record<string, unknown> & {
    data?: Record<string, unknown>;
  };

  const root =
    parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const out = new Map<string, InputValue>();

  for (const [key, value] of Object.entries(root)) {
    if (typeof value === "string") {
      const text = value.trim();
      if (text && !isSourceEcho(key, text)) out.set(key, text);
      continue;
    }

    if (typeof value !== "object" || value === null) continue;

    const obj = value as Record<string, unknown>;

    if (typeof obj.string === "string") {
      const str = obj.string.trim();
      if (str && !isSourceEcho(key, str)) out.set(key, str);
      continue;
    }

    const pluralEntries = Object.entries(obj).filter(
      ([form, v]) => ALLOWED_STRING_KEYS.has(form) && typeof v === "string",
    );
    if (pluralEntries.length > 0) {
      const plural: Record<string, string> = {};
      for (const [form, v] of pluralEntries) {
        const text = String(v).trim();
        if (!text || isSourceEcho(key, text)) continue;
        plural[form] = text;
      }
      if (Object.keys(plural).length > 0) out.set(key, plural);
    }
  }

  return out;
}

function isSourceEcho(sourceKey: string, candidate: string): boolean {
  return sourceTextFromKey(sourceKey).trim() === candidate.trim();
}

function sourceTextFromKey(sourceKey: string): string {
  const contextSeparator = "::";
  const separatorIndex = sourceKey.lastIndexOf(contextSeparator);
  if (separatorIndex <= 0) return sourceKey;
  return sourceKey.slice(0, separatorIndex);
}

function mergeStrings(
  current: Record<string, string>,
  incoming: InputValue,
  requiredKeys: string[] = [],
): Record<string, string> {
  const incomingKeys =
    typeof incoming === "string"
      ? []
      : Object.keys(incoming).filter((key) => ALLOWED_STRING_KEYS.has(key));
  const templateKeys =
    requiredKeys.length > 0
      ? requiredKeys
      : incomingKeys.length > 0
        ? incomingKeys
        : Object.keys(current).filter((key) => ALLOWED_STRING_KEYS.has(key));
  const sanitizedCurrent = sanitizeStrings(current, true);
  const currentKeys =
    templateKeys.length > 0 ? templateKeys : Object.keys(sanitizedCurrent);

  if (typeof incoming === "string") {
    if (currentKeys.length === 0) return { other: incoming };
    if (currentKeys.length === 1)
      return enforceTemplateKeys(
        {
          ...sanitizedCurrent,
          [currentKeys[0]]: incoming,
        },
        currentKeys,
      );
    if ("other" in sanitizedCurrent)
      return enforceTemplateKeys(
        { ...sanitizedCurrent, other: incoming },
        currentKeys,
      );
    return enforceTemplateKeys(
      {
        ...sanitizedCurrent,
        [currentKeys[0]]: incoming,
      },
      currentKeys,
    );
  }

  return enforceTemplateKeys(
    {
      ...sanitizedCurrent,
      ...sanitizeStrings(incoming, true),
    },
    currentKeys,
  );
}

function sanitizeStrings(
  strings: Record<string, string>,
  keepEmpty = false,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(strings)) {
    if (!ALLOWED_STRING_KEYS.has(key)) continue;
    const normalized = value.trim();
    if (!keepEmpty && normalized.length === 0) continue;
    out[key] = normalized;
  }
  return out;
}

function enforceTemplateKeys(
  strings: Record<string, string>,
  templateKeys: string[],
): Record<string, string> {
  // First, build a working set with all input strings
  const working: Record<string, string> = {};
  for (const [key, value] of Object.entries(strings)) {
    working[key] = value.trim();
  }

  // Ensure 'other' exists as a fallback (use first non-empty value if missing)
  const firstNonEmpty = Object.values(working).find((x) => x.length > 0) || "";
  if (!working.other || working.other.length === 0) {
    working.other = firstNonEmpty;
  }

  // Determine which keys we need to return
  const requiredKeys = templateKeys.length > 0 ? templateKeys : ["other"];

  // Build output with ONLY the required keys, filling missing ones from 'other'
  const out: Record<string, string> = {};
  for (const key of requiredKeys) {
    if (working[key] && working[key].length > 0) {
      out[key] = working[key];
    } else {
      out[key] = working.other;
    }
  }

  return out;
}

async function loadTargets(
  args: CliArgs,
): Promise<Array<{ locale: string; filePath: string }>> {
  if (args.file && args.locale) {
    if (isSourceLocale(args.locale)) {
      logVerbose(
        args,
        `Skipping source locale '${SOURCE_LOCALE}' for explicit file input (${args.file}).`,
      );
      return [];
    }
    logVerbose(
      args,
      `Using explicit input file: ${args.file} for locale ${args.locale}`,
    );
    return [{ locale: args.locale, filePath: args.file }];
  }

  logVerbose(args, `Scanning locale files in directory: ${args.dir}`);
  const entries = await fs.readdir(args.dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const requestedLocales = args.locales ? new Set(args.locales) : null;
  if (requestedLocales) {
    requestedLocales.delete(SOURCE_LOCALE);
    requestedLocales.delete(`l:${SOURCE_LOCALE}`);
    logVerbose(
      args,
      `Filtering to requested locales: ${Array.from(requestedLocales).join(", ")}`,
    );
  }

  return files
    .map((name) => ({
      locale: name.replace(/\.json$/, ""),
      filePath: path.join(args.dir, name),
    }))
    .filter((x) => !isSourceLocale(x.locale))
    .filter((x) => (requestedLocales ? requestedLocales.has(x.locale) : true));
}

async function fetchTranslationIndex(
  args: CliArgs,
  token: string,
  resourceId: string,
  languageId: string,
): Promise<
  Map<
    string,
    {
      translationId: string;
      currentStrings: Record<string, string>;
      requiredKeys: string[];
    }
  >
> {
  const result = new Map<
    string,
    {
      translationId: string;
      currentStrings: Record<string, string>;
      requiredKeys: string[];
    }
  >();

  let nextUrl: string | null =
    `${API_BASE}/resource_translations?filter[resource]=${encodeURIComponent(resourceId)}` +
    `&filter[language]=${encodeURIComponent(languageId)}` +
    `&include=resource_string`;
  let pageNo = 0;

  while (nextUrl) {
    logVerbose(
      args,
      `Loading translation index page ${pageNo + 1} for ${localeCodeFromLanguageId(languageId)}: ${nextUrl}`,
    );
    const page = await txFetchJson<JsonApiList<ResourceTranslationItem>>(
      token,
      nextUrl,
      {
        method: "GET",
      },
    );

    const metaByResourceStringId = new Map<
      string,
      { key: string; requiredKeys: string[] }
    >();
    for (const inc of page.included || []) {
      if (inc.type !== "resource_strings") continue;
      const key = inc.attributes?.key;
      if (!key) continue;
      const requiredKeys = Object.keys(inc.attributes?.strings || {})
        .filter((form) => ALLOWED_STRING_KEYS.has(form))
        .sort((a, b) => a.localeCompare(b));
      metaByResourceStringId.set(inc.id, { key, requiredKeys });
    }

    for (const item of page.data) {
      const rsId = item.relationships?.resource_string?.data?.id;
      if (!rsId) continue;
      const meta = metaByResourceStringId.get(rsId);
      if (!meta) continue;

      result.set(meta.key, {
        translationId: item.id,
        currentStrings: item.attributes?.strings || {},
        requiredKeys: meta.requiredKeys,
      });
    }

    pageNo += 1;
    nextUrl = resolveNextUrl(page.links?.next);
  }

  logVerbose(
    args,
    `Loaded ${result.size} translation keys from ${pageNo} page(s) for ${localeCodeFromLanguageId(languageId)}`,
  );
  return result;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function patchTranslations(
  args: CliArgs,
  token: string,
  rows: Array<{ id: string; strings: Record<string, string> }>,
): Promise<void> {
  const url = `${API_BASE}/resource_translations`;
  const body = {
    data: rows.map((row) => ({
      id: row.id,
      type: "resource_translations",
      attributes: {
        strings: row.strings,
      },
    })),
  };

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.api+json",
      "Content-Type": 'application/vnd.api+json;profile="bulk"',
    },
    body: JSON.stringify(body),
  });
  logVerbose(args, `PATCH /resource_translations with ${rows.length} row(s)`);

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${url}\n${raw}`,
    );
  }
}

async function updateOneLocale(
  args: CliArgs,
  locale: string,
  filePath: string,
): Promise<void> {
  logVerbose(args, `${locale}: loading file ${filePath}`);
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown> & {
    data?: Record<string, unknown>;
  };
  const rawParsed =
    parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
  const rawKeyCount = Object.keys(rawParsed).length;
  const inputMap = parseInputMap(raw);
  const languageId = ensureLanguageId(locale);
  const skippedAsSourceEcho = Math.max(0, rawKeyCount - inputMap.size);
  logVerbose(
    args,
    `${locale}: parsed ${inputMap.size} uploadable key(s), skipped source-echo keys=${skippedAsSourceEcho}`,
  );

  const index = await fetchTranslationIndex(
    args,
    args.token,
    args.resourceId,
    languageId,
  );

  const updates: Array<{ id: string; strings: Record<string, string> }> = [];
  let missing = 0;
  let skippedPlurals = 0;
  const skippedPluralKeys: string[] = [];

  for (const [key, incomingValue] of inputMap.entries()) {
    const current = index.get(key);
    if (!current) {
      missing += 1;
      continue;
    }

    // Skip keys containing "plural" for now
    if (key.toLowerCase().includes("plural")) {
      skippedPlurals += 1;
      skippedPluralKeys.push(key);
      continue;
    }

    const strings = mergeStrings(
      current.currentStrings,
      incomingValue,
      current.requiredKeys,
    );
    updates.push({ id: current.translationId, strings });
  }

  console.log(
    `[info] ${locale}: parsed=${rawKeyCount}, uploadable=${inputMap.size}, matched=${updates.length}, missing=${missing}, skipped-plural=${skippedPlurals}, skipped-source-echo=${skippedAsSourceEcho}`,
  );

  if (skippedPlurals > 0) {
    console.log(`[info] ${locale}: skipped ${skippedPlurals} plural keys:`);
    for (const key of skippedPluralKeys) {
      console.log(`  - ${key}`);
    }
  }

  if (missing > 0) {
    logVerbose(
      args,
      `${locale}: ${missing} key(s) from input were not found in Transifex`,
    );
  }

  if (args.dryRun) {
    console.log(
      `[dry-run] ${locale}: would patch ${updates.length} translations`,
    );
    return;
  }

  for (const [idx, group] of chunk(updates, 150).entries()) {
    await patchTranslations(args, args.token, group);
    console.log(
      `[ok] ${locale}: batch ${idx + 1}/${Math.ceil(updates.length / 150)} (${group.length})`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  logVerbose(
    args,
    `Configuration: resource=${args.resourceId}, dir=${args.dir}, file=${args.file ?? "<auto>"}, locale=${args.locale ?? "<auto>"}, dryRun=${args.dryRun}`,
  );
  const targets = await loadTargets(args);

  if (targets.length === 0) {
    console.log(
      `No locales selected for update after skipping source locale '${SOURCE_LOCALE}'.`,
    );
    return;
  }

  console.log(
    `Locales to update (${targets.length}): ${targets.map((x) => x.locale).join(", ")}${
      args.dryRun ? " [dry-run]" : ""
    }`,
  );

  const failures: string[] = [];

  for (const target of targets) {
    try {
      logVerbose(
        args,
        `Starting locale update for ${target.locale} from ${target.filePath}`,
      );
      await updateOneLocale(args, target.locale, target.filePath);
    } catch (error) {
      failures.push(target.locale);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fail] ${target.locale}: ${message}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Failed locales (${failures.length}): ${failures.join(", ")}`,
    );
  }

  logVerbose(
    args,
    `Update summary: succeeded=${targets.length - failures.length}, failed=${failures.length}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
