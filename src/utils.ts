import type { ForgeNode, NodeKind } from "./types.js";

const STOPWORDS = new Set([
  "the","and","for","with","from","that","this","into","your","have","will","just","they","them",
  "are","was","were","but","not","you","our","their","out","when","what","where","while","into",
  "http","https","www","com","org","net","html","json","using","used","than","over","under"
]);

export function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `forge-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function excerpt(content: string, limit = 140): string {
  if (!content) return "";
  return content.length > limit ? `${content.slice(0, limit)}…` : content;
}

export function tokenize(input: string): string[] {
  return [...new Set(
    input
      .toLowerCase()
      .replace(/https?:\/\//g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  )];
}

export function domainOf(url?: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function inferTags(kind: NodeKind, title: string, content: string, url?: string): string[] {
  const tokens = tokenize(`${title} ${content}`);
  const domain = domainOf(url);
  const tags = [kind, ...tokens.slice(0, 4)];
  if (domain) tags.push(domain);
  return [...new Set(tags)].slice(0, 6);
}

export function sortByUpdated(nodes: ForgeNode[]): ForgeNode[] {
  return [...nodes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function hashToken(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function toVector(text: string, size = 32): Float32Array {
  const vector = new Float32Array(size);
  for (const token of tokenize(text)) {
    const slot = hashToken(token) % size;
    vector[slot] += 1;
  }
  return vector;
}

export function topKeywordsFromNodes(nodes: ForgeNode[], limit = 8): string[] {
  const counts = new Map<string, number>();
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

export function matchesQuery(node: ForgeNode, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return `${node.title} ${node.content} ${node.tags.join(" ")} ${node.url ?? ""}`.toLowerCase().includes(q);
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readTextFile(file: File): Promise<string> {
  return await file.text();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function centerForNode(node: ForgeNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

export function safeJsonParse<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function niceKind(kind: NodeKind): string {
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

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 200): T {
  let timer: number | undefined;
  return ((...args: never[]) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  }) as T;
}
