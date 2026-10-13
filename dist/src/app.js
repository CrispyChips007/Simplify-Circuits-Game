import { LEVELS } from './levels.js';
import { cloneGraph, isSolved, relationship, reduceGraph } from './solver.js';
import { loadProgress, saveResult } from './storage.js';

const $=selector=>document.querySelector(selector);
let progress=loadProgress();
let levelIndex=Math.max(0,Math.min(progress.unlocked-1,LEVELS.length-1));
let state;

const fmt=value=>Number.isInteger(value)?String(value):Number(value.toFixed(2)).toString();
const resistor=(edge,x,y,vertical=false)=>{const w=vertical?76:126,h=vertical?88:62;return `<g class="resistor${state.selected.has(edge.id)?' selected':''}${state.hinted.has(edge.id)?' hinted':''}" data-id="${edge.id}" tabindex="0" role="button" transform="translate(${x-w/2} ${y-h/2})"><rect class="body" width="${w}" height="${h}" rx="2"/><text class="rid" x="${w/2}" y="${h/2-2}">${edge.label||edge.id}</text><text class="ohms" x="${w/2}" y="${h/2+18}">${fmt(edge.value)} Ω</text></g>`};
const battery=(top,bottom)=>{const mid=(top+bottom)/2;return `<g><path class="wire" d="M90 ${top} V${mid-13} M90 ${mid+13} V${bottom}"/><path class="battery-line" d="M68 ${mid-7} H112 M77 ${mid+7} H103"/><text class="battery-text" x="61" y="${mid+4}">12 V</text></g>`};

function renderCircuit(){
  if(state.level.trace){renderTrace();return}
  const edges=state.graph.edges;
  const allParallel=edges.length>1&&edges.every(e=>[e.a,e.b].sort().join('|')===[edges[0].a,edges[0].b].sort().join('|'));
  if(allParallel){
    const xs=edges.length===2?[310,500]:edges.length===3?[245,390,535]:edges.map((_,i)=>220+i*110);
    $('#circuit').innerHTML=`<path class="wire" d="M90 100 H650 M90 300 H650"/>${battery(100,300)}${edges.map((e,i)=>`<path class="wire" d="M${xs[i]} 100 V156 M${xs[i]} 244 V300"/><circle class="node" cx="${xs[i]}" cy="100" r="6"/><circle class="node" cx="${xs[i]}" cy="300" r="6"/>${resistor(e,xs[i],200,true)}`).join('')}`;
  }else if(edges.length===3&&state.level.layout==='mixed'){
    const [r1,r2,r3]=edges;
    $('#circuit').innerHTML=`<path class="wire" d="M90 200 H190 M316 200 H370 M370 200 V115 H427 M553 115 H610 V200 M370 200 V285 H427 M553 285 H610 V200 H680 V300 H90"/>${battery(200,300)}${resistor(r1,253,200)}${resistor(r2,490,115)}${resistor(r3,490,285)}<circle class="node" cx="370" cy="200" r="6"/><circle class="node" cx="610" cy="200" r="6"/>`;
  }else{
    const xs=edges.length===2?[300,475]:edges.map((_,i)=>280+i*150);
    let path='M90 200 H'+(xs[0]-63)+' ';
    edges.forEach((_,i)=>{path+=`M${xs[i]+63} 200 H${i===edges.length-1?680:xs[i+1]-63} `});
    $('#circuit').innerHTML=`<path class="wire" d="${path}M680 200 V300 H90"/>${battery(200,300)}${edges.map((e,i)=>resistor(e,xs[i],200)).join('')}`;
  }
  bindResistors();
}

function renderTrace(expanded=false){
  if(expanded){
    const edges=[{id:'R1',label:'R1',value:10},{id:'R2',label:'R2',value:20},{id:'R3',label:'R3',value:30}];
    $('#circuit').innerHTML=`<path class="wire" d="M90 200 H205 M591 200 H680 V300 H90"/>${battery(200,300)}${edges.map((e,i)=>resistor(e,268+i*130,200)).join('')}<rect class="value-pill" x="128" y="154" width="96" height="27" rx="14"/><text class="value-pill-text" x="176" y="173">Iₜ = 0.2 A</text>`;
  }else $('#circuit').innerHTML=`<path class="wire" d="M90 200 H290 M470 200 H680 V300 H90"/>${battery(200,300)}${resistor({id:'EQ',label:'R1–R3',value:60},380,200)}<rect class="value-pill" x="138" y="154" width="96" height="27" rx="14"/><text class="value-pill-text" x="186" y="173">Iₜ = 0.2 A</text>`;
}

