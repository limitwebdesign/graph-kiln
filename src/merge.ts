import type { ForgeCluster, ForgeEdge, ForgeNode, ForgeWorkspace, WorkspaceAction } from "./types.js";
import { nowIso, uuid } from "./utils.js";

function chooseNewerNode(a: ForgeNode, b: ForgeNode): ForgeNode {
  if (b.lamport > a.lamport) return b;
  if (b.lamport < a.lamport) return a;
  return new Date(b.updatedAt).getTime() >= new Date(a.updatedAt).getTime() ? b : a;
}

function chooseStrongerEdge(a: ForgeEdge, b: ForgeEdge): ForgeEdge {
  return b.weight >= a.weight ? b : a;
}

function sortActions(actions: WorkspaceAction[]): WorkspaceAction[] {
  return [...actions].sort((a, b) => a.lamport - b.lamport || new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

export function appendAction(workspace: ForgeWorkspace, type: WorkspaceAction["type"], summary: string, payload: Record<string, unknown>): WorkspaceAction {
  workspace.meta.lamport += 1;
  workspace.meta.updatedAt = nowIso();
  const action: WorkspaceAction = {
    id: uuid(),
    type,
    summary,
    payload,
    ts: workspace.meta.updatedAt,
    lamport: workspace.meta.lamport
  };
  workspace.actions.push(action);
  workspace.actions = workspace.actions.slice(-400);
  return action;
}

export function mergeWorkspaces(left: ForgeWorkspace, right: ForgeWorkspace): ForgeWorkspace {
  const nodeMap = new Map<string, ForgeNode>();
  for (const node of [...left.nodes, ...right.nodes]) {
    const current = nodeMap.get(node.id);
    nodeMap.set(node.id, current ? chooseNewerNode(current, node) : node);
  }

  const edgeMap = new Map<string, ForgeEdge>();
  for (const edge of [...left.edges, ...right.edges]) {
    const key = `${edge.from}|${edge.to}|${edge.reason}`;
    const current = edgeMap.get(key);
    edgeMap.set(key, current ? chooseStrongerEdge(current, edge) : edge);
  }

  const clusterMap = new Map<string, ForgeCluster>();
  for (const cluster of [...left.clusters, ...right.clusters]) {
    const current = clusterMap.get(cluster.id);
    if (!current || cluster.score >= current.score) {
      clusterMap.set(cluster.id, cluster);
    }
  }

  const actionMap = new Map<string, WorkspaceAction>();
  for (const action of [...left.actions, ...right.actions]) {
    actionMap.set(action.id, action);
  }

  const merged: ForgeWorkspace = {
    id: left.id,
    title: left.title === right.title ? left.title : `${left.title} // merged`,
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    clusters: [...clusterMap.values()],
    actions: sortActions([...actionMap.values()]),
    meta: {
      createdAt: left.meta.createdAt,
      updatedAt: nowIso(),
      lamport: Math.max(left.meta.lamport, right.meta.lamport),
      version: "10.0.0"
    }
  };

  appendAction(merged, "merge", "Merged imported workspace", { importedWorkspaceId: right.id });
  return merged;
}

export function emptyWorkspaceLike(workspace: ForgeWorkspace): ForgeWorkspace {
  return {
    id: workspace.id,
    title: workspace.title,
    nodes: [],
    edges: [],
    clusters: [],
    actions: [],
    meta: {
      createdAt: workspace.meta.createdAt,
      updatedAt: workspace.meta.updatedAt,
      lamport: 0,
      version: workspace.meta.version
    }
  };
}

export function applyAction(workspace: ForgeWorkspace, action: WorkspaceAction): ForgeWorkspace {
  const next: ForgeWorkspace = {
    ...workspace,
    nodes: workspace.nodes.map((node) => ({ ...node })),
    edges: workspace.edges.map((edge) => ({ ...edge })),
    clusters: workspace.clusters.map((cluster) => ({ ...cluster, nodeIds: [...cluster.nodeIds], keywords: [...cluster.keywords] })),
    actions: [...workspace.actions, action],
    meta: {
      ...workspace.meta,
      lamport: Math.max(workspace.meta.lamport, action.lamport),
      updatedAt: action.ts
    }
  };

  if (action.type === "add-node" || action.type === "update-node" || action.type === "move-node") {
    const node = action.payload.node as ForgeNode | undefined;
    if (node) {
      const idx = next.nodes.findIndex((item) => item.id === node.id);
      if (idx >= 0) next.nodes[idx] = node;
      else next.nodes.push(node);
    }
  }

  if (action.type === "delete-node") {
    const nodeId = action.payload.nodeId as string | undefined;
    if (nodeId) {
      next.nodes = next.nodes.filter((node) => node.id !== nodeId);
      next.edges = next.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId);
      next.clusters = next.clusters.map((cluster) => ({
        ...cluster,
        nodeIds: cluster.nodeIds.filter((id) => id !== nodeId)
      })).filter((cluster) => cluster.nodeIds.length > 0);
    }
  }

  if (action.type === "analyze") {
    next.edges = (action.payload.edges as ForgeEdge[] | undefined) ?? next.edges;
    next.clusters = (action.payload.clusters as ForgeCluster[] | undefined) ?? next.clusters;
  }


  if (action.type === "layout") {
    const nodes = action.payload.nodes as ForgeNode[] | undefined;
    if (nodes) {
      next.nodes = nodes;
    }
  }

  if (action.type === "clear") {
    next.nodes = [];
    next.edges = [];
    next.clusters = [];
  }

  if (action.type === "load-sample") {
    const imported = action.payload.workspace as ForgeWorkspace | undefined;
    if (imported) return imported;
  }

  return next;
}
