# Product

<!-- impeccable:product-schema 1 -->

## Platform

Windows desktop first, using Tauri. Android and iPhone are future targets after the desktop workflow is proven.

## Stack

Planned: Tauri 2, React, TypeScript, Vite, Rust application commands, and local SQLite. The browser-based design review prototype is not the production app.

## Users

The challenge identifies astronauts on long-duration space missions as the primary users, responsible for recognizing changes in their own health. An onboard medical officer and ground medical team are proposed secondary users, not confirmed customer interviews.

## Product Purpose

Build an intuitive offline health console that helps astronauts review health indicators, understand context, and follow up on a change. The user wants a scientifically grounded, distinctive, competitive NASA Space Apps Challenge 2026 project.

## Operating Context

Planning began October 27 and continued October 29, 2026, Asia/Manila. The user supplied the challenge brief and reports that more resources arrive November 13. Final event-specific submission rules still need verification.

## Capabilities and Constraints

- The user asked to review the visual design before production implementation.
- The clickable desktop design prototype is in `docs/design-review/`.
- Offline operation and local-only health records are core requirements.
- Actual astronaut telemetry, clinical protocols, validated thresholds, and clinical review have not been provided.
- Proposed demonstrations must clearly distinguish synthetic data, public research data, and measured sensor data.
- No device pairing, ground communications, diagnosis AI, or NASA endorsement should be implied.

## Evidence on Hand

- User-supplied screenshot: “Create Health Monitoring Software for Astronauts on Space Missions.”
- Official NASA, partner-agency, and primary research sources documented in docs/RESEARCH.md.
- Empty project at discovery; no existing app, visual system, or code to preserve.

## Brand Commitments

The approved direction is a dark mission-monitor console with compact readings, purposeful graphs, and an interactive 3D reference anatomy view. Selecting a reading focuses and highlights its related body area when supported; the highlight communicates reading review, not organ health. Keep Today visually clear, with anatomy controls confined to the dedicated Body view. Milo may appear as optional help outside critical guidance and the main anatomy workspace.

## Product Principles

- Make the next useful action understandable.
- Connect proposed functionality to evidence and the challenge's gather/evaluate/act loop.
- Make uncertainty and the source of each measurement visible.
- Demonstrate a coherent workflow at achievable scope.

## Open Decisions

The browser prototype is in `docs/design-review/` and reflects the approved dark console direction. The production Tauri application, local SQLite persistence, and Windows packaging remain to be implemented. November 13 challenge resources may update evidence and content after release; they do not block prototype work.
