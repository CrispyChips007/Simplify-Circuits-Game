import { LEVELS } from './levels.js?v=20261029-1';
import { cloneGraph, expandEdge, isSolved, nearlyEqual, relationship, reduceGraph, treeValues } from './solver.js?v=20261029-1';
import { loadProgress, resetProgress, saveResult } from './storage.js?v=20261014-38';
import { levelSupply } from './supplies.js?v=20261014-38';
import { calculationComplete } from './completion.js?v=20261015-53';
import { buildGridLayout } from './grid-layout.js?v=20261029-4';

const $=selector=>document.querySelector(selector);
let progress=loadProgress();
const TEST_ALL_LEVELS=true;
const initialUnlocked=progress.unlocked;
// TEMPORARY TESTING OVERRIDE — remove this entire block before public release.
// It deliberately ignores saved progression so every level can be tested after an update.
{
  progress={...progress,unlocked:LEVELS.length};
}
// END TEMPORARY TESTING OVERRIDE.
let levelIndex=Math.max(0,Math.min(initialUnlocked-1,LEVELS.length-1));
let state;
const TUTORIAL_KEY='circuit-fold-tutorial-v1';
let tutorial={active:false,step:0,firstPlay:!localStorage.getItem(TUTORIAL_KEY)};
const CURRENT_TUTORIAL_KEY='solve-it-current-tutorial-v1';
const FIRST_CURRENT_LEVEL_ID=LEVELS.find(level=>level.mode==='complete')?.id;
let currentTutorial={active:false,step:0,firstPlay:!localStorage.getItem(CURRENT_TUTORIAL_KEY)};

const fmt=value=>Number.isInteger(value)?String(value):Number(value.toFixed(2)).toString();
const supply=()=>levelSupply(state.level);
const supplyVoltage=()=>supply().voltage;
const supplyCapacity=()=>supply().capacity;
const supplyCapacityLabel=()=>`${supplyCapacity()} Ah${state.level.supplies?.length>1&&state.phase!=='supply'&&state.level.supplyConnection==='series'?' (series)':''}`;
const subscriptNumber=value=>String(value).replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
const svgResistorLabel=label=>{const match=String(label).match(/^R(.+)$/);return match?`R<tspan class="subscript resistor-subscript" baseline-shift="sub">${match[1]}</tspan>`:label};
const plainResistorLabel=label=>String(label).replace(/^R(.+)$/,(_,suffix)=>`R${suffix.replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[Number(d)])}`);

function renderOriginal(){
  const snapshot={graph:state.graph,selected:state.selected,hinted:state.hinted,phase:state.phase,solved:state.solved,layoutHints:state.layoutHints,gridLayout:state.gridLayout,gridViewport:state.gridViewport};
  state.graph=cloneGraph(state.level.graph);state.selected=new Set();state.hinted=new Set();state.phase=state.level.supplies?.length>1?'supply':(['complete','voltage'].includes(state.level.mode)?'simplify':null);state.solved=true;state.layoutHints=new Map();state.gridLayout=null;
  const reference=$('#referenceCircuit');renderCircuit(reference,false);
  reference.querySelectorAll('[tabindex]').forEach(element=>{element.removeAttribute('tabindex');element.removeAttribute('role')});
  Object.assign(state,snapshot);
}

function circuitPosition(graph,edgeId){
  const grid=graph===state.graph&&state.gridLayout?state.gridLayout:buildGridLayout(graph,{source:state.level.graph.source,sink:state.level.graph.sink,hints:state.layoutHints});
  const component=grid.components.get(edgeId);
  return component?{x:(component.col+.5)*100,y:(component.row+.5)*100}:null;
}

