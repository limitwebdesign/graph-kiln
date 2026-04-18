import type { AnalyzeResult, ForgeNode } from "./types.js";

export class ClusterWorkerBridge {
  private worker: Worker | null = null;

  constructor() {
    try {
      this.worker = new Worker(new URL("./workers/cluster.worker.js", import.meta.url), { type: "module" });
    } catch (error) {
      console.warn("Worker unavailable, clustering will fall back to main thread.", error);
    }
  }

  async analyze(nodes: ForgeNode[]): Promise<AnalyzeResult> {
    if (!this.worker) {
      return {
        clusters: [],
        edges: [],
        metrics: {
          topKeywords: [],
          densestNodeId: null,
          averageDegree: 0
        }
      };
    }

    return await new Promise((resolve, reject) => {
      const worker = this.worker;
      if (!worker) {
        reject(new Error("Cluster worker missing."));
        return;
      }
      const timer = window.setTimeout(() => reject(new Error("Cluster worker timed out.")), 5000);

      worker.onmessage = (event: MessageEvent<AnalyzeResult>) => {
        window.clearTimeout(timer);
        resolve(event.data);
      };

      worker.onerror = (event) => {
        window.clearTimeout(timer);
        reject(event.error ?? new Error("Cluster worker failed."));
      };

      worker.postMessage({ nodes });
    });
  }
}
