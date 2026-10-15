import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/src/levels.js';
import { loadProgress, saveResult } from '../dist/src/storage.js';
import { isSolved, nearlyEqual, reduceGraph, solveCircuit, treeValues } from '../dist/src/solver.js';
import { combineSupplies, levelSupply } from '../dist/src/supplies.js';

test('course contains sequential levels',()=>{
  assert.equal(LEVELS.length,24);
  assert.deepEqual(LEVELS.map(level=>level.id),Array.from({length:24},(_,index)=>index+1));
});

test('all-value levels follow current-only levels',()=>{
  const firstCurrent=LEVELS.findIndex(level=>level.mode==='complete');
  const firstAllValues=LEVELS.findIndex(level=>level.mode==='voltage');
  assert.ok(firstCurrent>0);
  assert.ok(firstAllValues>firstCurrent);
  for(const level of LEVELS.filter(level=>level.mode==='voltage'))assert.ok(levelSupply(level).voltage>0);
});

test('progress can unlock all course levels',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  for(let level=1;level<=LEVELS.length;level++)saveResult(level,3,storage,LEVELS.length);
  assert.equal(loadProgress(storage).unlocked,LEVELS.length);
});

test('advanced chapter includes staged nested circuits',()=>{
  const nested=LEVELS.filter(level=>level.layout==='nested');
  assert.ok(nested.length>=2);
  assert.ok(nested.filter(level=>['relation','formula'].includes(level.mode)).every(level=>level.best===4));
});

test('level two introduces a different connection type',()=>{
  assert.notEqual(LEVELS[1].layout,LEVELS[0].layout);
});

test('all simplification precedes current and all-value solving',()=>{
  const firstCalculation=LEVELS.findIndex(level=>['complete','voltage'].includes(level.mode));
  assert.ok(firstCalculation>0);
  assert.ok(LEVELS.slice(0,firstCalculation).every(level=>['relation','formula'].includes(level.mode)));
  assert.ok(LEVELS.slice(firstCalculation).every(level=>['complete','voltage'].includes(level.mode)));
  assert.ok(LEVELS.slice(firstCalculation).findIndex(level=>level.mode==='voltage')>0);
});

test('adjacent simplification levels do not repeat the same advanced topology',()=>{
  const simplification=LEVELS.filter(level=>['relation','formula'].includes(level.mode));
  for(let index=1;index<simplification.length;index++){
    const previous=simplification[index-1],current=simplification[index];
    assert.notEqual(previous.topology||`${previous.layout}:${previous.graph.edges.length}`,current.topology||`${current.layout}:${current.graph.edges.length}`);
  }
});

test('course contains six genuinely new circuit topologies',()=>{
  assert.equal(new Set(LEVELS.map(level=>level.topology).filter(Boolean)).size,6);
  assert.ok(!LEVELS.some(level=>level.layout==='parallel'&&level.graph.edges.length>5));
});

test('every custom circuit defines reusable node and resistor positions',()=>{
  for(const level of LEVELS.filter(level=>level.layout==='custom'))for(const edge of level.graph.edges){assert.ok(level.positions[edge.a],`${level.topology} ${edge.a}`);assert.ok(level.positions[edge.b],`${level.topology} ${edge.b}`);assert.ok(level.positions[edge.id],`${level.topology} ${edge.id}`)}
});

test('every custom topology can be reduced to one resistor',()=>{
  const canSolve=start=>{const queue=[structuredClone(start)],seen=new Set();while(queue.length){const graph=queue.shift();if(isSolved(graph))return true;const key=graph.edges.map(edge=>[edge.a,edge.b].sort().join('-')).sort().join('|');if(seen.has(key))continue;seen.add(key);const ids=graph.edges.map(edge=>edge.id);for(let mask=1;mask<(1<<ids.length);mask++){const chosen=ids.filter((_,i)=>mask&(1<<i));const result=reduceGraph(graph,chosen);if(result.ok)queue.push(result.graph)}}return false};
  for(const level of LEVELS.filter(level=>level.layout==='custom'))assert.equal(canSolve(level.graph),true,level.topology);
});

test('nested circuit reduces series then parallel then series',()=>{
  let graph=structuredClone(LEVELS.find(level=>level.layout==='nested').graph);
  const top=reduceGraph(graph,['R2','R3']);assert.equal(top.ok,true);graph=top.graph;
  const bottom=reduceGraph(graph,['R4','R5']);assert.equal(bottom.ok,true);graph=bottom.graph;
  const middle=reduceGraph(graph,[top.edge.id,bottom.edge.id]);assert.equal(middle.ok,true);graph=middle.graph;
  const final=reduceGraph(graph,['R1',middle.edge.id,'R6']);assert.equal(final.ok,true);
  assert.equal(isSolved(final.graph),true);
});