function gridValueMarkup({placement,id,text,type,selectable}){
  const vertical=placement.orientation==='vertical',selected=state.selected.has(id),originX=placement.col*100,originY=placement.row*100,isCurrent=type==='current',className=isCurrent?(id==='CURRENT'?'current-component':'resistor-current'):'known-voltage',hitbox=isCurrent?'current-hitbox':'voltage-hitbox',textClass=isCurrent?'circuit-value':'voltage-value';
  const transform=vertical?`translate(${originX+(isCurrent?10:90)} ${originY+50}) rotate(-90)`:`translate(${originX+50} ${originY+(isCurrent?11:89)})`;
  return `<g class="${className} grid-component-value${vertical?' vertical-value':''}${selectable?' selectable':''}${selected?' selected':''}" data-id="${id}" tabindex="0" role="button" transform="${transform}"><rect class="${hitbox}" x="-42" y="-9" width="84" height="18" rx="9"/><text class="value-pill-text ${textClass}" x="0" y="4">${text}</text></g>`;
}

function renderKnownValues(){
  if(!['complete','voltage'].includes(state.level.mode)||!['total','expand','restored'].includes(state.phase))return;
  const labels=state.graph.edges.flatMap(edge=>{
    const known=state.known[edge.id]||{},value=state.values[edge.id],placement=state.gridLayout?.components.get(edge.id),rawNumber=(edge.label||edge.id).replace(/^R/,''),grouped=/[,–]/.test(rawNumber),number=rawNumber.replace(/,/g,'‚'),selectable=!state.solved,items=[];if(!placement||!value)return items;
    if(known.current){const root=state.graph.edges.length===1,id=root?'CURRENT':`CURRENT:${edge.id}`,name=root?'I<tspan class="subscript" baseline-shift="sub">Total</tspan>':grouped?'I':`I${subscriptNumber(number)}`;items.push(gridValueMarkup({placement,id,text:`${name} = ${fmt(value.current)} A`,type:'current',selectable}))}
    if(known.voltage){const id=`VOLTAGE:${edge.id}`,name=grouped?'V':`V${subscriptNumber(number)}`;items.push(gridValueMarkup({placement,id,text:`${name} = ${fmt(value.voltage)} V`,type:'voltage',selectable}))}
    return items;
  }).join('');
  $('#circuit').insertAdjacentHTML('beforeend',labels);
}

function gridWireMarkup(layout){
  const lines=[...layout.connections].map(raw=>{const [left,right]=raw.split('|').map(value=>value.split(',').map(Number)),x1=(left[0]+.5)*100,y1=(left[1]+.5)*100,x2=(right[0]+.5)*100,y2=(right[1]+.5)*100;return`<path class="wire grid-wire" d="M${x1} ${y1} L${x2} ${y2}"/>`}).join('');
  const junctions=layout.wires.filter(wire=>wire.ports.length>=3).map(wire=>`<circle class="grid-junction" cx="${(wire.col+.5)*100}" cy="${(wire.row+.5)*100}" r="6"/>`).join('');
  return lines+junctions;
}

function gridResistorMarkup(edge,placement){
  const vertical=placement.orientation==='vertical',selected=state.selected.has(edge.id),hinted=state.hinted.has(edge.id),showValue=state.level.mode!=='relation',transform=`translate(${placement.col*100} ${placement.row*100})`,body=vertical?'<rect class="body" x="35" y="0" width="30" height="100"/>':'<rect class="body" x="0" y="35" width="100" height="30"/>',name=svgResistorLabel(edge.label||edge.id),text=vertical?`<text class="rid" x="50" y="${showValue?48:56}">${name}</text>${showValue?`<text class="ohms" x="50" y="66">${fmt(edge.value)} Ω</text>`:''}`:`<text class="rid" x="50" y="${showValue?48:56}">${name}</text>${showValue?`<text class="ohms" x="50" y="64">${fmt(edge.value)} Ω</text>`:''}`;
  return `<g class="resistor grid-component${vertical?' vertical':''}${selected?' selected':''}${hinted?' hinted':''}" data-id="${edge.id}" tabindex="0" role="button" transform="${transform}"><rect class="grid-hitbox" width="100" height="100"/>${body}${text}</g>`;
}

