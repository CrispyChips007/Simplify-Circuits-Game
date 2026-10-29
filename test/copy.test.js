import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const playerCopy=[
  readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),
  readFileSync(new URL('../dist/src/app.js',import.meta.url),'utf8'),
  readFileSync(new URL('../dist/src/interactions.js',import.meta.url),'utf8'),
  readFileSync(new URL('../dist/src/solver.js',import.meta.url),'utf8')
].join('\n');

test('player feedback avoids internal circuit-graph language',()=>{
  for(const phrase of ['same two nodes','branching node','unbranched path','reducible group','saved group','selected token','child resistor','graph endpoint']){
    assert.equal(playerCopy.toLowerCase().includes(phrase),false,`player copy contains "${phrase}"`);
  }
});
