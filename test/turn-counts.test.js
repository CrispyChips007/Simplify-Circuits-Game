import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../dist/src/levels.js';
import { reduceGraph } from '../dist/src/solver.js';

const treeKey=edge=>edge.history?`${edge.history.type}(${edge.history.children.map(treeKey).sort().join(',')})`:edge.id;
const graphKey=graph=>graph.edges.map(edge=>`${[edge.a,edge.b].sort().join('-')}:${treeKey(edge)}`).sort().join('|');
const selections=ids=>{const result=[];for(let mask=1;mask<(1<<ids.length);mask++){const selected=ids.filter((_,index)=>mask&(1<<index));if(selected.length>1)result.push(selected)}return result};

function calculationTurns(edge,known,allValues){
  if(!edge.history)return allValues?(known==='both'?0:1):(known==='current'?0:1);
  const required=edge.history.type==='series'?'current':'voltage',prepare=known==='both'||known===required?0:1;
  return prepare+1+edge.history.children.reduce((sum,child)=>sum+calculationTurns(child,required,allValues),0);
}

function minimumTurns(level){
  const pending=[{graph:structuredClone(level.graph),turns:0}],seen=new Set(),solved=[];
  while(pending.length){const state=pending.shift(),key=graphKey(state.graph);if(seen.has(key))continue;seen.add(key);if(state.graph.edges.length===1){solved.push(state);continue}for(const selected of selections(state.graph.edges.map(edge=>edge.id))){const result=reduceGraph(state.graph,selected);if(result.ok)pending.push({graph:result.graph,turns:state.turns+1})}}
  const supplyTurn=level.supplies?.length>1?1:0,calculationLevel=['complete','voltage'].includes(level.mode);
  return Math.min(...solved.map(state=>{if(!calculationLevel)return supplyTurn+state.turns;const root=state.graph.edges[0],allValues=level.mode==='voltage',fromCurrent=1+calculationTurns(root,'current',allValues),fromBoth=2+calculationTurns(root,'both',allValues);return supplyTurn+state.turns+Math.min(fromCurrent,fromBoth)}));
}

test('every level best score matches its minimum valid counted turns',()=>{for(const level of LEVELS)assert.equal(level.best,minimumTurns(level),`level ${level.id} best-turn value is stale`)});
