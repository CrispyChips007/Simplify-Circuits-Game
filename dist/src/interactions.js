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

