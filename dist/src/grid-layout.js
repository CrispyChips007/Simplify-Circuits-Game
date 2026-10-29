export const GRID_COLS=11;
export const GRID_ROWS=7;
export const MIN_COLS=5;
export const MIN_ROWS=3;
const BRANCHED_MIN_COLS=9;

export function glideRotation(from,to,centerRow){
  if(!from||!to||from.orientation===to.orientation)return 0;
  return from.row<centerRow?-90:90;
}

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
    const colOffset=Math.floor((width-child.width)/2);mergeInto(result,child,colOffset,rowOffset);
    const left={col:0,row:child.left.row+rowOffset},childLeft={col:child.left.col+colOffset,row:child.left.row+rowOffset},childRight={col:child.right.col+colOffset,row:child.right.row+rowOffset},right={col:width-1,row:childRight.row};
    addCableRun(result.connections,left,childLeft);addCableRun(result.connections,childRight,right);terminals.push({left,right});
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

function applyPlacementHints(layout,hints){
  const occupied=new Map([...layout.components.values()].map(item=>[cellKey(item.col,item.row),item.id]));
  const exactPorts=(col,row,orientation)=>{const ports=layout.directions.get(cellKey(col,row)),expected=orientation==='vertical'?['N','S']:['E','W'];return ports?.size===2&&expected.every(port=>ports.has(port))};
  for(const component of layout.components.values()){
    const hint=hints.get(component.id);if(!hint||component.type!=='resistor'||hint.orientation!==component.orientation)continue;
    const candidates=[{col:component.col,row:component.row}],steps=component.orientation==='vertical'?[[0,-1],[0,1]]:[[-1,0],[1,0]];
    for(const [dc,dr] of steps){let col=component.col+dc,row=component.row+dr;while(col>=0&&col<layout.cols&&row>=0&&row<layout.rows&&exactPorts(col,row,component.orientation)){const key=cellKey(col,row),other=occupied.get(key);if(other&&other!==component.id)break;candidates.push({col,row});col+=dc;row+=dr}}
    candidates.sort((a,b)=>(Math.abs(a.col-hint.col)+Math.abs(a.row-hint.row))-(Math.abs(b.col-hint.col)+Math.abs(b.row-hint.row))||Math.abs(a.col-component.col)+Math.abs(a.row-component.row)-Math.abs(b.col-component.col)-Math.abs(b.row-component.row));
    const target=candidates[0];if(target.col===component.col&&target.row===component.row)continue;
    occupied.delete(cellKey(component.col,component.row));component.col=target.col;component.row=target.row;occupied.set(cellKey(component.col,component.row),component.id);
  }
}

export function buildGridLayout(graph,{source=graph.source??graph.nodes[0],sink=graph.sink??graph.nodes.at(-1),hints=new Map()}={}){
  const series=graph.edges.length===1||(()=>{const degree=new Map();graph.edges.forEach(edge=>{degree.set(edge.a,(degree.get(edge.a)||0)+1);degree.set(edge.b,(degree.get(edge.b)||0)+1)});return[...degree.values()].filter(value=>value===1).length===2&&[...degree.values()].every(value=>value<=2)})();
  const local=series?buildSeriesRing(graph,source,sink,hints):isParallelBank(graph)?buildParallelBank(graph,hints):buildBranchedLayout(graph,source,sink);
  const colOffset=Math.floor((GRID_COLS-local.width)/2),rowOffset=Math.floor((GRID_ROWS-local.height)/2);
  const layout={cols:GRID_COLS,rows:GRID_ROWS,width:local.width,height:local.height,colOffset,rowOffset,components:new Map(),connections:new Set()};
  mergeInto(layout,local,colOffset,rowOffset);layout.directions=directionsFor(layout);applyPlacementHints(layout,hints);
  layout.wires=[...layout.directions].filter(([key])=>![...layout.components.values()].some(item=>cellKey(item.col,item.row)===key)).map(([key,ports])=>{const [col,row]=parseCell(key);return{col,row,ports:[...ports].sort().join('')}});
  return layout;
}

export function expandSupplyBankGridLayout(layout,count){
  if(count<2)return layout;
  const original=layout.components.get('SUPPLY');if(!original)throw new Error('Supply is missing from the grid.');
  const extra=count-1,shift=Math.max(0,extra-layout.colOffset),components=new Map([...layout.components].map(([id,item])=>[id,{...item,col:item.col+shift}])),connections=new Set();
  for(const raw of layout.connections){const [a,b]=raw.split('|').map(parseCell);addConnection(connections,{col:a[0]+shift,row:a[1]},{col:b[0]+shift,row:b[1]})}
  const supply=components.get('SUPPLY'),supplyKey=cellKey(supply.col,supply.row);for(const raw of [...connections])if(raw.split('|').includes(supplyKey))connections.delete(raw);components.delete('SUPPLY');
  const firstCol=supply.col-extra,lastCol=supply.col;for(let index=0;index<count;index++){const col=firstCol+index,id=`SUPPLY:${index}`;components.set(id,{id,type:'supply',orientation:'vertical',col,row:supply.row});addConnection(connections,{col,row:supply.row-1},{col,row:supply.row});addConnection(connections,{col,row:supply.row},{col,row:supply.row+1})}
  for(let col=firstCol;col<lastCol;col++){addConnection(connections,{col,row:supply.row-1},{col:col+1,row:supply.row-1});addConnection(connections,{col,row:supply.row+1},{col:col+1,row:supply.row+1})}
  const right=layout.colOffset+layout.width-1+shift,expanded={...layout,colOffset:firstCol,width:right-firstCol+1,components,connections};expanded.directions=directionsFor(expanded);expanded.wires=[...expanded.directions].filter(([key])=>![...components.values()].some(item=>cellKey(item.col,item.row)===key)).map(([key,ports])=>{const [col,row]=parseCell(key);return{col,row,ports:[...ports].sort().join('')}});return expanded;
}

