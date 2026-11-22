const svg = document.querySelector('#circuit');
const moveCount = document.querySelector('#moveCount');
const selectionText = document.querySelector('#selectionText');
const actionGrid = document.querySelector('#actionGrid');
const feedback = document.querySelector('#feedback');
const feedbackTitle = document.querySelector('#feedbackTitle');
const feedbackText = document.querySelector('#feedbackText');
const feedbackIcon = document.querySelector('#feedbackIcon');
const resultCard = document.querySelector('#resultCard');

const stageCopy = {
  1: ['STAGE 01 · RECOGNISE', 'How are these resistors connected?', 'The pair is already selected. Identify the relationship to simplify it.'],
  2: ['STAGE 02 · FIND THE GROUP', 'Find the complete parallel group', 'Tap every resistor that belongs in the group, then identify the relationship.'],
  3: ['STAGE 03 · CHOOSE THE FORMULA', 'Choose the rule that simplifies this group', 'Select all components in one reducible section, then choose its formula.'],
  4: ['STAGE 04 · TRACE VALUES', 'Carry the known current back through', 'The circuit has been solved. Expand the combined resistor using the correct circuit rule.']
};

let state = { stage: 1, moves: 0, selected: new Set(['R1', 'R2']), solved: false, step: 0 };

function resistor(id, x, y, value, orientation = 'h', selected = false, label = id) {
  const vertical = orientation === 'v';
  const w = vertical ? 76 : 130;
  const h = vertical ? 92 : 62;
  return `<g class="resistor ${selected ? 'selected' : ''}" data-id="${id}" tabindex="0" role="button" aria-label="${label}, ${value} ohms" transform="translate(${x - w/2} ${y - h/2})">
    <rect class="body" width="${w}" height="${h}" rx="14"/>
    <text class="label" x="${w/2}" y="${h/2 - 3}">${label}</text>
    <text class="value" x="${w/2}" y="${h/2 + 18}">${value} Ω</text>
  </g>`;
}

function stageOne() {
  return `<path class="wire" d="M120 210 H280 M540 210 H700 V315 H120 V210"/>
    <circle class="node" cx="120" cy="210" r="7"/><circle class="node" cx="700" cy="210" r="7"/>
    ${resistor('R1', 345, 210, 10, 'h', true)}
    ${resistor('R2', 475, 210, 22, 'h', true)}
    <g transform="translate(100 263)"><path class="wire" d="M20 0 V104"/><path class="wire" d="M0 38 H40 M8 64 H32"/></g>`;
}

function parallelCircuit(autoSelected = false) {
  return `<path class="wire" d="M120 105 H700 V315 H120 V105 M250 105 V155 M410 105 V155 M570 105 V155 M250 247 V315 M410 247 V315 M570 247 V315"/>
    <circle class="node" cx="250" cy="105" r="7"/><circle class="node" cx="410" cy="105" r="7"/><circle class="node" cx="570" cy="105" r="7"/>
    <circle class="node" cx="250" cy="315" r="7"/><circle class="node" cx="410" cy="315" r="7"/><circle class="node" cx="570" cy="315" r="7"/>
    ${resistor('R1', 250, 201, 12, 'v', autoSelected)}
    ${resistor('R2', 410, 201, 24, 'v', autoSelected)}
    ${resistor('R3', 570, 201, 8, 'v', autoSelected)}
    <g transform="translate(100 190)"><path class="wire" d="M20 -85 V125"/><path class="wire" d="M0 5 H40 M8 31 H32"/></g>`;
}

function mixedCircuit() {
  return `<path class="wire" d="M100 210 H205 M335 210 H385 M385 210 V125 H610 V210 M385 210 V295 H610 V210 H720 V330 H100 V210"/>
    <circle class="node" cx="385" cy="210" r="7"/><circle class="node" cx="610" cy="210" r="7"/>
    ${resistor('R1', 270, 210, 4, 'h')}
    ${resistor('R2', 498, 125, 12, 'h')}
    ${resistor('R3', 498, 295, 6, 'h')}
    <g transform="translate(80 262)"><path class="wire" d="M20 -52 V68"/><path class="wire" d="M0 -5 H40 M8 21 H32"/></g>`;
}

