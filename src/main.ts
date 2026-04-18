import type { AppState, ForgeCluster, ForgeNode, ForgeWorkspace, NodeKind } from "./types.js";
import { createSampleWorkspace } from "./sample-data.js";
import { WorkspaceStorage } from "./storage.js";
import { appendAction, mergeWorkspaces } from "./merge.js";
import { commandSuggestions, selectedNodeSummary, workspaceSummary } from "./summary.js";
import { WasmScoreEngine } from "./wasm-engine.js";
import { probeWebGpu, runWebGpuBenchmark } from "./webgpu.js";
import { ClusterWorkerBridge } from "./worker-bridge.js";
import {
  centerForNode,
  clamp,
  debounce,
  domainOf,
  downloadJson,
  excerpt,
  fileToDataUrl,
  inferTags,
  matchesQuery,
  niceKind,
  nowIso,
  readTextFile,
  sortByUpdated,
  uuid
} from "./utils.js";
import { replayWorkspace } from "./replay.js";

const storage = new WorkspaceStorage();
const wasmEngine = new WasmScoreEngine();
const workerBridge = new ClusterWorkerBridge();

const refs = {
  nodeForm: document.getElementById("nodeForm") as HTMLFormElement,
  nodeKind: document.getElementById("nodeKind") as HTMLSelectElement,
  nodeTitle: document.getElementById("nodeTitle") as HTMLInputElement,
  nodeContent: document.getElementById("nodeContent") as HTMLTextAreaElement,
  nodeUrl: document.getElementById("nodeUrl") as HTMLInputElement,
  nodeFile: document.getElementById("nodeFile") as HTMLInputElement,
  search: document.getElementById("searchInput") as HTMLInputElement,
  nodeLayer: document.getElementById("nodeLayer") as HTMLDivElement,
  edgeLayer: document.getElementById("edgeLayer") as unknown as SVGSVGElement,
  workspaceTitle: document.getElementById("workspaceTitle") as HTMLInputElement,
  summary: document.getElementById("workspaceSummary") as HTMLParagraphElement,
  selectedTitle: document.getElementById("selectedTitle") as HTMLInputElement,
  selectedKind: document.getElementById("selectedKind") as HTMLSelectElement,
  selectedContent: document.getElementById("selectedContent") as HTMLTextAreaElement,
  selectedUrl: document.getElementById("selectedUrl") as HTMLInputElement,
  selectedTags: document.getElementById("selectedTags") as HTMLInputElement,
  selectedSave: document.getElementById("selectedSave") as HTMLButtonElement,
  selectedDelete: document.getElementById("selectedDelete") as HTMLButtonElement,
  selectedSummary: document.getElementById("selectedSummary") as HTMLParagraphElement,
  selectedMeta: document.getElementById("selectedMeta") as HTMLParagraphElement,
  clusterList: document.getElementById("clusterList") as HTMLDivElement,
  suggestionList: document.getElementById("suggestionList") as HTMLUListElement,
  activityList: document.getElementById("activityList") as HTMLUListElement,
  relatedList: document.getElementById("relatedList") as HTMLUListElement,
  statusLine: document.getElementById("statusLine") as HTMLDivElement,
  statsNodes: document.getElementById("statsNodes") as HTMLSpanElement,
  statsEdges: document.getElementById("statsEdges") as HTMLSpanElement,
  statsClusters: document.getElementById("statsClusters") as HTMLSpanElement,
  capabilities: document.getElementById("capabilities") as HTMLUListElement,
  gpuRun: document.getElementById("runGpuBenchmark") as HTMLButtonElement,
  gpuResult: document.getElementById("gpuResult") as HTMLParagraphElement,
  exportButton: document.getElementById("exportWorkspace") as HTMLButtonElement,
  importButton: document.getElementById("importWorkspace") as HTMLButtonElement,
  importInput: document.getElementById("importInput") as HTMLInputElement,
  analyzeButton: document.getElementById("analyzeWorkspace") as HTMLButtonElement,
  layoutButton: document.getElementById("layoutWorkspace") as HTMLButtonElement,
  replayButton: document.getElementById("replayWorkspace") as HTMLButtonElement,
  sampleButton: document.getElementById("loadSample") as HTMLButtonElement,
  clearButton: document.getElementById("clearWorkspace") as HTMLButtonElement
};

