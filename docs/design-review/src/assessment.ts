import type { Dataset, Metric, Observation } from './domain';

export type AssessmentState = 'urgent' | 'attention' | 'verify' | 'within' | 'unconfigured' | 'missing' | 'stale';
export type AssessmentRule = {
  id: string;
  version: string;
  metric: Metric;
  dataset: Dataset;
  reviewStatus: 'reviewed' | 'practice-only';
  unit: string;
  validFrom: string;
  validThrough?: string;
  above?: number;
  below?: number;
  aboveSecondary?: number;
  belowSecondary?: number;
  referenceLabel?: string;
  requiredContext?: string;
  requiredMethod?: 'recorded';
  freshnessHours?: number;
  urgency: 'review' | 'urgent';
  source: string;
};

export type ReadingAssessment = {
  metric: Metric;
  observation?: Observation;
  state: AssessmentState;
  label: string;
  reason: string;
  nextAction: string;
  bodyTarget?: string;
  rule?: AssessmentRule;
};

// Demo profile: fictional healthy, fit 40-year-old male. These checks combine
// background references with explicitly simulated targets. They are not clinical
// protocols and must never be selected for the personal dataset.
export const ASSESSMENT_RULES: AssessmentRule[] = [{
  id: 'practice-resting-heart-rate-v1',
  version: '1.0',
  metric: 'heart',
  dataset: 'demo',
  reviewStatus: 'practice-only',
  unit: 'bpm',
  validFrom: '2026-10-29T00:00:00.000Z',
  below: 40,
  above: 100,
  requiredContext: 'At rest · seated',
  requiredMethod: 'recorded',
  freshnessHours: 24,
  urgency: 'review',
  source: 'American Heart Association · resting heart-rate guide',
  referenceLabel: 'Resting heart rate guide: 40–100 bpm for this fit-adult demo profile.',
}, {
  id: 'demo-blood-pressure-reference-v1', version: '1.0', metric: 'bp', dataset: 'demo', reviewStatus: 'practice-only',
  unit: 'mmHg', validFrom: '2026-10-29T00:00:00.000Z', above: 119, aboveSecondary: 79,
  below: 90, belowSecondary: 60,
  requiredContext: 'Seated · at rest', requiredMethod: 'recorded', freshnessHours: 24, urgency: 'review',
  source: 'American Heart Association · adult blood-pressure categories',
  referenceLabel: 'Demo target: 90–119 / 60–79 mmHg. Lower bounds are scenario assumptions; upper bounds follow the AHA adult category.',
}, {
  id: 'demo-fasting-glucose-reference-v1', version: '1.0', metric: 'glucose', dataset: 'demo', reviewStatus: 'practice-only',
  unit: 'mg/dL', validFrom: '2026-10-29T00:00:00.000Z', below: 70, above: 99,
  requiredContext: 'Fasting', requiredMethod: 'recorded', urgency: 'review',
  source: 'NIDDK · fasting plasma glucose categories',
  referenceLabel: 'Demo fasting target: 70–99 mg/dL. Lower bound is a scenario assumption. The NIDDK upper reference concerns laboratory plasma, not meter diagnosis.',
}, {
  id: 'demo-after-meal-glucose-simulation-v1', version: '1.0', metric: 'glucose', dataset: 'demo', reviewStatus: 'practice-only',
  unit: 'mg/dL', validFrom: '2026-10-29T00:00:00.000Z', below: 70, above: 140,
  requiredContext: 'After a meal', requiredMethod: 'recorded', freshnessHours: 24, urgency: 'review',
  source: 'Tether fictional demonstration profile · simulated after-meal target',
  referenceLabel: '70–140 mg/dL is a scripted demo target, not a clinical reference or treatment recommendation.',
}, {
  id: 'demo-temperature-reference-v1', version: '1.0', metric: 'temperature', dataset: 'demo', reviewStatus: 'practice-only',
  unit: '°C', validFrom: '2026-10-29T00:00:00.000Z', below: 36.1, above: 37.2,
  requiredContext: 'Oral', requiredMethod: 'recorded', freshnessHours: 24, urgency: 'review',
  source: 'MedlinePlus · body-temperature norms',
  referenceLabel: 'General body-temperature guide: 36.1–37.2 °C; site and time affect the result.',
}, {
  id: 'demo-sleep-reference-v1', version: '1.0', metric: 'sleep', dataset: 'demo', reviewStatus: 'practice-only',
  unit: 'hours', validFrom: '2026-10-29T00:00:00.000Z', below: 7,
  requiredContext: 'Main sleep period', requiredMethod: 'recorded', urgency: 'review',
  source: 'CDC · adult sleep duration recommendation',
  referenceLabel: 'Adults 18–60 are generally recommended at least 7 hours of sleep.',
}];

const recorded = (value: string) => value.trim() !== '' && value.trim().toLocaleLowerCase() !== 'not recorded';

export function bodyTargetForMetric(metric: Metric): string | undefined {
  if (metric === 'heart') return 'heart';
  if (metric === 'bp') return 'vessels';
  if (metric === 'glucose' || metric === 'temperature') return 'skin';
  return undefined;
}

