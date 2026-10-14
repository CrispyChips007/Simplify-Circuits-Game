# Current

A dependency-free browser game for identifying and simplifying series/parallel networks, then solving current and voltage throughout mixed circuits. It includes series and parallel supplies with amp-hour ratings.

## Run locally

```powershell
python -m http.server 8000 --directory dist
```

Then open <http://localhost:8000>.

## Structure

- `dist/index.html` — page structure
- `dist/game.css` — responsive visual design
- `dist/src/solver.js` — connectivity-based series/parallel solver
- `dist/src/app.js` — circuit interactions and progression
- `test/solver.test.js` — reduction, expansion, and electrical-value tests
- `test/levels.test.js` — course sequence, geometry, and supply tests

The `dist` directory is ready for static hosting such as GitHub Pages.

## Test

```powershell
npm test
```
