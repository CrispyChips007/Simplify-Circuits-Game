import { LEVELS } from './levels.js?v=20261015-42';
import { cloneGraph, expandEdge, isSolved, nearlyEqual, relationship, reduceGraph, treeValues } from './solver.js?v=20261015-44';
import { loadProgress, resetProgress, saveResult } from './storage.js?v=20261014-38';
import { levelSupply } from './supplies.js?v=20261014-38';

const $=selector=>document.querySelector(selector);
let progress=loadProgress();
const initialUnlocked=progress.unlocked;
// TEMPORARY TESTING OVERRIDE — remove this entire block before public release.
// It deliberately ignores saved progression so every level can be tested after an update.
{
  progress={...progress,unlocked:LEVELS.length};
}
// END TEMPORARY TESTING OVERRIDE.
let levelIndex=Math.max(0,Math.min(initialUnlocked-1,LEVELS.length-1));
let state;

const fmt=value=>Number.isInteger(value)?String(value):Number(value.toFixed(2)).toString();
const mobileCircuit=()=>matchMedia('(max-width:540px)').matches;
const spaced=(count,start,end)=>count===1?[(start+end)/2]:Array.from({length:count},(_,index)=>start+(end-start)*index/(count-1));
const seriesXs=count=>count===1?[410]:count===2?[320,500]:count===3?[260,410,560]:spaced(count,220,600);
const seriesPositions=count=>{
  if(count<=3)return seriesXs(count).map(x=>({x,y:100}));
  const topCount=Math.ceil(count/2),bottomCount=count-topCount;
  const top=spaced(topCount,245,575).map(x=>({x,y:120}));
  const bottom=spaced(bottomCount,245,575).reverse().map(x=>({x,y:260}));
  return [...top,...bottom];
};
const seriesLoopPositions=count=>{
  const topCount=Math.ceil((count-1)/2),bottomCount=count-1-topCount;
  const [start,end]=mobileCircuit()?[250,530]:[285,515];
  return [...spaced(topCount,start,end).map(x=>({x,y:80})),{x:640,y:190},...spaced(bottomCount,start,end).reverse().map(x=>({x,y:300}))];
};
const usesSeriesLoop=(graph=state.graph)=>state.level.layout==='series'&&graph.edges.length>=3;
const usesVerticalMixed=()=>state.level.layout==='mixed'&&state.level.mixedOrientation==='vertical';
const supply=()=>levelSupply(state.level);
const supplyVoltage=()=>supply().voltage;
const supplyCapacity=()=>supply().capacity;
const currentValue=()=>state.current??0;
const subscriptNumber=value=>String(value).replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
const svgResistorLabel=label=>{const match=String(label).match(/^R(.+)$/);return match?`R<tspan class="subscript resistor-subscript" baseline-shift="sub">${match[1]}</tspan>`:label};
const plainResistorLabel=label=>String(label).replace(/^R(.+)$/,(_,suffix)=>`R${suffix.replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[Number(d)])}`);
const leafResistorIds=edge=>edge.history?.children?edge.history.children.flatMap(leafResistorIds):[edge.id];
const resistorIsVertical=(edge,graph=state.graph)=>{
  if(state.level.layout==='parallel')return true;
  if(state.level.layout==='custom'){
    const a=state.level.positions[edge.a],b=state.level.positions[edge.b];
    return Boolean(a&&b&&Math.abs(a[0]-b[0])<Math.abs(a[1]-b[1]));
  }
  if(usesVerticalMixed()){
    const leaves=leafResistorIds(edge);
    return leaves.length>0&&leaves.every(id=>id==='R2'||id==='R3');
  }
  return false;
};
const resistor=(edge,x,y,vertical=false)=>{const enlarged=mobileCircuit(),showValue=state.level.mode!=='relation',w=vertical?(enlarged?68:54):(enlarged?128:110),h=vertical?(enlarged?130:104):(enlarged?52:44),labelY=h/2+(showValue?-4:6);return `<g class="resistor${vertical?' vertical':''}${state.selected.has(edge.id)?' selected':''}${state.hinted.has(edge.id)?' hinted':''}" data-id="${edge.id}" tabindex="0" role="button" transform="translate(${x-w/2} ${y-h/2})"><rect class="body" width="${w}" height="${h}" rx="2"/><text class="rid" x="${w/2}" y="${labelY}">${svgResistorLabel(edge.label||edge.id)}</text>${showValue?`<text class="ohms" x="${w/2}" y="${h/2+14}">${fmt(edge.value)} Ω</text>`:''}</g>`};
const battery=(top,bottom)=>{const mid=(top+bottom)/2,selectable=!state.solved,voltage=supplyVoltage(),capacity=supplyCapacity();if(state.phase==='supply'){const sources=state.level.supplies,series=state.level.supplyConnection==='series',gap=56,first=mid-gap*(sources.length-1)/2;const symbols=sources.map((item,index)=>{const id=`SUPPLY:${index}`,x=series?90:65+index*50,y=series?first+index*gap:mid;return `<g class="supply-component selectable${state.selected.has(id)?' selected':''}" data-id="${id}" tabindex="0" role="button"><rect class="supply-hitbox" x="${x-32}" y="${y-23}" width="64" height="46" rx="8"/><path class="battery-line" d="M${x-20} ${y-6} H${x+20} M${x-13} ${y+6} H${x+13}"/><text class="battery-text supply-voltage" x="${x-29}" y="${y-11}">${item.voltage} V</text><text class="battery-text supply-capacity" x="${x-29}" y="${y+21}">${item.capacity} Ah</text></g>`}).join('');const wires=series?`M90 ${top} V${first-6} ${sources.slice(1).map((_,index)=>`M90 ${first+index*gap+6} V${first+(index+1)*gap-6}`).join(' ')} M90 ${first+(sources.length-1)*gap+6} V${bottom}`:`M65 ${top} H${65+(sources.length-1)*50} M65 ${bottom} H${65+(sources.length-1)*50} ${sources.map((_,index)=>`M${65+index*50} ${top} V${mid-6} M${65+index*50} ${mid+6} V${bottom}`).join(' ')}`;return symbols+`<path class="wire" d="${wires}"/>`};return `<g class="supply-component${selectable?' selectable':''}${state.selected.has('SUPPLY')?' selected':''}"${selectable?` data-id="SUPPLY" tabindex="0" role="button" aria-label="${voltage} volt, ${capacity} amp hour supply"`:''}><rect class="supply-hitbox" x="34" y="${mid-52}" width="104" height="104" rx="8"/><path class="wire" d="M90 ${top} V${mid-13} M90 ${mid+13} V${bottom}"/><path class="battery-line" d="M68 ${mid-7} H112 M77 ${mid+7} H103"/><text class="battery-text supply-voltage" x="61" y="${mid}">${voltage} V</text><text class="battery-text supply-capacity" x="61" y="${mid+16}">${capacity} Ah</text></g>`};

