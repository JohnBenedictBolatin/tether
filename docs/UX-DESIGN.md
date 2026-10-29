# Tether — proposed mobile UX

October 28, 2026. Revised after user feedback: the first visual study was too plain. Planning concept for review, not a production design system. Mode: Operate. See [current friendly 3D study](concepts/tether-friendly-companion-v4.png), [product blueprint](BLUEPRINT.md), and [research](RESEARCH.md).

## Direction: a friendly companion inside a softly sculpted habitat

The user explicitly wants richer 3D elements, softer buttons, and a friendly astronaut dog. The revised world pairs a carefully made 3D companion with tactile surfaces and clear, readable observations. Everyday check-ins should feel welcoming. The evidence interaction remains: expand from a change to its explanation and next action.

The physical scene is a crew member using a handheld device inside a habitat under changing light, often between tasks. Pearl-blue surfaces and sculpted shapes suggest a welcoming cabin. Use depth to establish tappable controls and character, with clear silhouettes, readable text, and explicit selected states. Preserve a future dark scheme; the current study explores light mode only. Avoid decorative medical traces and arbitrary health scores.

The current study shows Today, a daily check-in, and trend review. The earlier journal-like image is retained as superseded exploration, not visual authority. The handoff behavior remains in the blueprint and needs translation into this new visual language before implementation.

## Milo, the astronaut dog

User review accepted this direction subject to correcting the helmet. In every pose, the entire head, muzzle, tuft, and both ears must be enclosed by the dome with visible clearance. The glass boundary cannot intersect fur; it must connect coherently to the collar. Check this at full size and at the smallest in-app rendering. The v4 visual study corrects the head clearance and seats the dome into a wider, continuous collar in all three appearances. Glass must terminate at the collar plane; no lower bubble arc can hang beside the chest.

Working name and design: golden-cream fur, caramel floppy ears, dark expressive eyes, a pearlescent suit, periwinkle joints, mint chest module, orbit patch, and a clear helmet. Consistent markings and proportions across poses make it feel like one companion.

- **Today:** a relaxed greeting; space for personality during routine use. On compact screens, shorten the artwork before reducing text or hiding the next action.
- **Check-in:** an attentive portrait that acknowledges the task without implying an assessment of the user's health.
- **Evidence:** a small, quiet pose; measurements and explanations get the space.
- **Task saved:** a subtle nod or wave. No streak pressure, guilt, confetti, or reward for reporting favorable health.
- **Urgent state:** the large mascot and decorative motion yield to a clearly labeled action and reviewed response instructions. Friendliness must not conceal urgency.

The mascot is a companion, not a clinician or an AI doctor. It does not diagnose, dismiss symptoms, or say everything is fine. Offer a reduced-character mode and respect reduced motion. Whether this approach improves comfort or task performance is a usability question, not an established psychological effect.

## Navigation and information architecture

Four stable destinations:

| Destination | Job | Main contents |
|---|---|---|
| Today | Decide what deserves attention now | Priority action, supporting facts, due care tasks, data freshness |
| Trends | Understand a change | Metric detail, historical range, raw readings, context, source/quality |
| Care | Complete a reviewed task | Check-in, verification, configured care tasks, reassessment |
| Log | Retrieve and share the record | Timeline, amendments, handoff drafts, delivery receipts |

Check-in is an action inside Today/Care, not a navigation destination. Settings, source connections, privacy, and mission clock are accessed from the profile. Research replay is a clearly separate mode under Trends; it never silently changes the astronaut's observations.

On Android, use Material navigation and system Back. On iPhone, adapt tab/stack navigation, sheet behavior, controls, safe areas, and back gesture. Share information architecture and visual roles; preserve platform behavior. A future tablet uses a navigation rail and list/detail arrangement where appropriate rather than stretching the phone layout.

## Primary flow and exact copy

**Today → Review changes → Evidence → Start check-in → Verification/action → Reassessment → Handoff preview → Queue/export.**

