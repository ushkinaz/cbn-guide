/**
 * @file fetch-fixtures.ts
 * @description This script fetches the nightly or a specific build of the game data (all.json and all_mods.json)
 * and saves it for local development and testing purposes. It also updates the
 * metadata file (_test/all.meta.json) with the new build number and SHAs.
 *
 * @usage
 * ```bash
 * # Fetch the build specified in _test/all.meta.json
 * npx tsx scripts/fetch-fixtures.ts
 *
 * # Fetch the nightly build and update metadata
 * npx tsx scripts/fetch-fixtures.ts nightly
 * ```
 */

import * as fs from "fs/promises";
import { createReadStream, createWriteStream, readFileSync } from "fs";
import * as crypto from "crypto";
import * as url from "url";
import * as path from "path";
import { EnvHttpProxyAgent, request, setGlobalDispatcher } from "undici";
import { getDataJsonUrl } from "../src/constants";

const envHttpProxyAgent = new EnvHttpProxyAgent();
setGlobalDispatcher(envHttpProxyAgent);

interface MetaData {
  buildNum: string;
  sha: string;
  modsSha?: string;
}

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const metaPath = path.join(projectRoot, "_test", "all.meta.json");
const currentMeta: MetaData = JSON.parse(readFileSync(metaPath, "utf8"));
const update = process.argv[2] === "nightly";

const targetVersion = update ? "nightly" : currentMeta.buildNum;

function computeSha(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const s = createReadStream(file);
    s.on("error", reject);
    s.on("data", (d) => hash.update(d));
    s.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

async function matchesSha(
  file: string,
  expectedSha?: string,
): Promise<boolean> {
  if (!expectedSha) return false;
  try {
    await fs.access(file);
    const sha = await computeSha(file);
    return expectedSha === sha;
  } catch {
    return false;
  }
}

async function fetchFile(url: string, destPath: string): Promise<void> {
  // console.log(`Fetching ${url} -> ${destPath}`);
  const res = await request(url);
  if (!res.body) {
    throw new Error(`No response body received for ${url}`);
  }
  if (res.statusCode !== 200) {
    throw new Error(`Failed to fetch ${url}: Status ${res.statusCode}`);
  }

  const dest = createWriteStream(destPath);
  res.body.pipe(dest);

  return new Promise<void>((resolve, reject) => {
    // Resolve only after destination stream has flushed all bytes to disk.
    dest.on("finish", resolve);
    res.body.on("error", reject);
    dest.on("error", reject);
  });
}

(async () => {
  const allJsonPath = path.join(projectRoot, "_test", "all.json");
  const allModsJsonPath = path.join(projectRoot, "_test", "all_mods.json");

  // We check if fetch is needed for either file, or forced update
  let fetchAll = update;
  let fetchMods = update;

  if (!update) {
    if (!(await matchesSha(allJsonPath, currentMeta.sha))) fetchAll = true;
    if (!(await matchesSha(allModsJsonPath, currentMeta.modsSha)))
      fetchMods = true;
  }

  if (!fetchAll && !fetchMods) {
    console.log("All test data up-to-date.");
    return;
  }

  const newMeta: MetaData = { ...currentMeta };

  try {
    if (fetchAll) {
      const url = getDataJsonUrl(targetVersion, "all.json");
      console.log(`Fetching all.json from ${targetVersion}...`);
      await fetchFile(url, allJsonPath);
      newMeta.sha = await computeSha(allJsonPath);

      // Update build number from new file content
      const dataContent = await fs.readFile(allJsonPath, "utf8");
      const json = JSON.parse(dataContent);
      if (json.build_number) {
        newMeta.buildNum = json.build_number;
      }
    }

    if (fetchMods) {
      const url = getDataJsonUrl(targetVersion, "all_mods.json");
      console.log(`Fetching all_mods.json from ${targetVersion}...`);
      await fetchFile(url, allModsJsonPath);
      newMeta.modsSha = await computeSha(allModsJsonPath);
    }

    // Save updated metadata
    await fs.writeFile(metaPath, JSON.stringify(newMeta, null, 2));
    console.log(`Successfully updated test data to build ${newMeta.buildNum}`);
  } catch (error) {
    console.error("Failed to fetch fixtures:", error);
    process.exit(1);
  }
})();