function renderOriginal(){
  const edges=state.level.graph?.edges||[];
  const mini=(edge,x,y,vertical=false)=>{const w=vertical?30:72,h=vertical?72:30;return `<rect class="mini-resistor" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="1"/><text class="mini-label" x="${x}" y="${y+4}">${svgResistorLabel(edge.label)}</text>`};
  const miniBattery=(top,bottom)=>{const mid=(top+bottom)/2;return `<path class="wire" d="M145 ${top} V${mid-10} M145 ${mid+10} V${bottom}"/><path class="battery-line" d="M126 ${mid-7} H164 M133 ${mid+7} H157"/><text class="battery-text" x="118" y="${mid}">${supplyVoltage()} V</text><text class="battery-text supply-capacity" x="118" y="${mid+14}">${supplyCapacity()} Ah</text>`};
  if(state.level.layout==='custom'){
    const points=state.level.positions,scale=.52,map=([x,y])=>[405+(x-400)*scale,75+(y-165)*scale];
    const paths=edges.map(edge=>{const a=map(points[edge.a]),b=map(points[edge.b]),p=map(points[edge.id]);return `<path class="wire" d="M${a[0]} ${a[1]} V${p[1]} H${b[0]} V${b[1]}"/>`}).join('');
    const source=map(points[state.level.graph.nodes[0]]),sink=map(points[state.level.graph.nodes[state.level.graph.nodes.length-1]]);
    $('#referenceCircuit').innerHTML=`<path class="wire" d="M145 ${source[1]} H${source[0]} M${sink[0]} ${sink[1]} H700 V140 H145"/>${miniBattery(source[1],140)}${paths}${edges.map(edge=>{const p=map(points[edge.id]);return mini(edge,p[0],p[1])}).join('')}`;
  }else if(state.level.layout==='parallel'){
    const xs=spaced(edges.length,230,530);
    const railEnd=xs[edges.length-1];
    $('#referenceCircuit').innerHTML=`<path class="wire" d="M145 18 H${railEnd} M145 132 H${railEnd}"/>${miniBattery(18,132)}${edges.map((edge,index)=>`<path class="wire" d="M${xs[index]} 18 V132"/>${mini(edge,xs[index],75,true)}`).join('')}`;
  }else if(state.level.layout==='nested'){
    $('#referenceCircuit').innerHTML=`<path class="wire" d="M145 75 H230 M310 75 H340 M340 75 V25 H555 V75 M340 75 V125 H555 V75 M555 75 H585 M665 75 H700 V145 H145"/>${miniBattery(75,145)}${mini(edges[0],270,75)}${mini(edges[1],390,25)}${mini(edges[2],505,25)}${mini(edges[3],390,125)}${mini(edges[4],505,125)}${mini(edges[5],625,75)}<circle class="node" cx="340" cy="75" r="4"/><circle class="node" cx="555" cy="75" r="4"/>`;
  }else if(state.level.layout==='mixed'){
    $('#referenceCircuit').innerHTML=usesVerticalMixed()?`<path class="wire" d="M145 18 H365 M365 18 H570 M365 132 H570 M365 132 H145"/>${miniBattery(18,132)}${mini(edges[0],255,18)}${mini(edges[1],470,75,true)}${mini(edges[2],570,75,true)}<circle class="node" cx="365" cy="18" r="4"/><circle class="node" cx="365" cy="132" r="4"/><circle class="node" cx="470" cy="18" r="4"/><circle class="node" cx="470" cy="132" r="4"/><circle class="node" cx="570" cy="18" r="4"/><circle class="node" cx="570" cy="132" r="4"/>`:`<path class="wire" d="M145 75 H350 M350 75 V25 H575 V75 M350 75 V125 H575 V75 M575 75 H625 V145 H145"/>${miniBattery(75,145)}${mini(edges[0],250,75)}${mini(edges[1],470,25)}${mini(edges[2],470,125)}`;
  }else{
    if(edges.length>=3){
      const topCount=Math.ceil((edges.length-1)/2),bottomCount=edges.length-1-topCount,positions=[...spaced(topCount,285,500).map(x=>({x,y:18})),{x:625,y:75,vertical:true},...spaced(bottomCount,285,500).reverse().map(x=>({x,y:132}))];
      $('#referenceCircuit').innerHTML=`<path class="wire" d="M145 18 H625 V132 H145"/>${miniBattery(18,132)}${edges.map((edge,index)=>mini(edge,positions[index].x,positions[index].y,positions[index].vertical)).join('')}`;
    }else{
      const xs=spaced(edges.length,260,520);
      $('#referenceCircuit').innerHTML=`<path class="wire" d="M145 25 H625 V125 H145"/>${miniBattery(25,125)}${edges.map((edge,index)=>mini(edge,xs[index],25)).join('')}`;
    }
  }
}

