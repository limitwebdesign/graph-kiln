import { inferTags, nowIso, uuid } from "./utils.js";
function makeNode(partial) {
    const createdAt = nowIso();
    return {
        id: uuid(),
        kind: partial.kind,
        title: partial.title,
        content: partial.content,
        url: partial.url,
        imageData: partial.imageData,
        tags: inferTags(partial.kind, partial.title, partial.content, partial.url),
        x: partial.x,
        y: partial.y,
        width: 250,
        height: partial.kind === "image" ? 220 : 170,
        createdAt,
        updatedAt: createdAt,
        lamport: partial.lamport
    };
}
export function createSampleWorkspace() {
    const nodes = [
        makeNode({
            kind: "note",
            title: "Local-first manifesto",
            content: "Keep the primary copy on-device. Sync later. Preserve ownership, privacy, offline progress, and merge history.",
            x: 120,
            y: 120,
            lamport: 1
        }),
        makeNode({
            kind: "code",
            title: "WebGPU compute kernels",
            content: "WGSL kernels for similarity matrices, graph layout experiments, and visual compute passes.",
            x: 480,
            y: 90,
            lamport: 2
        }),
        makeNode({
            kind: "entity",
            title: "Research cockpit",
            content: "One workspace for strategy notes, evidence boards, snippets, screenshots, and active questions.",
            x: 860,
            y: 140,
            lamport: 3
        }),
        makeNode({
            kind: "note",
            title: "Conflict-free merge log",
            content: "Append-only local operations with deterministic merge rules for imported workspaces and later sync.",
            x: 150,
            y: 430,
            lamport: 4
        }),
        makeNode({
            kind: "link",
            title: "Signal Atlas concept",
            content: "Graph ingest for entities, notes, files, and code references.",
            url: "https://www.limit.ro/ecosistem.html",
            x: 520,
            y: 420,
            lamport: 5
        }),
        makeNode({
            kind: "code",
            title: "Transformers adapter hook",
            content: "Optional browser adapter for on-device summarization and embeddings when a model runtime is available.",
            x: 900,
            y: 420,
            lamport: 6
        }),
        makeNode({
            kind: "note",
            title: "Quant signal notebook",
            content: "Local-first reasoning surface for ranking signals, scenarios, constraints, and execution paths.",
            x: 1240,
            y: 140,
            lamport: 7
        }),
        makeNode({
            kind: "image",
            title: "Screenshot node",
            content: "Visual evidence can live next to code, links, and thesis notes.",
            imageData: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='480' height='280' viewBox='0 0 480 280'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='%23152a52'/><stop offset='1' stop-color='%23070d18'/></linearGradient></defs><rect width='480' height='280' rx='22' fill='url(%23g)'/><circle cx='80' cy='74' r='22' fill='%236ea8fe' fill-opacity='0.85'/><rect x='134' y='58' width='228' height='20' rx='10' fill='white' fill-opacity='0.14'/><rect x='46' y='126' width='388' height='16' rx='8' fill='white' fill-opacity='0.1'/><rect x='46' y='154' width='276' height='16' rx='8' fill='white' fill-opacity='0.08'/><rect x='46' y='196' width='168' height='42' rx='14' fill='%236ea8fe' fill-opacity='0.9'/></svg>",
            x: 1240,
            y: 430,
            lamport: 8
        }),
        makeNode({
            kind: "entity",
            title: "Evidence board",
            content: "Legal notes, due diligence trails, SEO entity graphs, and investment memos can live in the same surface.",
            x: 1600,
            y: 280,
            lamport: 9
        })
    ];
    const createdAt = nowIso();
    return {
        id: uuid(),
        title: "GraphKiln // Atlas Alpha",
        nodes,
        edges: [],
        clusters: [],
        actions: nodes.map((node) => ({
            id: uuid(),
            type: "add-node",
            summary: `Added ${node.title}`,
            ts: node.createdAt,
            lamport: node.lamport,
            payload: { node }
        })),
        meta: {
            createdAt,
            updatedAt: createdAt,
            lamport: 9,
            version: "10.0.0"
        }
    };
}
