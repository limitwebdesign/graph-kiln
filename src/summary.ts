import type { ForgeNode, ForgeWorkspace } from "./types.js";
import { topKeywordsFromNodes } from "./utils.js";

export function workspaceSummary(workspace: ForgeWorkspace): string {
  const counts = workspace.nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.kind] = (acc[node.kind] ?? 0) + 1;
    return acc;
  }, {});
  const keywordList = topKeywordsFromNodes(workspace.nodes, 5).join(", ") || "no strong signals yet";
  const densestCluster = [...workspace.clusters].sort((a, b) => b.nodeIds.length - a.nodeIds.length || b.score - a.score)[0];

  const parts = [
    `${workspace.nodes.length} nodes`,
    `${workspace.edges.length} inferred links`,
    `${workspace.clusters.length} clusters`,
    `top signals: ${keywordList}`
  ];

  if (densestCluster) {
    parts.push(`largest cluster: ${densestCluster.label} (${densestCluster.nodeIds.length})`);
  }

  if (counts.code) parts.push(`${counts.code} code nodes`);
  if (counts.link) parts.push(`${counts.link} link nodes`);

  return parts.join(" • ");
}

export function selectedNodeSummary(node: ForgeNode | null, workspace: ForgeWorkspace): string {
  if (!node) return "Select a node to inspect its relationship surface.";
  const connected = workspace.edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const linkedTitles = connected
    .map((edge) => workspace.nodes.find((candidate) => candidate.id === (edge.from === node.id ? edge.to : edge.from))?.title)
    .filter(Boolean)
    .slice(0, 3)
    .join(", ");

  const tags = node.tags.slice(0, 4).join(", ");
  const relationText = linkedTitles ? `Nearest linked signals: ${linkedTitles}.` : "No inferred links yet.";
  return `${node.title} is a ${node.kind} node tagged with ${tags || "no tags"}. ${relationText}`;
}

export function commandSuggestions(workspace: ForgeWorkspace): string[] {
  const suggestions: string[] = [];
  if (workspace.nodes.length < 6) {
    suggestions.push("Add more evidence nodes to unlock stronger clustering.");
  }
  if (workspace.edges.length === 0) {
    suggestions.push("Run Analyze to infer links between notes, code, and entities.");
  }
  if (workspace.clusters.length > 1) {
    suggestions.push("Use Auto layout after Analyze to group clusters spatially.");
  }
  if (!workspace.nodes.some((node) => node.kind === "image")) {
    suggestions.push("Drop a screenshot or diagram into the workspace to mix visual evidence with text.");
  }
  suggestions.push("Export the workspace JSON after a strong session to preserve a portable local-first artifact.");
  return suggestions.slice(0, 4);
}
