export type NodeKind = "note" | "link" | "code" | "image" | "entity";

export interface ForgeNode {
  id: string;
  kind: NodeKind;
  title: string;
  content: string;
  url?: string;
  imageData?: string;
  tags: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
  lamport: number;
}

export interface ForgeEdge {
  id: string;
  from: string;
  to: string;
  weight: number;
  reason: string;
  createdAt: string;
}

export interface ForgeCluster {
  id: string;
  label: string;
  nodeIds: string[];
  keywords: string[];
  score: number;
}

export interface WorkspaceMeta {
  createdAt: string;
  updatedAt: string;
  lamport: number;
  version: string;
}

export interface WorkspaceAction {
  id: string;
  type:
    | "add-node"
    | "update-node"
    | "move-node"
    | "delete-node"
    | "analyze"
    | "merge"
    | "clear"
    | "load-sample"
    | "layout";
  summary: string;
  ts: string;
  lamport: number;
  payload: Record<string, unknown>;
}

export interface ForgeWorkspace {
  id: string;
  title: string;
  nodes: ForgeNode[];
  edges: ForgeEdge[];
  clusters: ForgeCluster[];
  actions: WorkspaceAction[];
  meta: WorkspaceMeta;
}

export interface AnalyzeResult {
  clusters: ForgeCluster[];
  edges: ForgeEdge[];
  metrics: {
    topKeywords: string[];
    densestNodeId: string | null;
    averageDegree: number;
  };
}

export interface SimilarityScore {
  nodeId: string;
  title: string;
  score: number;
}

export interface CapabilityState {
  wasm: string;
  webgpu: string;
  serviceWorker: string;
}

export interface AppState {
  workspace: ForgeWorkspace;
  selectedNodeId: string | null;
  query: string;
  capabilities: CapabilityState;
  gpuBenchmark: string;
  related: SimilarityScore[];
  statusLine: string;
  replaying: boolean;
}
