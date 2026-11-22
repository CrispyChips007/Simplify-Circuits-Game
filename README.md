# Current

A dependency-free browser game for identifying and simplifying series/parallel networks, then solving current and voltage throughout mixed circuits. It includes series and parallel supplies with amp-hour ratings.

## Run locally

```powershell
python -m http.server 8000 --directory learning
```

Then open <http://localhost:8000/solvit/>.

## Structure

- `learning/solvit/index.html` — page structure
- `learning/solvit/game.css` — responsive visual design
- `learning/solvit/src/solver.js` — connectivity-based series/parallel solver
- `learning/solvit/src/app.js` — circuit interactions and progression
- `test/solver.test.js` — reduction, expansion, and electrical-value tests
- `test/levels.test.js` — course sequence, geometry, and supply tests

The `learning` directory is the site root (deployed to learn.interactiveelectronics.com.au). Each game or lesson lives in its own subfolder, e.g. `learning/solvit/` → `/solvit/`.

## Test

```powershell
npm test
```
