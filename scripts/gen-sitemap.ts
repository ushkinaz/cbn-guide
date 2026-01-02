/**
 * @file gen-sitemap.ts
 * @description Generates a static sitemap.xml for the specified (or latest stable) version of the guide.
 *
 * @usage
 * ```bash
 * # Basic usage (generates sitemap for latest stable)
 * npx tsx scripts/gen-sitemap.ts
 *
 * # For a specific version
 * GAME_VERSION=v0.9.1 npx tsx scripts/gen-sitemap.ts
 *
 * # Using npm script
 * npm run gen:sitemap
 * ```
 */

import path from "node:path";
import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { EnvHttpProxyAgent, request, setGlobalDispatcher } from "undici";

import { BUILDS_URL, CANONICAL_URL, getDataJsonUrl } from "../src/constants";
import { CBNData } from "../src/data";

const agent = new EnvHttpProxyAgent();
setGlobalDispatcher(agent);

const cwd = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(cwd, "..");
const publicDir = path.join(projectRoot, "public");
const cacheDir = path.join(projectRoot, "tmp", "data-cache");

const BASE_URL = CANONICAL_URL;
const SITEMAP_PATH = path.join(publicDir, "sitemap.xml");

const MAX_ENTRIES = 50000;
const MAX_SIZE_MB = 50;

const ENTITY_TYPES = [
  "item",
  "monster",
  "terrain",
  "furniture",
  "vehicle_part",
  "mutation",
  "martial_art",
  "tool_quality",
  "json_flag",
  "achievement",
  "technique",
  "overmap_special",
  "mutation_category",
  "bionic",
];

async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readJson(file: string) {
  const content = await fs.readFile(file, "utf8");
  return JSON.parse(content);
}

async function downloadFile(url: string, dest: string) {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const res = await request(url);
  if (res.statusCode && res.statusCode >= 400) {
    throw new Error(`Failed to fetch ${url} (${res.statusCode})`);
  }
  if (!res.body) throw new Error(`No response body for ${url}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function loadData(): Promise<{
  gameData: CBNData;
  version: string;
  releaseDate: string;
}> {
  const versionEnv = process.env.GAME_VERSION;
  console.log(`Fetching builds from ${BUILDS_URL}...`);
  const res = await request(BUILDS_URL);
  const builds = (await res.body.json()) as any[];

  let selectedBuild;
  if (versionEnv) {
    selectedBuild = builds.find((b: any) => b.build_number === versionEnv);
    if (!selectedBuild) {
      throw new Error(`Build ${versionEnv} not found in builds.json`);
    }
  } else {
    selectedBuild = builds.find((b: any) => !b.prerelease);
    if (!selectedBuild) throw new Error("No stable build found in builds.json");
  }

  const version = selectedBuild.build_number;
  console.log(`Using version ${version}`);

  await fs.mkdir(cacheDir, { recursive: true });
  const localAllJson = path.join(cacheDir, `all-${version}.json`);

  if (!(await fileExists(localAllJson))) {
    const url = getDataJsonUrl(version, "all.json");
    console.log(`Downloading ${url}...`);
    await downloadFile(url, localAllJson);
  }

  const { data, build_number, release } = await readJson(localAllJson);
  return {
    gameData: new CBNData(data, build_number, release),
    version: version,
    releaseDate: selectedBuild.created_at.split("T")[0],
  };
}

function generateXml(urls: string[], lastmod: string): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const url of urls) {
    lines.push("  <url>");
    lines.push(`    <loc>${url}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push("  </url>");
  }

  lines.push("</urlset>");
  return lines.join("\n");
}

async function main() {
  try {
    const { gameData, version, releaseDate } = await loadData();

    const urls: string[] = [];
    const baseWithStable = `${BASE_URL}/stable`;

    // 1. Root and category pages
    urls.push(`${baseWithStable}/`);
    for (const type of ENTITY_TYPES) {
      urls.push(`${baseWithStable}/${type}`);
    }

    // 2. Entity pages
    console.log("Collecting entity IDs...");
    const seen = new Set<string>();

    for (const type of ENTITY_TYPES) {
      const items = gameData.byType(type as any);
      for (const item of items) {
        const ids: string[] = Array.isArray(item.id)
          ? item.id
          : typeof item.id === "string"
            ? [item.id]
            : [item.abstract].filter(Boolean);

        for (const id of ids) {
          if (!id) continue;
          const key = `${type}:${id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          urls.push(`${baseWithStable}/${type}/${encodeURIComponent(id)}`);

          if (urls.length > MAX_ENTRIES) {
            throw new Error(
              `Sitemap entries exceeded limit of ${MAX_ENTRIES}. A sitemap index must be implemented.`,
            );
          }
        }
      }
    }

    console.log(`Generated ${urls.length} URLs.`);

    const xml = generateXml(urls, releaseDate);
    const xmlSizeMB = Buffer.byteLength(xml) / (1024 * 1024);

    if (xmlSizeMB > MAX_SIZE_MB) {
      throw new Error(
        `Sitemap size (${xmlSizeMB.toFixed(2)}MB) exceeded limit of ${MAX_SIZE_MB}MB. A sitemap index must be implemented.`,
      );
    }

    await fs.writeFile(SITEMAP_PATH, xml);
    console.log(`Sitemap saved to ${SITEMAP_PATH}`);
  } catch (err) {
    console.error("Error generating sitemap:", err);
    process.exit(1);
  }
}

main();