| Moment | Lead copy | Primary action | Required behavior |
|---|---|---|---|
| No actionable change | “No new follow-ups” | “Start daily check-in” | Do not say “You are healthy”; display unresolved concerns and data gaps independently |
| Multiple changes | “Check your recovery” | “Review changes” | Identify the observations; disclose that the rule is a demo parameter if applicable |
| Poor measurement | “This reading needs a repeat” | “Review measurement steps” | Show why it is questionable; retain symptom/escalation access |
| Missing history | “Building your baseline” | “Log today's check-in” | Show valid sample count; no fabricated range |
| Ground unavailable | “Saved on this device” | “Review & queue” | Queue only on action; no fake delivery success |
| Queued | “Queued for delivery” | “View included details” | Persistent state, cancel if not sent, edits create a new reviewable revision |
| Transmitted, no receipt | “Sent · Receipt pending” | “View delivery details” | Do not imply receipt or clinical review |
| Receipt confirmed | “Received by ground” | “View receipt” | Clinician review remains separately pending |

Urgent flow: clear text and severity, immediate access to the reviewed onboard response pathway, and persistent visibility. No waiting for check-in completion, baseline collection, network, or a conversational assistant. Prototype simulations remain labeled.

## Screen composition

### Today

Top: mission day and explicit time zone, profile, compact connectivity state. Routine greeting: “Morning, Alex. Let's check in.” A friendly 3D scene gives the app its character, followed by a prominent check-in action, current observations, and a follow-up row. The concept shows an illustrative routine state with nonurgent follow-ups. If a higher-priority action is present, move it above the mascot and collapse the artwork. Unresolved issues must remain visible without scrolling through decoration. No carousel can hide urgency.

### Evidence detail

Lead with the question and the current value/unit. A short chart shows historical context with an explicitly labeled range. Below it: comparison method, source, quality, and a plain explanation. More technical provenance is one disclosure away, not forced into the first scan. An accessible reading list is an alternative to the chart.

The concept's historical band is illustrative. In implementation it must be generated from the documented baseline window and labeled with its dates and definition. Do not draw a safe zone around values without a reviewed clinical basis. Show sampling gaps as gaps; no interpolation over missing readings. Compare only compatible methods and conditions.

### Check-in and verification

One short group of related questions per screen, progress retained locally, clear back/cancel, no long form. An attentive Milo portrait accompanies readable answer buttons. Provide explicit response labels; pictograms are supplemental. Selected answers have an outline and check marker, not only a depressed shadow. A sensitive optional response can be skipped. Urgent symptoms stay accessible regardless of current question. Confirm whether any entered symptom is occurring now before routing; the precise questions and escalation content require clinical review.

### Handoff

Show reason, included sections, excluded private notes, and record revision before sharing. Expand sections to inspect exact content. Distinguish “Prepared,” “Queued,” “Transmitted,” “Received,” and “Reviewed.” Pending stages use unfilled markers and explicit pending wording. When a draft is not queued, the timeline says “Queue for delivery — Not yet queued,” not “Queued.”

## Proposed visual roles

These are initial art-direction values for review, not a measured accessibility pass. Implement through semantic theme roles, not scattered literals.

| Role | Light proposal | Dark proposal | Use |
|---|---|---|---|
| Canvas | Mist blue, #EDF1FA | Proposed muted navy; not yet mocked | Comfortable continuous reading surface |
| Main text | Midnight navy, #202C46 | Proposed near-white | High hierarchy and legibility |
| Primary control | Indigo, #424CA3, with readable white text | Proposed light periwinkle with dark text | Soft raised shape, definite silhouette, one main action |
| Advisory surface | Pale apricot, #F4D3B9, with dark text | Proposed muted warm surface | Nonurgent follow-up, explicitly labeled; does not imply all-clear |
| Urgent | Semantic error role | Semantic error role | Reserved for genuinely urgent state, never decorative |
| Dividers | Neutral low-contrast role | Neutral low-contrast role | Grouping without card clutter |

