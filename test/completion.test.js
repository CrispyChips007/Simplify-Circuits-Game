import test from 'node:test';
import assert from 'node:assert/strict';
import { calculationComplete } from '../dist/src/completion.js';
import { LEVELS } from '../dist/src/levels.js';
import { levelSupply } from '../dist/src/supplies.js';

test('final level combines two 12 volt supplies into 24 volts',()=>{
  const level=LEVELS.at(-1);
  assert.deepEqual(level.supplies.map(supply=>supply.voltage),[12,12]);
  assert.equal(levelSupply(level).voltage,24);
  assert.equal(levelSupply(level).capacity,4);
});

test('final level completes from all original resistor values despite extra group state',()=>{
  const level=LEVELS.at(-1);
  const known=Object.fromEntries(level.graph.edges.map(edge=>[edge.id,{current:true,voltage:true}]));
  known.E4={current:true,voltage:true};
  assert.equal(calculationComplete(level,known),true);
});

test('final level remains open when one original voltage is missing',()=>{
  const level=LEVELS.at(-1);
  const known=Object.fromEntries(level.graph.edges.map(edge=>[edge.id,{current:true,voltage:true}]));
  known.R6.voltage=false;
  assert.equal(calculationComplete(level,known),false);
});