export function expandSeriesSupplyGridLayout(layout,count){
  if(count<2)return layout;
  const original=layout.components.get('SUPPLY');if(!original)throw new Error('Supply is missing from the grid.');
  const shift=Math.max(0,2-original.col),components=new Map([...layout.components].map(([id,item])=>[id,{...item,col:item.col+shift}])),connections=new Set();for(const raw of layout.connections){const [a,b]=raw.split('|').map(parseCell);addConnection(connections,{col:a[0]+shift,row:a[1]},{col:b[0]+shift,row:b[1]})}
  const supply=components.get('SUPPLY'),key=cellKey(supply.col,supply.row);for(const raw of [...connections])if(raw.split('|').includes(key))connections.delete(raw);components.delete('SUPPLY');
  const bankCol=supply.col-2,rows=count===3?[1,3,5]:[2,4],topTerminal={col:bankCol,row:rows[0]-1},bottomTerminal={col:bankCol,row:rows.at(-1)+1},topCircuit={col:supply.col,row:supply.row-1},bottomCircuit={col:supply.col,row:supply.row+1};
  const approachCol=supply.col-1,topApproach={col:approachCol,row:topCircuit.row},topOuter={col:approachCol,row:topTerminal.row},bottomOuter={col:approachCol,row:bottomTerminal.row},bottomApproach={col:approachCol,row:bottomCircuit.row};addConnection(connections,topCircuit,topApproach);addCableRun(connections,topApproach,topOuter);addCableRun(connections,topOuter,topTerminal);for(let row=topTerminal.row;row<bottomTerminal.row;row++)addConnection(connections,{col:bankCol,row},{col:bankCol,row:row+1});addCableRun(connections,bottomTerminal,bottomOuter);addCableRun(connections,bottomOuter,bottomApproach);addConnection(connections,bottomApproach,bottomCircuit);
  rows.forEach((row,index)=>components.set(`SUPPLY:${index}`,{id:`SUPPLY:${index}`,type:'supply',orientation:'vertical',col:bankCol,row}));
  const right=layout.colOffset+layout.width-1+shift,expanded={...layout,colOffset:bankCol,width:right-bankCol+1,components,connections};expanded.directions=directionsFor(expanded);expanded.wires=[...expanded.directions].filter(([cell])=>![...components.values()].some(item=>cellKey(item.col,item.row)===cell)).map(([cell,ports])=>{const [col,row]=parseCell(cell);return{col,row,ports:[...ports].sort().join('')}});return expanded;
}

export function reduceSeriesGridLayout(layout,selectedIds,equivalentId){
  const selected=new Set(selectedIds),placements=selectedIds.map(id=>layout.components.get(id)).filter(Boolean);
  if(placements.length!==selectedIds.length)throw new Error('Selected resistor is missing from the grid.');
  const orientation=placements.some(item=>item.orientation==='vertical')?'vertical':'horizontal',average={col:placements.reduce((sum,item)=>sum+item.col,0)/placements.length,row:placements.reduce((sum,item)=>sum+item.row,0)/placements.length},minCol=Math.min(...placements.map(item=>item.col)),maxCol=Math.max(...placements.map(item=>item.col)),minRow=Math.min(...placements.map(item=>item.row)),maxRow=Math.max(...placements.map(item=>item.row)),expected=orientation==='vertical'?['N','S']:['E','W'];
  const occupied=new Set([...layout.components].filter(([id])=>!selected.has(id)).map(([,item])=>cellKey(item.col,item.row))),candidates=[...layout.directions].flatMap(([key,ports])=>{const [col,row]=parseCell(key);return ports.size===2&&expected.every(port=>ports.has(port))&&col>=minCol&&col<=maxCol&&row>=minRow&&row<=maxRow&&!occupied.has(key)?[{col,row}]:[]});
  candidates.sort((a,b)=>(Math.abs(a.col-average.col)+Math.abs(a.row-average.row))-(Math.abs(b.col-average.col)+Math.abs(b.row-average.row))||a.row-b.row||a.col-b.col);const target=candidates[0];
  if(!target)throw new Error('No legal midpoint cell exists for the series reduction.');
  const components=new Map([...layout.components].filter(([id])=>!selected.has(id)).map(([id,item])=>[id,{...item}]));components.set(equivalentId,{id:equivalentId,type:'resistor',orientation,...target});
  const reduced={...layout,components,directions:new Map([...layout.directions].map(([key,ports])=>[key,new Set(ports)]))};
  reduced.wires=[...reduced.directions].filter(([key])=>![...components.values()].some(item=>cellKey(item.col,item.row)===key)).map(([key,ports])=>{const [col,row]=parseCell(key);return{col,row,ports:[...ports].sort().join('')}});
  return reduced;
}

