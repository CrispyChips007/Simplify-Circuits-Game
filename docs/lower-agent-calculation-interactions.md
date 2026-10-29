# Lower-agent task: global placement and calculation interactions

## Starting point

- Work from `main` at or after commit `acf281f`.
- Read `docs/circuit-layout.md`, `docs/player-feedback.md`, `dist/src/app.js`, `dist/src/grid-layout.js`, `dist/src/solver.js`, and the existing tests before editing.
- Do not add level-specific coordinates or checks such as `if (level.id === 6)`.
- Do not restore the legacy renderer, custom SVG paths, junction dots, fixed screenshots, or hard-coded per-level layouts.
- Preserve the fixed-cell rules, the stable per-level viewport, the 5×3 simple minimum, the square resistor corners, and the current glide/rotation behaviour.
- Do not push. Leave a clean, tested commit for the supervising agent to review.

## Goal

Make the calculation chapters easier to understand and fit on a portrait phone while preserving the circuit-learning rules. At the same time, make midpoint placement truly global so equivalent resistors do not jump to an arbitrary child position in branched circuits.

## Required implementation structure

Do the work in the following order. Each section must have automated coverage before moving to the next one.

1. Global equivalent placement.
2. Pure interaction/action evaluation module.
3. Current and voltage propagation changes.
4. Missing-input formula coaching and turn accounting.
5. Action-button ordering and visual emphasis.
6. Portrait-height compression.
7. Regression pass, cache-version bumps, and one final commit.

Prefer a new pure module at `dist/src/interactions.js`. Keep DOM rendering and event binding in `dist/src/app.js`. The pure module should own operand validation, action outcome classification, transfer-target discovery, and action ordering so these behaviours can be tested without a browser.

Suggested result contract:

```js
{
  status: 'correct' | 'wrong' | 'incomplete',
  countTurn: true | false,
  message: 'player-facing text',
  missing: null | { kind: 'resistance' | 'current' | 'voltage' | 'supply', ownerId?: string },
  operation: null | { type: string, ...data }
}
```

`app.js` should apply a returned operation, render the result, and show feedback. It should not duplicate rule decisions already made by the interaction module.

## 1. Global equivalent placement

### Current defect

`state.layoutHints` records the selected components' centroid, but `buildBranchedLayout()` does not honour those hints. In the current Level 6 nested circuit, combining the two series resistors in the upper branch (currently R2 and R3) places the equivalent at the left child instead of the nearest legal cell to their midpoint.

### Required rule

- The equivalent anchor is the arithmetic centre of every selected component cell.
- Orientation remains:
  - horizontal + horizontal → horizontal;
  - vertical + vertical → vertical;
  - any mixed selection → vertical.
- Every layout strategy—series ring, parallel bank, and branched series/parallel layout—must score legal placements against hints.
- Place the equivalent in the legal cell with the smallest Manhattan distance to its anchor.
- Preserve untouched component cells when legal. Move them only when required to produce a valid cable route.
- If two placements have equal score, prefer the placement that moves fewer untouched components, then the one closest to the existing circuit centre.
- The rule must be topology-driven. Do not special-case Level 6, R2/R3, or any template name.
- Keep components separated by cable cells and retain valid component ports.

### Tests

Extend `test/grid-layout.test.js` with:

- Level 6 upper-branch R2/R3 reduction lands at the nearest legal midpoint, not either child's arbitrary position.
- The same assertion for at least one other branched topology.
- A reduction simulation that carries placement hints through every valid reduction state of every level.
- Untouched components stay in their previous cells whenever a valid layout exists without moving them.
- `validateGridLayout()` remains empty for all generated layouts.

## 2. Remove the standalone ITotal interaction

### Current defect

The root current is represented by the special selection ID `CURRENT`, separate from the combined resistance. This creates an extra item and makes the propagation workflow require selecting both a value and its resistor.

### Required rule