function gridSupplyMarkup(placement){
  const selectable=!state.solved,x=placement.col*100,y=placement.row*100;
  if(state.phase==='supply'){
    const sources=state.level.supplies,series=state.level.supplyConnection==='series';
    return sources.map((item,index)=>{const id=`SUPPLY:${index}`,selected=state.selected.has(id),step=100/sources.length,cx=series?50:step*(index+.5),cy=series?step*(index+.5):50,hitbox=series?`x="5" y="${index*step+2}" width="90" height="${step-4}"`:`x="${index*step+2}" y="5" width="${step-4}" height="90"`,plates=series?`M28 ${cy-4} H72 M35 ${cy+4} H65`:`M${cx-17} 46 H${cx+17} M${cx-12} 54 H${cx+12}`,label=series?`<text class="battery-text supply-bank-label" x="12" y="${cy-9}">${item.voltage} V</text>`:`<text class="battery-text supply-bank-label" style="text-anchor:middle" x="${cx}" y="35">${item.voltage} V</text>`;return `<g class="supply-component grid-component selectable${selected?' selected':''}" transform="translate(${x} ${y})" data-id="${id}" tabindex="0" role="button" aria-label="${item.voltage} volt, ${item.capacity} amp hour supply"><rect class="supply-hitbox" ${hitbox} rx="6"/><path class="battery-line" d="${plates}"/>${label}</g>`}).join('');
  }
  const selected=state.selected.has('SUPPLY'),voltage=supplyVoltage(),capacity=supplyCapacity();
  return `<g class="supply-component grid-component${selectable?' selectable':''}${selected?' selected':''}" transform="translate(${x} ${y})"${selectable?` data-id="SUPPLY" tabindex="0" role="button" aria-label="${voltage} volt, ${capacity} amp hour supply"`:''}><rect class="supply-hitbox" width="100" height="100" rx="8"/><path class="battery-line" d="M22 43 H78 M31 57 H69"/><text class="battery-text supply-voltage" x="18" y="29">${voltage} V</text><text class="battery-text supply-capacity" x="18" y="78">${supplyCapacityLabel()}</text></g>`;
}

function viewportForLayout(layout){return{x:layout.colOffset*100,y:layout.rowOffset*100,width:layout.width*100,height:layout.height*100}}
function applyViewport(circuit,viewport){circuit.setAttribute('viewBox',`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`);circuit.style.aspectRatio=`${viewport.width}/${viewport.height}`}

function renderCircuit(circuit=$('#circuit'),interactive=true){
  const layout=buildGridLayout(state.graph,{source:state.level.graph.source,sink:state.level.graph.sink,hints:state.layoutHints}),viewport=state.gridViewport||viewportForLayout(layout);if(interactive){state.gridLayout=layout;state.gridViewport=viewport}
  applyViewport(circuit,viewport);
  circuit.innerHTML=gridWireMarkup(layout)+state.graph.edges.map(edge=>gridResistorMarkup(edge,layout.components.get(edge.id))).join('')+gridSupplyMarkup(layout.components.get('SUPPLY'));
  if(interactive){renderKnownValues();bindComponents()}
}

function bindComponents(){
  $('#circuit').querySelectorAll('.resistor').forEach(el=>{const toggle=()=>{if(state.level.preselect||state.solved)return;state.selected.has(el.dataset.id)?state.selected.delete(el.dataset.id):state.selected.add(el.dataset.id);state.hinted.clear();setMessage('');renderCircuit();renderSelection();syncTutorial()};el.addEventListener('click',toggle);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}})});
  $('#circuit').querySelectorAll('.supply-component.selectable').forEach(supply=>{const toggle=()=>{if(state.solved)return;const id=supply.dataset.id;state.selected.has(id)?state.selected.delete(id):state.selected.add(id);state.hinted.clear();setMessage('');renderCircuit();renderSelection();syncTutorial()};supply.addEventListener('click',toggle);supply.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}})});
  const totalCurrent=$('#circuit').querySelector('.current-component.selectable');if(totalCurrent){const toggle=()=>{state.selected.has('CURRENT')?state.selected.delete('CURRENT'):state.selected.add('CURRENT');setMessage('');renderCircuit();renderSelection();syncTutorial()};totalCurrent.addEventListener('click',toggle);totalCurrent.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}})}
  $('#circuit').querySelectorAll('.resistor-current.selectable,.known-voltage.selectable').forEach(el=>{const toggle=()=>{if(state.solved)return;state.selected.has(el.dataset.id)?state.selected.delete(el.dataset.id):state.selected.add(el.dataset.id);state.hinted.clear();setMessage('');renderCircuit();renderSelection();syncTutorial()};el.addEventListener('click',toggle);el.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle()}})});
}

