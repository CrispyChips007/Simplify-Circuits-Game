import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/src/levels.js';
import { loadProgress, saveResult } from '../dist/src/storage.js';
import { isSolved, nearlyEqual, reduceGraph, solveCircuit, treeValues } from '../dist/src/solver.js';
import { combineSupplies, levelSupply } from '../dist/src/supplies.js';
import { CIRCUIT_FRAME, COMPONENT_SIZE, componentSize, graphIsParallelBank, graphIsSeriesPath, validateCustomLayout } from '../dist/src/layout.js';

test('course contains sequential levels',()=>{
  assert.equal(LEVELS.length,31);
  assert.deepEqual(LEVELS.map(level=>level.id),Array.from({length:LEVELS.length},(_,index)=>index+1));
});

test('shared topology rules apply independently of each level template',()=>{
  for(const level of LEVELS){
    const queue=[structuredClone(level.graph)],seen=new Set();
    while(queue.length){
      const graph=queue.shift(),key=graph.edges.map(edge=>`${edge.id}:${edge.a}-${edge.b}`).sort().join('|');if(seen.has(key))continue;seen.add(key);
      const sameEndpoints=graph.edges.length>1&&graph.edges.every(edge=>[edge.a,edge.b].sort().join('|')===[graph.edges[0].a,graph.edges[0].b].sort().join('|'));
      if(sameEndpoints){assert.equal(graphIsParallelBank(graph),true,`level ${level.id} parallel reduction`);assert.equal(graphIsSeriesPath(graph),false,`level ${level.id} parallel bank is not a series path`)}
      if(graph.edges.length===1)assert.equal(graphIsSeriesPath(graph),true,`level ${level.id} final series path`);
      const ids=graph.edges.map(edge=>edge.id);for(let mask=1;mask<(1<<ids.length);mask++){const result=reduceGraph(graph,ids.filter((_,index)=>mask&(1<<index)));if(result.ok)queue.push(result.graph)}
    }
  }
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

test('course contains seven genuinely different custom circuit topologies',()=>{
  assert.equal(new Set(LEVELS.map(level=>level.topology).filter(Boolean)).size,7);
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

test('three-source battery arrays preserve the correct voltage and capacity rules',()=>{
  const arrays=LEVELS.filter(level=>level.supplies?.length===3);
  assert.equal(arrays.length,3);
  assert.ok(arrays.every(level=>level.mode==='voltage'));
  assert.deepEqual(levelSupply(arrays.find(level=>level.supplyConnection==='series')),{voltage:36,capacity:4});
  assert.ok(arrays.filter(level=>level.supplyConnection==='parallel').every(level=>levelSupply(level).voltage===12&&levelSupply(level).capacity===300));
});

test('custom layouts satisfy the mobile component and lead constraints',()=>{
  assert.ok(CIRCUIT_FRAME.lead>=8);
  for(const level of LEVELS.filter(level=>level.layout==='custom'))assert.deepEqual(validateCustomLayout(level),[],`${level.topology} violates the circuit frame`);
});

test('vertical resistors are exact rotations of horizontal resistors',()=>{
  const horizontal=componentSize('horizontal'),vertical=componentSize('vertical');
  assert.deepEqual(horizontal,COMPONENT_SIZE.horizontal);
  assert.deepEqual(vertical,COMPONENT_SIZE.vertical);
  assert.equal(vertical.width,horizontal.height);
  assert.equal(vertical.height,horizontal.width);
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

test('offset-tail layout keeps its final resistor on the main path',()=>{
  const level=LEVELS.find(item=>item.topology==='offset-tail');
  assert.equal(level.topology,'offset-tail');
  assert.equal(level.positions.R5[1],level.positions.C[1]);
  assert.equal(level.positions.R5[1],level.positions.D[1]);
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

test('every calculation level restores every required value',()=>{
  const calculationLevels=LEVELS.filter(level=>['complete','voltage'].includes(level.mode));
  assert.equal(calculationLevels.length,15);
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
