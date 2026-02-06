import * as fs from "node:fs/promises";
import * as path from "node:path";

type CliArgs = {
  token: string;
  resourceId: string;
  outDir: string;
  fileType: string;
  mode: string;
  locales: string[] | null;
  includeEmpty: boolean;
  pollMs: number;
  timeoutMs: number;
  verbose: boolean;
};

type JsonApiList<T> = {
  data: T[];
  links?: {
    next?: string | null;
  };
};

type ResourceLanguageStat = {
  attributes?: {
    translated_strings?: number;
  };
  relationships?: {
    language?: {
      data?: {
        id?: string;
      };
    };
  };
};

type AsyncDownloadCreateResponse = {
  data: {
    id: string;
  };
};

type AsyncDownloadStatusResponse = {
  data: {
    attributes?: {
      status?: string;
      errors?: unknown;
    };
  };
};

const API_BASE = "https://rest.api.transifex.com";
const DEFAULT_RESOURCE_ID = "o:cataclysmbn-guide:p:web-guide:r:ui";
const SOURCE_LOCALE = "en";

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
  const outDir = kv.get("out") || "./tmp/transifex-download";
  const fileType = kv.get("fileType") || "default";
  const mode = kv.get("mode") || "default";
  const pollMs = Number(kv.get("poll") || "2000");
  const timeoutMs = Number(kv.get("timeout") || "180000");
  const localesRaw = kv.get("locales") || "";
  const includeEmptyRaw = kv.get("include-empty") || "false";
  const verboseRaw = kv.get("verbose") || "false";

  if (!token)
    throw new Error(
      "Missing API token. Use --token=... or TRANSIFEX_API_TOKEN.",
    );
  if (!Number.isFinite(pollMs) || pollMs <= 0)
    throw new Error("Invalid --poll value.");
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
    throw new Error("Invalid --timeout value.");

  const locales = localesRaw
    ? localesRaw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : null;

  const includeEmpty = parseBool(includeEmptyRaw);
  const verbose = parseBool(verboseRaw);

  return {
    token,
    resourceId,
    outDir,
    fileType,
    mode,
    locales,
    includeEmpty,
    pollMs,
    timeoutMs,
    verbose,
  };
}

function ensureLanguageId(value: string): string {
  return value.startsWith("l:") ? value : `l:${value}`;
}

function localeCodeFromLanguageId(languageId: string): string {
  return languageId.replace(/^l:/, "");
}

function isSourceLanguageId(languageId: string): boolean {
  return localeCodeFromLanguageId(languageId) === SOURCE_LOCALE;
}

function projectIdFromResourceId(resourceId: string): string {
  const match = resourceId.match(/^(o:[^:]+:p:[^:]+):r:[^:]+$/);
  if (!match) {
    throw new Error(`Invalid resource id: ${resourceId}`);
  }
  return match[1];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function listLanguageIds(args: CliArgs): Promise<string[]> {
  if (args.locales && args.locales.length > 0) {
    const requested = args.locales.map(ensureLanguageId);
    const filtered = requested.filter(
      (languageId) => !isSourceLanguageId(languageId),
    );
    const skipped = requested.length - filtered.length;
    if (skipped > 0) {
      logVerbose(
        args,
        `Skipping source locale '${SOURCE_LOCALE}' from explicit locale list.`,
      );
    }
    logVerbose(
      args,
      `Using explicit locales from CLI: ${args.locales.join(", ")}`,
    );
    return filtered;
  }

  const projectId = projectIdFromResourceId(args.resourceId);
  const result: string[] = [];

  let nextUrl: string | null =
    `${API_BASE}/resource_language_stats?filter[project]=${encodeURIComponent(projectId)}` +
    `&filter[resource]=${encodeURIComponent(args.resourceId)}`;
  let pageNo = 0;

  while (nextUrl) {
    logVerbose(args, `Loading language stats page ${pageNo + 1}: ${nextUrl}`);
    const page = await txFetchJson<JsonApiList<ResourceLanguageStat>>(
      args.token,
      nextUrl,
      {
        method: "GET",
      },
    );

    for (const item of page.data) {
      const languageId = item.relationships?.language?.data?.id;
      if (!languageId) continue;
      if (isSourceLanguageId(languageId)) {
        logVerbose(
          args,
          `Skipping source locale '${SOURCE_LOCALE}' from project languages.`,
        );
        continue;
      }
      const translatedCount = item.attributes?.translated_strings ?? 0;
      if (!args.includeEmpty && translatedCount <= 0) continue;
      result.push(languageId);
    }

    pageNo += 1;
    nextUrl = resolveNextUrl(page.links?.next);
  }

  logVerbose(args, `Loaded ${pageNo} language stats page(s).`);
  return Array.from(new Set(result)).sort((a, b) => a.localeCompare(b));
}

async function createDownloadAction(
  args: CliArgs,
  languageId: string,
): Promise<string> {
  const url = `${API_BASE}/resource_translations_async_downloads`;
  const body = {
    data: {
      type: "resource_translations_async_downloads",
      attributes: {
        callback_url: null,
        content_encoding: "text",
        file_type: args.fileType,
        mode: args.mode,
        pseudo: false,
      },
      relationships: {
        language: {
          data: {
            type: "languages",
            id: languageId,
          },
        },
        resource: {
          data: {
            type: "resources",
            id: args.resourceId,
          },
        },
      },
    },
  };

  const created = await txFetchJson<AsyncDownloadCreateResponse>(
    args.token,
    url,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  logVerbose(
    args,
    `Created async download ${created.data.id} for ${localeCodeFromLanguageId(languageId)}`,
  );
  return created.data.id;
}

async function fetchDownloadedFile(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      Accept: "*/*",
    },
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    throw new Error(
      `Failed to download file from ${downloadUrl}: ${response.status} ${raw}`,
    );
  }

  return response.text();
}

