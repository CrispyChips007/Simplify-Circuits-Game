# Player feedback contract

## Persistent information

- The level header identifies the level once (`LEVEL n`); it does not repeat `Circuit n`.
- The task heading states the goal, such as `Simplify the circuit` or `Solve all values`.
- The selection panel is the single location for selection and action feedback.
- An empty selection always reads `No component selected`.

## Contextual feedback

The second line of the selection panel is hidden when there is nothing useful to say. It is used for:

- a guided next action;
- an invalid-selection explanation;
- a hint explanation;
- confirmation that a rule was applied;
- the next required calculation step.

Generic prompts such as `Make a selection` and `Select a valid section` are not displayed. Circuit highlighting, rejection motion, and hint pulses reinforce the message but do not create a separate feedback area.

Player-facing copy describes what electricity does, not how the solver stores the circuit:

- say `one current path`, not `an unbranched path`;
- say `circuit branches` or `branch currents`, not `graph edges`;
- say `the same two connection points`, not `the same two nodes`;
- say `combine the resistors`, not `reduce a group`;
- reserve `node`, `edge`, `endpoint`, `graph`, and `reduction` for code and developer documentation.

## First play

- A versioned first-play flag opens How to play once.
- Closing the dialog or choosing `OK, show me` starts the guide on the real Level 1.
- The guide targets R₁, then R₂, then the Series rule.
- Completing the guide stores the flag. Loading Level 1 later never starts the guide automatically.
- Opening How to play and choosing `OK, show me` explicitly replays the guide.
- How to play remains visible in portrait layouts.