let state: AppState = {
  workspace: createSampleWorkspace(),
  selectedNodeId: null,
  query: "",
  capabilities: {
    wasm: "Loading…",
    webgpu: "Probing…",
    serviceWorker: "Registering…"
  },
  gpuBenchmark: "Benchmark idle.",
  related: [],
  statusLine: "Booting GraphKiln…",
  replaying: false
};

let dragState: null | { nodeId: string; startX: number; startY: number; originX: number; originY: number; moved: boolean } = null;
const saveDebounced = debounce(async () => {
  await storage.save(state.workspace);
  setStatus("Workspace saved locally.");
}, 220);

function setStatus(message: string): void {
  state.statusLine = message;
  refs.statusLine.textContent = message;
}

function getSelectedNode(): ForgeNode | null {
  return state.workspace.nodes.find((node) => node.id === state.selectedNodeId) ?? null;
}

function ensureSelectedNode(): void {
  if (!state.selectedNodeId && state.workspace.nodes[0]) {
    state.selectedNodeId = state.workspace.nodes[0].id;
  }
}

function touchWorkspace(): void {
  state.workspace.meta.updatedAt = nowIso();
}

function selectNode(nodeId: string | null): void {
  state.selectedNodeId = nodeId;
  updateDerivedPanels();
  renderGraph();
}

function addNode(node: ForgeNode): void {
  state.workspace.nodes.push(node);
  appendAction(state.workspace, "add-node", `Added ${node.title}`, { node });
  touchWorkspace();
  selectNode(node.id);
  saveDebounced();
}

async function analyzeWorkspace(): Promise<void> {
  setStatus("Analyzing workspace graph…");
  try {
    const result = await workerBridge.analyze(state.workspace.nodes);
    state.workspace.edges = result.edges;
    state.workspace.clusters = result.clusters;
    appendAction(state.workspace, "analyze", "Analyzed workspace graph", { edges: result.edges, clusters: result.clusters });
    touchWorkspace();
    updateDerivedPanels();
    renderGraph();
    saveDebounced();
    setStatus("Analysis complete.");
  } catch (error) {
    console.error(error);
    setStatus("Analysis failed.");
  }
}

function autoLayout(): void {
  if (!state.workspace.nodes.length) return;
  const clusters = state.workspace.clusters.length
    ? state.workspace.clusters
    : [{ id: "all", label: "Workspace", nodeIds: state.workspace.nodes.map((node) => node.id), keywords: [], score: 1 }];

  const byId = new Map(state.workspace.nodes.map((node) => [node.id, node]));
  let clusterIndex = 0;

  for (const cluster of clusters) {
    const column = clusterIndex % 3;
    const row = Math.floor(clusterIndex / 3);
    const baseX = 120 + column * 500;
    const baseY = 120 + row * 360;

    cluster.nodeIds.forEach((nodeId, index) => {
      const node = byId.get(nodeId);
      if (!node) return;
      node.x = baseX + (index % 2) * 240;
      node.y = baseY + Math.floor(index / 2) * 190;
      node.updatedAt = nowIso();
      node.lamport = state.workspace.meta.lamport + index + 1;
    });

    clusterIndex += 1;
  }

  appendAction(state.workspace, "layout", "Auto-layout workspace", { nodes: state.workspace.nodes.map((node) => ({ ...node })) });
  touchWorkspace();
  renderGraph();
  updateDerivedPanels();
  saveDebounced();
  setStatus("Auto-layout applied.");
}

