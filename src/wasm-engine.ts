import type { ForgeNode, SimilarityScore } from "./types.js";
import { toVector } from "./utils.js";

type WasmExports = {
  memory: WebAssembly.Memory;
  dot: (leftPtr: number, rightPtr: number, length: number) => number;
  l2: (ptr: number, length: number) => number;
};

export class WasmScoreEngine {
  private exportsRef: WasmExports | null = null;
  public status = "Loading WebAssembly scoring core…";

  async init(): Promise<void> {
    try {
      const url = new URL("../wasm/graph_score.wasm", import.meta.url);
      const response = await fetch(url);
      const bytes = await response.arrayBuffer();
      const module = await WebAssembly.instantiate(bytes, {});
      this.exportsRef = module.instance.exports as unknown as WasmExports;
      this.status = "WebAssembly scoring ready.";
    } catch (error) {
      console.error(error);
      this.status = "WebAssembly unavailable. Falling back to JavaScript heuristics.";
      this.exportsRef = null;
    }
  }

  get ready(): boolean {
    return Boolean(this.exportsRef);
  }

  rankRelated(selected: ForgeNode | null, nodes: ForgeNode[]): SimilarityScore[] {
    if (!selected) return [];
    const others = nodes.filter((node) => node.id !== selected.id);

    if (!this.exportsRef) {
      const selectedTokens = new Set((selected.title + " " + selected.content + " " + selected.tags.join(" ")).toLowerCase().split(/\W+/));
      return others
        .map((node) => {
          const tokens = new Set((node.title + " " + node.content + " " + node.tags.join(" ")).toLowerCase().split(/\W+/));
          let overlap = 0;
          for (const token of selectedTokens) if (token && tokens.has(token)) overlap += 1;
          return { nodeId: node.id, title: node.title, score: overlap };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    }

    const selectedVec = toVector(`${selected.title} ${selected.content} ${selected.tags.join(" ")}`, 32);
    return others
      .map((node) => {
        const score = this.cosine(selectedVec, toVector(`${node.title} ${node.content} ${node.tags.join(" ")}`, 32));
        return { nodeId: node.id, title: node.title, score: Number(score.toFixed(4)) };
      })
      .filter((item) => item.score > 0.06)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  private cosine(left: Float32Array, right: Float32Array): number {
    const exportsRef = this.exportsRef;
    if (!exportsRef) return 0;

    const leftPtr = 0;
    const rightPtr = 256;
    const memory = new Float32Array(exportsRef.memory.buffer);
    memory.set(left, leftPtr / 4);
    memory.set(right, rightPtr / 4);

    const dot = exportsRef.dot(leftPtr, rightPtr, left.length);
    const leftNorm = Math.sqrt(exportsRef.l2(leftPtr, left.length));
    const rightNorm = Math.sqrt(exportsRef.l2(rightPtr, right.length));

    if (!leftNorm || !rightNorm) return 0;
    return dot / (leftNorm * rightNorm);
  }
}