function nestedExpanded(graph){const direct=graph.edges.filter(edge=>new Set([edge.a,edge.b]).has('B')&&new Set([edge.a,edge.b]).has('D')).length;return state.level.layout==='nested'&&(graph.nodes.includes('T')||graph.nodes.includes('U')||direct>1)}
function nestedPosition(graph,edge){
  const endpoints=new Set([edge.a,edge.b]);
  if(endpoints.has('A')&&endpoints.has('B'))return{x:165,y:165};
  if(endpoints.has('D')&&endpoints.has('E'))return{x:635,y:165};
  if(endpoints.has('T'))return{x:endpoints.has('B')?330:470,y:75};
  if(endpoints.has('U'))return{x:endpoints.has('B')?330:470,y:255};
  if(endpoints.has('B')&&endpoints.has('D')){const numbers=String(edge.label||edge.id).match(/\d+/g)?.map(Number)||[];return{x:400,y:numbers.some(number=>number===2||number===3)?75:255}}
  return{x:400,y:165};
}

function circuitPosition(graph,edgeId){
  const edges=graph.edges,index=edges.findIndex(edge=>edge.id===edgeId);
  if(state.level.layout==='custom'){
    const edge=edges[index],saved=state.level.positions[edge.id];
    if(saved)return{x:saved[0],y:saved[1]};
    if(edge.history?.children){
      const a=state.level.positions[edge.a],b=state.level.positions[edge.b];
      if(a&&b&&a[1]===b[1])return{x:(a[0]+b[0])/2,y:a[1]};
      if(a&&b&&a[0]===b[0])return{x:a[0],y:(a[1]+b[1])/2};
      const leaves=[];const collect=item=>item.history?.children?item.history.children.forEach(collect):leaves.push(state.level.positions[item.id]);edge.history.children.forEach(collect);
      const valid=leaves.filter(Boolean);if(valid.length)return{x:valid.reduce((sum,p)=>sum+p[0],0)/valid.length,y:valid.reduce((sum,p)=>sum+p[1],0)/valid.length};
    }
    const a=state.level.positions[edge.a],b=state.level.positions[edge.b];
    return{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2};
  }
  if(nestedExpanded(graph))return nestedPosition(graph,edges[index]);
  const allParallel=state.level.layout==='parallel'&&edges.every(edge=>[edge.a,edge.b].sort().join('|')===[edges[0].a,edges[0].b].sort().join('|'));
  if(allParallel){const xs=edges.length===1?[380]:edges.length===2?[320,440]:edges.length===3?[250,380,510]:edges.map((_,i)=>260+i*100);return{x:xs[index],y:200}}
  if(edges.length===3&&state.level.layout==='mixed')return usesVerticalMixed()?[{x:250,y:80},{x:500,y:190},{x:620,y:190}][index]:[{x:253,y:200},{x:490,y:115},{x:490,y:285}][index];
  if(edges.length===2&&usesVerticalMixed())return resistorIsVertical(edges[index],graph)?{x:620,y:190}:{x:250,y:80};
  if(usesSeriesLoop(graph))return seriesLoopPositions(edges.length)[index];
  return seriesPositions(edges.length)[index];
}

function customWirePath(edge,graph=state.graph){
  const a=state.level.positions[edge.a],b=state.level.positions[edge.b],p=circuitPosition(graph,edge.id);
  return `M${a[0]} ${a[1]} V${p.y} H${b[0]} V${b[1]}`;
}

function currentPill(selectable=false){const current=fmt(currentValue());return `<g class="current-component${selectable?' selectable':''}${state.selected.has('CURRENT')?' selected':''}"${selectable?` data-id="CURRENT" tabindex="0" role="button" aria-label="I total equals ${current} amps"`:''}><rect class="value-pill" x="50" y="38" width="124" height="27" rx="14"/><text class="value-pill-text" x="112" y="57">I<tspan class="subscript" baseline-shift="sub">Total</tspan> = ${current} A</text></g>`}

function renderKnownValues(){
  if(!['complete','voltage'].includes(state.level.mode))return;
  if(!['total','expand','restored'].includes(state.phase))return;
  if(state.current!==null)$('#circuit').insertAdjacentHTML('beforeend',currentPill(!state.solved));
  const labels=state.graph.edges.flatMap(edge=>{
    const known=state.known[edge.id]||{},value=state.values[edge.id],position=circuitPosition(state.graph,edge.id),number=(edge.label||edge.id).replace(/^R/,'').replace(/,/g,'‚'),selectable=!state.solved,vertical=resistorIsVertical(edge),items=[];
    if(known.current&&value&&state.graph.edges.length!==1){const id=`CURRENT:${edge.id}`,y=vertical?position.y-145:position.y-55;items.push(`<g class="resistor-current${selectable?' selectable':''}${state.selected.has(id)?' selected':''}" data-id="${id}" tabindex="0" role="button"><rect class="current-hitbox" x="${position.x-50}" y="${y}" width="100" height="25" rx="12"/><text class="value-pill-text circuit-value" x="${position.x}" y="${y+18}">I${subscriptNumber(number)} = ${fmt(value.current)} A</text></g>`)}
    if(known.voltage&&value){const id=`VOLTAGE:${edge.id}`,y=vertical?position.y+125:position.y+30;items.push(`<g class="known-voltage${selectable?' selectable':''}${state.selected.has(id)?' selected':''}" data-id="${id}" tabindex="0" role="button"><rect class="voltage-hitbox" x="${position.x-50}" y="${y}" width="100" height="25" rx="12"/><text class="value-pill-text voltage-value" x="${position.x}" y="${y+18}">V${subscriptNumber(number)} = ${fmt(value.voltage)} V</text></g>`)}
    return items;
  }).join('');
  $('#circuit').insertAdjacentHTML('beforeend',labels);
}