function renderCapabilities(): void {
  refs.capabilities.innerHTML = "";
  const items = [
    `WebAssembly: ${state.capabilities.wasm}`,
    `WebGPU: ${state.capabilities.webgpu}`,
    `Service Worker: ${state.capabilities.serviceWorker}`
  ];

  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    refs.capabilities.appendChild(li);
  }

  refs.gpuResult.textContent = state.gpuBenchmark;
}

function renderStats(): void {
  refs.statsNodes.textContent = String(state.workspace.nodes.length);
  refs.statsEdges.textContent = String(state.workspace.edges.length);
  refs.statsClusters.textContent = String(state.workspace.clusters.length);
  refs.summary.textContent = workspaceSummary(state.workspace);
}

function renderSuggestions(): void {
  refs.suggestionList.innerHTML = "";
  for (const suggestion of commandSuggestions(state.workspace)) {
    const li = document.createElement("li");
    li.textContent = suggestion;
    refs.suggestionList.appendChild(li);
  }
}

function renderClusters(): void {
  refs.clusterList.innerHTML = "";
  const clusters = [...state.workspace.clusters].sort((a, b) => b.nodeIds.length - a.nodeIds.length || b.score - a.score);

  if (!clusters.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Run Analyze to infer graph structure and cluster labels.";
    refs.clusterList.appendChild(empty);
    return;
  }

  for (const cluster of clusters) {
    const card = document.createElement("article");
    card.className = "cluster-card";
    card.innerHTML = `
      <div class="cluster-card__header">
        <strong>${cluster.label}</strong>
        <span>${cluster.nodeIds.length} nodes</span>
      </div>
      <p>${cluster.keywords.join(" • ") || "No keywords"}</p>
    `;
    card.addEventListener("click", () => {
      const first = cluster.nodeIds[0];
      if (first) selectNode(first);
    });
    refs.clusterList.appendChild(card);
  }
}

function renderActivity(): void {
  refs.activityList.innerHTML = "";
  const actions = [...state.workspace.actions].slice(-8).reverse();
  for (const action of actions) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${action.type}</strong><span>${action.summary}</span>`;
    refs.activityList.appendChild(li);
  }
}

function renderRelated(): void {
  refs.relatedList.innerHTML = "";
  if (!state.related.length) {
    const li = document.createElement("li");
    li.textContent = "No related nodes scored yet.";
    refs.relatedList.appendChild(li);
    return;
  }

  for (const item of state.related) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${item.title}</strong><span>${item.score.toFixed(4)}</span>`;
    li.addEventListener("click", () => selectNode(item.nodeId));
    refs.relatedList.appendChild(li);
  }
}

function renderInspector(): void {
  const selected = getSelectedNode();
  if (!selected) {
    refs.selectedTitle.value = "";
    refs.selectedContent.value = "";
    refs.selectedUrl.value = "";
    refs.selectedTags.value = "";
    refs.selectedKind.value = "note";
    refs.selectedMeta.textContent = "No node selected.";
    refs.selectedSummary.textContent = selectedNodeSummary(null, state.workspace);
    return;
  }

  refs.selectedTitle.value = selected.title;
  refs.selectedContent.value = selected.content;
  refs.selectedUrl.value = selected.url ?? "";
  refs.selectedTags.value = selected.tags.join(", ");
  refs.selectedKind.value = selected.kind;
  refs.selectedMeta.textContent = `Updated ${new Date(selected.updatedAt).toLocaleString()} • lamport ${selected.lamport}`;
  refs.selectedSummary.textContent = selectedNodeSummary(selected, state.workspace);
}

