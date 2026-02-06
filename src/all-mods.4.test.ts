/**
 * @vitest-environment jsdom
 */

import { makeModRenderTests } from "./testRenderMods";

const chunkNum = /all-mods\.(\d+)\.test\.ts$/.exec(__filename)?.[1];
if (!chunkNum) throw new Error("No chunk index found");
const chunkIdx = parseInt(chunkNum, 10) - 1;
const numChunks = 4;

makeModRenderTests(chunkIdx, numChunks);
