const endpointKey=(a,b)=>[a,b].sort().join('|');

export function spansSupply(edge,graph){
  const source=graph.source??graph.nodes[0],sink=graph.sink??graph.nodes.at(-1);
  return Boolean(edge)&&endpointKey(edge.a,edge.b)===endpointKey(source,sink);
}

export function rotateActions(actions,turns){
  if(!actions.length)return[];
  const offset=((turns%actions.length)+actions.length)%actions.length;
  return[...actions.slice(offset),...actions.slice(0,offset)];
}

export function currentToken(edgeId){return`CURRENT:${edgeId}`}
export function voltageToken(edgeId){return`VOLTAGE:${edgeId}`}

const result=(status,message,{missing=null,operation=null}={})=>({status,countTurn:status!=='incomplete',message,missing,operation});

export function evaluateFormula({action,selected,edge,known={},graph}){
  if(!edge||!selected.has(edge.id))return result('incomplete','Select a resistance.',{missing:{kind:'resistance'}});
  if(action==='voltage-multiply'){
    if(known.voltage)return result('incomplete','That voltage is already known.');
    const currents=[...selected].filter(id=>id.startsWith('CURRENT:'));
    if(!currents.length)return result('incomplete','Select a current.',{missing:{kind:'current',ownerId:edge.id}});
    if(currents.length!==1||currents[0]!==currentToken(edge.id)||!known.current)return result('wrong','That current belongs to a different resistance.');
    return result('correct','Voltage calculated.',{operation:{type:'mark-known',edgeId:edge.id,property:'voltage'}});
  }
  if(action==='current-divide'){
    if(known.current)return result('incomplete','That current is already known.');
    const voltages=[...selected].filter(id=>id.startsWith('VOLTAGE:')),supply=selected.has('SUPPLY');
    if(!voltages.length&&!supply)return result('incomplete','Select a voltage.',{missing:{kind:'voltage',ownerId:edge.id}});
    if(voltages.length+(supply?1:0)!==1)return result('wrong','Select one voltage for this resistance.');
    if(supply&&!spansSupply(edge,graph))return result('wrong','That voltage is not across this resistance.');
    if(voltages.length&&(voltages[0]!==voltageToken(edge.id)||!known.voltage))return result('wrong','That voltage belongs to a different resistance.');
    return result('correct','Current calculated.',{operation:{type:'mark-known',edgeId:edge.id,property:'current'}});
  }
  return result('wrong','That rule cannot determine a missing value here.');
}

export function transferPlan({action,selected,graph}){
  const property=action==='same-current'?'current':action==='same-voltage'?'voltage':null;
  if(!property)return{status:'wrong',countTurn:true,message:'That rule cannot be used here.',operation:null};
  const prefix=property==='current'?'CURRENT:':'VOLTAGE:',tokens=[...selected].filter(id=>id.startsWith(prefix)),supply=property==='voltage'&&selected.has('SUPPLY');
  if(tokens.length+(supply?1:0)===0)return{status:'incomplete',countTurn:false,message:`Select a ${property}.`,missing:{kind:property},operation:null};
  if(tokens.length+(supply?1:0)!==1)return{status:'wrong',countTurn:true,message:`Select one known ${property}.`,operation:null};
  let edge=tokens.length?graph.edges.find(item=>item.id===tokens[0].slice(prefix.length)):graph.edges.find(item=>item.history?.type==='parallel'&&spansSupply(item,graph));
  if(!edge)return{status:'wrong',countTurn:true,message:property==='voltage'?'That voltage is not across a parallel group.':'That current does not belong to this circuit section.',operation:null};
  const required=property==='current'?'series':'parallel';
  if(edge.history?.type!==required)return{status:'wrong',countTurn:true,message:property==='current'?'This current does not continue through a series group.':'That voltage is not shared by a parallel group.',operation:null};
  return{status:'correct',countTurn:true,message:property==='current'?'Current applied to the series resistors.':'Voltage applied to the parallel resistors.',operation:{type:'expand-transfer',edgeId:edge.id,property}};
}

export function turnDelta(outcome){return outcome?.countTurn?1:0}
export function applyTurnOutcome(state,outcome){state.turns+=turnDelta(outcome);return state.turns}
export function hintOutcome(){return result('correct','Hint used.')}
export function starsForTurns(turns,best){return turns<=best?3:turns===best+1?2:1}

