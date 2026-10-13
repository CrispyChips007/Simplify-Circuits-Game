const edge = (id, a, b, value, label = id) => ({ id, a, b, value, label });
const graph = (nodes, edges) => ({ nodes, edges, nextId: 1 });

export const LEVELS = [
  { id:1, name:'First connection', mode:'relation', title:'How are these connected?', prompt:'The resistors are already selected.', best:1, preselect:['R1','R2'], graph:graph(['A','B','C'],[edge('R1','A','B',10),edge('R2','B','C',22)]), layout:'series' },
  { id:2, name:'Shared nodes', mode:'relation', title:'Simplify the parallel group', prompt:'Choose any valid pair, or take all three at once.', best:1, graph:graph(['A','B'],[edge('R1','A','B',12),edge('R2','A','B',24),edge('R3','A','B',8)]), layout:'parallel' },
  { id:3, name:'Mixed circuit', mode:'formula', title:'Choose each simplifying formula', prompt:'Find a reducible group and keep going.', best:2, graph:graph(['A','B','C'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','C',6)]), layout:'mixed' },
  { id:4, name:'Carry the current', mode:'trace', title:'Carry the known value back through', prompt:'Expand the equivalent resistor using the correct rule.', best:1, preselect:['EQ'], trace:true }
];
