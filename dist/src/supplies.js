export function combineSupplies(supplies, connection){
  if(!supplies?.length)return { voltage:12, capacity:4 };
  if(connection==='parallel'){
    const voltage=supplies[0].voltage;
    if(!supplies.every(supply=>supply.voltage===voltage))return null;
    return { voltage, capacity:supplies.reduce((sum,supply)=>sum+supply.capacity,0) };
  }
  return {
    voltage:supplies.reduce((sum,supply)=>sum+supply.voltage,0),
    capacity:Math.min(...supplies.map(supply=>supply.capacity))
  };
}

export function levelSupply(level){
  if(level.supplies)return combineSupplies(level.supplies,level.supplyConnection);
  return { voltage:level.voltage||12, capacity:level.capacity||4 };
}
