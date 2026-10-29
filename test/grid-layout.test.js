import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/src/levels.js';
import { buildGridLayout, GRID_COLS, GRID_ROWS, validateGridLayout } from '../dist/src/grid-layout.js';
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
  for(const level of LEVELS){const layout=buildGridLayout(level.graph,{source:level.graph.nodes[0],sink:level.graph.nodes.at(-1)});for(const edge of level.graph.edges)assert.ok(layout.components.get(edge.id),`level ${level.id} ${edge.id}`);assert.equal(layout.components.get('SUPPLY').orientation,'vertical')}
});