function renderCircuit(){
  if(state.level.trace){renderTrace();return}
  const edges=state.graph.edges;
  const allParallel=state.level.layout==='parallel'&&edges.every(e=>[e.a,e.b].sort().join('|')===[edges[0].a,edges[0].b].sort().join('|'));
  if(state.level.layout==='custom'){
    const positions=state.level.positions,nodePoint=node=>positions[node];
    const paths=edges.map(edge=>`<path class="wire" d="${customWirePath(edge)}"/>`).join('');
    const first=nodePoint(state.level.graph.nodes[0]),last=nodePoint(state.level.graph.nodes[state.level.graph.nodes.length-1]);
    const outerX=Math.max(700,last[0]);
    $('#circuit').innerHTML=`<path class="wire" d="M90 ${first[1]} H${first[0]} M${last[0]} ${last[1]} H${outerX} V315 H90"/>${battery(first[1],315)}${paths}${edges.map(edge=>{const position=circuitPosition(state.graph,edge.id);return resistor(edge,position.x,position.y,resistorIsVertical(edge))}).join('')}${state.graph.nodes.map(node=>{const p=nodePoint(node);return `<circle class="node" cx="${p[0]}" cy="${p[1]}" r="5"/>`}).join('')}`;
  }else if(allParallel){
    const xs=edges.map(edge=>circuitPosition(state.graph,edge.id).x);
    const railEnd=Math.max(...xs);
    $('#circuit').innerHTML=`<path class="wire parallel-rails" d="M90 80 H${railEnd} M90 320 H${railEnd}"/>${battery(80,320)}${edges.map((e,i)=>`<g class="moving-wires" data-edge-id="${e.id}"><path class="wire" d="M${xs[i]} 80 V320"/><circle class="node" cx="${xs[i]}" cy="80" r="6"/><circle class="node" cx="${xs[i]}" cy="320" r="6"/></g>${resistor(e,xs[i],200,true)}`).join('')}`;
  }else if(nestedExpanded(state.graph)){
    $('#circuit').innerHTML=`<path class="wire" d="M90 165 H245 M555 165 H700 V315 H90 M245 165 V75 H555 V165 M245 165 V255 H555 V165"/>${battery(165,315)}${edges.map(edge=>{const position=circuitPosition(state.graph,edge.id);return resistor(edge,position.x,position.y)}).join('')}<circle class="node" cx="245" cy="165" r="6"/><circle class="node" cx="555" cy="165" r="6"/>`;
  }else if(edges.length===3&&usesVerticalMixed()){
    const [r1,r2,r3]=edges;
    $('#circuit').innerHTML=`<path class="wire" d="M90 80 H410 M410 80 H620 M410 300 H620 M410 300 H90"/>${battery(80,300)}<g class="moving-wires" data-edge-id="${r2.id}"><path class="wire" d="M500 80 V300"/><circle class="node" cx="500" cy="80" r="6"/><circle class="node" cx="500" cy="300" r="6"/></g><g class="moving-wires" data-edge-id="${r3.id}"><path class="wire" d="M620 80 V300"/><circle class="node" cx="620" cy="80" r="6"/><circle class="node" cx="620" cy="300" r="6"/></g>${resistor(r1,250,80)}${resistor(r2,500,190,true)}${resistor(r3,620,190,true)}<circle class="node" cx="410" cy="80" r="6"/><circle class="node" cx="410" cy="300" r="6"/>`;
  }else if(edges.length===2&&usesVerticalMixed()&&edges.some(edge=>resistorIsVertical(edge))){
    $('#circuit').innerHTML=`<path class="wire" d="M90 80 H620 V300 H90"/>${battery(80,300)}${edges.map(edge=>{const position=circuitPosition(state.graph,edge.id);return resistor(edge,position.x,position.y,resistorIsVertical(edge))}).join('')}`;
  }else if(edges.length===3&&state.level.layout==='mixed'){
    const [r1,r2,r3]=edges;
    $('#circuit').innerHTML=`<path class="wire" d="M90 200 H370 M610 200 H680 V350 H90"/>${battery(200,350)}<g class="moving-wires" data-edge-id="${r2.id}"><path class="wire" d="M370 200 V115 H610 V200"/></g><g class="moving-wires" data-edge-id="${r3.id}"><path class="wire" d="M370 200 V285 H610 V200"/></g>${resistor(r1,253,200)}${resistor(r2,490,115)}${resistor(r3,490,285)}<circle class="node" cx="370" cy="200" r="6"/><circle class="node" cx="610" cy="200" r="6"/>`;
  }else if(usesSeriesLoop()){
    const positions=edges.map(edge=>circuitPosition(state.graph,edge.id)),verticalIndex=Math.ceil((edges.length-1)/2);
    $('#circuit').innerHTML=`<path class="wire" d="M90 80 H640 V300 H90"/>${battery(80,300)}${edges.map((edge,index)=>resistor(edge,positions[index].x,positions[index].y,index===verticalIndex)).join('')}`;
  }else{
    const positions=edges.map(edge=>circuitPosition(state.graph,edge.id));
    const wrapped=state.level.layout==='series'&&edges.length>3;
    const top=wrapped?120:100,bottom=wrapped?260:300;
    $('#circuit').innerHTML=`<path class="wire" d="M90 ${top} H680 V${bottom} H90"/>${battery(top,bottom)}${edges.map((edge,index)=>resistor(edge,positions[index].x,positions[index].y)).join('')}`;
  }
  renderKnownValues();
  bindComponents();
}

