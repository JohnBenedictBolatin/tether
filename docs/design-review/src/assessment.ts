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

// This scoped rule exists only to drive the practice workflow. It is not an
// approved flight-medicine threshold and is never applied to personal records.
export const ASSESSMENT_RULES: AssessmentRule[] = [{
  id: 'practice-resting-heart-rate-v1',
  version: '1.0',
  metric: 'heart',
  dataset: 'demo',
  reviewStatus: 'practice-only',
  unit: 'bpm',
  validFrom: '2026-10-29T00:00:00.000Z',
  above: 100,
  requiredContext: 'At rest · seated',
  requiredMethod: 'recorded',
  freshnessHours: 24,
  urgency: 'review',
  source: 'Tether practice configuration',
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
  const rule = rules.find((item) => item.metric === metric && item.dataset === dataset
    && new Date(item.validFrom).getTime() <= observedAt && (!item.validThrough || new Date(item.validThrough).getTime() >= observedAt));
  const qualityNeedsCheck = observation.quality === 'verify' || !recorded(observation.method) || !recorded(observation.context);
  const unitMismatch = !!rule && observation.unit.trim().toLocaleLowerCase() !== rule.unit.trim().toLocaleLowerCase();
  if (qualityNeedsCheck || unitMismatch || (rule?.requiredContext && observation.context !== rule.requiredContext)) {
    return { metric, observation, state: 'verify', label: 'Check measurement',
      reason: unitMismatch
        ? `This check expects ${rule.unit}; the recorded unit is ${observation.unit || 'missing'}.`
        : !recorded(observation.method) || !recorded(observation.context)
        ? 'The method or conditions were not recorded, so this reading cannot be checked reliably.'
        : `The recorded conditions do not match this ${rule?.requiredContext?.toLocaleLowerCase() ?? 'measurement'} check.`,
      nextAction: 'Repeat it and record how you measured.', bodyTarget, rule };
  }

  if (!rule) return { metric, observation, state: 'unconfigured', label: 'Limits not configured',
    reason: 'This reading can be compared with your own history, but no reviewed mission limit is configured.',
    nextAction: 'Review the reading and its conditions.', bodyTarget };

  const ageHours = (now - new Date(observation.at).getTime()) / 3600000;
  if (rule.freshnessHours !== undefined && ageHours > rule.freshnessHours) {
    return { metric, observation, state: 'stale', label: 'Out of date', reason: `This configured check only applies to readings from the past ${rule.freshnessHours} hours.`,
      nextAction: 'Record a fresh measurement.', bodyTarget, rule };
  }

  if (rule.above !== undefined && Number(observation.value) > rule.above) {
    return { metric, observation, state: rule.urgency === 'urgent' ? 'urgent' : 'attention',
      label: rule.urgency === 'urgent' ? 'Urgent review' : 'Review reading',
      reason: `${observation.value} ${observation.unit} is above this configured review point of ${rule.above} ${rule.unit}.`,
      nextAction: 'Repeat the measurement, then review both readings.', bodyTarget, rule };
  }

  return { metric, observation, state: 'within', label: 'Within configured limits',
    reason: 'This reading is within the configured check. This does not assess overall health.',
    nextAction: 'Continue your scheduled check-ins.', bodyTarget, rule };
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
