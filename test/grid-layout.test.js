import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/src/levels.js';
import { buildGridLayout, glideRotation, GRID_COLS, GRID_ROWS, validateGridLayout } from '../dist/src/grid-layout.js';
import { reduceGraph } from '../dist/src/solver.js';

test('every level and reduction state fits the fixed circuit grid',()=>{
  for(const level of LEVELS){
    const source=level.graph.source,sink=level.graph.sink,queue=[structuredClone(level.graph)],seen=new Set();
    while(queue.length){
      const graph=queue.shift(),key=graph.edges.map(edge=>`${edge.id}:${edge.a}-${edge.b}`).sort().join('|');if(seen.has(key))continue;seen.add(key);
      const layout=buildGridLayout(graph,{source,sink});
      assert.equal(layout.cols,GRID_COLS);assert.equal(layout.rows,GRID_ROWS);
      assert.deepEqual(validateGridLayout(layout),[],`level ${level.id}: ${key}`);
      const ids=graph.edges.map(edge=>edge.id);for(let mask=1;mask<(1<<ids.length);mask++){const result=reduceGraph(graph,ids.filter((_,index)=>mask&(1<<index)));if(result.ok)queue.push(result.graph)}
    }
  }
});

test('resistor labels have stable component cells and supplies use vertical ports',()=>{
  for(const level of LEVELS){const layout=buildGridLayout(level.graph,{source:level.graph.nodes[0],sink:level.graph.nodes.at(-1)});for(const edge of level.graph.edges)assert.ok(layout.components.get(edge.id),`level ${level.id} ${edge.id}`);assert.equal(layout.components.get('SUPPLY').orientation,'vertical');assert.equal(layout.components.get('SUPPLY').row,Math.floor(GRID_ROWS/2))}
});

function reduceWithPlacementHints(level,selected){
  const before=buildGridLayout(level.graph),hints=new Map([...before.components].filter(([id])=>id!=='SUPPLY').map(([id,item])=>[id,{orientation:item.orientation,col:item.col,row:item.row}])),points=selected.map(id=>before.components.get(id)),result=reduceGraph(level.graph,selected);
  selected.forEach(id=>hints.delete(id));hints.set(result.edge.id,{orientation:points.some(item=>item.orientation==='vertical')?'vertical':'horizontal',col:points.reduce((sum,item)=>sum+item.col,0)/points.length,row:points.reduce((sum,item)=>sum+item.row,0)/points.length});
  return{before,after:buildGridLayout(result.graph,{source:level.graph.source,sink:level.graph.sink,hints}),equivalentId:result.edge.id,target:hints.get(result.edge.id)};
}

test('small series circuits stay on one side until wrapping is needed',()=>{
  const level=LEVELS[0],layout=buildGridLayout(level.graph),rows=level.graph.edges.map(edge=>layout.components.get(edge.id).row);
  assert.equal(layout.width,5);assert.equal(layout.height,3);assert.equal(new Set(rows).size,1);assert.ok(rows.every(row=>row<Math.floor(GRID_ROWS/2)));
});

test('the opening parallel bank is evenly spaced to the right of the supply',()=>{
  const level=LEVELS[1],layout=buildGridLayout(level.graph),supplyCol=layout.components.get('SUPPLY').col,columns=level.graph.edges.map(edge=>layout.components.get(edge.id).col);
  assert.ok(columns.every(col=>col>supplyCol));assert.deepEqual(columns.slice(1).map((col,index)=>col-columns[index]),[2,2]);
});

test('combined resistors use the nearest cell to their visual midpoint',()=>{
  for(const [level,selected] of [[LEVELS[0],['R1','R2']],[LEVELS[2],['R2','R3']],[LEVELS[5],['R2','R3']]]){const {after,equivalentId,target}=reduceWithPlacementHints(level,selected),equivalent=after.components.get(equivalentId);assert.ok(Math.abs(equivalent.col-target.col)+Math.abs(equivalent.row-target.row)<=1,`level ${level.id} moved beyond the nearest legal midpoint cell`)}
});

test('orientation changes rotate top resistors counter-clockwise and bottom resistors clockwise',()=>{
  const vertical={orientation:'vertical',row:3};
  assert.equal(glideRotation({orientation:'horizontal',row:1},vertical,3),-90);
  assert.equal(glideRotation({orientation:'horizontal',row:5},vertical,3),90);
  assert.equal(glideRotation({orientation:'vertical',row:1},vertical,3),0);
});