function renderTrace(expanded=false){
  if(expanded){
    const edges=[{id:'R1',label:'R1',value:10},{id:'R2',label:'R2',value:20},{id:'R3',label:'R3',value:30}];
    $('#circuit').innerHTML=`<path class="wire" d="M90 200 H680 V300 H90"/>${battery(200,300)}${edges.map((e,i)=>resistor(e,268+i*130,200)).join('')}<rect class="value-pill" x="62" y="154" width="116" height="27" rx="14"/><text class="value-pill-text" x="120" y="173">I<tspan class="subscript" baseline-shift="sub">Total</tspan> = 0.2 A</text>`;
  }else $('#circuit').innerHTML=`<path class="wire" d="M90 200 H680 V300 H90"/>${battery(200,300)}${resistor({id:'EQ',label:'R1–R3',value:60},380,200)}<rect class="value-pill" x="62" y="154" width="116" height="27" rx="14"/><text class="value-pill-text" x="120" y="173">I<tspan class="subscript" baseline-shift="sub">Total</tspan> = 0.2 A</text>`;
}

function bindComponents(){
  $('#circuit').querySelectorAll('.resistor').forEach(el=>{const toggle=()=>{if(state.level.preselect||state.solved)return;state.selected.has(el.dataset.id)?state.selected.delete(el.dataset.id):state.selected.add(el.dataset.id);state.hinted.clear();renderCircuit();renderSelection()};el.addEventListener('click',toggle);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}})});
  $('#circuit').querySelectorAll('.supply-component.selectable').forEach(supply=>{const toggle=()=>{if(state.solved)return;const id=supply.dataset.id;state.selected.has(id)?state.selected.delete(id):state.selected.add(id);state.hinted.clear();renderCircuit();renderSelection()};supply.addEventListener('click',toggle);supply.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}})});
  const totalCurrent=$('#circuit').querySelector('.current-component.selectable');if(totalCurrent){const toggle=()=>{state.selected.has('CURRENT')?state.selected.delete('CURRENT'):state.selected.add('CURRENT');renderCircuit();renderSelection()};totalCurrent.addEventListener('click',toggle);totalCurrent.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}})}
  $('#circuit').querySelectorAll('.resistor-current.selectable,.known-voltage.selectable').forEach(el=>{const toggle=()=>{if(state.solved)return;state.selected.has(el.dataset.id)?state.selected.delete(el.dataset.id):state.selected.add(el.dataset.id);state.hinted.clear();renderCircuit();renderSelection()};el.addEventListener('click',toggle);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}})});
}

function renderSelection(){const labels=[...state.selected].map(id=>{if(id==='SUPPLY')return `${supplyVoltage()} V supply`;if(id==='CURRENT')return `Iₜₒₜₐₗ = ${fmt(state.current)} A`;if(id.startsWith('SUPPLY:')){const item=state.level.supplies[Number(id.split(':')[1])];return `${item.voltage} V, ${item.capacity} Ah supply`}const [kind,edgeId]=id.split(':');const edge=state.graph?.edges.find(item=>item.id===(edgeId||id));if(kind==='CURRENT')return `I${subscriptNumber((edge?.label||'').replace(/^R/,''))} = ${fmt(state.values[edgeId].current)} A`;if(kind==='VOLTAGE')return `V${subscriptNumber((edge?.label||'').replace(/^R/,''))} = ${fmt(state.values[edgeId].voltage)} V`;return plainResistorLabel(edge?.label||id)});$('#selectionText').textContent=labels.length?labels.join(', '):(['complete','voltage'].includes(state.level.mode)&&['total','expand'].includes(state.phase)?'Tap circuit values':'Tap resistors')}
function setMessage(text,type=''){const el=$('#message');el.textContent=text;el.className=`message ${type}`}
function actions(){
  if(state.level.mode==='relation')return [['series','Series'],['parallel','Parallel']];
  if(state.phase==='supply')return [
    ['supply-series','VTotal = V1 + V2 + ⋯'],['supply-parallel','VTotal = V1 = V2 = ⋯'],
    ['current-divide','ITotal = VTotal ÷ RTotal'],['voltage-multiply','V = I × R'],
    ['same-current','Current is the same in series'],['same-voltage','Voltage is the same in parallel']
  ];
  return [
    ['series','<math aria-label="R total equals R one plus R two"><msub><mi>R</mi><mtext>Total</mtext></msub><mo>=</mo><msub><mi>R</mi><mn>1</mn></msub><mo>+</mo><msub><mi>R</mi><mn>2</mn></msub><mo>+</mo><mo>⋯</mo></math>'],
    ['parallel','<math aria-label="one over R total equals one over R one plus one over R two"><mfrac><mn>1</mn><msub><mi>R</mi><mtext>Total</mtext></msub></mfrac><mo>=</mo><mfrac><mn>1</mn><msub><mi>R</mi><mn>1</mn></msub></mfrac><mo>+</mo><mfrac><mn>1</mn><msub><mi>R</mi><mn>2</mn></msub></mfrac><mo>+</mo><mo>⋯</mo></math>'],
    ['current-divide','<math aria-label="I equals V divided by R"><mi>I</mi><mo>=</mo><mfrac><mi>V</mi><mi>R</mi></mfrac></math>'],
    ['voltage-multiply','<math aria-label="V equals I times R"><mi>V</mi><mo>=</mo><mi>I</mi><mo>×</mo><mi>R</mi></math>'],
    ['same-current','Current is the same in series'],
    ['same-voltage','Voltage is the same in parallel']
  ];
}

