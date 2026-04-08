/**
 * @file fetch-builds.ts
 * @description This script fetches the latest builds.json and saves it for local development.
 *
 * @usage
 * ```bash
 * pnpm run fetch:builds
 * ```
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BUILDS_URL } from "../src/constants";

const cwd = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(cwd, "..");
const buildsPath = path.join(projectRoot, "_test", "builds.json");

async function main() {
  console.log(`Fetching builds from ${BUILDS_URL}...`);
  const res = await fetch(BUILDS_URL);

  if (!res.ok) {
    throw new Error(`Failed to fetch builds: ${res.status} ${res.statusText}`);
  }

  await fs.writeFile(buildsPath, JSON.stringify(await res.json(), null, 2));

  console.log(`Successfully updated ${buildsPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
