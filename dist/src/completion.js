export function calculationComplete(level,known){
  const required=level.graph.edges.map(edge=>edge.id);
  const currentsKnown=required.every(id=>known[id]?.current);
  const voltagesKnown=required.every(id=>known[id]?.voltage);
  return currentsKnown&&(level.mode==='complete'||voltagesKnown);
}
