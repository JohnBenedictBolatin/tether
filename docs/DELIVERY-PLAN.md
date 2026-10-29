# Delivery plan and review gates

Planning date: October 28, 2026, Asia/Manila. The proposed schedule assumes a small team, but team size and skills are still unknown. Android is confirmed first. This file specifies work; none of the app functionality below has been implemented.

## Preparation and eligibility

Before setting a coding start date, verify the full challenge/resources, current 2026 rules on advance work and AI assistance, and the selected local event's deadlines. Research, notes, and generated concepts created now should retain their dates and be disclosed if reused. The current FAQ could not be retrieved; historical guidance is not sufficient to certify eligibility. See [research](RESEARCH.md).

Preparation questions for a local lead: What research, wireframes, generated assets, starter code, and prior work may be prepared or reused? What disclosures are required? What are the local pitch limit, judging time, and official submission cutoff? This plan does not send any messages on the user's behalf.

## Order of work once implementation is permitted

| Stage | Time-box within a 48-hour event | Exit evidence |
|---|---|---|
| Read full brief and lock scope | Hours 0–3 | Requirement matrix updated; one scenario agreed; exact NASA source selected; P0 cut list committed |
| Establish the local data spine | Hours 3–9 | Android build launches; fixture import, units/provenance, SQLite write/read, and restart survival work |
| Complete the decision loop | Hours 9–19 | Today → evidence → check-in → action → reassessment → saved handoff functions end to end |
| Add reliability and NASA evidence | Hours 19–28 | Bad/stale/missing data cases, evidence trace, handoff states, offline export, and one bounded NASA replay |
| Test with people and on device | Hours 28–35 | Formative task results, corrected misunderstandings, Android accessibility/state checks, critical tests pass |
| Make the submission understandable | Hours 35–42 | Demo recording, concise story, source/limitation documentation, working artifact and reproducibility instructions |
| Freeze and submit | Hours 42–48 | Clean-device install, offline rehearsal, links checked from another session/device, actual submission confirmed |

These are elapsed planning windows, not an instruction to stay awake for 48 hours. Allocate shifts/rest and protect the final verification buffer. Move submission earlier if the local event requires it.

## Roles and capacity

With four people: mobile/interaction, data/rules, science/validation, and UX/story/testing. Work from one shared schema and scenario; parallel work is useful only after those contracts are settled.

With two: one owns the app/data loop; the other owns science, UX testing, demo, and import preparation. Both review the explanation and state transitions.

Solo: keep only one follow-up scenario, the bad-data branch, a simple urgent-route fixture, local handoff/export, and one separate NASA replay. Simulate transport explicitly. Cut live wearables, receiver, extra metrics, and elaborate onboarding. Reliability and clear reasoning outrank feature count.

## First implementation backlog

| ID | Outcome | Acceptance criterion |
|---|---|---|
| T01 | Normalized observations | Reject unknown units, invalid numeric values, and future timestamps under the chosen policy; preserve original values and reasons |
| T02 | Persistent local log | A completed check-in and amendment survive forced restart without duplication |
| T03 | Scenario replay | Seeded fixtures reproduce the same observations and outcomes; demo flag appears in every related export |
| T04 | Comparative baseline | Insufficient history produces no comparison; source/method/phase mismatches are excluded and disclosed |
| T05 | Transparent evaluator | Every follow-up references rule version and triggering observations; fixture inputs yield expected states |
| T06 | Today and evidence | User can reach explanation and raw observations; no placeholder “health score” |
| T07 | Check-in/verification | Draft is preserved on back/restart; missing sensor data cannot block urgent symptom routing |
| T08 | Care and reassessment | Acknowledgement is distinct from completion and resolution; reassessment is linked to its initiating concern |
| T09 | Handoff/export | Preview shows exact included sections; private notes excluded by default; export identifies synthetic data and limitations |
| T10 | Persistent queue | Draft/queued/transmitted/received/reviewed are separate; retry does not duplicate an acknowledged revision |
| T11 | NASA replay | Source query, original times, instrument, units, terms, and snapshot hash recorded; replay does not enter the demo person's clinical rules |
| T12 | Device/usability verification | Critical tests pass; airplane-mode walkthrough and large-text screenshots captured; user-study errors recorded |

## Scientific review gate

The clinical mentor should evaluate intended use, chosen observations, baseline comparability, symptom language, alert priority, measurement-verification instructions, escalation route, and the boundary between study evidence and prototype parameters. Ask for concrete corrections, not a general endorsement.

If no expert is available, narrow the claim: an interaction and data-handling prototype with simulated follow-up logic. Do not put an invented “clinically validated” label on it. Record which content was reviewed, by whom, and when only after a real review occurs.

## Data feasibility gate

For RadLab, first retrieve an unfiltered narrow interval for one selected instrument. Inspect gaps, units, metadata, and time zone. Do not build a baseline or cumulative-dose estimate from the documentation's example query filtered to values above 2 microgray/hour: that example censors low readings. Keep a manifest with query, retrieval time, source, reuse terms, fields, transformation notes, and checksum.

For OSDR, inspect file-level public access before promising use. If processed assays are accessible, use a study-context view with participant and collection limitations. Do not require an application for controlled raw data during the hackathon.

## Tests worth writing

- Rules: noisy sample, missing sample, stale sample, baseline absent, repeated genuine change, unresolved concern after failed repeat, and symptom-driven escalation despite apparently normal vitals.
- Data: bpm versus incompatible units; HRV method mismatch; import idempotency; date/time conversion; corrections retain provenance.
- Persistence: interrupt local save/queue transaction, restart app, verify no half-written handoff.
- Transport, if real: retry same revision, receive out of order, reject mismatched acknowledgement, and distinguish receiver receipt from clinician review.
- Privacy: excluded note absent from readable export, JSON, queue payload, logs, and notification preview.
- UI: one meaningful end-to-end flow on an Android emulator/device plus manual screen-reader/large-text inspection. Do not spend time snapshot-testing every label.

## Submission package

Prepare the official project page in the format actually required; an accessible source repository and license/dependency attributions; a tested Android APK or permitted install path; a short video; architecture and source notes; precise NASA-data usage; reproducible synthetic scenarios; meaningful test results; limitations and future validation; and accurate AI/prior-work disclosures under the current rules.

A claim ledger should distinguish **implemented**, **simulated**, **planned**, and **validated**. Never include mockup-only screens in the video as if they are working features. The README should tell a judge how to run the demo without an API key or a real health account.

## Stop conditions and cuts

- If there is no working Android data loop by hour 9: cut external adapters and use local fixtures.
- If the complete scenario is not working by hour 19: cut additional domains/screens, protect handoff and restart persistence.
- If a NASA source cannot be verified: document the failure and choose another permitted accessible source; do not fabricate data provenance.
- After hour 35: accept only fixes that improve correctness, clarity, installability, or presentation. No new product branches.

## Concrete next decisions

1. Confirm the full 2026 statement and local rules.
2. Confirm team skills, available Android hardware, and whether Flutter is familiar.
3. Review the revised friendly 3D companion direction; the initial journal treatment was rejected as too plain.
4. Select one public data sample and one deterministic synthetic scenario.
5. Schedule qualified content review and five formative testers where feasible.

Completing those gates turns this researched proposal into a defensible build commitment.