function renderSelection(){const labels=[...state.selected].map(id=>{if(id==='SUPPLY')return `${supplyVoltage()} V supply`;if(id==='CURRENT')return `Iₜₒₜₐₗ = ${fmt(state.current)} A`;if(id.startsWith('SUPPLY:')){const item=state.level.supplies[Number(id.split(':')[1])];return `${item.voltage} V, ${item.capacity} Ah supply`}const [kind,edgeId]=id.split(':');const edge=state.graph?.edges.find(item=>item.id===(edgeId||id));if(kind==='CURRENT')return `I${subscriptNumber((edge?.label||'').replace(/^R/,''))} = ${fmt(state.values[edgeId].current)} A`;if(kind==='VOLTAGE')return `V${subscriptNumber((edge?.label||'').replace(/^R/,''))} = ${fmt(state.values[edgeId].voltage)} V`;return plainResistorLabel(edge?.label||id)});$('#selectionText').textContent=labels.length?labels.join(', '):'No component selected'}
function setMessage(text,type=''){const el=$('#message');el.textContent=text;el.className=`selection-feedback ${type}`}

function positionTutorialPointer(target){
  const pointer=$('#tutorialPointer');
  document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));
  if(!target){pointer.hidden=true;pointer.classList.remove('sideways');return}
  const sideways=target.classList.contains('supply-component');pointer.classList.toggle('sideways',sideways);
  target.classList.add('tutorial-target');pointer.hidden=false;
  requestAnimationFrame(()=>{const targetBox=target.getBoundingClientRect(),cardBox=$('#gameCard').getBoundingClientRect();pointer.style.left=`${targetBox.left-cardBox.left+(sideways?targetBox.width+4:targetBox.width/2)}px`;pointer.style.top=`${targetBox.top-cardBox.top+(sideways?targetBox.height/2:-4)}px`});
}

function syncTutorial(){
  if(tutorial.active){
    if(state.level.id!==1){tutorial.active=false;positionTutorialPointer(null);return}
    tutorial.step=state.selected.has('R1')&&state.selected.has('R2')?2:state.selected.has('R1')?1:0;
    const target=tutorial.step===0?$('#circuit [data-id="R1"]'):tutorial.step===1?$('#circuit [data-id="R2"]'):$('#actions [data-action="series"]');
    setMessage(tutorial.step===0?'First, tap R₁.':tutorial.step===1?'Good. Now tap R₂.':'Both are selected. Choose Series.');
    positionTutorialPointer(target);return
  }
  if(currentTutorial.active){
    if(state.level.id!==FIRST_CURRENT_LEVEL_ID){currentTutorial.active=false;positionTutorialPointer(null);return}
    if(state.phase==='total'){
      const equivalent=state.graph.edges[0],resistanceSelected=state.selected.has(equivalent.id),supplySelected=state.selected.has('SUPPLY');
      currentTutorial.step=resistanceSelected&&supplySelected?2:resistanceSelected?1:0;
      const target=currentTutorial.step===0?$(`#circuit [data-id="${equivalent.id}"]`):currentTutorial.step===1?$('#circuit [data-id="SUPPLY"]'):$('#actions [data-action="current-divide"]');
      setMessage(currentTutorial.step===0?'Tap the total resistance.':currentTutorial.step===1?'Now tap the supply voltage.':'Use I = V ÷ R to find the current.');
      positionTutorialPointer(target);return
    }
    if(state.phase==='expand'){
      const equivalent=state.graph.edges[0],currentSelected=state.selected.has('CURRENT'),resistanceSelected=state.selected.has(equivalent.id);
      currentTutorial.step=currentSelected&&resistanceSelected?5:currentSelected?4:3;
      const target=currentTutorial.step===3?$('#circuit [data-id="CURRENT"]'):currentTutorial.step===4?$(`#circuit [data-id="${equivalent.id}"]`):$('#actions [data-action="same-current"]');
      setMessage(currentTutorial.step===3?'Tap Iₜₒₜₐₗ.':currentTutorial.step===4?'Now tap the total resistance.':'Apply Iₜₒₜₐₗ to the series resistors.');
      positionTutorialPointer(target);return
    }
    positionTutorialPointer(null);return
  }
  if(currentTutorial.firstPlay&&state.level.id===FIRST_CURRENT_LEVEL_ID&&state.phase==='total'){
    currentTutorial.active=true;currentTutorial.firstPlay=false;localStorage.setItem(CURRENT_TUTORIAL_KEY,'started');syncTutorial();return
  }
  positionTutorialPointer(null);
}

