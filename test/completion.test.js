import test from 'node:test';
import assert from 'node:assert/strict';
import { calculationComplete } from '../dist/src/completion.js';
import { LEVELS } from '../dist/src/levels.js';

test('level 24 completes from all original resistor values despite extra group state',()=>{
  const level=LEVELS[23];
  const known=Object.fromEntries(level.graph.edges.map(edge=>[edge.id,{current:true,voltage:true}]));
  known.E4={current:true,voltage:true};
  assert.equal(calculationComplete(level,known),true);
});

test('level 24 remains open when one original voltage is missing',()=>{
  const level=LEVELS[23];
  const known=Object.fromEntries(level.graph.edges.map(edge=>[edge.id,{current:true,voltage:true}]));
  known.R6.voltage=false;
  assert.equal(calculationComplete(level,known),false);
});