export function assessObservation(observation: Observation, dataset: Dataset, now = Date.now(), rules = ASSESSMENT_RULES): ReadingAssessment {
  const { metric } = observation;
  const bodyTarget = bodyTargetForMetric(metric);
  const observedAt = new Date(observation.at).getTime();
  const candidates = rules.filter((item) => item.metric === metric && item.dataset === dataset
    && (dataset === 'demo' || item.reviewStatus === 'reviewed')
    && new Date(item.validFrom).getTime() <= observedAt && (!item.validThrough || new Date(item.validThrough).getTime() >= observedAt));
  const rule = candidates.find((item) => !item.requiredContext || item.requiredContext === observation.context) ?? candidates[0];
  const qualityNeedsCheck = observation.quality === 'verify' || !recorded(observation.method) || !recorded(observation.context);
  const unitMismatch = !!rule && observation.unit.trim().toLocaleLowerCase() !== rule.unit.trim().toLocaleLowerCase();
  if (qualityNeedsCheck || unitMismatch || (rule?.requiredContext && observation.context !== rule.requiredContext)) {
    const contextRecorded = recorded(observation.context);
    if (contextRecorded && rule?.requiredContext && observation.context !== rule.requiredContext && !unitMismatch && observation.quality !== 'verify' && recorded(observation.method)) {
      return { metric, observation, state: 'unconfigured', label: 'No matching guide',
        reason: `This guide applies to ${rule.requiredContext.toLocaleLowerCase()} readings. Your recorded condition is ${observation.context.toLocaleLowerCase()}, so this result is not classified.`,
        nextAction: 'Use a guide that matches the recorded conditions.', bodyTarget };
    }
    return { metric, observation, state: 'verify', label: 'Check measurement',
      reason: unitMismatch
        ? `This check expects ${rule.unit}; the recorded unit is ${observation.unit || 'missing'}.`
        : !recorded(observation.method) || !recorded(observation.context)
        ? 'The method or conditions were not recorded, so this reading cannot be checked reliably.'
        : `The recorded conditions do not match this ${rule?.requiredContext?.toLocaleLowerCase() ?? 'measurement'} check.`,
      nextAction: 'Repeat it and record how you measured.', bodyTarget, rule };
  }

  if (metric === 'mood') {
    const needsSupport = dataset === 'demo' && ['Very low', 'Low'].includes(String(observation.value));
    return { metric, observation, state: needsSupport ? 'attention' : 'within',
      label: dataset === 'demo' ? needsSupport ? 'Needs attention' : 'Good' : 'Check-in saved',
      reason: `You reported feeling ${String(observation.value).toLocaleLowerCase()}.`,
      nextAction: needsSupport ? 'Consider a support check-in and note what has changed.' : 'Continue your regular check-ins.', bodyTarget };
  }

  if (!rule) return { metric, observation, state: 'unconfigured', label: 'No crew range',
    reason: metric === 'glucose'
      ? 'This after-meal reading has no matching demo guide. Fasting blood tests use different conditions; this result is not classified.'
      : 'No demo guide is configured for this reading. This does not mean the result is normal or abnormal.',
    nextAction: 'Review the reading and its conditions.', bodyTarget };

  const ageHours = (now - new Date(observation.at).getTime()) / 3600000;
  if (rule.freshnessHours !== undefined && ageHours > rule.freshnessHours) {
    return { metric, observation, state: 'stale', label: 'Out of date', reason: `This configured check only applies to readings from the past ${rule.freshnessHours} hours.`,
      nextAction: 'Record a fresh measurement.', bodyTarget, rule };
  }

  const primaryBelow = rule.below !== undefined && Number(observation.value) < rule.below;
  const primaryAbove = rule.above !== undefined && Number(observation.value) > rule.above;
  const secondaryBelow = rule.belowSecondary !== undefined && Number(observation.secondary) < rule.belowSecondary;
  const secondaryAbove = rule.aboveSecondary !== undefined && Number(observation.secondary) > rule.aboveSecondary;
  if (primaryBelow || primaryAbove || secondaryBelow || secondaryAbove) {
    return { metric, observation, state: rule.urgency === 'urgent' ? 'urgent' : 'attention',
      label: rule.urgency === 'urgent' ? 'Urgent' : 'Needs attention',
      reason: metric === 'sleep' ? 'You slept less than your sleep goal.'
        : `${measurementName(metric)} is ${primaryBelow || secondaryBelow ? 'lower' : 'higher'} than your target range.`,
      nextAction: metric === 'sleep' ? 'Review your sleep pattern and scheduled rest.' : 'Repeat this measurement and compare the result.', bodyTarget, rule };
  }

  return { metric, observation, state: 'within', label: dataset === 'demo' ? 'Good' : 'Within configured limits',
    reason: metric === 'sleep' ? 'Your sleep duration meets your goal.' : `${measurementName(metric)} is in your target range.`,
    nextAction: 'Continue your scheduled check-ins.', bodyTarget, rule };
}

function measurementName(metric: Metric) {
  return ({ heart: 'Your resting heart rate', bp: 'Your blood pressure', glucose: 'Your blood glucose', temperature: 'Your temperature', sleep: 'Your sleep duration', mood: 'Your mood check-in' })[metric];
}

export function assessReading(metric: Metric, observations: Observation[], dataset: Dataset, now = Date.now(), rules = ASSESSMENT_RULES): ReadingAssessment {
  const observation = observations.filter((item) => item.metric === metric).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (observation) return assessObservation(observation, dataset, now, rules);
  const bodyTarget = bodyTargetForMetric(metric);
  return { metric, state: 'missing', label: 'No measurement', reason: 'There is no recorded reading yet.', nextAction: 'Record this measurement.', bodyTarget };
}

export function assessmentPriority(state: AssessmentState) {
  return ({ urgent: 0, attention: 1, verify: 2, stale: 3, unconfigured: 4, missing: 5, within: 6 } satisfies Record<AssessmentState, number>)[state];
}