function startTutorial(){
  tutorial.active=true;tutorial.step=0;
  if(levelIndex!==0)loadLevel(0);else{state.selected.clear();render();setMessage('');syncTutorial()}
}

function finishTutorial(){
  tutorial.active=false;tutorial.firstPlay=false;localStorage.setItem(TUTORIAL_KEY,'complete');positionTutorialPointer(null);
}
function finishCurrentTutorial(){currentTutorial.active=false;localStorage.setItem(CURRENT_TUTORIAL_KEY,'complete');positionTutorialPointer(null)}
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
  $('#levelNumber').textContent=`LEVEL ${level.id}`;$('#turnCount').textContent=state.turns;$('#promptTitle').textContent=level.title;
  $('#actions').className=`actions${level.mode!=='relation'?' formula-bank':''}`;
  $('#actions').innerHTML=actions().map(([id,label])=>`<button class="action${label.includes('<math')?' formula':''}" data-action="${id}">${label}</button>`).join('');
  $('#actions').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{submit(button.dataset.action);button.blur()}));
  renderOriginal();renderCircuit();renderSelection();applyResponsiveViewBoxes();syncTutorial();
}

function applyResponsiveViewBoxes(){
  const viewport=state.gridViewport||viewportForLayout(state.gridLayout);applyViewport($('#circuit'),viewport);applyViewport($('#referenceCircuit'),viewport);
}

