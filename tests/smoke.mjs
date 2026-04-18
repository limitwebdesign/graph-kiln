import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSampleWorkspace } from "../app/sample-data.js";
import { mergeWorkspaces } from "../app/merge.js";
import { workspaceSummary } from "../app/summary.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const sample = createSampleWorkspace();
assert.ok(sample.nodes.length >= 8, "sample workspace should contain multiple nodes");
assert.ok(sample.actions.length >= sample.nodes.length, "sample workspace should have an action log");

const imported = structuredClone(sample);
imported.nodes[0].title = "Mutated title";
imported.meta.lamport += 4;
imported.nodes.push({
  ...imported.nodes[0],
  id: "imported-extra",
  title: "Extra node",
  lamport: imported.meta.lamport + 1
});

const merged = mergeWorkspaces(sample, imported);
assert.ok(merged.nodes.some((node) => node.id === "imported-extra"), "merge should include imported node");
assert.equal(merged.nodes.find((node) => node.id === imported.nodes[0].id)?.title, "Mutated title");
assert.ok(workspaceSummary(merged).includes("nodes"), "summary should render text");

const wasmBytes = await fs.readFile(path.join(root, "wasm", "graph_score.wasm"));
const wasm = await WebAssembly.instantiate(wasmBytes, {});
const exportsRef = wasm.instance.exports;
const memory = new Float32Array(exportsRef.memory.buffer);
memory.set([1, 2, 3], 0);
memory.set([4, 5, 6], 64 / 4);
assert.equal(Math.round(exportsRef.dot(0, 64, 3)), 32, "WASM dot product should work");
assert.equal(Math.round(exportsRef.l2(0, 3)), 14, "WASM l2 norm should work");

console.log("GraphKiln smoke tests passed.");