function traceCircuit(expanded = false) {
  if (expanded) {
    return `<path class="wire" d="M105 210 H225 M595 210 H710 V315 H105 V210"/>
      ${resistor('R1', 290, 210, 10, 'h', true)} ${resistor('R2', 430, 210, 20, 'h', true)} ${resistor('R3', 560, 210, 30, 'h', true)}
      <rect class="current-pill" x="170" y="174" width="86" height="26" rx="13"/><text class="current-text" x="213" y="192">Iₜ = 0.2 A</text>
      <g transform="translate(85 263)"><path class="wire" d="M20 -53 V52"/><path class="wire" d="M0 -10 H40 M8 16 H32"/></g>`;
  }
  return `<path class="wire" d="M105 210 H305 M515 210 H710 V315 H105 V210"/>
    ${resistor('REQ', 410, 210, 60, 'h', true, 'R₁–R₃')}
    <rect class="current-pill" x="174" y="173" width="100" height="28" rx="14"/><text class="current-text" x="224" y="192">Iₜ = 0.2 A</text>
    <g transform="translate(85 263)"><path class="wire" d="M20 -53 V52"/><path class="wire" d="M0 -10 H40 M8 16 H32"/></g>`;
}

function render() {
  const copy = stageCopy[state.stage];
  document.querySelector('#stageLabel').textContent = copy[0];
  document.querySelector('#missionTitle').textContent = copy[1];
  document.querySelector('#missionText').textContent = copy[2];
  moveCount.textContent = state.moves;
  resultCard.classList.add('hidden');

  if (state.stage === 1) svg.innerHTML = stageOne();
  if (state.stage === 2) svg.innerHTML = parallelCircuit(false);
  if (state.stage === 3) svg.innerHTML = mixedCircuit();
  if (state.stage === 4) svg.innerHTML = traceCircuit(state.solved);

  updateSelectionStyles();
  renderActions();
  bindResistors();
}

function renderActions() {
  if (state.stage <= 2) {
    actionGrid.innerHTML = `<button class="action-button" data-action="series">Series</button><button class="action-button" data-action="parallel">Parallel</button>`;
  } else if (state.stage === 3) {
    actionGrid.innerHTML = `<button class="action-button formula" data-action="sum">Rₜ = R₁ + R₂ + …</button><button class="action-button formula" data-action="reciprocal">1/Rₜ = 1/R₁ + 1/R₂ + …</button>`;
  } else {
    actionGrid.innerHTML = `<button class="action-button" data-action="same-current">Current is the same in series</button><button class="action-button" data-action="same-voltage">Voltage is the same in parallel</button>`;
  }
  actionGrid.querySelectorAll('button').forEach(button => button.addEventListener('click', () => attempt(button.dataset.action)));
}

