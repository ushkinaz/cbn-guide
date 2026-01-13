/**
 * @file fetch-fixtures.ts
 * @description This script fetches the nightly or a specific build of the game data (all.json)
 * and saves it for local development and testing purposes. It also updates the
 * metadata file (_test/all.meta.json) with the new build number and SHA.
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
}

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const metaPath = path.join(projectRoot, "_test", "all.meta.json");
const { buildNum, sha }: MetaData = JSON.parse(readFileSync(metaPath, "utf8"));
const update = process.argv[2] === "nightly";
const dataUrl = getDataJsonUrl(update ? "nightly" : buildNum, "all.json");

function computeSha(file: string): Promise<string> {
  return new Promise((resolve) => {
    const hash = crypto.createHash("sha256");
    const s = createReadStream(file);
    s.on("data", (d) => hash.update(d));
    s.on("end", () => {
      resolve(hash.digest("hex"));
    });
  });
}

async function matchesSha(file: string, expectedSha: string): Promise<boolean> {
  return expectedSha === (await computeSha(file));
}

(async () => {
  const filename = path.join(projectRoot, "_test", "all.json");

  const exists = await fs
    .access(filename)
    .then(() => true)
    .catch(() => false);

  if (!exists) {
    console.log("Test data not present, fetching...");
  } else if (!(await matchesSha(filename, sha)) || update) {
    if (update) {
      console.log("Updating test data...");
    } else {
      console.log("Test data not up-to-date, fetching...");
    }
  } else {
    return;
  }

  try {
    const res = await request(dataUrl);
    if (!res.body) {
      throw new Error("No response body received");
    }

    const dest = createWriteStream(filename);
    res.body.pipe(dest);

    await new Promise<void>((resolve, reject) => {
      res.body.on("end", resolve);
      res.body.on("error", reject);
      dest.on("error", reject);
    });

    const newSha = await computeSha(filename);
    const dataContent = await fs.readFile(filename, "utf8");
    const newBuildNum = JSON.parse(dataContent).build_number;

    await fs.writeFile(
      metaPath,
      JSON.stringify({ buildNum: newBuildNum, sha: newSha }, null, 2),
    );
    console.log(`Successfully updated test data to build ${newBuildNum}`);
  } catch (error) {
    console.error("Failed to fetch or process test data:", error);
    process.exit(1);
  }
})();
