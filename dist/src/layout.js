export const CIRCUIT_FRAME=Object.freeze({
  viewBox:Object.freeze({x:30,y:24,width:700,height:290}),
  safe:Object.freeze({left:34,right:724,top:34,bottom:306}),
  supply:Object.freeze({x:90,left:54,right:170}),
  network:Object.freeze({left:126,right:724,top:34,bottom:300}),
  returnY:315,
  gap:8,
  lead:8
});

export const COMPONENT_SIZE=Object.freeze({
  horizontal:Object.freeze({width:128,height:52}),
  vertical:Object.freeze({width:52,height:128}),
  valuePill:Object.freeze({width:96,height:23,gap:5})
});

export function componentSize(orientation='horizontal'){
  return COMPONENT_SIZE[orientation==='vertical'?'vertical':'horizontal'];
}

export function graphIsSeriesPath(graph){
  if(!graph?.edges.length)return false;
  const adjacency=new Map(),degree=new Map();
  graph.edges.forEach(edge=>{if(!adjacency.has(edge.a))adjacency.set(edge.a,new Set());if(!adjacency.has(edge.b))adjacency.set(edge.b,new Set());adjacency.get(edge.a).add(edge.b);adjacency.get(edge.b).add(edge.a);degree.set(edge.a,(degree.get(edge.a)||0)+1);degree.set(edge.b,(degree.get(edge.b)||0)+1)});
  if(graph.edges.length>1){const degrees=[...degree.values()];if(degrees.filter(value=>value===1).length!==2||degrees.some(value=>value>2))return false}
  const pending=[adjacency.keys().next().value],visited=new Set();while(pending.length){const node=pending.pop();if(visited.has(node))continue;visited.add(node);adjacency.get(node)?.forEach(next=>pending.push(next))}
  return visited.size===adjacency.size;
}

export function graphIsParallelBank(graph){
  return Boolean(graph?.edges.length>1&&graph.edges.every(edge=>[edge.a,edge.b].sort().join('|')===[graph.edges[0].a,graph.edges[0].b].sort().join('|')));
}

const TEMPLATES=Object.freeze({
  sandwich:{A:[100,165],B:[250,165],C:[550,165],D:[700,165],R1:[175,165],R2:[400,75],R3:[400,255],R4:[625,165]},
  'double-bank':{A:[100,165],B:[400,165],C:[700,165],R1:[250,75],R2:[250,255],R3:[550,75],R4:[550,255]},
  'split-series':{A:[100,165],T:[400,75],U:[400,255],B:[700,165],R1:[250,75],R2:[550,75],R3:[250,255],R4:[550,255]},
  'unequal-branches':{A:[100,165],B:[250,165],T:[400,75],C:[550,165],D:[700,165],R1:[175,165],R2:[400,255],R3:[325,75],R4:[475,75],R5:[625,165]},
  'three-way-tail':{A:[100,165],B:[250,165],T:[400,65],U:[400,265],C:[550,165],D:[700,165],R1:[175,165],R2:[400,165],R3:[325,65],R4:[475,65],R5:[325,265],R6:[475,265],R7:[625,165]},
  'offset-double':{A:[96,165],B:[246,165],T:[390,75],C:[534,165],U:[690,110],D:[690,310],R1:[171,165],R2:[318,75],R3:[462,75],R4:[390,255],R5:[612,110],R6:[690,210]},
  'parallel-series-parallel':{A:[100,165],B:[280,165],C:[520,165],D:[700,165],R1:[190,70],R2:[190,260],R3:[400,165],R4:[610,70],R5:[610,260]}
});

export function templatePositions(name){
  const template=TEMPLATES[name];
  if(!template)throw new Error(`Unknown circuit layout template: ${name}`);
  return Object.fromEntries(Object.entries(template).map(([key,value])=>[key,[...value]]));
}

export function componentOrientation(level,edge){
  const a=level.positions?.[edge.a],b=level.positions?.[edge.b];
  return a&&b&&Math.abs(a[1]-b[1])>Math.abs(a[0]-b[0])?'vertical':'horizontal';
}

const overlaps=(a,b,gap=CIRCUIT_FRAME.gap)=>Math.abs(a.x-b.x)<(a.width+b.width)/2+gap&&Math.abs(a.y-b.y)<(a.height+b.height)/2+gap;

export function validateCustomLayout(level){
  if(level.layout!=='custom')return [];
  const issues=[],safe=CIRCUIT_FRAME.safe;
  const boxes=level.graph.edges.map(edge=>{
    const [x,y]=level.positions[edge.id],orientation=componentOrientation(level,edge),size=componentSize(orientation);
    return{id:edge.id,x,y,orientation,...size};
  });
  for(const box of boxes){
    if(box.x-box.width/2<safe.left||box.x+box.width/2>safe.right||box.y-box.height/2<safe.top||box.y+box.height/2>safe.bottom)issues.push(`${box.id} crosses the circuit safe area`);
    const edge=level.graph.edges.find(item=>item.id===box.id),a=level.positions[edge.a],b=level.positions[edge.b],lead=CIRCUIT_FRAME.lead;
    const before=box.orientation==='vertical'?Math.abs(box.y-a[1])-box.height/2:Math.abs(box.x-a[0])-box.width/2;
    const after=box.orientation==='vertical'?Math.abs(b[1]-box.y)-box.height/2:Math.abs(b[0]-box.x)-box.width/2;
    if(before<lead||after<lead)issues.push(`${box.id} needs at least ${lead}px of straight lead at each end`);
  }
  for(let left=0;left<boxes.length;left++)for(let right=left+1;right<boxes.length;right++)if(overlaps(boxes[left],boxes[right]))issues.push(`${boxes[left].id} overlaps ${boxes[right].id}`);
  for(const node of level.graph.nodes){
    const [x,y]=level.positions[node];
    for(const box of boxes)if(Math.abs(x-box.x)<=box.width/2&&Math.abs(y-box.y)<=box.height/2)issues.push(`${node} is hidden by ${box.id}`);
  }
  return issues;
}
