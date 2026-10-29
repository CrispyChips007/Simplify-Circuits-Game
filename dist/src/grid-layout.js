export const GRID_COLS=11;
export const GRID_ROWS=7;
export const MIN_COLS=7;
export const MIN_ROWS=5;
const BRANCHED_MIN_COLS=9;

const cellKey=(col,row)=>`${col},${row}`;
const parseCell=key=>key.split(',').map(Number);
const connectionKey=(a,b)=>{
  const left=cellKey(a.col,a.row),right=cellKey(b.col,b.row);
  return left<right?`${left}|${right}`:`${right}|${left}`;
};

function addConnection(connections,a,b){
  if(Math.abs(a.col-b.col)+Math.abs(a.row-b.row)!==1)throw new Error(`Grid connection is not adjacent: ${cellKey(a.col,a.row)} to ${cellKey(b.col,b.row)}`);
  connections.add(connectionKey(a,b));
}

function mergeInto(target,source,colOffset=0,rowOffset=0){
  for(const [id,item] of source.components)target.components.set(id,{...item,col:item.col+colOffset,row:item.row+rowOffset});
  for(const raw of source.connections){
    const [a,b]=raw.split('|').map(parseCell);
    addConnection(target.connections,{col:a[0]+colOffset,row:a[1]+rowOffset},{col:b[0]+colOffset,row:b[1]+rowOffset});
  }
}

function normalize(pattern){
  const occupied=[...pattern.components.values()].map(item=>({col:item.col,row:item.row}));
  for(const raw of pattern.connections)for(const point of raw.split('|').map(parseCell))occupied.push({col:point[0],row:point[1]});
  const minCol=Math.min(...occupied.map(item=>item.col)),minRow=Math.min(...occupied.map(item=>item.row));
  if(minCol||minRow){
    const shifted={components:new Map(),connections:new Set(),left:{col:pattern.left.col-minCol,row:pattern.left.row-minRow},right:{col:pattern.right.col-minCol,row:pattern.right.row-minRow}};
    mergeInto(shifted,pattern,-minCol,-minRow);pattern=shifted;
  }
  const points=[...pattern.components.values()].map(item=>({col:item.col,row:item.row}));
  for(const raw of pattern.connections)for(const point of raw.split('|').map(parseCell))points.push({col:point[0],row:point[1]});
  pattern.width=Math.max(...points.map(item=>item.col))+1;pattern.height=Math.max(...points.map(item=>item.row))+1;
  return pattern;
}

function leafPattern(edge){
  const pattern={components:new Map([[edge.id,{id:edge.id,type:'resistor',orientation:'horizontal',col:1,row:0}]]),connections:new Set(),left:{col:0,row:0},right:{col:2,row:0},width:3,height:1};
  addConnection(pattern.connections,pattern.left,{col:1,row:0});addConnection(pattern.connections,{col:1,row:0},pattern.right);
  return pattern;
}

function seriesPattern(children){
  let result=children[0];
  for(const child of children.slice(1)){
    const next={components:new Map(),connections:new Set(),left:{...result.left},right:null};
    mergeInto(next,result);
    const colOffset=result.right.col-child.left.col,rowOffset=result.right.row-child.left.row;
    mergeInto(next,child,colOffset,rowOffset);
    next.right={col:child.right.col+colOffset,row:child.right.row+rowOffset};
    result=normalize(next);
  }
  return result;
}

function addCableRun(connections,from,to){
  let current={...from};
  while(current.col!==to.col){const next={col:current.col+Math.sign(to.col-current.col),row:current.row};addConnection(connections,current,next);current=next}
  while(current.row!==to.row){const next={col:current.col,row:current.row+Math.sign(to.row-current.row)};addConnection(connections,current,next);current=next}
}

function parallelPattern(children){
  const width=Math.max(...children.map(child=>child.width));
  const result={components:new Map(),connections:new Set(),left:null,right:null};
  const terminals=[];let rowOffset=0;
  children.forEach((child,index)=>{
    mergeInto(result,child,0,rowOffset);
    const left={col:0,row:child.left.row+rowOffset},childRight={col:child.right.col,row:child.right.row+rowOffset},right={col:width-1,row:childRight.row};
    addCableRun(result.connections,childRight,right);terminals.push({left,right});
    rowOffset+=child.height+(index===children.length-1?0:1);
  });
  const firstRow=terminals[0].left.row,lastRow=terminals.at(-1).left.row;
  for(let row=firstRow;row<lastRow;row++){addConnection(result.connections,{col:0,row},{col:0,row:row+1});addConnection(result.connections,{col:width-1,row},{col:width-1,row:row+1})}
  const middle=Math.round((firstRow+lastRow)/2);result.left={col:0,row:middle};result.right={col:width-1,row:middle};
  return normalize(result);
}