- A calculated current always belongs to a resistance edge, including the total equivalent resistance.
- Use one consistent token shape: `CURRENT:<edgeId>`. Do not use a standalone `CURRENT` token in normal play.
- Display the total-current label attached to the combined resistance cell. It may still read `Iₜₒₜₐₗ`, but its owner is the equivalent edge.
- Selecting the current label identifies its owning resistance; the player must not also select the resistor.
- Update the guided current tutorial to target the attached current label and remove the redundant "select RTotal as well" step.
- `state.current` may remain as a cached numeric value if useful, but it must not create a second selectable component.

## 3. Automatic current and voltage propagation

### Same current in series

When the player selects a known current and presses **Current is the same in series**:

- Resolve the owning equivalent edge from `CURRENT:<edgeId>`.
- If that edge was formed by a series reduction, expand it and mark current known on every direct child automatically.
- Do not require the child resistors to be selected.
- The same action should work recursively as each series group is opened.
- If the owner is not a series group, return a fully formed wrong attempt.

### Same voltage in parallel

When the player selects a known voltage and presses **Voltage is the same in parallel**:

- Resolve the owner from `VOLTAGE:<edgeId>` or the supply.
- If the owner was formed by a parallel reduction, expand it and mark voltage known on every direct child automatically.
- Do not require the child resistors to be selected.
- If the selected supply spans the same two circuit terminals as a parallel group or resistor, treat the supply voltage as a valid voltage for that group.
- Do not accept the supply for a branch that does not span the supply terminals.

### Formula operand equivalence

- `I = V ÷ R` must accept either the resistor's own known voltage token or the supply when the selected resistance spans the supply terminals.
- `V = I × R` uses the current owned by that resistance.
- Endpoint comparisons are orientation-independent and must use graph terminals, not UI position or labels.
- Keep the language player-facing: "same circuit branches", "one current path", "voltage across this resistance". Do not introduce node/graph terminology.

### Tests

Create `test/interactions.test.js` and cover:

- Selecting only `CURRENT:<seriesEquivalent>` plus same-current opens the group and assigns current to all direct children.
- Selecting only `VOLTAGE:<parallelEquivalent>` plus same-voltage opens the group and assigns voltage to all direct children.
- A supply is accepted as the voltage across a resistor/parallel group spanning the supply terminals.
- The same supply is rejected for an internal branch.
- No child-resistor preselection is required.
- Tutorial-compatible total-current ownership uses `CURRENT:<rootId>`, never standalone `CURRENT`.

## 4. Turn and star accounting

### Required classification

Do not increment `state.turns` at the top of `submit()`.

- **Incomplete:** missing operands, nothing selected, only part of a formula selected, an already-known result, or another no-op. Do not count a turn.
- **Wrong:** all required operands are present, but the selected rule/topology/value relationship is wrong. Count one turn.
- **Correct:** a valid operation changes state. Count one turn.
- **Hint:** continues to count one turn.
- Component/value selection clicks never count.

Stars may continue to use `turns` and each level's existing `best`, because correct operations still count. The change is that incomplete clicks no longer damage the score.

Add one helper such as `applyTurnOutcome(state, outcome)` so turn accounting cannot drift between phases.

### Tests

- Clicking a formula with no operands does not increment turns.
- Clicking with one missing operand does not increment turns.
- A complete but incorrect formula attempt increments once.
- A correct operation increments once.
- A hint increments once.
- Repeated clicks on an already-known result do not increment turns.
- Star results ignore incomplete clicks but reflect counted wrong attempts.

## 5. Missing-input formula coaching

When a formula button is pressed without all required parts:

- Show a compact callout anchored to or immediately above the selected formula button.
- Repeat the formula in the callout.
- Highlight the missing symbol/operand in yellow.
- Use one direct instruction, for example:
  - "Select a voltage."
  - "Select a resistance."
  - "Select a current."
- Keep the currently selected valid operands selected.
- Do not shake resistors or show a red error for incomplete input.
- Do not count a turn.
- Clear the callout when the missing value is selected, another action succeeds, the level changes, or restart is pressed.
- Make it accessible with `role="status"` or `aria-live="polite"`; do not use a blocking browser alert.

Add one reusable callout element, not one element per button.