function renderGraph(): void {
  refs.nodeLayer.innerHTML = "";
  refs.edgeLayer.innerHTML = "";

  const filtered = state.workspace.nodes.filter((node) => matchesQuery(node, state.query));
  const visibleIds = new Set(filtered.map((node) => node.id));

  for (const edge of state.workspace.edges) {
    if (!visibleIds.has(edge.from) || !visibleIds.has(edge.to)) continue;
    const from = state.workspace.nodes.find((node) => node.id === edge.from);
    const to = state.workspace.nodes.find((node) => node.id === edge.to);
    if (!from || !to) continue;

    const fromCenter = centerForNode(from);
    const toCenter = centerForNode(to);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(fromCenter.x));
    line.setAttribute("y1", String(fromCenter.y));
    line.setAttribute("x2", String(toCenter.x));
    line.setAttribute("y2", String(toCenter.y));
    line.setAttribute("stroke", "rgba(110,168,254,0.38)");
    line.setAttribute("stroke-width", String(Math.max(1, edge.weight * 0.8)));
    line.setAttribute("stroke-linecap", "round");
    refs.edgeLayer.appendChild(line);
  }

  for (const node of state.workspace.nodes) {
    const dimmed = !matchesQuery(node, state.query);
    const element = document.createElement("article");
    element.className = `forge-node forge-node--${node.kind}`;
    if (state.selectedNodeId === node.id) element.classList.add("is-selected");
    if (dimmed) element.classList.add("is-dimmed");
    element.dataset.id = node.id;
    element.style.left = `${node.x}px`;
    element.style.top = `${node.y}px`;
    element.style.width = `${node.width}px`;
    element.style.minHeight = `${node.height}px`;
    element.innerHTML = `
      <header class="forge-node__handle">
        <span class="forge-node__kind">${niceKind(node.kind)}</span>
        <strong>${node.title}</strong>
      </header>
      <div class="forge-node__body">
        ${node.kind === "image" && node.imageData
          ? `<img class="forge-node__image" src="${node.imageData}" alt="${node.title}">`
          : `<p>${excerpt(node.content, 170) || "Empty node."}</p>`}
      </div>
      <footer class="forge-node__footer">
        <span>${node.tags.slice(0, 3).join(" • ")}</span>
        <span>${node.url ? domainOf(node.url) : ""}</span>
      </footer>
    `;
    refs.nodeLayer.appendChild(element);
  }
}

function updateDerivedPanels(): void {
  const selected = getSelectedNode();
  state.related = wasmEngine.rankRelated(selected, state.workspace.nodes);
  renderStats();
  renderInspector();
  renderClusters();
  renderSuggestions();
  renderActivity();
  renderRelated();
  renderCapabilities();
}

function refreshAll(): void {
  refs.workspaceTitle.value = state.workspace.title;
  refs.search.value = state.query;
  updateDerivedPanels();
  renderGraph();
  refs.statusLine.textContent = state.statusLine;
}

function buildNodeFromForm(kind: NodeKind, title: string, content: string, url: string, imageData?: string): ForgeNode {
  state.workspace.meta.lamport += 1;
  const now = nowIso();
  return {
    id: uuid(),
    kind,
    title,
    content,
    url: url || undefined,
    imageData,
    tags: inferTags(kind, title, content, url),
    x: 120 + (state.workspace.nodes.length % 5) * 260,
    y: 120 + Math.floor(state.workspace.nodes.length / 5) * 210,
    width: 250,
    height: kind === "image" ? 220 : 170,
    createdAt: now,
    updatedAt: now,
    lamport: state.workspace.meta.lamport
  };
}

async function handleNodeFormSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const kind = refs.nodeKind.value as NodeKind;
  const title = refs.nodeTitle.value.trim();
  const content = refs.nodeContent.value.trim();
  const url = refs.nodeUrl.value.trim();
  const file = refs.nodeFile.files?.[0];

  if (!title) {
    setStatus("Title is required.");
    return;
  }

  let imageData: string | undefined;
  if (kind === "image" && file) {
    imageData = await fileToDataUrl(file);
  }

  const node = buildNodeFromForm(kind, title, content, url, imageData);
  addNode(node);
  refs.nodeForm.reset();
  refs.nodeKind.value = "note";
  setStatus(`Added ${title}.`);
  refreshAll();
}

