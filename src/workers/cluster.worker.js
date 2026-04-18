const STOPWORDS = new Set([
  "the","and","for","with","from","that","this","into","your","have","will","just","they","them",
  "are","was","were","but","not","you","our","their","out","when","what","where","while","using"
]);

function tokenize(input) {
  return [...new Set(
    `${input || ""}`
      .toLowerCase()
      .replace(/https?:\/\//g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOPWORDS.has(token))
  )];
}

function domainOf(url) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function signal(node) {
  return [...new Set([
    ...tokenize(node.title),
    ...tokenize(node.content),
    ...(node.tags || []),
    node.kind,
    domainOf(node.url)
  ].filter(Boolean))];
}

self.onmessage = (event) => {
  const nodes = event.data.nodes || [];
  const signals = new Map(nodes.map((node) => [node.id, signal(node)]));
  const edges = [];
  const degrees = new Map(nodes.map((node) => [node.id, 0]));

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const left = nodes[i];
      const right = nodes[j];
      const a = new Set(signals.get(left.id));
      const b = new Set(signals.get(right.id));

      let overlap = 0;
      for (const token of a) if (b.has(token)) overlap += 1;
      const sameDomain = domainOf(left.url) && domainOf(left.url) === domainOf(right.url) ? 1 : 0;
      const sameKind = left.kind === right.kind ? 0.5 : 0;
      const weight = overlap + sameDomain + sameKind;

      if (weight >= 2) {
        edges.push({
          id: `${left.id}--${right.id}`,
          from: left.id,
          to: right.id,
          weight: Number(weight.toFixed(2)),
          reason: overlap >= 2 ? "shared keywords" : "shared domain",
          createdAt: new Date().toISOString()
        });
        degrees.set(left.id, (degrees.get(left.id) || 0) + 1);
        degrees.set(right.id, (degrees.get(right.id) || 0) + 1);
      }
    }
  }

  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    adjacency.get(edge.from).push(edge.to);
    adjacency.get(edge.to).push(edge.from);
  }

  const visited = new Set();
  const clusters = [];
  let clusterIndex = 0;

  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    const stack = [node.id];
    const component = [];

    while (stack.length) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (const next of adjacency.get(current) || []) {
        if (!visited.has(next)) stack.push(next);
      }
    }

    const members = nodes.filter((candidate) => component.includes(candidate.id));
    const counts = new Map();
    for (const member of members) {
      for (const token of signal(member)) {
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }

    const keywords = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([token]) => token);

    clusters.push({
      id: `cluster-${clusterIndex}`,
      label: keywords[0] ? `${keywords[0]} cluster` : `cluster ${clusterIndex + 1}`,
      nodeIds: members.map((member) => member.id),
      keywords,
      score: Number((members.length + keywords.length / 10).toFixed(2))
    });

    clusterIndex += 1;
  }

  const topKeywords = [...new Set(clusters.flatMap((cluster) => cluster.keywords))].slice(0, 8);
  const densestNodeId = [...degrees.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const averageDegree = edges.length ? Number(((edges.length * 2) / Math.max(nodes.length, 1)).toFixed(2)) : 0;

  self.postMessage({
    clusters,
    edges,
    metrics: {
      topKeywords,
      densestNodeId,
      averageDegree
    }
  });
};
