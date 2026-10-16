# Circuit layout contract

Circuit topology and electrical values live in `levels.js`. Visual geometry lives in `layout.js` and is shared by every level that uses the same topology.

## Frame

- Canonical playable SVG: 760 × 390 units.
- Mobile crop: x 30–730; the selection chip owns the lower part of the card.
- Supply zone: x 54–170.
- Network safe area: x 34–724, y 34–306.
- Return wire: y 315.

## Components

- Every playable resistor has one canonical 128 × 52-unit body at every viewport size.
- A vertical resistor is that same body rotated geometrically: 52 × 128 units.
- Renderers must read these dimensions from `COMPONENT_SIZE`; viewport-specific body dimensions are not permitted.
- Minimum component-to-component gap: 8 units.
- Minimum straight lead before a node or bend: 8 units at each resistor end.
- Value pills occupy their own lane above, below, or beside a resistor and do not alter component geometry.
- Combined resistors use `I` and `V` in value pills; original resistors retain numbered subscripts.

## Templates

New mixed circuits must use a named template from `layout.js`. A level supplies topology and values, not its own coordinates. Add a new template only when the topology is genuinely new.

Every custom layout must pass `validateCustomLayout`, which checks:

- the actual mobile component bounds;
- safe-area containment;
- component collisions;
- node obstruction;
- straight lead length.

## Motion

- The reduction destination is always the new equivalent resistor's calculated centre.
- Resistors and their attached wire groups translate toward their next centres together.
- Old geometry fades out over the new geometry; the new geometry fades in beneath it.
- The final SVG is redrawn from the solved graph after the crossfade.
- Reduced-motion mode skips interpolation and performs the final redraw immediately.

## Reference circuit

- The reference is derived from the same topology template as the playable circuit.
- Scaling is uniform in x and y; reference diagrams must not be stretched.
- It always displays original components and original supplies, never reduced state.