## 6. Action buttons: visibility and rotating positions

The transfer rules are currently visually lost among the formula buttons.

### Visual treatment

- Add a distinct but on-theme outline/detail to the two transfer buttons:
  - **Current is the same in series**
  - **Voltage is the same in parallel**
- Use a class such as `.action.transfer-rule`; do not rely on text selectors.
- Preserve clear selected, focus-visible, hover, and touch-active states.
- Keep formulas readable at 375 px width.

### Position rotation

- Keep a stable base list of calculation actions.
- Rotate the rendered list deterministically after each counted turn so every rule receives different positions and players cannot rely on muscle memory.
- Do not use `Math.random()`.
- Suggested rule: `offset = countedTurns % actionCount`, then render a circular rotation of the base list.
- Do not reorder while the player is merely selecting operands.
- Incomplete formula clicks do not count and therefore do not reorder.
- Reset order on level load/restart.
- Apply this only to the harder calculation/formula action bank; keep the two-button relation levels stable.

Add pure tests for action ordering and reset behaviour.

## 7. Portrait-height compression

Target: 375×812 CSS pixels. On a calculation level, the level header, title, circuit, selection/feedback area, all six actions, Hint, and Restart must be reachable without the action bank being pushed below the initial play area. Avoid horizontal scrolling.

Implement scoped classes on the game card, for example:

- `.mode-calculation`
- `.phase-simplify`
- `.phase-total`
- `.phase-expand`

Do not globally shrink the early relation levels.

Suggested portrait adjustments:

- Reduce calculation-level prompt margins and heading height.
- Reduce the original-circuit strip to approximately 48–56 px high.
- Remove unused vertical padding around the circuit while preserving the stable aspect ratio and feedback clearance.
- Use tighter action gaps and 46–50 px minimum button height.
- Keep two action columns on portrait.
- Keep touch targets at least 44 CSS px high.
- Keep the selection/feedback strip one compact block.
- Do not overlap current/voltage labels, tutorial pointer, or the circuit return cable.

Do a visual check at 375×812 and 390×844. Do not change the logical grid merely to satisfy CSS height.

## 8. Copy and feedback

Use concise player language. Examples:

- "Select a voltage."
- "That voltage is not across this resistance."
- "This current follows a different path."
- "Current applied to the series resistors."
- "Voltage applied to the parallel resistors."

Do not use: node, endpoint, graph, edge, token, child, owner, propagation, or topology in player-visible copy.

Update `test/copy.test.js` so internal implementation terms cannot leak into feedback.

## Files expected to change

- `dist/src/app.js`
- `dist/src/grid-layout.js`
- `dist/src/interactions.js` (new, preferred)
- `dist/index.html`
- `dist/refinements.css`
- `test/grid-layout.test.js`
- `test/interactions.test.js` (new)
- `test/copy.test.js`
- Possibly `dist/src/completion.js` only if completion ownership needs adjustment
- Documentation only when behaviour differs from existing docs

Avoid editing `dist/src/levels.js` or changing best-turn values unless a test proves the new interaction model changes the minimum number of correct operations. If best values must change, calculate them systematically and document why.

## Completion checklist

- [ ] Level 6 branch reduction honours the global midpoint rule.
- [ ] No hard-coded level/template placement exceptions.
- [ ] No standalone selectable `CURRENT` item.
- [ ] Same-current and same-voltage require only the known value selection.
- [ ] Supply voltage works wherever it is electrically the same voltage.
- [ ] Incomplete formula clicks show missing-input coaching and cost no turn.
- [ ] Complete wrong attempts and correct operations each cost one turn.
- [ ] Transfer-rule buttons have a distinct outline.
- [ ] Calculation actions rotate deterministically after counted turns.
- [ ] Calculation play area fits the portrait targets.
- [ ] Existing tutorials still work with the new ownership model.
- [ ] Cache query versions are bumped for every changed browser asset.
- [ ] `node --check dist/src/app.js` passes.
- [ ] `npm test` passes.
- [ ] `git diff --check` passes.
- [ ] One focused commit is created; nothing is pushed.