function handleSearch(): void {
  state.query = refs.search.value.trim();
  renderGraph();
}

function saveSelectedNode(): void {
  const selected = getSelectedNode();
  if (!selected) return;

  state.workspace.meta.lamport += 1;
  selected.title = refs.selectedTitle.value.trim() || selected.title;
  selected.kind = refs.selectedKind.value as NodeKind;
  selected.content = refs.selectedContent.value;
  selected.url = refs.selectedUrl.value.trim() || undefined;
  selected.tags = refs.selectedTags.value.split(",").map((item) => item.trim()).filter(Boolean);
  selected.updatedAt = nowIso();
  selected.lamport = state.workspace.meta.lamport;

  appendAction(state.workspace, "update-node", `Updated ${selected.title}`, { node: { ...selected } });
  touchWorkspace();
  updateDerivedPanels();
  renderGraph();
  saveDebounced();
  setStatus(`Saved ${selected.title}.`);
}

function deleteSelectedNode(): void {
  const selected = getSelectedNode();
  if (!selected) return;
  state.workspace.nodes = state.workspace.nodes.filter((node) => node.id !== selected.id);
  state.workspace.edges = state.workspace.edges.filter((edge) => edge.from !== selected.id && edge.to !== selected.id);
  state.workspace.clusters = state.workspace.clusters.map((cluster) => ({
    ...cluster,
    nodeIds: cluster.nodeIds.filter((id) => id !== selected.id)
  })).filter((cluster) => cluster.nodeIds.length > 0);
  appendAction(state.workspace, "delete-node", `Deleted ${selected.title}`, { nodeId: selected.id });
  touchWorkspace();
  state.selectedNodeId = state.workspace.nodes[0]?.id ?? null;
  updateDerivedPanels();
  renderGraph();
  saveDebounced();
  setStatus(`Deleted ${selected.title}.`);
}

async function exportWorkspace(): Promise<void> {
  downloadJson("graphkiln-workspace.json", state.workspace);
  setStatus("Workspace exported.");
}

async function importWorkspace(file: File): Promise<void> {
  try {
    const text = await readTextFile(file);
    const parsed = JSON.parse(text) as ForgeWorkspace;
    state.workspace = mergeWorkspaces(state.workspace, parsed);
    ensureSelectedNode();
    updateDerivedPanels();
    renderGraph();
    saveDebounced();
    setStatus("Workspace merged from imported JSON.");
  } catch (error) {
    console.error(error);
    setStatus("Import failed. Expected GraphKiln workspace JSON.");
  }
}

async function loadFreshSample(): Promise<void> {
  state.workspace = createSampleWorkspace();
  state.selectedNodeId = state.workspace.nodes[0]?.id ?? null;
  appendAction(state.workspace, "load-sample", "Loaded sample workspace", { sample: true });
  updateDerivedPanels();
  renderGraph();
  saveDebounced();
  setStatus("Sample workspace loaded.");
}

async function clearWorkspace(): Promise<void> {
  state.workspace.nodes = [];
  state.workspace.edges = [];
  state.workspace.clusters = [];
  appendAction(state.workspace, "clear", "Cleared workspace", {});
  state.selectedNodeId = null;
  updateDerivedPanels();
  renderGraph();
  saveDebounced();
  setStatus("Workspace cleared.");
}

async function bootCapabilities(): Promise<void> {
  await wasmEngine.init();
  state.capabilities.wasm = wasmEngine.status;
  updateDerivedPanels();

  state.capabilities.webgpu = await probeWebGpu();
  updateDerivedPanels();

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      state.capabilities.serviceWorker = "Offline cache registered.";
    } catch {
      state.capabilities.serviceWorker = "Service worker registration failed.";
    }
  } else {
    state.capabilities.serviceWorker = "Service workers unavailable.";
  }
  updateDerivedPanels();
}