function bindResistors() {
  svg.querySelectorAll('.resistor').forEach(el => {
    const activate = () => {
      if (state.stage === 1 || state.stage === 4 || state.solved) return;
      const id = el.dataset.id;
      state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
      updateSelectionStyles();
    };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
}

function updateSelectionStyles() {
  svg.querySelectorAll('.resistor').forEach(el => el.classList.toggle('selected', state.selected.has(el.dataset.id)));
  const names = [...state.selected];
  selectionText.textContent = names.length ? names.join(' + ') : 'Tap resistors';
}

function attempt(action) {
  if (state.solved) return;
  state.moves += 1;
  moveCount.textContent = state.moves;
  let correct = false;
  let explanation = '';

  if (state.stage === 1) {
    correct = action === 'series';
    explanation = 'There is no branch between R1 and R2, so the same current must pass through both.';
  } else if (state.stage === 2) {
    const complete = ['R1','R2','R3'].every(x => state.selected.has(x)) && state.selected.size === 3;
    correct = complete && action === 'parallel';
    explanation = complete ? 'Each resistor connects across the same two nodes, so the group is parallel.' : 'Follow the top and bottom rails: all three resistors share the same two nodes.';
  } else if (state.stage === 3) {
    const pair = state.selected.size === 2 && state.selected.has('R2') && state.selected.has('R3');
    correct = pair && action === 'reciprocal';
    explanation = pair ? 'R2 and R3 share both connection nodes, so use the parallel reciprocal formula.' : 'R2 and R3 form the reducible section—they connect between the same two nodes.';
  } else {
    correct = action === 'same-current';
    explanation = 'A series path has no branches, so the known total current applies to R1, R2 and R3.';
  }

  if (correct) solve(explanation); else fail(explanation);
}

function fail(explanation) {
  feedback.className = 'feedback error';
  feedbackIcon.textContent = '×';
  feedbackTitle.textContent = 'That connection does not hold';
  feedbackText.textContent = explanation;
  const chosen = svg.querySelectorAll('.resistor.selected');
  chosen.forEach(el => { el.classList.remove('wrong'); void el.getBoundingClientRect(); el.classList.add('wrong'); });
}

function solve(explanation) {
  feedback.className = 'feedback success';
  feedbackIcon.textContent = '✓';
  feedbackTitle.textContent = state.stage === 4 ? 'Value carried through' : 'Valid simplification';
  feedbackText.textContent = explanation;
  svg.querySelectorAll('.resistor.selected').forEach(el => el.classList.add('merging'));
  setTimeout(() => {
    state.solved = true;
    if (state.stage === 4) {
      svg.innerHTML = traceCircuit(true);
      selectionText.textContent = 'R1 + R2 + R3';
    } else {
      renderEquivalent();
    }
    showResult();
  }, 520);
}

function renderEquivalent() {
  if (state.stage === 1) {
    svg.innerHTML = `<path class="wire" d="M120 210 H335 M485 210 H700 V315 H120 V210"/>${resistor('REQ',410,210,32,'h',false,'Rₜ')}<g transform="translate(100 263)"><path class="wire" d="M20 0 V104"/><path class="wire" d="M0 38 H40 M8 64 H32"/></g>`;
    selectionText.textContent = 'Rₜ = 32 Ω';
  } else if (state.stage === 2) {
    svg.innerHTML = `<path class="wire" d="M120 105 H410 V155 M410 247 V315 H120 V105 M410 105 H700 V315 H410"/>${resistor('REQ',410,201,4,'v',false,'Rₜ')}<g transform="translate(100 190)"><path class="wire" d="M20 -85 V125"/><path class="wire" d="M0 5 H40 M8 31 H32"/></g>`;
    selectionText.textContent = 'Rₜ = 4 Ω';
  } else {
    svg.innerHTML = `<path class="wire" d="M100 210 H205 M335 210 H420 M550 210 H720 V330 H100 V210"/>${resistor('R1',270,210,4)}${resistor('REQ',485,210,4,'h',false,'R₂∥R₃')}<g transform="translate(80 262)"><path class="wire" d="M20 -52 V68"/><path class="wire" d="M0 -5 H40 M8 21 H32"/></g>`;
    selectionText.textContent = 'R2 ∥ R3 = 4 Ω';
  }
}

function showResult() {
  const best = 1;
  const stars = state.moves === best ? 3 : state.moves === best + 1 ? 2 : 1;
  document.querySelector('#stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  document.querySelector('#stars').setAttribute('aria-label', `${stars} out of 3 stars`);
  document.querySelector('#resultTitle').textContent = state.stage === 4 ? 'Original circuit restored' : 'Section simplified';
  document.querySelector('#resultText').textContent = state.moves === 1 ? 'One move. You found the complete relationship.' : `Solved in ${state.moves} moves. Replay to find a shorter path.`;
  document.querySelector('#nextButton').textContent = state.stage === 4 ? 'Play again ↻' : 'Next stage →';
  resultCard.classList.remove('hidden');
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function loadStage(stage) {
  state = {
    stage,
    moves: 0,
    selected: stage === 1 ? new Set(['R1','R2']) : stage === 4 ? new Set(['REQ']) : new Set(),
    solved: false,
    step: 0
  };
  document.querySelectorAll('.stage-tab').forEach(tab => tab.classList.toggle('active', Number(tab.dataset.stage) === stage));
  feedback.className = 'feedback';
  feedbackIcon.textContent = 'i';
  feedbackTitle.textContent = 'Your move';
  feedbackText.textContent = stage === 4 ? 'Choose the rule that lets the known value pass into the original components.' : 'Select a relationship or formula when you are ready.';
  render();
}

document.querySelectorAll('.stage-tab').forEach(tab => tab.addEventListener('click', () => loadStage(Number(tab.dataset.stage))));
document.querySelector('#restartButton').addEventListener('click', () => loadStage(state.stage));
document.querySelector('#nextButton').addEventListener('click', () => loadStage(state.stage === 4 ? 1 : state.stage + 1));
render();