async function waitForDownload(
  args: CliArgs,
  downloadId: string,
): Promise<string> {
  const started = Date.now();
  const statusUrl = `${API_BASE}/resource_translations_async_downloads/${encodeURIComponent(downloadId)}`;
  let pollCount = 0;

  while (Date.now() - started < args.timeoutMs) {
    pollCount += 1;
    logVerbose(
      args,
      `Polling async download ${downloadId}, attempt ${pollCount}`,
    );
    const response = await txFetch(args.token, statusUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        Accept: "application/vnd.api+json, */*",
      },
    });

    if (response.status === 303) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          `Download ${downloadId} returned 303 without Location header`,
        );
      }
      logVerbose(
        args,
        `Async download ${downloadId} ready after ${pollCount} poll(s): ${location}`,
      );
      return fetchDownloadedFile(location);
    }

    if (response.status === 404) {
      logVerbose(args, `Async download ${downloadId} not ready yet (404).`);
      await sleep(args.pollMs);
      continue;
    }

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText} for ${statusUrl}\n${raw}`,
      );
    }

    const parsed = JSON.parse(raw) as AsyncDownloadStatusResponse;
    const status = parsed.data.attributes?.status || "unknown";
    logVerbose(args, `Async download ${downloadId} status: ${status}`);
    if (status === "failed") {
      throw new Error(
        `Download ${downloadId} failed: ${JSON.stringify(parsed.data.attributes?.errors)}`,
      );
    }

    await sleep(args.pollMs);
  }

  throw new Error(`Timed out waiting for download ${downloadId}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await fs.mkdir(args.outDir, { recursive: true });
  logVerbose(
    args,
    `Configuration: resource=${args.resourceId}, out=${args.outDir}, mode=${args.mode}, fileType=${args.fileType}, includeEmpty=${args.includeEmpty}, pollMs=${args.pollMs}, timeoutMs=${args.timeoutMs}`,
  );

  const languageIds = await listLanguageIds(args);
  if (languageIds.length === 0) {
    console.log(
      `No locales selected for download after skipping source locale '${SOURCE_LOCALE}'.`,
    );
    return;
  }

  console.log(
    `Languages to download (${languageIds.length}): ${languageIds.join(", ")}`,
  );

  const failures: string[] = [];
  for (const languageId of languageIds) {
    const localeCode = localeCodeFromLanguageId(languageId);
    try {
      logVerbose(
        args,
        `Starting locale download for ${localeCode} (${languageId})`,
      );
      const downloadId = await createDownloadAction(args, languageId);
      const fileText = await waitForDownload(args, downloadId);
      const outFile = path.join(args.outDir, `${localeCode}.json`);
      await fs.writeFile(
        outFile,
        fileText.endsWith("\n") ? fileText : `${fileText}\n`,
        "utf8",
      );
      console.log(`[ok] ${localeCode} -> ${outFile}`);
    } catch (error) {
      failures.push(localeCode);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fail] ${localeCode}: ${message}`);
    }
  }

  logVerbose(
    args,
    `Download summary: succeeded=${languageIds.length - failures.length}, failed=${failures.length}`,
  );
  if (failures.length > 0) {
    throw new Error(
      `Failed locales (${failures.length}): ${failures.join(", ")}`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