Typography: Android system/Material text roles; iPhone system text styles. Use tabular numbers for aligned measurements. Units stay beside values. Main values can be prominent; explanatory text should remain comfortable at normal reading size. A compact screen must scroll rather than shrink text to fit the mockup.

Spacing follows a small consistent scale, with more space between sections than between a label and its value. Soft raised buttons have distinct foreground/background contrast and subtle edges as well as contact shadows. Inset chart surfaces organize the evidence; plotting marks remain flat and accurately positioned. Icons supplement labels; they do not replace the four navigation titles. Do not use 3D chart extrusion that distorts magnitude.

## 3D delivery and motion proposal

Use original rendered character assets for the first mobile build: greeting, listening, quiet reflection, and task saved. Prefer tightly cropped transparent renders in suitable resolution variants; generate assets separately from the UI comp rather than cutting the mascot out of a screenshot. Preserve exact suit and face references across poses.

The prototype does not require a continuously running 3D renderer. A rendered character can carry the visual quality while a short optional animation supplies a wave or nod. If actual 3D rotation/interactivity later serves a task, benchmark it on the target device before adding a runtime. Do not describe the present raster concept as an interactive 3D model.

Press states gently compress/lower the surface and retain an obvious focus/selected treatment. Motion must be interruptible, nonessential, and disabled with reduced-motion preferences. Keep health values stable while the mascot moves. Default to still art during reading and data entry. No mandatory mascot introduction before reaching useful information.

## Accessibility and platform acceptance

- Android touch targets at least 48dp; iOS at least 44pt. Confirm real rendered hit areas, not only icon sizes.
- Design at narrow phone width and with large system text; no clipped values, horizontal form scrolling, or fixed-height containers that hide copy.
- Verify contrast against actual light/dark states, including amber advisory copy, disabled controls, chart labels, and focus states.
- Pair severity with text and shape. Haptics/audio are optional supplements, never the only signal.
- Screen-reader summaries should read value, unit, time, source, and quality in a useful order.
- Respect reduced-motion settings. Use native transitions; avoid pulsing warnings and decorative motion.
- Save before navigating away; keyboard, system bars, and safe areas cannot cover the primary action.
- Future iOS support requires device/simulator validation; current imagery demonstrates design intent only.

## Superseded exploration record

The initial exploration considered quick-reference procedure cards, clinical flowsheets, bedside instruments, mission timelines, technical manuals, longitudinal journals, and hazard boards. The proposed field-journal visual treatment was rejected as too plain on October 28. The following catalog comparisons explain that earlier exploration only; they cannot override the user's new 3D/soft-interface direction.

The design exploration tool's comparison catalog was retrieved after an initial network failure. Alternative grammars were assessed on audience identification and product clarity:

| Comparison | Verdict | Discipline retained in the proposal |
|---|---|---|
| Darkroom exposure record | Declined: unfamiliar layers and notation weaken both axes | Make data quality distinguishable without color |
| Crouwel grid specimen | Declined: display typography dominates the operational task | Align values and units rigorously |
| Dense convention catalog | Declined: thumbnail density weakens both axes | Keep each record individually addressable |
| Dance notation | Declined: a learned symbol language impairs the task | Align observations by real time |
| Monochrome claim/proof presentation | Competitive on clarity, weaker as a recurring crew work surface | Keep each explanation adjacent to its evidence |
| Coded record-sleeve identity | Declined: encoded labels and hover translation are unsuitable | Give one meaningful chart the space to be readable |

The current direction's main risk is excessive mascot scale or low-contrast soft controls. Control it by reserving priority space for actions, shortening artwork on small displays, and testing contrast, touch targets, and reading order. The user's references establish a desired feeling and material quality; none is a sole compositional template.

## Status of the mockup

Generated with the built-in ImageGen tool, then visually inspected. It illustrates hierarchy, density, and themes; it is not a running Flutter screen. It does not establish device accessibility, chart accuracy, touch behavior, or functional data integration. The exact generation prompt is recorded in [concept provenance](concepts/PROVENANCE.md). The written state machine governs implementation wherever raster text is ambiguous.
