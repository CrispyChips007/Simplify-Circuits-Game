# Current

A dependency-free browser game for learning how to identify, simplify, and later expand series and parallel resistor networks.

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
- `test/solver.test.js` — solver behavior tests

The `dist` directory is ready for static hosting such as GitHub Pages.

## Test

```powershell
npm test
```
