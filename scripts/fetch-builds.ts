/**
 * @file fetch-builds.ts
 * @description This script fetches the latest builds.json and saves it for local development.
 *
 * @usage
 * ```bash
 * npx tsx scripts/fetch-builds.ts
 * ```
 */

import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import * as path from "path";
import * as url from "url";
import { EnvHttpProxyAgent, request, setGlobalDispatcher } from "undici";
import { BUILDS_URL } from "../src/constants";

const envHttpProxyAgent = new EnvHttpProxyAgent();
setGlobalDispatcher(envHttpProxyAgent);

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const buildsPath = path.join(projectRoot, "_test", "builds.json");

(async () => {
  console.log(`Fetching builds from ${BUILDS_URL}...`);
  try {
    const res = await request(BUILDS_URL);
    if (!res.body) {
      throw new Error("No response body received");
    }

    const dest = createWriteStream(buildsPath);
    res.body.pipe(dest);

    await new Promise<void>((resolve, reject) => {
      res.body.on("end", resolve);
      res.body.on("error", reject);
      dest.on("error", reject);
    });

    console.log(`Successfully updated ${buildsPath}`);
  } catch (error) {
    console.error("Failed to fetch builds:", error);
    process.exit(1);
  }
})();
