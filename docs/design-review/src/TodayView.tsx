import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, Pause, Play, Plus } from 'lucide-react';
import { anatomyManifest } from './anatomyManifest';
import { MetricGlyph } from './TetherIcons';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { assessmentPriority, type AssessmentState, type ReadingAssessment } from './assessment';
import { compareObservation, formatValue, fullDate, latestForMetric, localStamp, type ContextEntry, type Followup, type Metric, type MetricInfo, type Observation } from './domain';
import { ObservationChart } from './ObservationChart';

type Props = {
  metrics: Record<Metric, MetricInfo>;
  metricOrder: Metric[];
  observations: Observation[];
  contexts: ContextEntry[];
  tasks: Followup[];
  assessments: Record<Metric, ReadingAssessment>;
  selectedMetric: Metric;
  selectedStructure: string;
  environment: string;
  missionDay: number;
  timeZone: string;
  reducedMotion: boolean;
  rangeDays: 7 | 30;
  onRangeChange: (range: 7 | 30) => void;
  onSelectMetric: (metric: Metric) => void;
  onStructure: (id: string) => void;
  onReview: (item: Observation) => void;
  onAdd: (metric?: Metric, taskId?: string | null) => void;
  onTask: (task: Followup) => void;
  onCare: () => void;
};

type SupportTab = 'pressure' | 'sleep' | 'activity';

const AnatomyViewer = lazy(async () => {
  const module = await import('./AnatomyViewer');
  return { default: module.AnatomyViewer };
});

function conciseState(state: AssessmentState) {
  return ({ urgent: 'Urgent review', attention: 'Review reading', verify: 'Check conditions', within: 'Within configured limits', unconfigured: 'No limits set', missing: 'No measurement', stale: 'Out of date' } as const)[state];
}

