const STOPWORDS = new Set([
    "the", "and", "for", "with", "from", "that", "this", "into", "your", "have", "will", "just", "they", "them",
    "are", "was", "were", "but", "not", "you", "our", "their", "out", "when", "what", "where", "while", "into",
    "http", "https", "www", "com", "org", "net", "html", "json", "using", "used", "than", "over", "under"
]);
export function uuid() {
    if (globalThis.crypto?.randomUUID)
        return globalThis.crypto.randomUUID();
    return `forge-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}
export function nowIso() {
    return new Date().toISOString();
}
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export function excerpt(content, limit = 140) {
    if (!content)
        return "";
    return content.length > limit ? `${content.slice(0, limit)}…` : content;
}
export function tokenize(input) {
    return [...new Set(input
            .toLowerCase()
            .replace(/https?:\/\//g, " ")
            .replace(/[^a-z0-9]+/g, " ")
            .split(/\s+/)
            .filter((token) => token.length > 2 && !STOPWORDS.has(token)))];
}
export function domainOf(url) {
    if (!url)
        return "";
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, "");
    }
    catch {
        return "";
    }
}
export function inferTags(kind, title, content, url) {
    const tokens = tokenize(`${title} ${content}`);
    const domain = domainOf(url);
    const tags = [kind, ...tokens.slice(0, 4)];
    if (domain)
        tags.push(domain);
    return [...new Set(tags)].slice(0, 6);
}
export function sortByUpdated(nodes) {
    return [...nodes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
function hashToken(token) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
        h ^= token.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
export function toVector(text, size = 32) {
    const vector = new Float32Array(size);
    for (const token of tokenize(text)) {
        const slot = hashToken(token) % size;
        vector[slot] += 1;
    }
    return vector;
}
export function topKeywordsFromNodes(nodes, limit = 8) {
    const counts = new Map();
    for (const node of nodes) {
        for (const token of tokenize(`${node.title} ${node.content} ${node.tags.join(" ")}`)) {
            counts.set(token, (counts.get(token) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([token]) => token);
}
export function matchesQuery(node, query) {
    if (!query.trim())
        return true;
    const q = query.toLowerCase();
    return `${node.title} ${node.content} ${node.tags.join(" ")} ${node.url ?? ""}`.toLowerCase().includes(q);
}
export function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function readTextFile(file) {
    return await file.text();
}
export async function fileToDataUrl(file) {
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
    });
}
export function centerForNode(node) {
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}
export function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
export function niceKind(kind) {
    switch (kind) {
        case "note":
            return "Note";
        case "link":
            return "Link";
        case "code":
            return "Code";
        case "image":
            return "Image";
        case "entity":
            return "Entity";
    }
}
export function debounce(fn, wait = 200) {
    let timer;
    return ((...args) => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => fn(...args), wait);
    });
}
