# Research and evidence register

Prepared October 28, 2026, Asia/Manila. Research informs a proposed prototype, not a validated medical device. Links below distinguish official requirements, primary evidence, and our design inferences. No astronaut interviews or clinical validation have been performed.

## 1. Challenge and event verification

**Confirmed from the attachment and the indexed official challenge page:** the task is health monitoring for astronauts on long missions, with the core loop of gathering indicators, evaluating health status, and acting. The summary mentions radiation, isolation/confinement, altered gravity, and a hostile closed environment, alongside immune, bone, cardiovascular, and behavioral concerns. Source: [official challenge](https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/).

**Current limits:** repeated direct retrieval of that page returned HTTP 502; the resources tab could not be retrieved. The indexed summary matches the attachment. We have not verified the full statement, mandatory datasets, additional deliverables, or complete resource list.

The [official 2026 event page](https://www.spaceappschallenge.org/2026/) lists November 14–15, teams of up to six, and submission closing November 15 at 11:59 p.m. local time. Its indexed text was accessible; direct retrieval failed. Your chosen local event can have its own presentation schedule, so its deadline must be checked separately.

The [official Santiago event page](https://www.spaceappschallenge.org/2026/local-events/santiago-dominican-republic/) lists October 28 for full statements and resources. That date has now arrived in Manila; release timing and actual availability still need checking.

The [official Ajmer event page](https://www.spaceappschallenge.org/2026/local-events/ajmer/) describes Impact, Creativity, Validity, Relevance, and Presentation. Use those as planning lenses; this research has not verified a final global 2026 scoring guide, numeric weights, award categories, or pitch-length limit.

The [legacy official FAQ](https://legacy.spaceappschallenge.org/resources/faq/) asks participants to begin actual project work at the hackathon. It concerns an earlier year. The current [participant FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/) failed direct retrieval, so current rules on advance design/code and AI assistance remain unverified. Keep these preparation artifacts dated, disclose reuse, and ask the local lead which preparation is permitted before incorporating them into a competition submission. This is an eligibility question, not a claim that a historical rule is the 2026 rule.

## 2. Scientific and operational evidence

| Source | What it supports | Product implication and limit |
|---|---|---|
| [NASA Human System Risks](https://www.nasa.gov/hhp/human-system-risks/) | NASA treats sleep, behavioral health, cardiovascular changes, immune response, bone, muscle, radiation, and environment as distinct risk domains. | Organize data by meaningful domains. A single invented “space health score” would erase important distinctions. |
| [Earth Independent Medical Operations research](https://pmc.ncbi.nlm.nih.gov/articles/PMC10810302/) | Distance, communication limitations, and constrained evacuation increase the need for onboard medical capability. | Core monitoring and records should work without network access. This does not establish the clinical effectiveness of our proposed app. |
| [NASA Autonomous Medical Operations](https://www.nasa.gov/directorates/stmd/game-changing-development-program/autonomous-medical-operations-amo/) | NASA has already pursued onboard medical decision support. | We cannot claim to invent autonomous space medicine. Our contribution must be a demonstrable improvement to a narrow crew workflow. |
| [NASA AMOS demonstration](https://ntrs.nasa.gov/citations/20220014327) | AMOS evaluates just-in-time onboard instruction for medical autonomy. | Procedure guidance is existing work. Treat an app as an interface to reviewed content; do not generate medical procedures freely. |
| [CSA Bio-Monitor](https://www.asc-csa.gc.ca/eng/sciences/bio-monitor.asp) | A smart garment/headband system and tablet application collect multiple physiological measurements during daily activity. | Sensor integration is plausible but already established. We have no access to its interfaces or hardware; do not claim a working integration. |
| [NASA wearable research](https://www.nasa.gov/humans-in-space/wearable-tech-for-space-station-research/) | Wearable studies include unobtrusive heart and breathing monitoring during sleep. | Favor low-burden collection and clear source labels; capability depends on actual device and measurement method. |
| [Inspiration4 primary study, Nature 2024](https://www.nature.com/articles/s41586-024-07648-x) | Four participants on a short mission; wearable measures differed across participants and mission phases. In-flight oxygen readings failed in two participants. | Missingness and measurement reliability deserve a first-class workflow. These data do not validate long-duration prediction thresholds. The full page failed direct retrieval; findings were available in indexed article text and its reference PDF. |
| [NASA bone risk](https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/) and [bone evaluation](https://www.nasa.gov/directorates/esdmd/hhp/bone-and-mineral-evaluation-and-analysis/) | Skeletal changes require dedicated investigation; DXA and biological measurements play roles in evaluation. | Exercise adherence is a countermeasure record, not a bone-density measurement. Do not compute live bone loss from days in space. |
| [NASA fatigue investigation](https://ntrs.nasa.gov/citations/20140016946) | Fatigue has operational, circadian, environmental, and physiological contributors. | Review sleep together with work and symptom context; a coincident trend cannot establish a cause. |
| [NASA crew interface requirements](https://www.nasa.gov/reference/10-0-crew-interfaces-vol-2/) | Alert distinctions and prioritization help focus attention on the most important events. | Rank actionable issues, use text and shape alongside color, and separate urgent alerts from advisory follow-ups. Consulting the standard is not compliance certification. |

## 3. Data sources and honest uses

### NASA OSDR and Inspiration4

[NASA's I4 dataset announcement](https://www.nasa.gov/osdr-latest-news-i4-mission-datasets/) distinguishes publicly available processed data from controlled raw information. The [primary OSDR access publication](https://www.nature.com/articles/s41526-024-00393-5) maps studies to their sample types. Relevant candidates include OSD-569 (whole blood) and OSD-575 (serum, including clinical/immune assays). These identifiers are not wearable streams.

**Proposed use:** a research evidence view or a separate, explicitly labeled study-data replay. Inspect file-level access, assay, units, participant counts, collection times, and reuse terms before selecting files. Do not make controlled access a hackathon dependency. No OSDR data file has been downloaded or parsed in this planning pass.

**Exclude:** training a disease predictor from four people, using omics as live wearable data, interpreting a statistically different group average as an individual's clinical alarm threshold, or silently combining research participants with fictional mission records.

### NASA OSDR RadLab

[RadLab overview](https://visualization.osdr.nasa.gov/radlab/gui/overview/) and [API documentation](https://visualization.osdr.nasa.gov/radlab/gui/data-api/) provide radiation telemetry by instrument, time, and spacecraft. Documentation was directly inspected. Its fields distinguish absorbed dose rate (microgray/hour) from dose equivalent rate (microsievert/hour).

**Proposed use:** one bounded historical interval in a clearly labeled environment replay, preserving instrument identity, units, sampling gaps, and original timestamps. Keep its clock distinct from the fictional astronaut scenario. Radiation context supports environmental awareness; it does not establish the astronaut's absorbed organ dose, symptoms' cause, or individualized cancer risk. No unqualified conversion between gray and sievert.

**Access check:** the API documentation's example query returned historical ISS DosTel1/DosTel2 records for April 1–2, 2022. This confirms one bounded response was accessible, not a production integration. That example filters out low readings; it must not be used to calculate an unbiased baseline or cumulative exposure.

**Feasibility gate:** fetch an unfiltered narrow interval for a selected instrument, archive the query/response and checksum, verify terms, and add a known-value unit test. If a live service fails during judging, use the disclosed snapshot. No complete dataset ingestion or app integration has been implemented.

### Synthetic scenario fixtures

**Purpose:** demonstrate interaction, data-quality handling, rules, and persistence reproducibly without exposing health data. Use fictional crew IDs. Each observation carries `synthetic`, and every screen/export visibly says Demo. Plausible example values are authored scenarios, not clinical evidence or real mission data.

**Separation:** the demo person's timeline, public study replay, and real wearable adapter are separate contexts. An explicit environment replay can coexist with a demo, but it must not be presented as its measured spacecraft environment.

## 4. Engineering references

- [Flutter adaptive design](https://docs.flutter.dev/ui/adaptive-responsive) supports shared implementation with platform adaptation. Framework choice remains a recommendation pending team experience.
- [Flutter offline architecture](https://docs.flutter.dev/app-architecture/design-patterns/offline-first) describes local/remote repositories and synchronization patterns. Our proposed app makes the local record authoritative for core onboard work.
- [Android offline guidance](https://developer.android.com/topic/architecture/data-layer/offline-first) supports separating critical local capability from network transport.
- [Apple HealthKit privacy](https://developer.apple.com/documentation/HealthKit/protecting-user-privacy) is relevant to any later iPhone integration. No HealthKit integration or permission flow has been implemented.

## 5. What we still need to learn

1. Full 2026 challenge statement, official resources, current global rules, and local deadlines.
2. Team size/skills, actual Android device, access to a Mac for an eventual iOS build, and available sensors.
3. Whether a relevant public dataset is usable at file level under its terms.
4. Review by a space-medicine expert or qualified clinical mentor of intended-use boundaries, protocol content, and escalation behavior.
5. Interviews with plausible users: crew/analog participants where accessible, plus clinicians with remote-care experience. Until then, fatigue, time pressure, and sharing preferences are design hypotheses.

The proposed product strategy in BLUEPRINT.md is our synthesis. None of these sources validates its alert rules, forecasts a competition result, or endorses its branding.