function render(){
  const level=state.level;
  $('#levelNumber').textContent=`LEVEL ${level.id}`;$('#levelName').textContent=`Circuit ${level.id}`;$('#turnCount').textContent=state.turns;$('#promptTitle').textContent=level.title;$('#promptText').textContent=level.prompt;
  $('#actions').className=`actions${level.mode!=='relation'?' formula-bank':''}`;
  $('#actions').innerHTML=actions().map(([id,label])=>`<button class="action${label.includes('<math')?' formula':''}" data-action="${id}">${label}</button>`).join('');
  $('#actions').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>submit(button.dataset.action)));
  renderOriginal();renderCircuit();renderSelection();applyResponsiveViewBoxes();
}

function applyResponsiveViewBoxes(){
  const mobile=matchMedia('(max-width:540px)').matches;
  $('#circuit').setAttribute('viewBox',mobile&&state.level.layout!=='custom'?'30 0 700 390':'0 0 760 390');
  $('#referenceCircuit').setAttribute('viewBox',mobile?'105 0 620 150':'0 0 760 150');
}

function explain(relation,chosen){
  if(!relation)return chosen==='parallel'?'Parallel components must share the same two nodes. This selection does not.':'A series selection must form one unbranched path.';
  if(relation.type!==chosen)return chosen==='parallel'?'Parallel components must share the same two nodes. This selection does not.':'A series path cannot contain a branching node.';
  return relation.type==='parallel'?'Same two nodes: valid parallel group.':'One unbranched path: valid series group.';
}

function selectedResistorIds(){const edgeIds=new Set(state.graph.edges.map(edge=>edge.id));return [...state.selected].filter(id=>edgeIds.has(id))}

function submit(action){
  if(state.solved)return;state.turns++;$('#turnCount').textContent=state.turns;
  const calculationLevel=['complete','voltage'].includes(state.level.mode);
  if(state.phase==='supply'){
    const expected=`supply-${state.level.supplyConnection}`,selected=[...state.selected].filter(id=>id.startsWith('SUPPLY:'));
    if(selected.length!==state.level.supplies.length){reject('Select all supplies in the bank.');return}
    if(action!==expected){reject('That rule does not match how these supplies are connected.');return}
    state.phase='simplify';state.selected.clear();render();setMessage('Supply bank combined.','good');return
  }
  if(state.level.mode==='formula'&&!['series','parallel'].includes(action)){reject('That rule cannot simplify the selected resistance group.');return}
  if(calculationLevel&&state.phase==='simplify'&&!['series','parallel'].includes(action)){reject('That rule cannot be applied to the selected values.');return}
  if(calculationLevel&&state.phase==='total'){
    const equivalent=state.graph.edges[0];
    if(!state.selected.has(equivalent.id)){reject('No resistance selected.');return}
    if(action==='same-voltage'){
      if(!state.selected.has('SUPPLY')){reject('Select the supply voltage.');return}
      state.values=treeValues(equivalent,supplyVoltage());state.known={[equivalent.id]:{current:false,voltage:true}};state.selected.clear();render();setMessage('Supply voltage applied to the total resistance.','good');return
    }
    if(action!=='current-divide'){reject('That rule cannot determine an available circuit value.');return}
    const selectedVoltage=state.selected.has('SUPPLY')||(state.known[equivalent.id]?.voltage&&state.selected.has(`VOLTAGE:${equivalent.id}`));
    if(!selectedVoltage){reject('Select the supply voltage or the voltage across the total resistance.');return}
    state.current=supplyVoltage()/equivalent.value;if(!state.values[equivalent.id])state.values=treeValues(equivalent,supplyVoltage());state.known={[equivalent.id]:{current:true,voltage:Boolean(state.known[equivalent.id]?.voltage)}};state.phase='expand';state.selected.clear();render();setMessage(`Iₜₒₜₐₗ = ${fmt(state.current)} A.`,'good');return
  }
  if(calculationLevel&&state.phase==='expand'){
    const resistorIds=selectedResistorIds();
    if(['same-current','same-voltage'].includes(action)&&resistorIds.length){
      const property=action==='same-current'?'current':'voltage',prefix=property==='current'?'CURRENT:':'VOLTAGE:',resistor=resistorIds.length===1?state.graph.edges.find(edge=>edge.id===resistorIds[0]):null;
      const ownValue=resistor&&(state.selected.has(`${prefix}${resistor.id}`)||(property==='current'&&state.graph.edges.length===1&&state.selected.has('CURRENT')));
      if(resistor?.history&&ownValue){
        if(resistor.history.type!==(property==='current'?'series':'parallel')){reject('That rule does not match this saved group.');return}
        const result=expandEdge(state.graph,resistor.id);state.graph=result.graph;delete state.known[resistor.id];
        result.graph.edges.filter(edge=>resistor.history.children.some(child=>child.id===edge.id)).forEach(edge=>{state.known[edge.id]={[property]:true}});
        state.selected.clear();if(finishCalculationIfReady())return;render();setMessage('Valid rule.','good');return
      }
      const selectedTokens=[...state.selected].filter(id=>id.startsWith(prefix)),special=property==='voltage'&&state.selected.has('SUPPLY')?'SUPPLY':property==='current'&&state.selected.has('CURRENT')?'CURRENT':null;
      if(selectedTokens.length+(special?1:0)!==1){reject(`Select one known ${property} value.`);return}
      const sourceId=selectedTokens[0]?.slice(prefix.length),sourceValue=special==='SUPPLY'?supplyVoltage():special==='CURRENT'?state.current:state.values[sourceId]?.[property];
      const targets=resistorIds.filter(id=>id!==sourceId);
      if(!targets.length){reject(`Select a resistance to receive the ${property} value.`);return}
      if(property==='voltage'){
        const endpointKey=edge=>[edge.a,edge.b].sort().join('|'),sourceKey=special==='SUPPLY'?[state.level.graph.nodes[0],state.level.graph.nodes[state.level.graph.nodes.length-1]].sort().join('|'):endpointKey(state.graph.edges.find(edge=>edge.id===sourceId));
        if(targets.some(id=>endpointKey(state.graph.edges.find(edge=>edge.id===id))!==sourceKey)){reject('Those components are not connected across the same two nodes.');return}
      }
      if(property==='current'&&sourceId){const relation=relationship(state.graph,[sourceId,...targets]);if(relation?.type!=='series'){reject('Those components do not form one unbranched series path.');return}}
      if(sourceValue===null||sourceValue===undefined||targets.some(id=>!nearlyEqual(state.values[id]?.[property],sourceValue))){reject(`Those components do not have the same ${property}.`);return}
      targets.forEach(id=>{state.known[id]={...(state.known[id]||{}),[property]:true}});state.selected.clear();
      if(finishCalculationIfReady())return;render();setMessage(`${property==='current'?'Current':'Voltage'} carried to the selected component${targets.length===1?'':'s'}.`,'good');return
    }
    if(resistorIds.length!==1){reject('Select one resistance value.');return}
    const resistor=state.graph.edges.find(edge=>edge.id===resistorIds[0]);
    const known=state.known[resistor.id]||{};
    if(action==='voltage-multiply'){
      const currentSelected=state.selected.has(`CURRENT:${resistor.id}`)||(state.graph.edges.length===1&&state.selected.has('CURRENT'));
      if(!known.current||!currentSelected){reject('Select the current for this resistance.');return}
      if(known.voltage){reject('That voltage is already known.');return}
      known.voltage=true;state.known[resistor.id]=known;state.selected.clear();
      if(finishCalculationIfReady())return;
      render();setMessage('Voltage calculated.','good');return
    }
    if(action==='current-divide'){
      if(!known.voltage||!state.selected.has(`VOLTAGE:${resistor.id}`)){reject('Select the voltage for this resistance.');return}
      if(known.current){reject('That current is already known.');return}
      known.current=true;state.known[resistor.id]=known;state.selected.clear();
      if(finishCalculationIfReady())return;
      render();setMessage('Current calculated.','good');return
    }
    reject('That rule cannot determine a missing value here.');return
  }
  const resistorIds=selectedResistorIds();
  const relation=relationship(state.graph,resistorIds);
  if(!relation||relation.type!==action){reject(explain(relation,action));return}
  const result=reduceGraph(state.graph,resistorIds);
  if(!result.ok){reject(result.reason);return}
  setMessage(explain(relation,action),'good');
  animateToEquivalent(result.graph,result.edge.id,()=>{state.graph=result.graph;state.selected.clear();state.hinted.clear();if(isSolved(state.graph)&&calculationLevel){state.phase='total';render();setMessage('Valid reduction.','good')}else if(isSolved(state.graph)){render();complete()}else{render();setMessage('Valid reduction.','good')}});
}

