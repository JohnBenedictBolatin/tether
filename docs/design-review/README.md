# Tether design review

Interactive desktop direction prototype for Tether, built with React, TypeScript, Vite, and React Three Fiber. Start with `npm run dev` and open `http://127.0.0.1:4173/`; create a production web bundle with `npm run build`.

The prototype has four primary workflows: Today, Measurements, Care Plan, and History. Today combines six compact reading summaries, a chart, a clear rotatable 3D anatomy view, and the next action. Selecting a reading focuses its related anatomy when supported. History brings chart and timeline views together. Reference Library and Settings remain utility pages. Selecting unsupported structures reports **Not assessed**. Measurements include source, method, time, and context; optional check-ins include symptoms, exercise, meal/hydration, and sleep quality.

The seeded crew and measurements are synthetic. New entries, context, and follow-ups are held in page memory and clear when refreshed. The preview works offline after the assets load. It does not connect sensors, transmit medical records, diagnose conditions, or supply a mission clinical protocol. The planned Tauri/SQLite desktop application remains a later implementation stage.

## Anatomy assets

The BodyParts3D body surface and system meshes are locally bundled. The heart and lung meshes are separately licensed source assets. Attribution and adaptations are documented in `public/assets/anatomy/LICENSE.md` and adjacent credit files. Rebuild the grouped body asset with `scripts/prepare_bodyparts3d.py`.