function nodeSet(edges){return new Set(edges.flatMap(edge=>[edge.a,edge.b]))}

function reachable(edges,start,removed=null){
  const seen=new Set(removed===start?[]:[start]),pending=[...seen];
  while(pending.length){const node=pending.pop();for(const edge of edges){if(edge.a===removed||edge.b===removed)continue;const next=edge.a===node?edge.b:edge.b===node?edge.a:null;if(next!==null&&!seen.has(next)){seen.add(next);pending.push(next)}}}
  return seen;
}

function distances(edges,start){
  const distance=new Map([[start,0]]),pending=[start];
  while(pending.length){const node=pending.shift();for(const edge of edges){const next=edge.a===node?edge.b:edge.b===node?edge.a:null;if(next!==null&&!distance.has(next)){distance.set(next,distance.get(node)+1);pending.push(next)}}}
  return distance;
}

function internalComponents(edges,source,sink){
  const internal=[...nodeSet(edges)].filter(node=>node!==source&&node!==sink),remaining=new Set(internal),components=[];
  while(remaining.size){const first=remaining.values().next().value,component=new Set([first]),pending=[first];remaining.delete(first);while(pending.length){const node=pending.pop();for(const edge of edges){const next=edge.a===node?edge.b:edge.b===node?edge.a:null;if(next!==null&&next!==source&&next!==sink&&remaining.has(next)){remaining.delete(next);component.add(next);pending.push(next)}}}components.push(component)}
  return components;
}

export function decomposeSeriesParallel(graph,source=graph.source??graph.nodes[0],sink=graph.sink??graph.nodes.at(-1),edges=graph.edges){
  if(edges.length===1)return{type:'edge',edge:edges[0]};
  const distance=distances(edges,source),cuts=[...nodeSet(edges)].filter(node=>node!==source&&node!==sink&&!reachable(edges,source,node).has(sink)).sort((a,b)=>(distance.get(a)||0)-(distance.get(b)||0));
  for(const cut of cuts){
    const sourceSide=reachable(edges,source,cut),sinkSide=reachable(edges,sink,cut);
    const left=edges.filter(edge=>(sourceSide.has(edge.a)||edge.a===cut)&&(sourceSide.has(edge.b)||edge.b===cut));
    const right=edges.filter(edge=>(sinkSide.has(edge.a)||edge.a===cut)&&(sinkSide.has(edge.b)||edge.b===cut));
    if(left.length&&right.length&&new Set([...left,...right]).size===edges.length)return{type:'series',children:[decomposeSeriesParallel(graph,source,cut,left),decomposeSeriesParallel(graph,cut,sink,right)]};
  }
  const branches=[];
  for(const edge of edges.filter(edge=>new Set([edge.a,edge.b]).has(source)&&new Set([edge.a,edge.b]).has(sink)))branches.push([edge]);
  for(const component of internalComponents(edges,source,sink))branches.push(edges.filter(edge=>component.has(edge.a)||component.has(edge.b)));
  const unique=branches.filter(branch=>branch.length),covered=new Set(unique.flat());
  if(unique.length>1&&covered.size===edges.length)return{type:'parallel',children:unique.map(branch=>decomposeSeriesParallel(graph,source,sink,branch))};
  throw new Error('Circuit is not a two-terminal series/parallel graph.');
}

function patternFromTree(tree){
  if(tree.type==='edge')return leafPattern(tree.edge);
  const children=tree.children.map(patternFromTree);
  return tree.type==='series'?seriesPattern(children):parallelPattern(children);
}

function orderedSeriesEdges(graph,source,sink){
  const result=[],used=new Set();let node=source;
  while(node!==sink){const edge=graph.edges.find(item=>!used.has(item.id)&&(item.a===node||item.b===node));if(!edge)throw new Error('Series path is incomplete.');used.add(edge.id);result.push(edge);node=edge.a===node?edge.b:edge.a}
  return result;
}

function perimeterPath(width,height,supplyRow){
  const result=[];
  for(let row=supplyRow-1;row>=0;row--)result.push({col:0,row});
  for(let col=1;col<width;col++)result.push({col,row:0});
  for(let row=1;row<height;row++)result.push({col:width-1,row});
  for(let col=width-2;col>=0;col--)result.push({col,row:height-1});
  for(let row=height-2;row>supplyRow;row--)result.push({col:0,row});
  return result;
}

function pathOrientation(path,index){
  const previous=index===0?null:path[index-1],next=index===path.length-1?null:path[index+1];
  if(!previous||!next)return null;
  if(previous.row===next.row)return'horizontal';
  if(previous.col===next.col)return'vertical';
  return null;
}