function attachDragHandlers(): void {
  refs.nodeLayer.addEventListener("pointerdown", (event) => {
    const target = event.target as HTMLElement;
    const handle = target.closest(".forge-node__handle") as HTMLElement | null;
    if (!handle || state.replaying) return;
    const nodeEl = handle.closest(".forge-node") as HTMLElement | null;
    if (!nodeEl) return;
    const nodeId = nodeEl.dataset.id;
    const node = state.workspace.nodes.find((item) => item.id === nodeId);
    if (!node || !nodeId) return;
    dragState = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      moved: false
    };
    selectNode(nodeId);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  });

  window.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const node = state.workspace.nodes.find((item) => item.id === dragState?.nodeId);
    if (!node) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    node.x = clamp(dragState.originX + dx, 24, 2100);
    node.y = clamp(dragState.originY + dy, 24, 1500);
    node.updatedAt = nowIso();
    dragState.moved = true;
    renderGraph();
  });

  window.addEventListener("pointerup", () => {
    if (!dragState) return;
    const node = state.workspace.nodes.find((item) => item.id === dragState?.nodeId);
    if (node && dragState.moved) {
      state.workspace.meta.lamport += 1;
      node.lamport = state.workspace.meta.lamport;
      appendAction(state.workspace, "move-node", `Moved ${node.title}`, { node: { ...node } });
      touchWorkspace();
      saveDebounced();
      setStatus(`Moved ${node.title}.`);
    }
    dragState = null;
    updateDerivedPanels();
    renderGraph();
  });

  refs.nodeLayer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const nodeEl = target.closest(".forge-node") as HTMLElement | null;
    if (!nodeEl) return;
    const nodeId = nodeEl.dataset.id;
    if (nodeId) selectNode(nodeId);
  });
}

async function boot(): Promise<void> {
  const stored = await storage.load();
  state.workspace = stored ?? createSampleWorkspace();
  ensureSelectedNode();
  refreshAll();
  setStatus("GraphKiln ready.");

  refs.nodeForm.addEventListener("submit", (event) => {
    void handleNodeFormSubmit(event as SubmitEvent);
  });
  refs.search.addEventListener("input", handleSearch);
  refs.workspaceTitle.addEventListener("change", () => {
    state.workspace.title = refs.workspaceTitle.value.trim() || state.workspace.title;
    touchWorkspace();
    saveDebounced();
    setStatus("Workspace title updated.");
  });
  refs.selectedSave.addEventListener("click", saveSelectedNode);
  refs.selectedDelete.addEventListener("click", deleteSelectedNode);
  refs.exportButton.addEventListener("click", () => void exportWorkspace());
  refs.importButton.addEventListener("click", () => refs.importInput.click());
  refs.importInput.addEventListener("change", async () => {
    const file = refs.importInput.files?.[0];
    if (file) await importWorkspace(file);
    refs.importInput.value = "";
  });
  refs.analyzeButton.addEventListener("click", () => void analyzeWorkspace());
  refs.layoutButton.addEventListener("click", autoLayout);
  refs.sampleButton.addEventListener("click", () => void loadFreshSample());
  refs.clearButton.addEventListener("click", () => void clearWorkspace());
  refs.replayButton.addEventListener("click", async () => {
    if (state.replaying) return;
    state.replaying = true;
    const liveWorkspace = state.workspace;
    await replayWorkspace(liveWorkspace, (frame) => {
      state.workspace = frame;
      renderGraph();
      updateDerivedPanels();
    }, setStatus);
    state.workspace = liveWorkspace;
    state.replaying = false;
    refreshAll();
  });
  refs.gpuRun.addEventListener("click", async () => {
    state.gpuBenchmark = "Running WebGPU benchmark…";
    renderCapabilities();
    state.gpuBenchmark = await runWebGpuBenchmark();
    renderCapabilities();
  });

  attachDragHandlers();
  await analyzeWorkspace();
  await bootCapabilities();
  refreshAll();
}

void boot();