function reject(text){setMessage(text,'error');$('#circuit').querySelectorAll('.resistor.selected').forEach(el=>{el.classList.remove('wrong');void el.getBoundingClientRect();el.classList.add('wrong')})}

function animateToEquivalent(nextGraph,equivalentId,done){
  const elements=[...$('#circuit').querySelectorAll('.resistor')];
  const selected=elements.filter(el=>el.classList.contains('selected'));
  if(!selected.length){done();return}
  const destination=circuitPosition(nextGraph,equivalentId);
  const items=elements.map(el=>{const matrix=el.transform.baseVal.consolidate()?.matrix,bbox=el.getBBox(),x=matrix?.e||0,y=matrix?.f||0,chosen=el.classList.contains('selected'),nextPosition=chosen?destination:circuitPosition(nextGraph,el.dataset.id);return{el,x,y,cx:x+bbox.width/2,cy:y+bbox.height/2,chosen,destination:nextPosition}});
  const branches=[...$('#circuit').querySelectorAll('.moving-wires')].map(el=>{const id=el.dataset.edgeId,from=circuitPosition(state.graph,id),to=state.selected.has(id)?destination:circuitPosition(nextGraph,id);return{el,dx:to.x-from.x,dy:to.y-from.y}});
  const rails=$('#circuit').querySelector('.parallel-rails');
  const oldRailEnd=state.level.layout==='parallel'?Math.max(...state.graph.edges.map(edge=>circuitPosition(state.graph,edge.id).x)):0;
  const newRailEnd=state.level.layout==='parallel'?Math.max(...nextGraph.edges.map(edge=>circuitPosition(nextGraph,edge.id).x)):0;
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:700,start=performance.now();
  const frame=now=>{const raw=duration?Math.min(1,(now-start)/duration):1,t=1-Math.pow(1-raw,3);items.forEach(item=>{const x=item.x+(item.destination.x-item.cx)*t,y=item.y+(item.destination.y-item.cy)*t;item.el.setAttribute('transform',`translate(${x} ${y})`)});branches.forEach(branch=>branch.el.setAttribute('transform',`translate(${branch.dx*t} ${branch.dy*t})`));if(rails){const railEnd=oldRailEnd+(newRailEnd-oldRailEnd)*t;rails.setAttribute('d',`M90 80 H${railEnd} M90 320 H${railEnd}`)}if(raw<1)requestAnimationFrame(frame);else done()};
  requestAnimationFrame(frame);
}
function bestGroup(){
  const ids=state.graph.edges.map(e=>e.id),groups=[];
  for(let mask=1;mask<(1<<ids.length);mask++){const set=ids.filter((_,i)=>mask&(1<<i));const rel=relationship(state.graph,set);if(rel)groups.push({set,rel})}
  return groups.sort((a,b)=>b.set.length-a.set.length)[0];
}
function finishCalculationIfReady(){
  const original=state.graph.edges.every(edge=>!edge.history),currentDone=original&&state.graph.edges.every(edge=>state.known[edge.id]?.current),voltageDone=original&&state.graph.edges.every(edge=>state.known[edge.id]?.voltage);
  if(currentDone&&(state.level.mode==='complete'||voltageDone)){state.solved=true;state.phase='restored';render();complete();return true}
  return false
}
function hint(){
  if(state.solved)return;state.turns++;$('#turnCount').textContent=state.turns;
  const calculationLevel=['complete','voltage'].includes(state.level.mode);
  if(calculationLevel&&state.phase==='total'){const equivalent=state.graph.edges[0],voltageKnown=state.known[equivalent.id]?.voltage;state.selected=new Set([equivalent.id,voltageKnown?`VOLTAGE:${equivalent.id}`:'SUPPLY']);renderCircuit();renderSelection();setMessage(voltageKnown?'The selected voltage and resistance can determine current.':'The supply voltage and total resistance can determine current.');return}
  if(calculationLevel&&state.phase==='expand'){const edges=state.graph.edges,edge=edges.find(item=>{const known=state.known[item.id]||{};if(item.history){const required=item.history.type==='series'?'current':'voltage';return !known[required]}return !known.current||state.level.mode==='voltage'&&!known.voltage})||edges.find(item=>item.history);if(!edge)return;const known=state.known[edge.id]||{},root=edges.length===1;if(edge.history){const required=edge.history.type==='series'?'current':'voltage';if(!known[required]){const available=required==='current'?'voltage':'current',valueId=available==='current'&&(root)?'CURRENT':`${available.toUpperCase()}:${edge.id}`;state.selected=new Set([edge.id,valueId])}else{const valueId=required==='current'&&root?'CURRENT':`${required.toUpperCase()}:${edge.id}`;state.selected=new Set([edge.id,valueId])}}else if(known.current&&!known.voltage)state.selected=new Set([edge.id,root?'CURRENT':`CURRENT:${edge.id}`]);else state.selected=new Set([edge.id,`VOLTAGE:${edge.id}`]);renderCircuit();renderSelection();setMessage('The selected values can be used together.');return}
  const hint=bestGroup();if(!hint)return;
  state.selected=new Set(hint.set);state.hinted=new Set(hint.set);renderCircuit();renderSelection();setMessage(`These components form a ${hint.rel.type} group.`);
}

