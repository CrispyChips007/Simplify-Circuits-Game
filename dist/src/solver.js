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

export function originalResistorNumbers(edge) {
  if (edge.history?.children) return edge.history.children.flatMap(originalResistorNumbers);
  const match = String(edge.label || edge.id).match(/\d+/g);
  return match ? match.map(Number) : [];
}

export function reduceGraph(graph, ids) {
  const relation = relationship(graph, ids);
  if (!relation) return { ok: false, graph, reason: 'Those resistors do not form one reducible group.' };
  const next = cloneGraph(graph);
  const id = `E${next.nextId++}`;
  const chosen = new Set(ids);
  const resistorNumbers = relation.edges.flatMap(originalResistorNumbers).sort((a, b) => a - b);
  const edge = {
    id,
    label: `R${resistorNumbers.join(',')}`,
    a: relation.endpoints[0],
    b: relation.endpoints[1],
    value: equivalentValue(relation.type, relation.edges),
    history: { type: relation.type, children: relation.edges.map((item) => structuredClone(item)) }
  };
  const insertionIndex = next.edges.findIndex((item) => chosen.has(item.id));
  next.edges = next.edges.filter((item) => !chosen.has(item.id));
  next.edges.splice(insertionIndex, 0, edge);
  next.nodes = [...new Set(next.edges.flatMap((item) => [item.a, item.b]))];
  return { ok: true, graph: next, relation, edge };
}

export function isSolved(graph) { return graph.edges.length === 1; }
export function nearlyEqual(a, b) { return Math.abs(a - b) <= EPSILON * Math.max(1, Math.abs(a), Math.abs(b)); }

export function expandEdge(graph,edgeId){
  const edge=graph.edges.find(item=>item.id===edgeId);
  if(!edge?.history?.children)return {ok:false,graph,reason:'That resistance has no saved components to restore.'};
  const next=cloneGraph(graph),index=next.edges.findIndex(item=>item.id===edgeId);
  next.edges.splice(index,1,...edge.history.children.map(item=>structuredClone(item)));
  next.nodes=[...new Set(next.edges.flatMap(item=>[item.a,item.b]))];
  return {ok:true,graph:next,edge};
}

export function treeValues(edge,voltage){
  const values={};
  const visit=(item,itemVoltage)=>{
    const current=itemVoltage/item.value;
    values[item.id]={voltage:itemVoltage,current};
    if(!item.history?.children)return;
    if(item.history.type==='series')item.history.children.forEach(child=>visit(child,current*child.value));
    else item.history.children.forEach(child=>visit(child,itemVoltage));
  };
  visit(edge,voltage);
  return values;
}

function solveLinear(matrix,values){
  const n=values.length;
  for(let col=0;col<n;col++){
    let pivot=col;
    for(let row=col+1;row<n;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;
    [matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];[values[col],values[pivot]]=[values[pivot],values[col]];
    const divisor=matrix[col][col];
    if(Math.abs(divisor)<EPSILON)throw new Error('Circuit cannot be solved.');
    for(let item=col;item<n;item++)matrix[col][item]/=divisor;values[col]/=divisor;
    for(let row=0;row<n;row++)if(row!==col){const factor=matrix[row][col];for(let item=col;item<n;item++)matrix[row][item]-=factor*matrix[col][item];values[row]-=factor*values[col]}
  }
  return values;
}

export function solveCircuit(graph,supplyVoltage){
  const source=graph.nodes[0],sink=graph.nodes[graph.nodes.length-1];
  const unknown=graph.nodes.filter(node=>node!==source&&node!==sink),index=new Map(unknown.map((node,i)=>[node,i]));
  const matrix=unknown.map(()=>unknown.map(()=>0)),values=unknown.map(()=>0);
  unknown.forEach(node=>graph.edges.filter(edge=>edge.a===node||edge.b===node).forEach(edge=>{
    const other=edge.a===node?edge.b:edge.a,conductance=1/edge.value,row=index.get(node);
    matrix[row][row]+=conductance;
    if(index.has(other))matrix[row][index.get(other)]-=conductance;
    else if(other===source)values[row]+=conductance*supplyVoltage;
  }));
  const solved=unknown.length?solveLinear(matrix,values):[],nodeVoltages={[source]:supplyVoltage,[sink]:0};
  unknown.forEach((node,i)=>nodeVoltages[node]=solved[i]);
  const resistors={};
  graph.edges.forEach(edge=>{const voltage=Math.abs(nodeVoltages[edge.a]-nodeVoltages[edge.b]);resistors[edge.id]={voltage,current:voltage/edge.value}});
  const totalCurrent=graph.edges.filter(edge=>edge.a===source||edge.b===source).reduce((sum,edge)=>sum+Math.abs(nodeVoltages[edge.a]-nodeVoltages[edge.b])/edge.value,0);
  return {nodeVoltages,resistors,totalCurrent,totalResistance:supplyVoltage/totalCurrent};
}