const portDelta={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
function traceToJunction(layout,placement,port){
  let previous={col:placement.col,row:placement.row},current={col:placement.col+portDelta[port][0],row:placement.row+portDelta[port][1]},path=[connectionKey(previous,current)];
  for(let steps=0;steps<layout.cols*layout.rows;steps++){
    const ports=layout.directions.get(cellKey(current.col,current.row))||new Set();if(ports.size!==2)return{terminal:current,path};
    const next=[...ports].map(item=>({col:current.col+portDelta[item][0],row:current.row+portDelta[item][1]})).find(item=>item.col!==previous.col||item.row!==previous.row);if(!next)break;
    path.push(connectionKey(current,next));previous=current;current=next;
  }
  throw new Error('Parallel branch does not reach a junction.');
}
function finishReducedLayout(layout,components,connections){
  const componentCells=new Set([...components.values()].map(item=>cellKey(item.col,item.row)));let changed=true;while(changed){changed=false;const directions=directionsFor({connections});for(const [key,ports] of directions)if(!componentCells.has(key)&&ports.size===1){const [col,row]=parseCell(key),port=[...ports][0],next={col:col+portDelta[port][0],row:row+portDelta[port][1]};connections.delete(connectionKey({col,row},next));changed=true}}
  const reduced={...layout,components,connections};reduced.directions=directionsFor(reduced);reduced.wires=[...reduced.directions].filter(([key])=>!componentCells.has(key)).map(([key,ports])=>{const [col,row]=parseCell(key);return{col,row,ports:[...ports].sort().join('')}});return reduced;
}
export function reduceParallelGridLayout(layout,selectedIds,equivalentId){
  const selected=new Set(selectedIds),placements=selectedIds.map(id=>layout.components.get(id)).filter(Boolean);if(placements.length!==selectedIds.length)throw new Error('Selected resistor is missing from the grid.');
  const components=new Map([...layout.components].filter(([id])=>!selected.has(id)).map(([id,item])=>[id,{...item}])),connections=new Set(layout.connections),average={col:placements.reduce((sum,item)=>sum+item.col,0)/placements.length,row:placements.reduce((sum,item)=>sum+item.row,0)/placements.length},occupied=new Set([...components.values()].map(item=>cellKey(item.col,item.row)));
  let target,orientation;
  if(placements.every(item=>item.orientation==='vertical')&&new Set(placements.map(item=>item.row)).size===1){
    orientation='vertical';const row=placements[0].row,candidates=[];for(let col=Math.min(...placements.map(item=>item.col));col<=Math.max(...placements.map(item=>item.col));col++)if(!occupied.has(cellKey(col,row)))candidates.push({col,row});candidates.sort((a,b)=>Math.abs(a.col-average.col)-Math.abs(b.col-average.col));target=candidates[0];
    for(const placement of placements)for(const raw of [...connections])if(raw.split('|').includes(cellKey(placement.col,placement.row)))connections.delete(raw);
    addConnection(connections,{col:target.col,row:target.row-1},target);addConnection(connections,target,{col:target.col,row:target.row+1});
  }else if(placements.every(item=>item.orientation==='horizontal')){
    orientation='horizontal';const leftTraces=placements.map(item=>traceToJunction(layout,item,'W')),rightTraces=placements.map(item=>traceToJunction(layout,item,'E')),traces=[...leftTraces,...rightTraces],centre=items=>({col:Math.round(items.reduce((sum,item)=>sum+item.terminal.col,0)/items.length),row:Math.round(items.reduce((sum,item)=>sum+item.terminal.row,0)/items.length)});
    traces.forEach(item=>item.path.forEach(raw=>connections.delete(raw)));const left=centre(leftTraces),right=centre(rightTraces),row=Math.round(average.row),col=Math.round(average.col);target={col,row};if(occupied.has(cellKey(col,row)))throw new Error('The parallel midpoint cell is occupied.');
    const before={col:target.col-1,row:target.row},after={col:target.col+1,row:target.row};addCableRun(connections,left,before);addConnection(connections,before,target);addConnection(connections,target,after);addCableRun(connections,after,right);
  }else throw new Error('Mixed-orientation parallel reduction is not supported by this grid.');
  components.set(equivalentId,{id:equivalentId,type:'resistor',orientation,...target});return finishReducedLayout(layout,components,connections);
}

export function chooseReducedGridLayout(current,inPlace,compact,untouchedIds){
  const sameCell=id=>{const before=current.components.get(id),after=compact.components.get(id);return before&&after&&before.col===after.col&&before.row===after.row&&before.orientation===after.orientation};
  return untouchedIds.every(sameCell)?compact:inPlace;
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
