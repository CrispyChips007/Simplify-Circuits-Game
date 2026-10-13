export const EPSILON = 1e-9;

export function cloneGraph(graph) {
  return { nodes: [...graph.nodes], edges: graph.edges.map((edge) => structuredClone(edge)), nextId: graph.nextId || 1 };
}

export function nodeDegree(graph, nodeId) {
  return graph.edges.filter((edge) => edge.a === nodeId || edge.b === nodeId).length;
}

export function selectedEdges(graph, ids) {
  const wanted = new Set(ids);
  return graph.edges.filter((edge) => wanted.has(edge.id));
}

export function parallelEndpoints(edges) {
  if (edges.length < 2) return null;
  const first = [edges[0].a, edges[0].b].sort().join('|');
  return edges.every((edge) => [edge.a, edge.b].sort().join('|') === first)
    ? [edges[0].a, edges[0].b]
    : null;
}

export function seriesEndpoints(graph, edges) {
  if (edges.length < 2) return null;
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const counts = new Map();
  edges.forEach((edge) => {
    counts.set(edge.a, (counts.get(edge.a) || 0) + 1);
    counts.set(edge.b, (counts.get(edge.b) || 0) + 1);
  });
  const endpoints = [...counts].filter(([, count]) => count === 1).map(([node]) => node);
  const internals = [...counts].filter(([, count]) => count === 2).map(([node]) => node);
  if (endpoints.length !== 2 || counts.size !== edges.length + 1) return null;
  if (internals.some((node) => nodeDegree(graph, node) !== 2)) return null;
  const visited = new Set([endpoints[0]]);
  const queue = [endpoints[0]];
  while (queue.length) {
    const node = queue.shift();
    edges.filter((edge) => edgeIds.has(edge.id) && (edge.a === node || edge.b === node)).forEach((edge) => {
      const next = edge.a === node ? edge.b : edge.a;
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    });
  }
  return visited.size === counts.size ? endpoints : null;
}

export function relationship(graph, ids) {
  const edges = selectedEdges(graph, ids);
  if (edges.length !== new Set(ids).size || edges.length < 2) return null;
  const parallel = parallelEndpoints(edges);
  if (parallel) return { type: 'parallel', endpoints: parallel, edges };
  const series = seriesEndpoints(graph, edges);
  if (series) return { type: 'series', endpoints: series, edges };
  return null;
}

export function equivalentValue(type, edges) {
  if (type === 'series') return edges.reduce((total, edge) => total + edge.value, 0);
  return 1 / edges.reduce((total, edge) => total + 1 / edge.value, 0);
}

export function reduceGraph(graph, ids) {
  const relation = relationship(graph, ids);
  if (!relation) return { ok: false, graph, reason: 'Those resistors do not form one reducible group.' };
  const next = cloneGraph(graph);
  const id = `E${next.nextId++}`;
  const chosen = new Set(ids);
  const edge = {
    id,
    label: `R${id.slice(1)}`,
    a: relation.endpoints[0],
    b: relation.endpoints[1],
    value: equivalentValue(relation.type, relation.edges),
    history: { type: relation.type, children: relation.edges.map((item) => structuredClone(item)) }
  };
  next.edges = next.edges.filter((item) => !chosen.has(item.id));
  next.edges.push(edge);
  next.nodes = [...new Set(next.edges.flatMap((item) => [item.a, item.b]))];
  return { ok: true, graph: next, relation, edge };
}

export function isSolved(graph) { return graph.edges.length === 1; }
export function nearlyEqual(a, b) { return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b)); }