function dueLabel(task: Followup, now: number, timeZone: string) {
  const due = new Date(task.due).getTime();
  if (due < now) return `Overdue · ${localStamp(task.due, true, timeZone === 'UTC' ? 'UTC' : undefined)}`;
  const today = new Intl.DateTimeFormat(undefined, { timeZone: timeZone === 'UTC' ? 'UTC' : undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(due))
    === new Intl.DateTimeFormat(undefined, { timeZone: timeZone === 'UTC' ? 'UTC' : undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));
  return today ? `Today · ${localStamp(task.due, false, timeZone === 'UTC' ? 'UTC' : undefined)}` : localStamp(task.due, true, timeZone === 'UTC' ? 'UTC' : undefined);
}

function ActionButton({ task, assessment, onTask, onAdd, onReview }: {
  task?: Followup;
  assessment?: ReadingAssessment;
  onTask: (task: Followup) => void;
  onAdd: (metric: Metric, taskId?: string | null) => void;
  onReview: (item: Observation) => void;
}) {
  if (task?.resultId) return <Button onClick={() => onTask(task)}>Review repeat<ArrowRight data-icon="inline-end" /></Button>;
  if (task) return <Button onClick={() => onTask(task)}>{task.kind === 'measurement' ? 'Start repeat' : 'Open task'}<ArrowRight data-icon="inline-end" /></Button>;
  if (!assessment || assessment.state === 'missing') return <Button onClick={() => onAdd(assessment?.metric ?? 'heart')}><Plus data-icon="inline-start" /> Record measurement</Button>;
  if (assessment.state === 'attention' || assessment.state === 'urgent' || assessment.state === 'verify' || assessment.state === 'stale') {
    return <Button onClick={() => onAdd(assessment.metric)}>Record another reading<ArrowRight data-icon="inline-end" /></Button>;
  }
  return assessment.observation ? <Button variant="outline" onClick={() => onReview(assessment.observation!)}>Reading details<ArrowRight data-icon="inline-end" /></Button> : null;
}

export function TodayView(props: Props) {
  const now = Date.now();
  const activeTimeZone = props.timeZone === 'UTC' ? 'UTC' : undefined;
  const [supportTab, setSupportTab] = useState<SupportTab>('pressure');
  const [playing, setPlaying] = useState(false);
  const [playbackFraction, setPlaybackFraction] = useState(1);
  const [focusRequestKey, setFocusRequestKey] = useState(0);
  const [updatedObservationId, setUpdatedObservationId] = useState('');
  const priorLatestRef = useRef('');
  const latestByMetric = useMemo(() => Object.fromEntries(props.metricOrder.map((metric) => [metric, latestForMetric(props.observations, metric)])) as Record<Metric, Observation | undefined>, [props.metricOrder, props.observations]);
  const latestSignature = props.metricOrder.map((metric) => latestByMetric[metric]?.id ?? '').join('|');

  useEffect(() => {
    const previous = priorLatestRef.current;
    if (previous && previous !== latestSignature) {
      const oldIds = new Set(previous.split('|'));
      const fresh = props.metricOrder.map((metric) => latestByMetric[metric]?.id).find((id) => id && !oldIds.has(id));
      if (fresh) {
        setUpdatedObservationId(fresh);
        const timer = window.setTimeout(() => setUpdatedObservationId(''), 650);
        priorLatestRef.current = latestSignature;
        return () => window.clearTimeout(timer);
      }
    }
    priorLatestRef.current = latestSignature;
  }, [latestByMetric, latestSignature, props.metricOrder]);

  const openTasks = props.tasks.filter((task) => task.status === 'open').sort((a, b) => a.due.localeCompare(b.due));
  const topAssessment = props.metricOrder.map((metric) => props.assessments[metric])
    .filter((assessment) => ['urgent', 'attention', 'verify', 'stale'].includes(assessment.state))
    .sort((a, b) => assessmentPriority(a.state) - assessmentPriority(b.state) || (b.observation?.at ?? '').localeCompare(a.observation?.at ?? ''))[0];
  const missingAssessment = props.metricOrder.map((metric) => props.assessments[metric]).find((assessment) => assessment.state === 'missing');
  const topTask = openTasks[0];
  const taskForPriority = topAssessment?.observation && openTasks.find((task) => task.observationId === topAssessment.observation?.id || task.resultId === topAssessment.observation?.id);
  const actionTask = topAssessment ? taskForPriority : topTask;
  const actionAssessment = topAssessment ?? (!actionTask ? missingAssessment : undefined);
  const selectedStructureInfo = anatomyManifest.find((item) => item.id === props.selectedStructure);
  const structureNotAssessed = !!selectedStructureInfo && selectedStructureInfo.metricKeys.length === 0;
  const selectedAssessment = props.assessments[props.selectedMetric];
  const selectedItem = latestByMetric[props.selectedMetric];
  const rangeStart = now - props.rangeDays * 86400000;
  const rangeRows = props.observations.filter((item) => new Date(item.at).getTime() >= rangeStart && new Date(item.at).getTime() <= now);
  const latestForSelected = selectedItem && new Date(selectedItem.at).getTime() >= rangeStart ? selectedItem : undefined;
  const comparison = latestForSelected ? compareObservation(latestForSelected, props.observations, props.rangeDays) : undefined;
  const playbackAt = rangeStart + playbackFraction * (now - rangeStart);
  const replayEvents = useMemo(() => [
    ...props.observations.filter((item) => new Date(item.at).getTime() >= rangeStart && new Date(item.at).getTime() <= now).map((item) => ({
      key: `reading:${item.id}`, at: item.at, title: `${props.metrics[item.metric].short} recorded`, detail: formatValue(item), item,
    })),
    ...props.contexts.filter((item) => new Date(item.at).getTime() >= rangeStart && new Date(item.at).getTime() <= now).map((item) => ({
      key: `context:${item.id}`, at: item.at, title: item.kind, detail: item.value, item,
    })),
    ...props.tasks.filter((item) => new Date(item.createdAt).getTime() >= rangeStart && new Date(item.createdAt).getTime() <= now).map((item) => ({
      key: `task:${item.id}`, at: item.createdAt, title: item.title, detail: item.status === 'complete' ? 'Completed' : 'Added to Care Plan', item,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at)), [props.contexts, props.metrics, props.observations, props.tasks, rangeStart, now]);
  const activeReplayEvent = replayEvents.reduce<(typeof replayEvents)[number] | undefined>((nearest, event) => {
    if (!nearest) return event;
    return Math.abs(new Date(event.at).getTime() - playbackAt) < Math.abs(new Date(nearest.at).getTime() - playbackAt) ? event : nearest;
  }, undefined);
  const upcomingTasks = openTasks.filter((task) => new Date(task.due).getTime() > now).slice(0, 3);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setPlaybackFraction((fraction) => {
      const next = Math.min(1, fraction + 1 / 36);
      if (next >= 1) setPlaying(false);
      return next;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  const selectMetric = (metric: Metric) => {
    setPlaying(false);
    setPlaybackFraction(1);
    setFocusRequestKey((key) => key + 1);
    props.onSelectMetric(metric);
    props.onStructure(props.assessments[metric].bodyTarget ?? '');
  };
  const selectNearestReplayEvent = (value: number) => {
    const target = rangeStart + (value / 1000) * (now - rangeStart);
    const nearest = replayEvents.reduce<(typeof replayEvents)[number] | undefined>((best, event) => {
      if (!best) return event;
      return Math.abs(new Date(event.at).getTime() - target) < Math.abs(new Date(best.at).getTime() - target) ? event : best;
    }, undefined);
    const stamp = nearest ? new Date(nearest.at).getTime() : target;
    setPlaybackFraction(Math.min(1, Math.max(0, (stamp - rangeStart) / Math.max(1, now - rangeStart))));
  };
  const rangeObservations = (metric: Metric) => rangeRows.filter((item) => item.metric === metric).sort((a, b) => a.at.localeCompare(b.at));
  const inspectReplayEvent = (event: (typeof replayEvents)[number] | undefined) => {
    if (event && 'metric' in event.item) props.onReview(event.item);
  };

  const metricStrip = <div className="mission-metric-strip" aria-label="Latest crew readings">
    {props.metricOrder.map((metric) => {
      const item = latestByMetric[metric];
      const assessment = props.assessments[metric];
      const selected = props.selectedMetric === metric;
      const stamp = item ? localStamp(item.at, true, activeTimeZone) : 'Awaiting entry';
      return <button key={metric} type="button" className={`mission-metric ${selected ? 'selected' : ''} ${updatedObservationId === item?.id ? 'reading-updated' : ''}`}
        aria-label={`${props.metrics[metric].label}: ${item ? formatValue(item) : 'No measurement'} · ${item ? conciseState(assessment.state) : 'Record measurement'}. Recorded ${stamp}. View graph.`}
        aria-pressed={selected} onClick={() => selectMetric(metric)}>
        <span className={`mission-metric-glyph metric-${metric}`}><MetricGlyph name={metric} size={21} /></span>
        <span className="mission-metric-label">{props.metrics[metric].short}</span>
        <strong>{item ? formatValue(item) : '—'}</strong>
        <span className="mission-metric-stamp">{stamp}</span>
        <span className={`mission-metric-state state-${assessment.state}`}><i aria-hidden="true" />{item ? conciseState(assessment.state) : 'No measurement'}</span>
      </button>;
    })}
  </div>;

  return <section className="today-page mission-console page-view" aria-labelledby="today-title">
    <header className="mission-console-heading">
      <div><h1 id="today-title">Crew monitor</h1><p>Mission day {props.missionDay} <span aria-hidden="true">·</span> {props.environment} <span aria-hidden="true">·</span> {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: activeTimeZone }).format(new Date(now))}</p></div>
      <Button onClick={() => props.onAdd(props.selectedMetric)}><Plus data-icon="inline-start" /> Add measurement</Button>
    </header>

    {metricStrip}

    <div className="mission-main-grid">
      <Card className="mission-chart-panel">
        <CardHeader className="mission-chart-heading">
          <div className="mission-chart-title"><div><CardTitle>{props.metrics[props.selectedMetric].label}</CardTitle><span>Recorded observations · {props.rangeDays} days</span></div>
            <div className="mission-chart-current"><strong>{selectedItem ? formatValue(selectedItem) : 'No measurement'}</strong>
              {selectedItem && <span className={`mission-status status-${selectedAssessment.state}`}><i aria-hidden="true" />{conciseState(selectedAssessment.state)}</span>}
            </div>
          </div>
          <div className="mission-chart-controls">
            <span>{selectedItem ? `${rangeObservations(props.selectedMetric).length} observations` : 'No observation in this period'}</span>
            <div className="mission-range" role="group" aria-label="Chart date range">
              {([7, 30] as const).map((days) => <Button key={days} type="button" size="sm" variant={props.rangeDays === days ? 'secondary' : 'ghost'} aria-pressed={props.rangeDays === days} onClick={() => { setPlaying(false); setPlaybackFraction(1); props.onRangeChange(days); }}>{days}d</Button>)}
            </div>
          </div>
        </CardHeader>
        <CardContent className="mission-main-chart-content">
          <ObservationChart observations={rangeObservations(props.selectedMetric)} metric={props.selectedMetric} timeZone={activeTimeZone}
            presentation="console-main" rangeDays={props.rangeDays} rangeEnd={now} replayAt={playbackAt}
            reducedMotion={props.reducedMotion} onSelect={props.onReview} />
          {comparison && <div className="mission-comparison" aria-live="polite">
            <span>{comparison.count} similar reading{comparison.count === 1 ? '' : 's'} · past {comparison.days} days</span>
            <strong>{comparison.comparison}</strong>
          </div>}
        </CardContent>
      </Card>

      <aside className="mission-right-rail" aria-label="Anatomy and next action">
        <Card className="mission-anatomy-panel">
          <CardHeader><CardTitle>Body map</CardTitle></CardHeader>
          <CardContent>
            <Suspense fallback={<div className="mission-anatomy-placeholder" role="status">Preparing anatomy</div>}>
              <AnatomyViewer selectedMetric={props.selectedMetric} selectedStructure={props.selectedStructure} focusRequestKey={focusRequestKey} reducedMotion={props.reducedMotion}
                onMetric={(metric) => { if (metric) selectMetric(metric); }} onStructure={props.onStructure}
                priorityStructure={topAssessment?.bodyTarget} priorityState={topAssessment?.state} compact />
            </Suspense>
            {structureNotAssessed && <div className="mission-structure-note"><strong>{selectedStructureInfo?.label}</strong><span>Not assessed</span></div>}
          </CardContent>
        </Card>

        <Card className={`mission-action-panel ${actionAssessment ? `priority-${actionAssessment.state}` : ''}`}>
          <CardHeader><div><CardTitle>Next action</CardTitle>{actionAssessment && <Badge className="mission-action-badge" variant={actionAssessment.state === 'urgent' ? 'destructive' : actionAssessment.state === 'missing' ? 'outline' : 'attention'}>{conciseState(actionAssessment.state)}</Badge>}</div></CardHeader>
          <CardContent>
            <strong className="mission-action-value">{topAssessment?.observation
              ? `${props.metrics[topAssessment.metric].short} · ${formatValue(topAssessment.observation)}`
              : actionTask?.title ?? (missingAssessment ? `Record ${props.metrics[missingAssessment.metric].short.toLocaleLowerCase()}` : 'No action scheduled')}</strong>
            <p>{topAssessment?.nextAction ?? (actionTask ? actionTask.kind === 'measurement' ? 'A repeat measurement is scheduled.' : 'A routine check-in is scheduled.' : missingAssessment ? 'Record a reading to begin.' : 'There are no scheduled actions.')}</p>
            {actionTask && <small className="mission-action-due"><CalendarClock aria-hidden="true" />{dueLabel(actionTask, now, activeTimeZone ?? '')}</small>}
            <ActionButton task={actionTask} assessment={actionAssessment} onTask={props.onTask}
              onAdd={(metric, taskId) => props.onAdd(metric, taskId)} onReview={(item) => props.onReview(item)} />
          </CardContent>
        </Card>
      </aside>
    </div>

    <section className="mission-support" aria-label="Supporting records">
      <div className="mission-support-tabs" role="tablist" aria-label="Supporting panel">
        <button type="button" role="tab" id="support-pressure-tab" aria-selected={supportTab === 'pressure'} aria-controls="support-pressure-panel" onClick={() => setSupportTab('pressure')}><MetricGlyph name="bp" size={19} /> Blood pressure</button>
        <button type="button" role="tab" id="support-sleep-tab" aria-selected={supportTab === 'sleep'} aria-controls="support-sleep-panel" onClick={() => setSupportTab('sleep')}><MetricGlyph name="sleep" size={19} /> Sleep</button>
        <button type="button" role="tab" id="support-activity-tab" aria-selected={supportTab === 'activity'} aria-controls="support-activity-panel" onClick={() => setSupportTab('activity')}><CalendarClock aria-hidden="true" /> Activity</button>
      </div>
      <div className="mission-support-grid">
        <Card className={`mission-support-panel support-pressure ${supportTab === 'pressure' ? 'support-active' : ''}`} id="support-pressure-panel" role="tabpanel" aria-labelledby="support-pressure-tab">
          <CardHeader><div><CardTitle>Blood pressure</CardTitle><span>Top and bottom numbers · mmHg</span></div><strong>{latestByMetric.bp ? formatValue(latestByMetric.bp) : '—'}</strong></CardHeader>
          <CardContent><ObservationChart observations={rangeObservations('bp')} metric="bp" timeZone={activeTimeZone} presentation="console-compact"
            rangeDays={props.rangeDays} rangeEnd={now} reducedMotion={props.reducedMotion} onSelect={props.onReview} /></CardContent>
        </Card>
        <Card className={`mission-support-panel support-sleep ${supportTab === 'sleep' ? 'support-active' : ''}`} id="support-sleep-panel" role="tabpanel" aria-labelledby="support-sleep-tab">
          <CardHeader><div><CardTitle>Sleep duration</CardTitle><span>Hours recorded</span></div><strong>{latestByMetric.sleep ? formatValue(latestByMetric.sleep) : '—'}</strong></CardHeader>
          <CardContent><ObservationChart observations={rangeObservations('sleep')} metric="sleep" timeZone={activeTimeZone} presentation="bars"
            rangeDays={props.rangeDays} rangeEnd={now} reducedMotion={props.reducedMotion} onSelect={props.onReview} /></CardContent>
        </Card>
        <Card className={`mission-support-panel support-activity ${supportTab === 'activity' ? 'support-active' : ''}`} id="support-activity-panel" role="tabpanel" aria-labelledby="support-activity-tab">
          <CardHeader><div><CardTitle>Recent activity</CardTitle><span>Recorded checks and follow-ups</span></div><Button variant="ghost" size="sm" onClick={props.onCare}>Care Plan<ArrowRight data-icon="inline-end" /></Button></CardHeader>
          <CardContent>
            {replayEvents.length ? <div className="mission-event-list">{[...replayEvents].reverse().slice(0, 3).map((event) => <button key={event.key} type="button" className="mission-event-row" onClick={() => { const fraction = (new Date(event.at).getTime() - rangeStart) / Math.max(1, now - rangeStart); setPlaying(false); setPlaybackFraction(Math.min(1, Math.max(0, fraction))); if ('metric' in event.item) props.onSelectMetric(event.item.metric); }}>
              <time>{localStamp(event.at, true, activeTimeZone)}</time><span><strong>{event.title}</strong><small>{event.detail}</small></span><ArrowRight aria-hidden="true" />
            </button>)}</div> : <p className="mission-empty">No activity in this period.</p>}
            {upcomingTasks.length > 0 && <div className="mission-upcoming"><span>UPCOMING</span>{upcomingTasks.slice(0, 2).map((task) => <button key={task.id} type="button" onClick={() => props.onTask(task)}><strong>{task.title}</strong><time>{dueLabel(task, now, activeTimeZone ?? '')}</time></button>)}</div>}
          </CardContent>
        </Card>
      </div>
    </section>

    <div className="mission-replay" aria-label="Saved observation playback">
      <Button type="button" variant="outline" size="icon-sm" aria-label={playing ? 'Pause timeline replay' : 'Play timeline replay'} aria-pressed={playing}
        onClick={() => { if (playbackFraction >= 1) setPlaybackFraction(0); setPlaying((value) => !value); }}>
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
      <span className="mission-replay-title">Review timeline</span>
      <input type="range" min="0" max="1000" step="1" value={Math.round(playbackFraction * 1000)} aria-label="Timeline position"
        aria-valuetext={fullDate(new Date(playbackAt).toISOString(), activeTimeZone)}
        onChange={(event) => { setPlaying(false); selectNearestReplayEvent(Number(event.target.value)); }} />
      <time>{fullDate(new Date(playbackAt).toISOString(), activeTimeZone)} · {localStamp(new Date(playbackAt).toISOString(), false, activeTimeZone)}</time>
      <Button type="button" variant="ghost" size="sm" disabled={!activeReplayEvent || !('metric' in activeReplayEvent.item)} onClick={() => inspectReplayEvent(activeReplayEvent)}>
        Open reading<ArrowRight data-icon="inline-end" />
      </Button>
    </div>
    <span className="mission-sr-only">Moving the timeline reviews saved observations only. Current readings and the next action remain unchanged.</span>
  </section>;
}