function bindResistors(){
  $('#circuit').querySelectorAll('.resistor').forEach(el=>{const toggle=()=>{if(state.level.preselect||state.solved)return;state.selected.has(el.dataset.id)?state.selected.delete(el.dataset.id):state.selected.add(el.dataset.id);state.hinted.clear();renderCircuit();renderSelection()};el.addEventListener('click',toggle);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}})});
}

function renderSelection(){const labels=[...state.selected].map(id=>state.graph?.edges.find(e=>e.id===id)?.label||id);$('#selectionText').textContent=labels.length?labels.join(' + '):'Tap resistors'}
function setMessage(text,type=''){const el=$('#message');el.textContent=text;el.className=`message ${type}`}
function actions(){
  if(state.level.mode==='relation')return [['series','Series'],['parallel','Parallel']];
  if(state.level.mode==='formula')return [
    ['series','<math aria-label="R total equals R one plus R two"><msub><mi>R</mi><mi>T</mi></msub><mo>=</mo><msub><mi>R</mi><mn>1</mn></msub><mo>+</mo><msub><mi>R</mi><mn>2</mn></msub><mo>+</mo><mo>⋯</mo></math>'],
    ['parallel','<math aria-label="one over R total equals one over R one plus one over R two"><mfrac><mn>1</mn><msub><mi>R</mi><mi>T</mi></msub></mfrac><mo>=</mo><mfrac><mn>1</mn><msub><mi>R</mi><mn>1</mn></msub></mfrac><mo>+</mo><mfrac><mn>1</mn><msub><mi>R</mi><mn>2</mn></msub></mfrac><mo>+</mo><mo>⋯</mo></math>']
  ];
  return [['same-current','Current is the same in series'],['same-voltage','Voltage is the same in parallel']];
}

function render(){
  const level=state.level;
  $('#levelNumber').textContent=`LEVEL ${level.id}`;$('#levelName').textContent=level.name;$('#turnCount').textContent=state.turns;$('#promptTitle').textContent=level.title;$('#promptText').textContent=level.prompt;
  $('#actions').innerHTML=actions().map(([id,label])=>`<button class="action${level.mode==='formula'?' formula':''}" data-action="${id}">${label}</button>`).join('');
  $('#actions').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>submit(button.dataset.action)));
  renderCircuit();renderSelection();
}

function explain(relation,chosen){
  if(!relation)return 'That selection is not one continuous series path or a group sharing both nodes.';
  if(relation.type!==chosen)return relation.type==='parallel'?'Those resistors share both nodes, so they are parallel.':'There is no branch between those resistors, so they are series.';
  return relation.type==='parallel'?'Same two nodes: valid parallel group.':'One unbranched path: valid series group.';
}

function submit(action){
  if(state.solved)return;state.turns++;$('#turnCount').textContent=state.turns;
  if(state.level.trace){if(action==='same-current')finishTrace();else reject('The equivalent contains a series path, so current—not voltage—is shared.');return}
  const relation=relationship(state.graph,[...state.selected]);
  if(!relation||relation.type!==action){reject(explain(relation,action));return}
  const result=reduceGraph(state.graph,[...state.selected]);
  if(!result.ok){reject(result.reason);return}
  setMessage(explain(relation,action),'good');
  animateToCentre(()=>{state.graph=result.graph;state.selected.clear();state.hinted.clear();if(isSolved(state.graph))complete();else{render();setMessage('Good reduction. Find the next group.','good')}});
}

function reject(text){setMessage(text,'error');$('#circuit').querySelectorAll('.resistor.selected').forEach(el=>{el.classList.remove('wrong');void el.getBoundingClientRect();el.classList.add('wrong')})}