function chooseSeriesSlots(path,edges,hints,colOffset,rowOffset){
  const eligible=path.map((cell,index)=>({cell,index,orientation:pathOrientation(path,index)})).filter(item=>item.orientation&&item.index>0&&item.index<path.length-1);
  const unplaced=edges.every(edge=>!hints?.has(edge.id)),topOnly=unplaced&&edges.length<=3;
  const upperRow=Math.min(...eligible.filter(item=>item.orientation==='horizontal').map(item=>item.cell.row)),candidates=topOnly?eligible.filter(item=>item.orientation==='horizontal'&&item.cell.row===upperRow):eligible;
  let best=null;
  const visit=(start,chosen)=>{
    if(chosen.length===edges.length){
      let score=0;chosen.forEach((slot,index)=>{const ideal=topOnly?(index+1)*(candidates.length+1)/(edges.length+1)-1:(index+1)*path.length/(edges.length+1),candidateIndex=candidates.indexOf(slot);score+=Math.abs((topOnly?candidateIndex:slot.index)-ideal);const hint=hints?.get(edges[index].id);if(hint){if(hint.orientation!==slot.orientation)score+=250;score+=30*(Math.abs(hint.col-(slot.cell.col+colOffset))+Math.abs(hint.row-(slot.cell.row+rowOffset)))}});
      if(!best||score<best.score)best={score,slots:[...chosen]};return
    }
    for(let index=start;index<candidates.length;index++){const slot=candidates[index];if(chosen.length&&slot.index-chosen.at(-1).index<2)continue;visit(index+1,[...chosen,slot])}
  };
  visit(0,[]);if(!best)throw new Error('Series circuit does not fit the fixed grid.');return best.slots;
}

function buildSeriesRing(graph,source,sink,hints){
  const edges=orderedSeriesEdges(graph,source,sink);let width=MIN_COLS,height=MIN_ROWS,layout=null;
  while(!layout){
    const supplyRow=Math.floor(height/2),path=perimeterPath(width,height,supplyRow);
    const colOffset=Math.floor((GRID_COLS-width)/2),rowOffset=Math.floor((GRID_ROWS-height)/2);
    try{layout={width,height,supply:{col:0,row:supplyRow,orientation:'vertical'},path,slots:chooseSeriesSlots(path,edges,hints,colOffset,rowOffset)}}catch(error){if(width<GRID_COLS)width++;else if(height<GRID_ROWS)height++;else throw error}
  }
  const components=new Map([['SUPPLY',{id:'SUPPLY',type:'supply',...layout.supply}]]),connections=new Set();
  layout.slots.forEach((slot,index)=>components.set(edges[index].id,{id:edges[index].id,type:'resistor',orientation:slot.orientation,...slot.cell}));
  const full=[layout.supply,...layout.path];for(let index=0;index<full.length;index++)addConnection(connections,full[index],full[(index+1)%full.length]);
  return{width:layout.width,height:layout.height,components,connections};
}

function isParallelBank(graph){return graph.edges.length>1&&graph.edges.every(edge=>[edge.a,edge.b].sort().join('|')===[graph.edges[0].a,graph.edges[0].b].sort().join('|'))}

function buildParallelBank(graph,hints){
  const width=Math.max(MIN_COLS,Math.min(GRID_COLS,graph.edges.length*2+1)),height=MIN_ROWS,row=Math.floor(height/2),components=new Map([['SUPPLY',{id:'SUPPLY',type:'supply',orientation:'vertical',col:0,row}]]),connections=new Set(),colOffset=Math.floor((GRID_COLS-width)/2),available=Array.from({length:width-1},(_,index)=>index+1),rightStart=width-1-2*(graph.edges.length-1);
  const columns=graph.edges.map((edge,index)=>{const hint=hints?.get(edge.id),fallback=rightStart>=1?rightStart+index*2:1+index*(width-2)/Math.max(1,graph.edges.length-1),target=hint?hint.col-colOffset:fallback,column=available.reduce((best,item)=>Math.abs(item-target)<Math.abs(best-target)?item:best,available[0]);available.splice(available.indexOf(column),1);return column});
  graph.edges.forEach((edge,index)=>components.set(edge.id,{id:edge.id,type:'resistor',orientation:'vertical',col:columns[index],row}));
  for(let col=0;col<width-1;col++){addConnection(connections,{col,row:row-1},{col:col+1,row:row-1});addConnection(connections,{col,row:row+1},{col:col+1,row:row+1})}
  for(const component of components.values()){addConnection(connections,{col:component.col,row:row-1},component);addConnection(connections,component,{col:component.col,row:row+1})}
  return{width,height,components,connections};
}