test('parallel supplies retain voltage and add amp hours',()=>{
  assert.deepEqual(combineSupplies([{voltage:12,capacity:3},{voltage:12,capacity:5}],'parallel'),{voltage:12,capacity:8});
  assert.equal(combineSupplies([{voltage:12,capacity:3},{voltage:6,capacity:3}],'parallel'),null);
});

test('series supplies add voltage and retain the limiting amp hours',()=>{
  assert.deepEqual(combineSupplies([{voltage:6,capacity:4},{voltage:6,capacity:4}],'series'),{voltage:12,capacity:4});
});

test('custom resistor bodies do not overlap or hide junction nodes',()=>{
  const halfWidth=55,halfHeight=22;
  for(const level of LEVELS.filter(level=>level.layout==='custom')){
    const boxes=level.graph.edges.map(edge=>({id:edge.id,x:level.positions[edge.id][0],y:level.positions[edge.id][1]}));
    for(let left=0;left<boxes.length;left++)for(let right=left+1;right<boxes.length;right++){
      const a=boxes[left],b=boxes[right];
      assert.ok(Math.abs(a.x-b.x)>=halfWidth*2||Math.abs(a.y-b.y)>=halfHeight*2,`${level.topology}: ${a.id} overlaps ${b.id}`);
    }
    for(const node of level.graph.nodes){
      const [x,y]=level.positions[node];
      for(const box of boxes)assert.ok(Math.abs(x-box.x)>halfWidth||Math.abs(y-box.y)>halfHeight,`${level.topology}: ${node} is hidden by ${box.id}`);
    }
  }
});

test('late course applies current and voltage rules to mixed circuits',()=>{
  const calculation=LEVELS.filter(level=>['complete','voltage'].includes(level.mode));
  assert.ok(calculation.some(level=>level.mode==='complete'&&['mixed','nested'].includes(level.layout)));
  assert.ok(calculation.some(level=>level.mode==='voltage'&&['mixed','nested'].includes(level.layout)));
});

test('course includes playable series and parallel supply combinations',()=>{
  assert.ok(LEVELS.some(level=>level.supplyConnection==='series'&&level.supplies?.length>1));
  assert.ok(LEVELS.some(level=>level.supplyConnection==='parallel'&&level.supplies?.length>1));
});

test('mixed circuits vary between horizontal and vertical presentations',()=>{
  const mixed=LEVELS.filter(level=>level.layout==='mixed');
  assert.ok(mixed.some(level=>level.mixedOrientation==='vertical'));
  assert.ok(mixed.some(level=>level.mixedOrientation!=='vertical'));
});

function reductionToSingle(start){
  const queue=[structuredClone(start)],seen=new Set();
  while(queue.length){
    const graph=queue.shift();
    if(isSolved(graph))return graph.edges[0];
    const key=graph.edges.map(edge=>`${edge.id}:${edge.a}-${edge.b}`).sort().join('|');
    if(seen.has(key))continue;
    seen.add(key);
    const ids=graph.edges.map(edge=>edge.id);
    for(let mask=1;mask<(1<<ids.length);mask++){
      const result=reduceGraph(graph,ids.filter((_,index)=>mask&(1<<index)));
      if(result.ok)queue.push(result.graph);
    }
  }
  return null;
}

test('calculation levels 18 through 24 restore every required value',()=>{
  const calculationLevels=LEVELS.slice(17);
  assert.equal(calculationLevels.length,7);
  for(const level of calculationLevels){
    assert.ok(['complete','voltage'].includes(level.mode),`level ${level.id} is a calculation level`);
    const supply=levelSupply(level);
    const equivalent=reductionToSingle(level.graph);
    assert.ok(equivalent,`level ${level.id} reduces to one equivalent resistance`);
    const restored=treeValues(equivalent,supply.voltage);
    const direct=solveCircuit(level.graph,supply.voltage);
    assert.ok(nearlyEqual(restored[equivalent.id].current,direct.totalCurrent),`level ${level.id} total current`);
    for(const edge of level.graph.edges){
      assert.ok(restored[edge.id],`level ${level.id} restores ${edge.id}`);
      assert.ok(nearlyEqual(restored[edge.id].current,direct.resistors[edge.id].current),`level ${level.id} ${edge.id} current`);
      assert.ok(nearlyEqual(restored[edge.id].voltage,direct.resistors[edge.id].voltage),`level ${level.id} ${edge.id} voltage`);
    }
  }
});
