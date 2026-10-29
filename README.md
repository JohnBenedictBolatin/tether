# Tether — Astronaut Health Console

Tether is a Windows-first desktop concept for the 2026 NASA Space Apps Challenge. Its workflow helps a crew member notice a change, verify the observation, understand its context, and record a follow-up.

## Current review

The live, clickable design prototype is in [docs/design-review](docs/design-review/README.md). Open its `index.html` in a browser or use the local preview at `http://127.0.0.1:4173/` while that server is running.

The current review screen uses a dark mission-monitor layout with six compact readings, trend charts, an interactive 3D reference anatomy view, and a persistent next action. Selecting a reading focuses the corresponding body area when one is available. The prototype is not the production Tauri app; local persistence and Windows packaging remain future work.

## Project notes

- [Product context](PRODUCT.md): platform, user needs, constraints, and visual direction.
- [Engineering blueprint](docs/BLUEPRINT.md): challenge mapping, architecture, demo workflow, and validation.
- [Research and evidence](docs/RESEARCH.md): primary sources, research context, and data opportunities.
- [Earlier mobile concept](docs/UX-DESIGN.md): retained for history; the desktop prototype defines the current visual direction.