function buildBranchedLayout(graph,source,sink){
  const pattern=patternFromTree(decomposeSeriesParallel(graph,source,sink));
  const width=Math.max(BRANCHED_MIN_COLS,pattern.width),height=Math.max(MIN_ROWS,pattern.height+2);
  if(width>GRID_COLS||height>GRID_ROWS)throw new Error(`Circuit requires ${width}×${height} cells; fixed grid is ${GRID_COLS}×${GRID_ROWS}.`);
  const components=new Map(),connections=new Set(),patternRow=Math.floor((height-2-pattern.height)/2),patternCol=Math.floor((width-pattern.width)/2);
  mergeInto({components,connections},pattern,patternCol,patternRow);
  const left={col:pattern.left.col+patternCol,row:pattern.left.row+patternRow},right={col:pattern.right.col+patternCol,row:pattern.right.row+patternRow};
  addCableRun(connections,{col:0,row:left.row},left);addCableRun(connections,right,{col:width-1,row:right.row});
  const supply={id:'SUPPLY',type:'supply',orientation:'vertical',col:0,row:Math.floor(height/2)};components.set('SUPPLY',supply);
  const supplyTop={col:0,row:supply.row-1},supplyBottom={col:0,row:supply.row+1};addCableRun(connections,{col:0,row:left.row},supplyTop);addConnection(connections,supplyTop,supply);addConnection(connections,supply,supplyBottom);
  addCableRun(connections,{col:width-1,row:right.row},{col:width-1,row:height-1});addCableRun(connections,{col:width-1,row:height-1},{col:0,row:height-1});addCableRun(connections,{col:0,row:height-1},supplyBottom);
  return{width,height,components,connections};
}

function directionsFor(layout){
  const directions=new Map();
  const add=(cell,direction)=>{const key=cellKey(cell.col,cell.row);if(!directions.has(key))directions.set(key,new Set());directions.get(key).add(direction)};
  for(const raw of layout.connections){const [left,right]=raw.split('|').map(parseCell),a={col:left[0],row:left[1]},b={col:right[0],row:right[1]};if(a.col<b.col){add(a,'E');add(b,'W')}else if(a.col>b.col){add(a,'W');add(b,'E')}else if(a.row<b.row){add(a,'S');add(b,'N')}else{add(a,'N');add(b,'S')}}
  return directions;
}

export function buildGridLayout(graph,{source=graph.source??graph.nodes[0],sink=graph.sink??graph.nodes.at(-1),hints=new Map()}={}){
  const series=graph.edges.length===1||(()=>{const degree=new Map();graph.edges.forEach(edge=>{degree.set(edge.a,(degree.get(edge.a)||0)+1);degree.set(edge.b,(degree.get(edge.b)||0)+1)});return[...degree.values()].filter(value=>value===1).length===2&&[...degree.values()].every(value=>value<=2)})();
  const local=series?buildSeriesRing(graph,source,sink,hints):isParallelBank(graph)?buildParallelBank(graph,hints):buildBranchedLayout(graph,source,sink);
  const colOffset=Math.floor((GRID_COLS-local.width)/2),rowOffset=Math.floor((GRID_ROWS-local.height)/2);
  const layout={cols:GRID_COLS,rows:GRID_ROWS,width:local.width,height:local.height,colOffset,rowOffset,components:new Map(),connections:new Set()};
  mergeInto(layout,local,colOffset,rowOffset);layout.directions=directionsFor(layout);
  layout.wires=[...layout.directions].filter(([key])=>![...layout.components.values()].some(item=>cellKey(item.col,item.row)===key)).map(([key,ports])=>{const [col,row]=parseCell(key);return{col,row,ports:[...ports].sort().join('')}});
  return layout;
}

export function validateGridLayout(layout){
  const issues=[],occupied=new Map();
  for(const component of layout.components.values()){
    const key=cellKey(component.col,component.row);if(occupied.has(key))issues.push(`${component.id} overlaps ${occupied.get(key)}`);occupied.set(key,component.id);
    if(component.col<0||component.col>=layout.cols||component.row<0||component.row>=layout.rows)issues.push(`${component.id} is outside the grid`);
  }
  for(const component of layout.components.values()){
    const key=cellKey(component.col,component.row);
    const expected=component.orientation==='vertical'?new Set(['N','S']):new Set(['E','W']),actual=layout.directions.get(key)||new Set();if(expected.size!==actual.size||[...expected].some(port=>!actual.has(port)))issues.push(`${component.id} has invalid ports`);
    for(const port of actual){const delta={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]}[port],next=cellKey(component.col+delta[0],component.row+delta[1]);if(occupied.get(next))issues.push(`${component.id} joins directly to ${occupied.get(next)}`)}
  }
  const allowed=new Set(['EW','NS','EN','ES','NW','SW','ENS','ENW','ESW','NSW','ENSW']);for(const wire of layout.wires)if(!allowed.has(wire.ports))issues.push(`Invalid cable ${wire.ports} at ${wire.col},${wire.row}`);
  return issues;
}
