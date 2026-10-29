import test from 'node:test';
import assert from 'node:assert/strict';
import { currentToken, rotateActions, spansSupply, transferPlan, turnDelta, voltageToken } from '../dist/src/interactions.js';

const graph={nodes:['A','B'],source:'A',sink:'B',edges:[]};
const child=(id,a='A',b='B')=>({id,a,b,value:5});
const group=(id,type,a='A',b='B')=>({id,a,b,value:10,history:{type,children:[child('R1',a,b),child('R2',a,b)]}});

test('calculation actions rotate deterministically',()=>{const actions=['a','b','c'];assert.deepEqual(rotateActions(actions,0),actions);assert.deepEqual(rotateActions(actions,1),['b','c','a']);assert.deepEqual(rotateActions(actions,3),actions)});
test('current and voltage tokens always belong to a resistance',()=>{assert.equal(currentToken('E1'),'CURRENT:E1');assert.equal(voltageToken('E1'),'VOLTAGE:E1')});
test('supply equivalence uses circuit terminals',()=>{assert.equal(spansSupply(child('R1'),graph),true);assert.equal(spansSupply(child('R2','A','C'),graph),false)});
test('same current needs only the current value',()=>{const circuit={...graph,edges:[group('E1','series')]},plan=transferPlan({action:'same-current',selected:new Set(['CURRENT:E1']),graph:circuit});assert.equal(plan.status,'correct');assert.deepEqual(plan.operation,{type:'expand-transfer',edgeId:'E1',property:'current'})});
test('same voltage needs only the voltage value',()=>{const circuit={...graph,edges:[group('E1','parallel')]},plan=transferPlan({action:'same-voltage',selected:new Set(['VOLTAGE:E1']),graph:circuit});assert.equal(plan.status,'correct');assert.equal(plan.operation.property,'voltage')});
test('supply can feed a parallel group across the supply',()=>{const circuit={...graph,edges:[group('E1','parallel')]},plan=transferPlan({action:'same-voltage',selected:new Set(['SUPPLY']),graph:circuit});assert.equal(plan.status,'correct')});
test('supply cannot feed an internal parallel group',()=>{const circuit={...graph,edges:[group('E1','parallel','A','C')]},plan=transferPlan({action:'same-voltage',selected:new Set(['SUPPLY']),graph:circuit});assert.equal(plan.status,'wrong')});
test('missing values are incomplete and do not cost a turn',()=>{const circuit={...graph,edges:[group('E1','series')]},plan=transferPlan({action:'same-current',selected:new Set(),graph:circuit});assert.equal(plan.status,'incomplete');assert.equal(turnDelta(plan),0)});
test('complete correct and wrong attempts cost one turn',()=>{assert.equal(turnDelta({status:'correct',countTurn:true}),1);assert.equal(turnDelta({status:'wrong',countTurn:true}),1)});