function animateToCentre(done){
  const selected=[...$('#circuit').querySelectorAll('.resistor.selected')];
  if(!selected.length){done();return}
  const boxes=selected.map(el=>el.getBoundingClientRect());
  const centre={x:boxes.reduce((sum,box)=>sum+box.left+box.width/2,0)/boxes.length,y:boxes.reduce((sum,box)=>sum+box.top+box.height/2,0)/boxes.length};
  const animations=selected.map((el,index)=>{const box=boxes[index],dx=centre.x-(box.left+box.width/2),dy=centre.y-(box.top+box.height/2);return el.animate([{translate:'0 0',scale:1,opacity:1},{translate:`${dx}px ${dy}px`,scale:.42,opacity:0}],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'})});
  Promise.all(animations.map(animation=>animation.finished.catch(()=>{}))).then(done);
}
function finishTrace(){setMessage('The total current now applies to R1, R2 and R3.','good');state.solved=true;renderTrace(true);complete(true)}

function bestGroup(){
  const ids=state.graph.edges.map(e=>e.id),groups=[];
  for(let mask=1;mask<(1<<ids.length);mask++){const set=ids.filter((_,i)=>mask&(1<<i));const rel=relationship(state.graph,set);if(rel)groups.push({set,rel})}
  return groups.sort((a,b)=>b.set.length-a.set.length)[0];
}
function hint(){
  if(state.solved)return;state.turns++;$('#turnCount').textContent=state.turns;
  if(state.level.trace){setMessage('Follow the unbranched path: which quantity must stay unchanged?');return}
  const hint=bestGroup();if(!hint)return;
  state.selected=new Set(hint.set);state.hinted=new Set(hint.set);renderCircuit();renderSelection();setMessage(`These components form a ${hint.rel.type} group.`);
}

function starsFor(turns,best){return turns<=best?3:turns===best+1?2:1}
function complete(trace=false){
  state.solved=true;const stars=starsFor(state.turns,state.level.best);progress=saveResult(state.level.id,stars);$('#stars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);$('#stars').setAttribute('aria-label',`${stars} out of 3 stars`);$('#completeTitle').textContent=trace?'Original circuit restored':'Circuit solved';$('#completeText').textContent=`${state.turns} turn${state.turns===1?'':'s'}. Best possible: ${state.level.best}.`;$('#nextButton').hidden=state.level.id===LEVELS.length;setTimeout(()=>$('#completeDialog').showModal(),300)
}

function loadLevel(index){
  levelIndex=index;const level=LEVELS[index];state={level,graph:level.graph?cloneGraph(level.graph):null,turns:0,selected:new Set(level.preselect||[]),hinted:new Set(),solved:false};setMessage(level.mode==='relation'?'Choose the connection.':level.mode==='formula'?'Select a group, then choose its formula.':'Choose the rule that carries the known value.');render()
}

function renderLevels(){
  $('#levelGrid').innerHTML=LEVELS.map((level,index)=>{const unlocked=level.id<=progress.unlocked,stars=progress.stars[level.id]||0;return `<button class="level-tile" data-level="${index}" ${unlocked?'':'disabled'}><span class="number">LEVEL ${level.id}</span><b>${level.name}</b>${unlocked?`<span class="tile-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</span>`:'<span class="lock">▣</span>'}</button>`}).join('');
  $('#levelGrid').querySelectorAll('[data-level]:not(:disabled)').forEach(button=>button.addEventListener('click',()=>{$('#levelsDialog').close();loadLevel(Number(button.dataset.level))}))
}

$('#hintButton').addEventListener('click',hint);$('#restartButton').addEventListener('click',()=>loadLevel(levelIndex));$('#levelsButton').addEventListener('click',()=>{renderLevels();$('#levelsDialog').showModal()});$('#nextButton').addEventListener('click',()=>{$('#completeDialog').close();loadLevel(Math.min(levelIndex+1,LEVELS.length-1))});$('#replayButton').addEventListener('click',()=>{$('#completeDialog').close();loadLevel(levelIndex)});document.addEventListener('click',event=>{if(event.target.dataset.open)$(`#${event.target.dataset.open}`).showModal();if(event.target.dataset.close)$(`#${event.target.dataset.close}`).close()});
loadLevel(levelIndex);
