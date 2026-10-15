import { templatePositions } from './layout.js';

const edge = (id, a, b, value, label = id) => ({ id, a, b, value, label });
const graph = (nodes, edges) => ({ nodes, edges, nextId: 1 });
const nested = (values) => graph(['A','B','T','U','D','E'],[
  edge('R1','A','B',values[0]),edge('R2','B','T',values[1]),edge('R3','T','D',values[2]),
  edge('R4','B','U',values[3]),edge('R5','U','D',values[4]),edge('R6','D','E',values[5])
]);
const parallelSeriesParallel=(values)=>graph(['A','B','C','D'],[
  edge('R1','A','B',values[0]),edge('R2','A','B',values[1]),edge('R3','B','C',values[2]),
  edge('R4','C','D',values[3]),edge('R5','C','D',values[4])
]);
const custom=(id,name,mode,topology,nodes,edges,best)=>({id,name,mode,title:'Simplify the circuit',prompt:'Select a valid section.',best,graph:graph(nodes,edges),layout:'custom',topology,positions:templatePositions(topology)});

const LEVELS_SOURCE = [
  { id:1, name:'First connection', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B','C'],[edge('R1','A','B',10),edge('R2','B','C',22)]), layout:'series' },
  { id:2, name:'Longer path', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B','C','D'],[edge('R1','A','B',5),edge('R2','B','C',10),edge('R3','C','D',15)]), layout:'series' },
  { id:3, name:'Shared nodes', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B'],[edge('R1','A','B',12),edge('R2','A','B',24),edge('R3','A','B',8)]), layout:'parallel' },
  { id:4, name:'Mixed connections', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:2, graph:graph(['A','B','C'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','C',6)]), layout:'mixed' },
  { id:5, name:'Series formula', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B','C','D','E'],[edge('R1','A','B',3),edge('R2','B','C',6),edge('R3','C','D',9),edge('R4','D','E',12)]), layout:'series' },
  { id:6, name:'Parallel formula', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B'],[edge('R1','A','B',12),edge('R2','A','B',12),edge('R3','A','B',24),edge('R4','A','B',24)]), layout:'parallel' },
  { id:7, name:'Mixed formulas', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:2, graph:graph(['A','B','C'],[edge('R1','A','B',6),edge('R2','B','C',18),edge('R3','B','C',9)]), layout:'mixed', mixedOrientation:'vertical' },
  { id:8, name:'Two currents', mode:'complete', title:'Solve the circuit currents', prompt:'Determine I₁ and I₂.', best:3, voltage:12, graph:graph(['A','B','C'],[edge('R1','A','B',4),edge('R2','B','C',8)]), layout:'series' },
  { id:9, name:'Three currents', mode:'complete', title:'Solve the circuit currents', prompt:'Determine I₁, I₂ and I₃.', best:3, voltage:12, graph:graph(['A','B','C','D'],[edge('R1','A','B',10),edge('R2','B','C',20),edge('R3','C','D',30)]), layout:'series' },
  { id:10, name:'Four currents', mode:'complete', title:'Solve the circuit currents', prompt:'Determine I₁, I₂, I₃ and I₄.', best:3, voltage:24, graph:graph(['A','B','C','D','E'],[edge('R1','A','B',6),edge('R2','B','C',6),edge('R3','C','D',6),edge('R4','D','E',6)]), layout:'series' },
  { id:11, name:'First voltage drops', mode:'voltage', title:'Solve the voltage drops', prompt:'Determine V₁ and V₂.', best:5, voltage:12, graph:graph(['A','B','C'],[edge('R1','A','B',4),edge('R2','B','C',8)]), layout:'series' },
  { id:12, name:'Voltage drops', mode:'voltage', title:'Solve the voltage drops', prompt:'Determine V₁, V₂ and V₃.', best:6, voltage:18, graph:graph(['A','B','C','D'],[edge('R1','A','B',3),edge('R2','B','C',6),edge('R3','C','D',9)]), layout:'series' },
  { id:13, name:'Split paths', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:4, graph:nested([2,4,8,6,6,10]), layout:'nested' },
  { id:14, name:'Parallel routes', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:4, graph:nested([5,5,10,8,12,5]), layout:'nested' },
  { id:15, name:'Inside the branches', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:4, graph:nested([4,6,6,8,4,4]), layout:'nested' },
  { id:16, name:'Six branches', mode:'relation', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B'],[edge('R1','A','B',6),edge('R2','A','B',12),edge('R3','A','B',18),edge('R4','A','B',24),edge('R5','A','B',36),edge('R6','A','B',72)]), layout:'parallel' },
  { id:17, name:'Wrapped series', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B','C','D','E','F'],[edge('R1','A','B',3),edge('R2','B','C',6),edge('R3','C','D',9),edge('R4','D','E',12),edge('R5','E','F',15)]), layout:'series' },
  { id:18, name:'Wide parallel formula', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:1, graph:graph(['A','B'],[edge('R1','A','B',12),edge('R2','A','B',18),edge('R3','A','B',24),edge('R4','A','B',36),edge('R5','A','B',72)]), layout:'parallel' },
  { id:19, name:'Branch sequence', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:4, graph:nested([2,3,9,6,6,4]), layout:'nested' },
  { id:20, name:'Offset branch', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:2, graph:graph(['A','B','C'],[edge('R1','A','B',8),edge('R2','B','C',12),edge('R3','B','C',6)]), layout:'mixed' },
  { id:21, name:'Five currents', mode:'complete', title:'Solve the circuit currents', prompt:'Determine I₁ through I₅.', best:3, voltage:30, graph:graph(['A','B','C','D','E','F'],[edge('R1','A','B',2),edge('R2','B','C',4),edge('R3','C','D',6),edge('R4','D','E',8),edge('R5','E','F',10)]), layout:'series' },
  { id:22, name:'Four voltage drops', mode:'voltage', title:'Solve the voltage drops', prompt:'Determine V₁ through V₄.', best:7, voltage:20, graph:graph(['A','B','C','D','E'],[edge('R1','A','B',2),edge('R2','B','C',4),edge('R3','C','D',6),edge('R4','D','E',8)]), layout:'series' },
  { id:23, name:'Advanced paths', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:4, graph:nested([4,4,8,6,10,2]), layout:'nested' },
  { id:24, name:'Final circuit', mode:'formula', title:'Simplify the circuit', prompt:'Select a valid section.', best:4, supplies:[{voltage:12,capacity:3},{voltage:12,capacity:3}], supplyConnection:'parallel', graph:nested([3,9,3,8,4,6]), layout:'nested' },
  custom(25,'Circuit','relation','sandwich',['A','B','C','D'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','C',6),edge('R4','C','D',5)],2),
  custom(26,'Circuit','relation','double-bank',['A','B','C'],[edge('R1','A','B',8),edge('R2','A','B',8),edge('R3','B','C',12),edge('R4','B','C',6)],3),
  custom(27,'Circuit','formula','split-series',['A','T','U','B'],[edge('R1','A','T',5),edge('R2','T','B',7),edge('R3','A','U',6),edge('R4','U','B',6)],3),
  custom(28,'Circuit','formula','unequal-branches',['A','B','T','C','D'],[edge('R1','A','B',3),edge('R2','B','C',10),edge('R3','B','T',4),edge('R4','T','C',6),edge('R5','C','D',7)],3),
  custom(29,'Circuit','formula','three-way-tail',['A','B','T','U','C','D'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','T',3),edge('R4','T','C',9),edge('R5','B','U',5),edge('R6','U','C',10),edge('R7','C','D',6)],4),
  custom(30,'Circuit','formula','offset-double',['A','B','T','C','U','D'],[edge('R1','A','B',2),edge('R2','B','T',4),edge('R3','T','C',8),edge('R4','B','C',6),edge('R5','C','U',5),edge('R6','U','D',5)],4),
  {id:31,name:'Circuit',mode:'complete',title:'Solve currents',prompt:'Determine every current.',best:7,voltage:24,graph:graph(['A','B','C'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','C',6)]),layout:'mixed',mixedOrientation:'vertical'},
  {id:32,name:'Circuit',mode:'complete',title:'Solve currents',prompt:'Determine every current.',best:11,voltage:24,graph:nested([2,4,8,6,6,10]),layout:'nested'},
  {id:33,name:'Circuit',mode:'voltage',title:'Solve all values',prompt:'Determine every current and voltage.',best:10,supplies:[{voltage:12,capacity:3},{voltage:12,capacity:5}],supplyConnection:'parallel',graph:graph(['A','B','C'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','C',6)]),layout:'mixed'},
  {id:34,name:'Circuit',mode:'voltage',title:'Solve all values',prompt:'Determine every current and voltage.',best:14,supplies:[{voltage:12,capacity:4},{voltage:12,capacity:4}],supplyConnection:'series',graph:nested([2,4,8,6,6,10]),layout:'nested'}
  ,{...custom(35,'Circuit','formula','parallel-series-parallel',['A','B','C','D'],parallelSeriesParallel([12,12,6,8,8]).edges,3)}
  ,{...custom(36,'Circuit','complete','parallel-series-parallel',['A','B','C','D'],parallelSeriesParallel([12,12,6,8,8]).edges,10),voltage:24}
  ,{...custom(37,'Circuit','voltage','unequal-branches',['A','B','T','C','D'],[edge('R1','A','B',3),edge('R2','B','C',10),edge('R3','B','T',4),edge('R4','T','C',6),edge('R5','C','D',7)],14),voltage:24}
  ,{...custom(38,'Circuit','voltage','three-way-tail',['A','B','T','U','C','D'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','T',3),edge('R4','T','C',9),edge('R5','B','U',5),edge('R6','U','C',10),edge('R7','C','D',6)],18),voltage:24}
  ,{...custom(39,'Circuit','voltage','offset-double',['A','B','T','C','U','D'],[edge('R1','A','B',2),edge('R2','B','T',4),edge('R3','T','C',8),edge('R4','B','C',6),edge('R5','C','U',5),edge('R6','U','D',5)],16),voltage:30}
  ,{...custom(40,'Circuit','voltage','parallel-series-parallel',['A','B','C','D'],parallelSeriesParallel([12,12,6,8,8]).edges,14),voltage:24}
  ,{id:41,name:'Circuit',scenario:'Marine battery bank',mode:'voltage',title:'Solve all values',prompt:'Determine every current and voltage.',best:8,supplies:[{voltage:12,capacity:100},{voltage:12,capacity:100},{voltage:12,capacity:100}],supplyConnection:'parallel',graph:graph(['A','B','C'],[edge('R1','A','B',6),edge('R2','B','C',12)]),layout:'series'}
  ,{id:42,name:'Circuit',scenario:'Solar battery string',mode:'voltage',title:'Solve all values',prompt:'Determine every current and voltage.',best:8,supplies:[{voltage:12,capacity:4},{voltage:12,capacity:4},{voltage:12,capacity:4}],supplyConnection:'series',graph:graph(['A','B'],[edge('R1','A','B',18),edge('R2','A','B',18)]),layout:'parallel'}
  ,{id:43,name:'Circuit',scenario:'Motorhome battery bank',mode:'voltage',title:'Solve all values',prompt:'Determine every current and voltage.',best:11,supplies:[{voltage:12,capacity:100},{voltage:12,capacity:100},{voltage:12,capacity:100}],supplyConnection:'parallel',graph:graph(['A','B','C'],[edge('R1','A','B',4),edge('R2','B','C',12),edge('R3','B','C',6)]),layout:'mixed',mixedOrientation:'vertical'}
];

// Teaching order: identify connections, apply formulas, solve currents, then solve all values.
// The second near-identical series-identification question is deliberately omitted.
const COURSE_ORDER=[1,3,4,25,26,13,5,6,17,18,7,27,20,35,28,19,30,29,8,9,31,36,32,11,37,40,38,39,41,33,42,43,34];
export const LEVELS=COURSE_ORDER.map((sourceId,index)=>{
  const source=LEVELS_SOURCE.find(level=>level.id===sourceId);
  const mode=source.mode;
  return {...source,id:index+1,name:`Circuit ${index+1}`,title:mode==='complete'?'Solve currents':mode==='voltage'?'Solve all values':'Simplify the circuit',prompt:mode==='voltage'?'Determine every current and voltage drop.':source.prompt};
});