function explain(relation,chosen){
  if(!relation)return chosen==='parallel'?'Parallel resistors must sit on separate circuit branches.':'Series resistors must follow one current path with no branches between them.';
  if(relation.type!==chosen)return chosen==='parallel'?'These resistors do not sit on separate branches.':'A branch splits the current between these resistors, so they are not in series.';
  return relation.type==='parallel'?'These resistors sit on separate branches: parallel.':'One current path with no branches: series.';
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
  if(state.level.mode==='formula'&&!['series','parallel'].includes(action)){reject('That rule cannot combine the selected resistors.');return}
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
    state.current=supplyVoltage()/equivalent.value;if(!state.values[equivalent.id])state.values=treeValues(equivalent,supplyVoltage());state.known={[equivalent.id]:{current:true,voltage:Boolean(state.known[equivalent.id]?.voltage)}};state.phase='expand';state.selected.clear();render();if(!currentTutorial.active)setMessage(`Iₜₒₜₐₗ = ${fmt(state.current)} A.`,'good');return
  }
  if(calculationLevel&&state.phase==='expand'){
    const resistorIds=selectedResistorIds();
    if(['same-current','same-voltage'].includes(action)&&resistorIds.length){
      const property=action==='same-current'?'current':'voltage',prefix=property==='current'?'CURRENT:':'VOLTAGE:',resistor=resistorIds.length===1?state.graph.edges.find(edge=>edge.id===resistorIds[0]):null;
      const ownValue=resistor&&(state.selected.has(`${prefix}${resistor.id}`)||(property==='current'&&state.graph.edges.length===1&&state.selected.has('CURRENT')));
      if(resistor?.history&&ownValue){
        if(resistor.history.type!==(property==='current'?'series':'parallel')){reject('That rule does not match how these resistors were combined.');return}
        if(currentTutorial.active&&action==='same-current')finishCurrentTutorial();const result=expandEdge(state.graph,resistor.id);state.layoutHints.delete(resistor.id);state.graph=result.graph;delete state.known[resistor.id];
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
      if(targets.some(id=>endpointKey(state.graph.edges.find(edge=>edge.id===id))!==sourceKey)){reject('These resistors do not sit on separate branches.');return}
      }
      if(property==='current'&&sourceId){const relation=relationship(state.graph,[sourceId,...targets]);if(relation?.type!=='series'){reject('Those resistors are not on one current path.');return}}
      if(sourceValue===null||sourceValue===undefined||targets.some(id=>!nearlyEqual(state.values[id]?.[property],sourceValue))){reject(`Those resistors do not have the same ${property}.`);return}
      targets.forEach(id=>{state.known[id]={...(state.known[id]||{}),[property]:true}});state.selected.clear();
      if(finishCalculationIfReady())return;render();setMessage(`${property==='current'?'Current':'Voltage'} copied to the selected resistor${targets.length===1?'':'s'}.`,'good');return
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
  const selectedPlacements=resistorIds.map(id=>state.gridLayout?.components.get(id)).filter(Boolean),layoutHint=selectedPlacements.length?{orientation:selectedPlacements.some(item=>item.orientation==='vertical')?'vertical':'horizontal',col:selectedPlacements.reduce((sum,item)=>sum+item.col,0)/selectedPlacements.length,row:selectedPlacements.reduce((sum,item)=>sum+item.row,0)/selectedPlacements.length}:null;
  const result=reduceGraph(state.graph,resistorIds);
  if(!result.ok){reject(result.reason);return}
  state.graph.edges.forEach(edge=>{const placement=state.gridLayout?.components.get(edge.id);if(placement)state.layoutHints.set(edge.id,{orientation:placement.orientation,col:placement.col,row:placement.row})});
  resistorIds.forEach(id=>state.layoutHints.delete(id));if(layoutHint)state.layoutHints.set(result.edge.id,layoutHint);
  if(tutorial.active&&tutorial.step===2&&action==='series')finishTutorial();
  setMessage('');
  animateToEquivalent(result.graph,result.edge.id,()=>{state.graph=result.graph;state.selected.clear();state.hinted.clear();if(isSolved(state.graph)&&calculationLevel){state.phase='total';render()}else if(isSolved(state.graph)){render();complete()}else{render();setMessage('Resistors combined.','good')}});
}

function reject(text){setMessage(text,'error');$('#circuit').querySelectorAll('.resistor.selected').forEach(el=>{el.classList.remove('wrong');void el.getBoundingClientRect();el.classList.add('wrong')})}

function animateToEquivalent(nextGraph,equivalentId,done){
  const circuit=$('#circuit'),elements=[...circuit.querySelectorAll('.resistor')];
  const selected=elements.filter(el=>el.classList.contains('selected'));
  if(!selected.length){done();return}
  const destination=circuitPosition(nextGraph,equivalentId);
  const items=elements.map(el=>{const matrix=el.transform.baseVal.consolidate()?.matrix,bbox=el.getBBox(),x=matrix?.e||0,y=matrix?.f||0,chosen=el.classList.contains('selected'),nextPosition=chosen?destination:circuitPosition(nextGraph,el.dataset.id);return{el,x,y,cx:x+bbox.width/2,cy:y+bbox.height/2,chosen,destination:nextPosition}});
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:760,start=performance.now();let crossed=false,ghost=null;
  const crossfade=raw=>{if(!crossed&&raw>=.72){ghost=circuit.cloneNode(true);ghost.removeAttribute('id');ghost.classList.add('circuit-ghost');circuit.parentElement.appendChild(ghost);crossed=true;done();circuit.style.opacity='0'}if(crossed){const fade=Math.min(1,(raw-.72)/.28);ghost.style.opacity=String(1-fade);circuit.style.opacity=String(fade)}};
  const frame=now=>{const raw=duration?Math.min(1,(now-start)/duration):1,t=1-Math.pow(1-raw,3);items.forEach(item=>{const x=item.x+(item.destination.x-item.cx)*t,y=item.y+(item.destination.y-item.cy)*t;item.el.setAttribute('transform',`translate(${x} ${y})`);if(item.chosen)item.el.style.opacity=String(Math.max(.18,1-raw*.75))});crossfade(raw);if(raw<1)requestAnimationFrame(frame);else{if(!crossed)done();ghost?.remove();circuit.style.opacity=''}};
  requestAnimationFrame(frame);
}
function bestGroup(){
  const ids=state.graph.edges.map(e=>e.id),groups=[];
  for(let mask=1;mask<(1<<ids.length);mask++){const set=ids.filter((_,i)=>mask&(1<<i));const rel=relationship(state.graph,set);if(rel)groups.push({set,rel})}
  return groups.sort((a,b)=>b.set.length-a.set.length)[0];
}
function finishCalculationIfReady(){
  if(calculationComplete(state.level,state.known)){state.graph=cloneGraph(state.level.graph);state.solved=true;state.phase='restored';render();complete();return true}
  return false
}
function hint(){
  if(state.solved)return;state.turns++;$('#turnCount').textContent=state.turns;
  const calculationLevel=['complete','voltage'].includes(state.level.mode);
  if(calculationLevel&&state.phase==='total'){const equivalent=state.graph.edges[0],voltageKnown=state.known[equivalent.id]?.voltage;state.selected=new Set([equivalent.id,voltageKnown?`VOLTAGE:${equivalent.id}`:'SUPPLY']);renderCircuit();renderSelection();setMessage(voltageKnown?'The selected voltage and resistance can determine current.':'The supply voltage and total resistance can determine current.');return}
  if(calculationLevel&&state.phase==='expand'){const edges=state.graph.edges,edge=edges.find(item=>{const known=state.known[item.id]||{};if(item.history){const required=item.history.type==='series'?'current':'voltage';return !known[required]}return !known.current||state.level.mode==='voltage'&&!known.voltage})||edges.find(item=>item.history);if(!edge)return;const known=state.known[edge.id]||{},root=edges.length===1;if(edge.history){const required=edge.history.type==='series'?'current':'voltage';if(!known[required]){const available=required==='current'?'voltage':'current',valueId=available==='current'&&(root)?'CURRENT':`${available.toUpperCase()}:${edge.id}`;state.selected=new Set([edge.id,valueId])}else{const valueId=required==='current'&&root?'CURRENT':`${required.toUpperCase()}:${edge.id}`;state.selected=new Set([edge.id,valueId])}}else if(known.current&&!known.voltage)state.selected=new Set([edge.id,root?'CURRENT':`CURRENT:${edge.id}`]);else state.selected=new Set([edge.id,`VOLTAGE:${edge.id}`]);renderCircuit();renderSelection();setMessage('The selected values can be used together.');return}
  const hint=bestGroup();if(!hint)return;
  state.selected=new Set(hint.set);state.hinted=new Set(hint.set);renderCircuit();renderSelection();setMessage(hint.rel.type==='series'?'These resistors follow one current path, so they are in series.':'These resistors sit on separate branches, so they are in parallel.');
}

function starsFor(turns,best){return turns<=best?3:turns===best+1?2:1}
function complete(trace=false){
  state.solved=true;const stars=starsFor(state.turns,state.level.best);progress=saveResult(state.level.id,stars,localStorage,LEVELS.length);$('#stars').textContent='★'.repeat(stars)+'☆'.repeat(3-stars);$('#stars').setAttribute('aria-label',`${stars} out of 3 stars`);$('#completeTitle').textContent=trace?'Original circuit restored':'Circuit solved';$('#completeText').textContent=`${state.turns} turn${state.turns===1?'':'s'}. Best possible: ${state.level.best}.`;$('#nextButton').hidden=state.level.id===LEVELS.length;setMessage('Level complete.','good');$('#gameCard').classList.add('reviewing');$('#resultButton').hidden=false
}

function loadLevel(index){
  levelIndex=index;const level=LEVELS[index],calculationLevel=['complete','voltage'].includes(level.mode),supplyLevel=calculationLevel&&level.supplies?.length>1;state={level,graph:level.graph?cloneGraph(level.graph):null,turns:0,selected:new Set(level.preselect||[]),hinted:new Set(),values:{},known:{},current:null,solved:false,phase:supplyLevel?'supply':calculationLevel?'simplify':null,layoutHints:new Map(),gridLayout:null,gridViewport:null};$('#gameCard').classList.remove('reviewing');$('#resultButton').hidden=true;setMessage('');render()
}

function renderLevels(){
  $('#levelGrid').innerHTML=LEVELS.map((level,index)=>{const unlocked=TEST_ALL_LEVELS||level.id<=progress.unlocked,stars=progress.stars[level.id]||0;return `<button class="level-tile" data-level="${index}" ${unlocked?'':'disabled'}><span class="number">LEVEL ${level.id}</span>${unlocked?`<span class="tile-stars">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</span>`:'<span class="lock">▣</span>'}</button>`}).join('');
  $('#levelGrid').querySelectorAll('[data-level]:not(:disabled)').forEach(button=>button.addEventListener('click',()=>{$('#levelsDialog').close();loadLevel(Number(button.dataset.level))}))
}

function showResult(){
  if(state.level.id===LEVELS.length){const total=Object.values(progress.stars).reduce((sum,value)=>sum+value,0);$('#chapterStars').textContent=`${total} of ${LEVELS.length*3} stars collected`;$('#chapterDialog').showModal();return}
  $('#completeDialog').showModal();
}

$('#hintButton').addEventListener('click',hint);$('#restartButton').addEventListener('click',()=>loadLevel(levelIndex));$('#resultButton').addEventListener('click',showResult);$('#levelsButton').addEventListener('click',()=>{renderLevels();$('#levelsDialog').showModal()});$('#tutorialStart').addEventListener('click',()=>{const replay=!tutorial.firstPlay;$('#howDialog').close();if(replay)startTutorial()});$('#howDialog').addEventListener('close',()=>{if(tutorial.firstPlay&&!tutorial.active)startTutorial()});$('#nextButton').addEventListener('click',()=>{$('#completeDialog').close();loadLevel(Math.min(levelIndex+1,LEVELS.length-1))});$('#replayButton').addEventListener('click',()=>{$('#completeDialog').close();loadLevel(levelIndex)});$('#startAgainButton').addEventListener('click',()=>{progress=resetProgress();progress={...progress,unlocked:LEVELS.length}; // TEMP: keep all levels unlocked during testing.
$('#chapterDialog').close();loadLevel(0)});$('#reviewLevelsButton').addEventListener('click',()=>{$('#chapterDialog').close();renderLevels();$('#levelsDialog').showModal()});document.addEventListener('click',event=>{if(event.target.dataset.open)$(`#${event.target.dataset.open}`).showModal();if(event.target.dataset.close)$(`#${event.target.dataset.close}`).close()});
addEventListener('resize',applyResponsiveViewBoxes);
loadLevel(levelIndex);
if(tutorial.firstPlay)$('#howDialog').showModal();