function starsFor(turns,best){return turns<=best?3:turns===best+1?2:1}
function complete(trace=false){
  state.solved=true;const stars=starsFor(state.turns,state.level.best);progress=saveResult(state.level.id,stars,localStorage,LEVELS.length);$('#stars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);$('#stars').setAttribute('aria-label',`${stars} out of 3 stars`);$('#completeTitle').textContent=trace?'Original circuit restored':'Circuit solved';$('#completeText').textContent=`${state.turns} turn${state.turns===1?'':'s'}. Best possible: ${state.level.best}.`;$('#nextButton').hidden=state.level.id===LEVELS.length;setMessage('Level complete.','good');$('#gameCard').classList.add('reviewing');$('#resultButton').hidden=false
}

function loadLevel(index){
  levelIndex=index;const level=LEVELS[index],calculationLevel=['complete','voltage'].includes(level.mode),supplyLevel=calculationLevel&&level.supplies?.length>1;state={level,graph:level.graph?cloneGraph(level.graph):null,turns:0,selected:new Set(level.preselect||[]),hinted:new Set(),values:{},known:{},current:null,solved:false,phase:supplyLevel?'supply':calculationLevel?'simplify':null};$('#gameCard').classList.remove('reviewing');$('#resultButton').hidden=true;setMessage('Make a selection.');render()
}

function renderLevels(){
  $('#levelGrid').innerHTML=LEVELS.map((level,index)=>{const unlocked=level.id<=progress.unlocked,stars=progress.stars[level.id]||0;return `<button class="level-tile" data-level="${index}" ${unlocked?'':'disabled'}><span class="number">LEVEL ${level.id}</span><b>Circuit ${level.id}</b>${unlocked?`<span class="tile-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</span>`:'<span class="lock">▣</span>'}</button>`}).join('');
  $('#levelGrid').querySelectorAll('[data-level]:not(:disabled)').forEach(button=>button.addEventListener('click',()=>{$('#levelsDialog').close();loadLevel(Number(button.dataset.level))}))
}

function showResult(){
  if(state.level.id===LEVELS.length){const total=Object.values(progress.stars).reduce((sum,value)=>sum+value,0);$('#chapterStars').textContent=`${total} of ${LEVELS.length*3} stars collected`;$('#chapterDialog').showModal();return}
  $('#completeDialog').showModal();
}

$('#hintButton').addEventListener('click',hint);$('#restartButton').addEventListener('click',()=>loadLevel(levelIndex));$('#resultButton').addEventListener('click',showResult);$('#levelsButton').addEventListener('click',()=>{renderLevels();$('#levelsDialog').showModal()});$('#nextButton').addEventListener('click',()=>{$('#completeDialog').close();loadLevel(Math.min(levelIndex+1,LEVELS.length-1))});$('#replayButton').addEventListener('click',()=>{$('#completeDialog').close();loadLevel(levelIndex)});$('#startAgainButton').addEventListener('click',()=>{progress=resetProgress();progress={...progress,unlocked:LEVELS.length}; // TEMP: keep all levels unlocked during testing.
$('#chapterDialog').close();loadLevel(0)});$('#reviewLevelsButton').addEventListener('click',()=>{$('#chapterDialog').close();renderLevels();$('#levelsDialog').showModal()});document.addEventListener('click',event=>{if(event.target.dataset.open)$(`#${event.target.dataset.open}`).showModal();if(event.target.dataset.close)$(`#${event.target.dataset.close}`).close()});
addEventListener('resize',applyResponsiveViewBoxes);
loadLevel(levelIndex);
