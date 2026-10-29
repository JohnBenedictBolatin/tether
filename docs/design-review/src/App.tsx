import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDownToLine, ArrowLeft, ArrowRight, CalendarClock, Check, CircleHelp, FileHeart, FileText, Info, LifeBuoy, Plus, RotateCcw, Search, SunMedium, Upload, X } from 'lucide-react';
import { EntryDialog } from './EntryDialog';
import { TodayView } from './TodayView';
import { ObservationChart } from './ObservationChart';
import { HazardGlyph, MetricGlyph, navigationGlyphs } from './TetherIcons';
import { assessObservation, assessReading, bodyTargetForMetric, type ReadingAssessment } from './assessment';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from './components/ui/empty';
import { Field, FieldGroup, FieldLabel } from './components/ui/field';
import { Input } from './components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Switch } from './components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { compareObservation, CONTEXT_KINDS, formatValue, fullDate, GUIDANCE_REVIEW_STATUS, GUIDANCE_VERSION, HAZARDS, isComparable, latestForMetric, localStamp, METRICS, METRIC_ORDER, makeDemoData, makeId, MOOD, SLEEP_QUALITY, type ContextEntry, type Dataset, type Followup, type ImportRow, type Metric, type Observation, type Page, type ReviewEpisode, type TaskKind } from './domain';
import './app.css';
import './soft.css';
import './console.css';

type WorkspaceData = { observations: Observation[]; contexts: ContextEntry[]; tasks: Followup[]; episodes: ReviewEpisode[] };
type RecordEvent = { id: string; key: string; kind: 'observation' | 'context' | 'task'; at: string; title: string; detail: string; item: Observation | ContextEntry | Followup; episodeId?: string };
type ExportPayload = { dataset: Dataset; createdAt: string; mission: { environment: string; startDate: string; timeZone: string }; observations: Observation[]; contexts: ContextEntry[]; tasks: Followup[]; episodes: ReviewEpisode[]; includeNotes: boolean };

const NAV: Array<[Page, string]> = [['console', 'Today'], ['measurements', 'Measurements'], ['care', 'Care Plan'], ['history', 'History']];
const emptyWorkspace = (): WorkspaceData => ({ observations: [], contexts: [], tasks: [], episodes: [] });
const BODY_SYSTEM_GUIDES: Array<{ name: string; text: string; metrics: Metric[]; source: string; url: string }> = [
  { name: 'Heart and circulation', text: 'Heart rate and blood pressure do not assess overall heart health or explain a change.', metrics: ['heart', 'bp'], source: METRICS.heart.source, url: METRICS.heart.sourceUrl },
  { name: 'Blood sugar', text: 'Readings can include meal timing. Tether does not set targets or treatment instructions.', metrics: ['glucose'], source: METRICS.glucose.source, url: METRICS.glucose.sourceUrl },
  { name: 'Body temperature', text: 'Readings keep the site and device used. Temperature alone does not explain a change.', metrics: ['temperature'], source: METRICS.temperature.source, url: METRICS.temperature.sourceUrl },
  { name: 'Sleep and mood', text: 'These are crew check-ins, not a mental-health assessment.', metrics: ['sleep', 'mood'], source: METRICS.sleep.source, url: METRICS.sleep.sourceUrl },
  { name: 'Bone and muscle', text: 'Not assessed. The body model and exercise notes do not show bone or muscle health.', metrics: [], source: 'NASA Human System Risks · background only', url: 'https://www.nasa.gov/hhp/human-system-risks/' },
];

function routeFromHash(hash: string): Page {
  const route = hash.replace(/^#/, '').split(/[?&]/, 1)[0].toLowerCase();
  if (route === 'overview' || route === '' || route === 'today' || route === 'console') return 'console';
  if (route === 'body') return 'console';
  if (route === 'trends' || route === 'records') return 'history';
  const pages: Page[] = ['measurements', 'history', 'care', 'library', 'settings', 'review', 'medical'];
  return pages.includes(route as Page) ? route as Page : 'console';
}

function historyViewFromHash(hash: string): 'chart' | 'timeline' | null {
  const route = hash.replace(/^#/, '').split(/[?&]/, 1)[0].toLowerCase();
  return route === 'trends' ? 'chart' : route === 'records' ? 'timeline' : null;
}

function metricFromLegacyBodyHash(hash: string): Metric | null {
  if (routeFromHash(hash) !== 'console' || !hash.toLowerCase().includes('#body')) return null;
  const query = hash.split('?')[1] ?? '';
  const raw = new URLSearchParams(query).get('metric') ?? '';
  return normalizeMetric(raw);
}

function toDateTimeInput(iso: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.valueOf())) return '';
  if (timeZone === 'UTC') return date.toISOString().slice(0, 16);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string, timeZone: string) {
  return new Date(timeZone === 'UTC' ? `${value}:00Z` : value);
}

function formatDateTime(iso: string, timeZone?: string) {
  const date = new Date(iso);
  return Number.isNaN(date.valueOf()) ? 'Time unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(date);
}

function dateKey(iso: string, timeZone?: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function normalizeMetric(value: string): Metric | null {
  const key = value.trim().toLocaleLowerCase().replace(/[_-]+/g, ' ');
  const aliases: Record<string, Metric> = {
    heart: 'heart', 'heart rate': 'heart', 'resting heart rate': 'heart',
    bp: 'bp', 'blood pressure': 'bp', glucose: 'glucose', 'blood glucose': 'glucose',
    temperature: 'temperature', 'body temperature': 'temperature', sleep: 'sleep', 'sleep duration': 'sleep',
    mood: 'mood', 'mood check in': 'mood', 'mood check-in': 'mood',
  };
  return aliases[key] ?? null;
}

function csvRecords(text: string) {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"' && quoted && input[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') {
      if (!quoted && cell.length) throw new Error('A quote appeared inside an unquoted CSV value. Correct the file and try again.');
      quoted = !quoted;
    } else if (character === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length)) records.push(row);
      row = []; cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('The CSV has an unclosed quote. Correct the file and try again.');
  if (cell.length || row.length) { row.push(cell.trim()); records.push(row); }
  return records;
}

function duplicateKey(metric: Metric, value: string, unit: string, at: string) {
  const timestamp = new Date(at).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const canonical = metric === 'bp'
    ? value.split('/').map((part) => String(Number(part.trim()))).join('/')
    : metric === 'mood' ? value.trim() : String(Number(value));
  return JSON.stringify([metric, canonical, unit.trim().toLocaleLowerCase(), timestamp]);
}

function observationKey(item: Observation) {
  return duplicateKey(item.metric, item.metric === 'bp' ? `${item.value}/${item.secondary}` : String(item.value), item.unit, item.at);
}

function validateImportRows(rows: ImportRow[], observations: Observation[]) {
  const seen = new Set(observations.map(observationKey));
  return rows.map((row) => {
    let error = row.error?.startsWith('Row has') ? row.error : '';
    if (!error && !row.metric) error = 'Choose a recognized indicator';
    if (!error && !row.value.trim()) error = 'Enter a value';
    const date = new Date(row.at);
    if (!error && (!row.at || Number.isNaN(date.valueOf()))) error = 'Enter a valid timestamp';
    if (!error && date.getTime() > Date.now() + 60000) error = 'Timestamp is in the future';
    if (row.metric && !error) {
      const info = METRICS[row.metric];
      if (row.unit.trim().toLocaleLowerCase() !== info.unit.toLocaleLowerCase()) error = `Expected unit ${info.unit || '(blank for mood)'}`;
      if (!error && row.metric === 'bp') {
        if (!/^\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?\s*$/.test(row.value)) error = 'Enter top/bottom values separated by /';
        else { const [systolic, diastolic] = row.value.split('/').map(Number); if (systolic <= diastolic || diastolic <= 0 || systolic > 350 || diastolic > 250) error = 'Check both blood pressure values'; }
      } else if (!error && row.metric === 'mood' && !MOOD.includes(row.value.trim())) error = 'Choose one of the five mood labels';
      else if (!error && row.metric !== 'mood') {
        const value = Number(row.value);
        const maximum = row.metric === 'heart' ? 300 : row.metric === 'temperature' ? 45 : row.metric === 'sleep' ? 24 : 2000;
        const minimum = row.metric === 'sleep' ? 0 : 0.01;
        if (!Number.isFinite(value) || value < minimum || value > maximum) error = `Enter a numeric value from ${minimum} to ${maximum}`;
      }
    }
    const key = row.metric && !error ? duplicateKey(row.metric, row.value, row.unit, row.at) : '';
    const duplicate = !!key && seen.has(key);
    if (key) seen.add(key);
    return { ...row, error, duplicate };
  });
}

function parseCsv(text: string, observations: Observation[]): ImportRow[] {
  const records = csvRecords(text);
  if (records.length < 2) throw new Error('CSV needs a header and at least one measurement row.');
  const headers = records[0].map((header) => header.trim().toLocaleLowerCase());
  const required = ['metric', 'value', 'unit', 'timestamp', 'context'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing CSV columns: ${missing.join(', ')}.`);
  const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
  const rows = records.slice(1).map((cells, index): ImportRow => {
    const read = (key: string) => cells[indexes[key]] ?? '';
    const metric = normalizeMetric(read('metric'));
    return {
      id: makeId(`CSV${index + 1}`), metric, rawMetric: read('metric'), value: read('value'), unit: read('unit'), at: read('timestamp'),
      context: read('context'), method: read('method') || 'CSV import',
      error: cells.length !== headers.length ? `Row has ${cells.length} fields; expected ${headers.length}.` : undefined,
    };
  });
  return validateImportRows(rows, observations);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ?? character));
}

function Icon({ name }: { name: string }) {
  const IconComponent = navigationGlyphs[name === 'history' ? 'records' : name] ?? navigationGlyphs.console;
  return <IconComponent className={`navigation-glyph navigation-glyph-${name}`} aria-hidden="true" />;
}

function PageHeading({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <header className="page-heading"><div><h1>{title}</h1><p className="subtitle">{description}</p></div>{actions && <div className="page-heading-actions">{actions}</div>}</header>;
}

function MissionClock({ missionDay, timeZone }: { missionDay: number; timeZone?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const formatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone });
  const zone = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short', timeZone }).formatToParts(now).find((part) => part.type === 'timeZoneName')?.value;
  return <div className="mission-clock" aria-label={`Mission day ${missionDay}, ${zone ?? 'local time'}`}>
    <span>MISSION DAY</span><strong>{String(missionDay).padStart(3, '0')}</strong><i aria-hidden="true" />
    <span className="mission-clock-zone">{zone}</span><time dateTime={now.toISOString()}>{formatter.format(now)}</time>
  </div>;
}

export default function App() {
  const [page, setPage] = useState<Page>(() => routeFromHash(window.location.hash));
  const [historyView, setHistoryView] = useState<'chart' | 'timeline'>(() => historyViewFromHash(window.location.hash) ?? 'chart');
  const [returnPage, setReturnPage] = useState<Page>('console');
  const [showMilo, setShowMilo] = useState(true);
  const [environment, setEnvironment] = useState('Spacecraft');
  const [missionStartDate, setMissionStartDate] = useState(() => new Date(Date.now() - 41 * 86400000).toISOString().slice(0, 10));
  const [profileName, setProfileName] = useState('');
  const [reminders, setReminders] = useState(true);
  const [compactMotion, setCompactMotion] = useState(false);
  const [systemReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [timeZone, setTimeZone] = useState('Local device');
  const [dataset, setDataset] = useState<Dataset>('demo');
  const [workspaces, setWorkspaces] = useState<Record<Dataset, WorkspaceData>>(() => ({ demo: makeDemoData(), personal: emptyWorkspace() }));
  const workspace = workspaces[dataset];
  const { observations, contexts, tasks, episodes } = workspace;
  const now = Date.now();
  const assessments = useMemo(() => Object.fromEntries(METRIC_ORDER.map((metric) => [metric, assessReading(metric, observations, dataset, now)])) as Record<Metric, ReadingAssessment>, [observations, dataset, now]);
  const [selectedMetric, setSelectedMetric] = useState<Metric>(() => metricFromLegacyBodyHash(window.location.hash) ?? 'heart');
  const [selectedObservation, setSelectedObservation] = useState('DEMO-heart-7');
  const [selectedStructure, setSelectedStructure] = useState(() => {
    const metric = metricFromLegacyBodyHash(window.location.hash) ?? 'heart';
    return bodyTargetForMetric(metric) ?? '';
  });
  const [consoleRange, setConsoleRange] = useState<7 | 30>(7);
  const [range, setRange] = useState<7 | 30>(7);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryMode, setEntryMode] = useState<'measurement' | 'context'>('measurement');
  const [contextKind, setContextKind] = useState<string>('symptom');
  const [entryMetric, setEntryMetric] = useState<Metric>('heart');
  const [entryContext, setEntryContext] = useState('');
  const [entryError, setEntryError] = useState('');
  const [linkTask, setLinkTask] = useState<string | null>(null);
  const [entrySession, setEntrySession] = useState(0);
  const entryOrigin = useRef<Page>('console');
  const [csvRows, setCsvRows] = useState<ImportRow[] | null>(null);
  const [csvError, setCsvError] = useState('');
  const [search, setSearch] = useState('');
  const [librarySearch, setLibrarySearch] = useState('');
  const [recordMetric, setRecordMetric] = useState('all');
  const [recordFrom, setRecordFrom] = useState('');
  const [recordTo, setRecordTo] = useState('');
  const [recordEpisode, setRecordEpisode] = useState('all');
  const [exportSelection, setExportSelection] = useState<string[] | null>(null);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [handoffEpisode, setHandoffEpisode] = useState('');
  const [handoffPreviewOpen, setHandoffPreviewOpen] = useState(false);
  const [handoffIncludeNotes, setHandoffIncludeNotes] = useState(false);
  const [handoffError, setHandoffError] = useState('');
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskDraftKind, setTaskDraftKind] = useState<TaskKind>('measurement');
  const [taskDraftTitle, setTaskDraftTitle] = useState('');
  const [taskDraftDue, setTaskDraftDue] = useState('');
  const [taskDraftObservation, setTaskDraftObservation] = useState('');
  const [taskError, setTaskError] = useState('');
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({});
  const [rescheduleValues, setRescheduleValues] = useState<Record<string, string>>({});
  const [focusTaskId, setFocusTaskId] = useState('');
  const [resetDemoOpen, setResetDemoOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const reviewScrollTop = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const activeTimeZone = timeZone === 'UTC' ? 'UTC' : undefined;
  const selected = observations.find((item) => item.id === selectedObservation) ?? latestForMetric(observations, selectedMetric);
  const missionZone = timeZone === 'UTC' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone;
  const missionParts = new Intl.DateTimeFormat('en-US', { timeZone: missionZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const missionToday = Object.fromEntries(missionParts.map((part) => [part.type, part.value]));
  const [startYear, startMonth, startDay] = missionStartDate.split('-').map(Number);
  const missionCurrentOrdinal = Date.UTC(Number(missionToday.year), Number(missionToday.month) - 1, Number(missionToday.day));
  const missionStartOrdinal = Date.UTC(startYear, startMonth - 1, startDay);
  const missionDay = Math.max(1, Math.floor((missionCurrentOrdinal - missionStartOrdinal) / 86400000) + 1);
  const reviewTask = selected ? tasks.find((task) => task.observationId === selected.id || task.resultId === selected.id || task.id === selected.linkedTask) : undefined;
  const selectedReadingAssessment = selected ? assessObservation(selected, dataset, now) : undefined;
  const reviewOriginal = reviewTask?.observationId ? observations.find((item) => item.id === reviewTask.observationId) : undefined;
  const reviewResult = reviewTask?.resultId ? observations.find((item) => item.id === reviewTask.resultId) : undefined;
  const reviewEpisode = selected ? episodes.find((episode) => episode.observationId === selected.id || episode.resultIds.includes(selected.id)) : undefined;
  const trendStart = now - range * 86400000;
  const trendRows = observations.filter((item) => item.metric === selectedMetric && new Date(item.at).getTime() >= trendStart && new Date(item.at).getTime() <= now).sort((a, b) => a.at.localeCompare(b.at));
  const rangeComparison = selected ? compareObservation(selected, observations, range) : null;
  const events = useMemo<RecordEvent[]>(() => {
    const result: RecordEvent[] = [];
    observations.forEach((item) => {
      const episode = episodes.find((candidate) => candidate.observationId === item.id || candidate.resultIds.includes(item.id));
      result.push({ id: item.id, key: `observation:${item.id}`, kind: 'observation', at: item.at, title: METRICS[item.metric].label,
        detail: `${formatValue(item)} · ${item.method} · ${item.context}${item.note ? ` · ${item.note}` : ''}`, item, episodeId: episode?.id });
    });
    contexts.forEach((item) => result.push({ id: item.id, key: `context:${item.id}`, kind: 'context', at: item.at, title: item.kind, detail: `${item.value}${item.note ? ` · ${item.note}` : ''}`, item, episodeId: item.episodeId }));
    tasks.forEach((item) => result.push({ id: item.id, key: `task:${item.id}`, kind: 'task', at: item.status === 'complete' ? item.completedAt ?? item.createdAt : item.createdAt, title: `${item.kind === 'measurement' ? 'Measurement follow-up' : 'Routine action'} · ${item.status === 'complete' ? 'completed' : item.status === 'cancelled' ? 'cancelled' : 'open'}`,
      detail: `${item.title} · Scheduled ${formatDateTime(item.due, activeTimeZone)}${item.resultId ? ' · repeat recorded' : ''}${item.completionNote ? ` · ${item.completionNote}` : ''}`, item, episodeId: item.episodeId }));
    return result.sort((a, b) => b.at.localeCompare(a.at));
  }, [observations, contexts, tasks, episodes, activeTimeZone]);
  const visibleEvents = events.filter((event) => {
    const day = dateKey(event.at, activeTimeZone);
    const matchesDate = (!recordFrom || day >= recordFrom) && (!recordTo || day <= recordTo);
    const matchesMetric = recordMetric === 'all' || (event.kind === 'observation' && (event.item as Observation).metric === recordMetric);
    const matchesEpisode = recordEpisode === 'all' || event.episodeId === recordEpisode;
    const matchesSearch = `${event.title} ${event.detail}`.toLocaleLowerCase().includes(search.toLocaleLowerCase());
    return matchesDate && matchesMetric && matchesEpisode && matchesSearch;
  });
  const normalizedLibrarySearch = librarySearch.trim().toLocaleLowerCase();
  const libraryHazards = HAZARDS.filter((hazard) => `${hazard.name} ${hazard.text} ${hazard.limit}`.toLocaleLowerCase().includes(normalizedLibrarySearch));
  const libraryGuides = METRIC_ORDER.filter((metric) => `${METRICS[metric].label} ${METRICS[metric].why} ${METRICS[metric].how} ${METRICS[metric].cannot}`.toLocaleLowerCase().includes(normalizedLibrarySearch));
  const libraryBodySystems = BODY_SYSTEM_GUIDES.filter((item) => `${item.name} ${item.text} ${item.metrics.map((metric) => METRICS[metric].label).join(' ')} ${item.source}`.toLocaleLowerCase().includes(normalizedLibrarySearch));
  const openTasks = tasks.filter((task) => task.status === 'open').sort((a, b) => a.due.localeCompare(b.due));
  const selectedRecordEpisode = episodes.find((episode) => episode.id === recordEpisode);
  const selectedRecordEpisodeOriginal = selectedRecordEpisode ? observations.find((item) => item.id === selectedRecordEpisode.observationId) : undefined;
  const selectedTaskObservation = observations.find((item) => item.id === taskDraftObservation);
  const activeHandoffEpisode = episodes.find((item) => item.id === handoffEpisode) ?? episodes[0];
  const handoffData = useMemo(() => {
    if (!activeHandoffEpisode) return null;
    const episodeObservations = observations.filter((item) => item.id === activeHandoffEpisode.observationId || activeHandoffEpisode.resultIds.includes(item.id));
    const episodeContexts = contexts.filter((item) => item.episodeId === activeHandoffEpisode.id);
    const episodeTasks = tasks.filter((item) => item.episodeId === activeHandoffEpisode.id);
    return { observations: episodeObservations, contexts: episodeContexts, tasks: episodeTasks, episodes: [activeHandoffEpisode] };
  }, [activeHandoffEpisode, observations, contexts, tasks]);

  const mutate = (update: (current: WorkspaceData) => WorkspaceData) => {
    setWorkspaces((current) => ({ ...current, [dataset]: update(current[dataset]) }));
  };
  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  };
  const navigate = (next: Page) => {
    if (next === 'trends') setHistoryView('chart');
    if (next === 'records') setHistoryView('timeline');
    const destination = next === 'body' ? 'console' : next === 'trends' || next === 'records' ? 'history' : next;
    setPage(destination);
    const hash = destination === 'console' ? '#today' : `#${destination}`;
    if (window.location.hash !== hash) window.history.pushState({ page: destination }, '', hash);
  };
  const openReview = (item: Observation, from: Page = page) => {
    reviewScrollTop.current = window.scrollY;
    setSelectedObservation(item.id);
    setSelectedMetric(item.metric);
    setReturnPage(from === 'review' ? returnPage : from);
    navigate('review');
  };
  const returnFromReview = () => {
    navigate(returnPage);
    window.requestAnimationFrame(() => window.scrollTo({ top: reviewScrollTop.current, behavior: compactMotion || systemReducedMotion ? 'instant' : 'smooth' }));
  };
  useEffect(() => {
    const updateRoute = () => {
      setPage(routeFromHash(window.location.hash));
      const legacyHistoryView = historyViewFromHash(window.location.hash);
      if (legacyHistoryView) setHistoryView(legacyHistoryView);
      if (window.location.hash.toLowerCase().includes('#body')) {
        const metric = metricFromLegacyBodyHash(window.location.hash) ?? 'heart';
        setSelectedMetric(metric);
        setSelectedStructure(bodyTargetForMetric(metric) ?? '');
      }
    };
    window.addEventListener('hashchange', updateRoute);
    window.addEventListener('popstate', updateRoute);
    return () => { window.removeEventListener('hashchange', updateRoute); window.removeEventListener('popstate', updateRoute); };
  }, []);
  useEffect(() => {
    if (!focusTaskId || page !== 'care') return;
    window.requestAnimationFrame(() => document.getElementById(`care-task-${focusTaskId}`)?.scrollIntoView({ block: 'center', behavior: compactMotion || systemReducedMotion ? 'instant' : 'smooth' }));
    setFocusTaskId('');
  }, [focusTaskId, page, compactMotion, systemReducedMotion]);
  useEffect(() => () => { if (toastTimer.current) window.clearTimeout(toastTimer.current); }, []);

  const startMeasurement = (metric: Metric = selectedMetric, taskId: string | null = null) => {
    const task = taskId ? tasks.find((candidate) => candidate.id === taskId) : undefined;
    const original = task?.observationId ? observations.find((item) => item.id === task.observationId) : undefined;
    entryOrigin.current = page === 'review' ? returnPage : page;
    setEntryMode('measurement'); setEntryMetric(original?.metric ?? metric); setEntryContext(''); setLinkTask(taskId);
    setEntryError(''); setEntrySession((current) => current + 1); setEntryOpen(true);
  };
  const startContext = (kind: string) => {
    entryOrigin.current = page === 'review' ? returnPage : page;
    setEntryMode('context'); setContextKind(kind); setEntryError(''); setEntrySession((current) => current + 1); setEntryOpen(true);
  };

  function saveEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setEntryError('');
    const atText = String(form.get(entryMode === 'context' ? 'at' : 'at') ?? '');
    const recordedAt = fromDateTimeInput(atText, timeZone);
    if (!atText || Number.isNaN(recordedAt.valueOf()) || recordedAt.getTime() > Date.now() + 60000) {
      setEntryError('Enter a valid date and time that is not in the future. Your entry has not been saved.'); return;
    }
    if (entryMode === 'context') {
      const value = String(form.get('value') ?? '').trim();
      const note = String(form.get('note') ?? '').trim();
      if (!value) { setEntryError('Add a short check-in value. Your entry has not been saved.'); return; }
      const context: ContextEntry = { id: makeId('CTX'), kind: contextKind, value, at: recordedAt.toISOString(), note, dataset, synthetic: dataset === 'demo' };
      mutate((current) => ({ ...current, contexts: [context, ...current.contexts] }));
      setEntryOpen(false); notify('Check-in recorded for this session.'); return;
    }
    const info = METRICS[entryMetric];
    const rawContext = String(form.get('context') ?? '').trim();
    const context = rawContext || 'Not recorded';
    if (linkTask && !rawContext) { setEntryError('Confirm the conditions used for this repeat, or choose “Not recorded.” Your entry has not been saved.'); return; }
    const method = String(form.get('method') ?? '').trim() || 'Not recorded';
    const note = String(form.get('note') ?? '').trim();
    let value: number | string;
    let secondary: number | undefined;
    if (entryMetric === 'bp') {
      const systolic = Number(form.get('value'));
      const diastolic = Number(form.get('secondary'));
      if (!Number.isFinite(systolic) || !Number.isFinite(diastolic) || systolic <= diastolic || diastolic <= 0 || systolic > 350 || diastolic > 250) {
        setEntryError('Check both pressure values. The top number must be higher than the bottom number. Your entry has not been saved.'); return;
      }
      value = systolic; secondary = diastolic;
    } else if (entryMetric === 'mood') {
      const mood = String(form.get('value') ?? '');
      if (!MOOD.includes(mood)) { setEntryError('Choose one of the five mood descriptions. Your entry has not been saved.'); return; }
      value = mood;
    } else {
      const raw = String(form.get('value') ?? '').trim();
      const numeric = Number(raw);
      const maximum = entryMetric === 'heart' ? 300 : entryMetric === 'temperature' ? 45 : entryMetric === 'sleep' ? 24 : 2000;
      const minimum = entryMetric === 'sleep' ? 0 : 0.01;
      if (!raw || !Number.isFinite(numeric) || numeric < minimum || numeric > maximum) {
        setEntryError(`Enter a numeric ${info.unit || 'hour'} value from ${minimum} to ${maximum}. Your entry has not been saved.`); return;
      }
      value = entryMetric === 'temperature' ? Number(numeric.toFixed(1)) : numeric;
    }
    const task = linkTask ? tasks.find((candidate) => candidate.id === linkTask) : undefined;
    const original = task?.observationId ? observations.find((item) => item.id === task.observationId) : undefined;
    if (linkTask && (!task || task.status !== 'open' || task.kind !== 'measurement')) { setEntryError('This follow-up is no longer open. Reopen Care Plan and choose an active task.'); return; }
    if (task?.observationId && (!original || original.metric !== entryMetric)) { setEntryError('A repeat must use the same indicator as its original observation. Your entry has not been saved.'); return; }
    if (original && recordedAt.getTime() <= new Date(original.at).getTime()) { setEntryError('A repeat must be recorded after its original observation. Your entry has not been saved.'); return; }
    const hasConditions = method !== 'Not recorded' && context !== 'Not recorded';
    const quality = hasConditions ? 'usable' : 'verify';
    const qualityNote = quality === 'verify' ? 'Method or measurement conditions are missing; comparison may be limited.' : '';
    const observation: Observation = { id: makeId('OBS'), metric: entryMetric, value, secondary, unit: info.unit, at: recordedAt.toISOString(), method, context,
      note: [note, qualityNote].filter(Boolean).join(' '), source: 'Manual entry', synthetic: dataset === 'demo', dataset, quality, guidanceVersion: GUIDANCE_VERSION, linkedTask: task?.id };
    const episodeId = task?.episodeId ?? makeId('EPISODE');
    const updatedEpisode: ReviewEpisode | undefined = episodeId
      ? episodes.find((episode) => episode.id === episodeId)
      : undefined;
    const newEpisode: ReviewEpisode | undefined = updatedEpisode ? undefined : {
      id: episodeId, observationId: original?.id ?? observation.id, resultIds: original ? [observation.id] : [],
      openedAt: original?.at ?? observation.at, status: 'open', taskId: task?.id, dataset, synthetic: dataset === 'demo',
    };
    mutate((current) => ({
      ...current,
      observations: [observation, ...current.observations],
      tasks: task ? current.tasks.map((candidate) => candidate.id === task.id ? { ...candidate, episodeId, resultId: observation.id } : candidate) : current.tasks,
      episodes: updatedEpisode
        ? current.episodes.map((episode) => episode.id === updatedEpisode.id ? { ...episode, resultIds: [...episode.resultIds, observation.id] } : episode)
        : newEpisode ? [newEpisode, ...current.episodes] : current.episodes,
    }));
    setSelectedMetric(entryMetric); setSelectedObservation(observation.id); setEntryOpen(false); setLinkTask(null);
    openReview(observation, entryOrigin.current);
    notify(task ? 'Repeat recorded. Review both readings before completing the task.' : 'Reading saved.');
  }

  const openTask = (task: Followup) => {
    if (new Date(task.due).getTime() > Date.now()) { setFocusTaskId(task.id); navigate('care'); return; }
    if (task.kind === 'measurement') {
      const result = task.resultId ? observations.find((item) => item.id === task.resultId) : undefined;
      const original = task.observationId ? observations.find((item) => item.id === task.observationId) : undefined;
      if (result) { openReview(result, page); return; }
      startMeasurement(original?.metric ?? selectedMetric, task.id); return;
    }
    setFocusTaskId(task.id); navigate('care');
  };

  const openTaskComposer = (observation?: Observation) => {
    setTaskDraftKind(observation ? 'measurement' : 'routine');
    setTaskDraftObservation(observation?.id ?? '');
    setTaskDraftTitle(observation ? `Repeat ${METRICS[observation.metric].short.toLowerCase()} and record the conditions` : '');
    setTaskDraftDue(''); setTaskError(''); setTaskFormOpen(true); navigate('care');
  };

  const createTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskDraftTitle.trim();
    const due = fromDateTimeInput(taskDraftDue, timeZone);
    if (!title) { setTaskError('Add a short action name.'); return; }
    if (!taskDraftDue || Number.isNaN(due.valueOf())) { setTaskError('Choose when this task should be reviewed.'); return; }
    const original = taskDraftObservation ? observations.find((item) => item.id === taskDraftObservation) : undefined;
    if (taskDraftKind === 'measurement' && !original) { setTaskError('Choose the original reading for this repeat.'); return; }
    const existingEpisode = original ? episodes.find((episode) => episode.observationId === original.id || episode.resultIds.includes(original.id)) : undefined;
    const episodeId = existingEpisode?.id ?? (original ? makeId('EPISODE') : undefined);
    const task: Followup = { id: makeId('TASK'), kind: taskDraftKind, observationId: original?.id, episodeId, title, due: due.toISOString(), createdAt: new Date().toISOString(), status: 'open', dataset, synthetic: dataset === 'demo' };
    mutate((current) => ({ ...current, tasks: [task, ...current.tasks], episodes: original && !existingEpisode
      ? [{ id: episodeId!, observationId: original.id, taskId: task.id, resultIds: [], openedAt: new Date().toISOString(), status: 'open', dataset, synthetic: dataset === 'demo' }, ...current.episodes]
      : existingEpisode ? current.episodes.map((episode) => episode.id === existingEpisode.id ? { ...episode, taskId: task.id } : episode) : current.episodes }));
    setTaskFormOpen(false); setTaskDraftObservation(''); setTaskDraftTitle(''); setTaskDraftDue(''); setTaskError(''); notify('Task added to the Care Plan.');
  };

  const completeTask = (task: Followup) => {
    const original = task.observationId ? observations.find((item) => item.id === task.observationId) : undefined;
    const result = task.resultId ? observations.find((item) => item.id === task.resultId) : undefined;
    const comparable = !!original && !!result && isComparable(original, result);
    const note = (taskNotes[task.id] ?? '').trim();
    if (task.kind === 'measurement' && !result) { notify('Record the follow-up measurement before completing this task.'); return; }
    if (!comparable && !note) { notify('Add a note explaining what you reviewed before completing this task.'); return; }
    const completedAt = new Date().toISOString();
    mutate((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status: 'complete', completedAt, completionNote: note || undefined } : item),
      episodes: task.episodeId ? current.episodes.map((episode) => episode.id === task.episodeId ? { ...episode, status: 'reviewed', reviewNote: note || 'Follow-up reviewed under recorded conditions.' } : episode) : current.episodes }));
    notify('Task complete. This does not mean a health concern is resolved.');
  };

  const cancelTask = (task: Followup) => {
    mutate((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status: 'cancelled' } : item) }));
    notify('Task cancelled. Its history remains in Records.');
  };

  const rescheduleTask = (task: Followup) => {
    const value = rescheduleValues[task.id];
    const due = fromDateTimeInput(value ?? toDateTimeInput(task.due, timeZone), timeZone);
    if (!value || Number.isNaN(due.valueOf())) { notify('Choose a new date and time before rescheduling.'); return; }
    mutate((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, due: due.toISOString() } : item) }));
    setRescheduleValues((current) => ({ ...current, [task.id]: '' })); notify('Task schedule updated.');
  };

  const onCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setCsvError('');
    try { setCsvRows(parseCsv(await file.text(), observations)); }
    catch (error) { setCsvRows(null); setCsvError(error instanceof Error ? error.message : 'The selected file could not be read.'); }
  };
  const updateCsvRow = (id: string, field: 'rawMetric' | 'value' | 'unit' | 'at' | 'context' | 'method', value: string) => {
    setCsvRows((rows) => rows ? validateImportRows(rows.map((row) => row.id === id
      ? { ...row, [field]: value, metric: field === 'rawMetric' ? normalizeMetric(value) : row.metric, error: row.error?.startsWith('Row has') ? row.error : '' }
      : row), observations) : rows);
  };
  const downloadBlob = (content: BlobPart, mime: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const downloadTemplate = () => {
    downloadBlob('metric,value,unit,timestamp,context,method\n', 'text/csv', 'tether-measurements-template.csv');
  };
  const commitCsv = () => {
    if (!csvRows) return;
    const good = csvRows.filter((row) => !row.error && !row.duplicate && row.metric);
    if (!good.length) { setCsvError('No valid rows to import. Fix a row or remove it.'); return; }
    const added: Observation[] = good.map((row) => {
      const metric = row.metric!;
      const date = new Date(row.at);
      const pair = metric === 'bp' ? row.value.split('/').map(Number) : undefined;
      const value = metric === 'bp' ? pair![0] : metric === 'mood' ? row.value.trim() : Number(row.value);
      const context = row.context.trim() || 'Not recorded';
      const method = row.method.trim() || 'Not recorded';
      return { id: makeId('CSV'), metric, value, secondary: pair?.[1], unit: METRICS[metric].unit, at: date.toISOString(), context, method,
        note: '', source: 'CSV import', synthetic: dataset === 'demo', dataset, quality: context !== 'Not recorded' && method !== 'Not recorded' ? 'usable' : 'verify', guidanceVersion: GUIDANCE_VERSION };
    });
    mutate((current) => ({ ...current, observations: [...added, ...current.observations], episodes: [...added.map((item) => ({ id: makeId('EPISODE'), observationId: item.id, resultIds: [], openedAt: item.at, status: 'open' as const, dataset, synthetic: dataset === 'demo' })), ...current.episodes] }));
    const skipped = csvRows.length - good.length;
    setCsvRows(null); setCsvError(''); setSelectedMetric(added[0].metric); setSelectedObservation(added[0].id);
    openReview(added[0], 'measurements');
    notify(`${added.length} reading${added.length === 1 ? '' : 's'} imported${skipped ? `; ${skipped} row${skipped === 1 ? '' : 's'} skipped` : ''}.`);
  };

  function startTaskFromToday(task: Followup) {
    if (task.kind === 'measurement' && task.resultId) { const result = observations.find((item) => item.id === task.resultId); if (result) openReview(result); return; }
    openTask(task);
  }

  const markEpisodeReviewed = (episode: ReviewEpisode) => {
    mutate((current) => ({ ...current, episodes: current.episodes.map((item) => item.id === episode.id ? { ...item, status: 'reviewed', reviewNote: item.reviewNote || 'Reading reviewed.' } : item) }));
    notify('Reading review saved.');
  };

  const selectedEventKeys = exportSelection ?? visibleEvents.map((event) => event.key);
  const selectedEvents = visibleEvents.filter((event) => selectedEventKeys.includes(event.key));
  const buildExportPayload = (selectedItems: RecordEvent[], withNotes: boolean): ExportPayload => {
    const chosenObs = selectedItems.filter((event) => event.kind === 'observation').map((event) => event.item as Observation);
    const chosenContexts = selectedItems.filter((event) => event.kind === 'context').map((event) => event.item as ContextEntry);
    const chosenTasks = selectedItems.filter((event) => event.kind === 'task').map((event) => event.item as Followup);
    const relatedEpisodeIds = new Set(selectedItems.map((event) => event.episodeId).filter(Boolean));
    const linkedIds = new Set(chosenObs.map((item) => item.id));
    chosenTasks.forEach((task) => { if (task.observationId) linkedIds.add(task.observationId); if (task.resultId) linkedIds.add(task.resultId); });
    episodes.filter((episode) => relatedEpisodeIds.has(episode.id)).forEach((episode) => {
      linkedIds.add(episode.observationId);
      episode.resultIds.forEach((id) => linkedIds.add(id));
    });
    const includedObservations = observations.filter((item) => linkedIds.has(item.id));
    const includedTasks = [...new Map([...chosenTasks, ...tasks.filter((task) => task.episodeId && relatedEpisodeIds.has(task.episodeId))].map((task) => [task.id, task])).values()];
    const includedContexts = [...new Map([...chosenContexts, ...contexts.filter((item) => item.episodeId && relatedEpisodeIds.has(item.episodeId))].map((item) => [item.id, item])).values()];
    const includedEpisodes = episodes.filter((episode) => relatedEpisodeIds.has(episode.id) || includedObservations.some((item) => item.id === episode.observationId || episode.resultIds.includes(item.id)));
    return { dataset, createdAt: new Date().toISOString(), mission: { environment, startDate: missionStartDate, timeZone: timeZone === 'UTC' ? 'UTC' : Intl.DateTimeFormat().resolvedOptions().timeZone },
      observations: includedObservations.map((item) => withNotes ? item : { ...item, note: '' }),
      contexts: includedContexts.map((item) => withNotes ? item : { ...item, note: '' }),
      tasks: includedTasks.map((item) => withNotes ? item : { ...item, completionNote: undefined }), episodes: includedEpisodes.map((item) => withNotes ? item : { ...item, reviewNote: undefined }), includeNotes: withNotes };
  };
  const exportRecords = (format: 'json' | 'html') => {
    const payload = buildExportPayload(selectedEvents, includeNotes);
    const suffix = 'records';
    if (format === 'json') downloadBlob(JSON.stringify(payload, null, 2), 'application/json', `tether-${suffix}.json`);
    else {
      const rows = payload.observations.map((item) => {
        const sourceVersion = item.synthetic ? escapeHtml(item.guidanceVersion) : `${escapeHtml(item.source)} · ${escapeHtml(item.guidanceVersion)}`;
        return `<tr><td>${escapeHtml(METRICS[item.metric].label)}</td><td>${escapeHtml(formatValue(item))}</td><td>${escapeHtml(formatDateTime(item.at, payload.mission.timeZone))}</td><td>${escapeHtml(item.method)} · ${escapeHtml(item.context)}</td><td>${sourceVersion}</td>${includeNotes ? `<td>${escapeHtml(item.note)}</td>` : ''}</tr>`;
      }).join('');
      const contextRows = payload.contexts.map((item) => `<tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(formatDateTime(item.at, payload.mission.timeZone))}</td>${includeNotes ? `<td>${escapeHtml(item.note)}</td>` : ''}</tr>`).join('');
      const taskRows = payload.tasks.map((item) => `<tr><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(formatDateTime(item.due, payload.mission.timeZone))}</td><td>${item.resultId ? 'Repeat reading recorded' : 'No result recorded'}</td>${includeNotes ? `<td>${escapeHtml(item.completionNote ?? '')}</td>` : ''}</tr>`).join('');
      const episodeRows = payload.episodes.map((item) => `<tr><td>${escapeHtml(item.status)}</td><td>${escapeHtml(formatDateTime(item.openedAt, payload.mission.timeZone))}</td>${includeNotes ? `<td>${escapeHtml(item.reviewNote ?? '')}</td>` : ''}</tr>`).join('');
      const columns = includeNotes ? '<th>Notes</th>' : '';
      const practiceNotice = 'For review; not a diagnosis.';
      const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tether record</title><style>body{font:16px/1.5 Arial,sans-serif;background:#f2f6fb;color:#23334d;max-width:1100px;margin:32px auto;padding:0 20px}main{background:#fff;padding:28px;border:1px solid #dce5f2;border-radius:16px}h1{margin-top:0}p,small{color:#596b85}table{border-collapse:collapse;width:100%;margin:20px 0}th,td{text-align:left;padding:10px;border-bottom:1px solid #dce5f2;vertical-align:top}th{color:#245b83}.notice{padding:12px;border:1px solid #c9d9eb;border-radius:10px;background:#f4f8fc}</style><main><h1>Tether record</h1><p class="notice">${practiceNotice} Notes ${includeNotes ? 'are included' : 'are excluded'}.</p><p>Mission: ${escapeHtml(payload.mission.environment)} · Started ${escapeHtml(payload.mission.startDate)} · ${escapeHtml(payload.mission.timeZone)}</p><p>${payload.observations.length} readings · ${payload.contexts.length} check-ins · ${payload.tasks.length} actions · ${escapeHtml(formatDateTime(payload.createdAt, payload.mission.timeZone))}</p><h2>Readings</h2><table><thead><tr><th>Indicator</th><th>Value</th><th>Time</th><th>Method and conditions</th><th>Source / version</th>${columns}</tr></thead><tbody>${rows}</tbody></table><h2>Check-ins</h2><table><thead><tr><th>Type</th><th>Entry</th><th>Time</th>${columns}</tr></thead><tbody>${contextRows}</tbody></table><h2>Follow-up actions</h2><table><thead><tr><th>Status</th><th>Action</th><th>Scheduled</th><th>Result</th>${columns}</tr></thead><tbody>${taskRows}</tbody></table><h2>Reading reviews</h2><table><thead><tr><th>Status</th><th>Opened</th>${columns}</tr></thead><tbody>${episodeRows}</tbody></table><small>Use your mission medical instructions for health decisions.</small></main></html>`;
      downloadBlob(html, 'text/html', `tether-${suffix}.html`);
    }
    setExportPreviewOpen(false); notify(`${format.toUpperCase()} report ready.`);
  };

  const buildHandoff = (withNotes: boolean) => handoffData ? buildExportPayload(handoffData.observations.map((item) => ({ id: item.id, key: `observation:${item.id}`, kind: 'observation', at: item.at, title: METRICS[item.metric].label, detail: formatValue(item), item, episodeId: activeHandoffEpisode?.id })), withNotes) : null;
  const prepareHandoff = () => {
    if (!activeHandoffEpisode || !handoffData) { setHandoffError('There is no review episode in this dataset to include.'); return; }
    setHandoffError(''); setHandoffPreviewOpen(true);
  };
  const previewPayload = selectedEvents.length ? buildExportPayload(selectedEvents, includeNotes) : null;
  const handoffPreviewPayload = buildHandoff(handoffIncludeNotes);
  const exportHandoff = (format: 'json' | 'html') => {
    const payload = buildHandoff(handoffIncludeNotes);
    if (!payload) return;
    if (format === 'json') downloadBlob(JSON.stringify({ ...payload, purpose: 'Mission handoff draft · not sent' }, null, 2), 'application/json', 'tether-handoff.json');
    else {
      const rows = payload.observations.map((item) => {
        const sourceVersion = item.synthetic ? escapeHtml(item.guidanceVersion) : `${escapeHtml(item.source)} · ${escapeHtml(item.guidanceVersion)}`;
        return `<tr><td>${escapeHtml(METRICS[item.metric].label)}</td><td>${escapeHtml(formatValue(item))}</td><td>${escapeHtml(formatDateTime(item.at, payload.mission.timeZone))}</td><td>${escapeHtml(item.method)} · ${escapeHtml(item.context)}</td><td>${sourceVersion}</td>${handoffIncludeNotes ? `<td>${escapeHtml(item.note)}</td>` : ''}</tr>`;
      }).join('');
      const contextRows = payload.contexts.map((item) => `<tr><td>${escapeHtml(item.kind)}</td><td>${escapeHtml(item.value)}</td><td>${escapeHtml(formatDateTime(item.at, payload.mission.timeZone))}</td>${handoffIncludeNotes ? `<td>${escapeHtml(item.note)}</td>` : ''}</tr>`).join('');
      const noteColumn = handoffIncludeNotes ? '<th>Notes</th>' : '';
      const practiceNotice = 'For review; not a diagnosis.';
      const doc = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Tether handoff</title><style>body{font:16px/1.5 Arial;background:#f2f6fb;color:#23334d;max-width:950px;margin:32px auto;padding:0 20px}main{background:#fff;padding:28px;border:1px solid #dce5f2;border-radius:16px}table{border-collapse:collapse;width:100%;margin:18px 0}td,th{text-align:left;padding:10px;border-bottom:1px solid #dce5f2;vertical-align:top}</style><main><h1>Medical review handoff</h1><p>${practiceNotice} Not sent. Use your mission medical support process.</p><h2>Readings · ${escapeHtml(GUIDANCE_VERSION)}</h2><table><thead><tr><th>Indicator</th><th>Value</th><th>Recorded</th><th>Method and conditions</th><th>Source / version</th>${noteColumn}</tr></thead><tbody>${rows}</tbody></table><h2>Check-ins</h2><table><thead><tr><th>Type</th><th>Entry</th><th>Recorded</th>${noteColumn}</tr></thead><tbody>${contextRows}</tbody></table><h2>Actions</h2><table><thead><tr><th>Status</th><th>Action</th><th>Scheduled</th><th>Outcome</th>${noteColumn}</tr></thead><tbody>${payload.tasks.map((item) => `<tr><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(formatDateTime(item.due, payload.mission.timeZone))}</td><td>${item.resultId ? 'Repeat reading recorded' : 'No result recorded'}</td>${handoffIncludeNotes ? `<td>${escapeHtml(item.completionNote ?? '')}</td>` : ''}</tr>`).join('')}</tbody></table>${handoffIncludeNotes ? `<h2>Review notes</h2><p>${escapeHtml(payload.episodes[0]?.reviewNote ?? '')}</p>` : '<p>Private notes excluded.</p>'}<small>Use your mission medical instructions for health decisions.</small></main></html>`;
      downloadBlob(doc, 'text/html', 'tether-handoff.html');
    }
    setHandoffPreviewOpen(false); notify('Handoff report ready. Nothing was sent.');
  };

  const resetDemo = () => { setWorkspaces((current) => ({ ...current, demo: makeDemoData() })); setResetDemoOpen(false); setDataset('demo'); setSelectedObservation('DEMO-heart-7'); notify('Starting readings restored. Your readings were not changed.'); };
  const setRecordFilter = (setter: (value: string) => void, value: string) => { setter(value); setExportSelection(null); };

  const navLabel = page === 'console' ? 'TODAY' : page === 'history' ? 'HISTORY' : page === 'review' ? 'READING REVIEW' : page === 'medical' ? 'MEDICAL SUPPORT' : page.toUpperCase();

  return <div className={`app-shell tether-shell dark ${compactMotion || systemReducedMotion ? 'reduce-motion' : ''}`} data-page={page}>
    <aside className="sidebar">
      <a className="brand" href="#today" aria-label="Tether Crew Health home" onClick={(event) => { event.preventDefault(); navigate('console'); }}>
        <picture className="brand-logo"><source media="(max-width: 860px)" srcSet="/assets/brand/tether-mark.svg" /><img src="/assets/brand/tether-horizontal.svg" alt="" /></picture>
      </a>
      <div className="side-caption">MISSION WORKSPACE</div>
      <nav className="primary-nav" aria-label="Primary navigation">{NAV.map(([id, label]) => <Button key={id} type="button" variant={page === id ? 'secondary' : 'ghost'} className={`nav-item ${page === id ? 'active' : ''}`} title={label} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><span className="nav-icon"><Icon name={id} /></span><span>{label}</span></Button>)}</nav>
      <div className="utility-links"><div className="side-caption">REFERENCE & CONTROL</div>{(['library', 'settings'] as Page[]).map((id) => { const label = id === 'library' ? 'Reference library' : 'Settings'; return <Button key={id} type="button" variant={page === id ? 'secondary' : 'ghost'} className={`nav-item ${page === id ? 'active' : ''}`} title={label} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><span className="nav-icon"><Icon name={id} /></span><span>{label}</span></Button>; })}</div>
      {showMilo && <button type="button" className="sidebar-milo" onClick={() => navigate('library')} aria-label="Milo measurement help. Open the reference library."><img src="/assets/milo-astronaut-dog.png" alt="" /><span><b>Milo</b><small>Measurement help</small></span><ArrowRight aria-hidden="true" /></button>}
    </aside>

    <div className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>CREW HEALTH</span><span className="crumb-sep">/</span><b>{navLabel}</b></div><div className="top-actions">
        <MissionClock missionDay={missionDay} timeZone={activeTimeZone} />
        <Button type="button" variant="outline" className="support-button" onClick={() => navigate('medical')}><Icon name="medical" /> Medical support</Button>
      </div></header>

      <main className="content-wrap">
        {page === 'console' && <TodayView metrics={METRICS} metricOrder={METRIC_ORDER} observations={observations} contexts={contexts} tasks={tasks} assessments={assessments}
          selectedMetric={selectedMetric} selectedStructure={selectedStructure}
          environment={environment} missionDay={missionDay} timeZone={activeTimeZone ?? ''} reducedMotion={compactMotion || systemReducedMotion}
          rangeDays={consoleRange} onRangeChange={setConsoleRange}
          onSelectMetric={(metric) => { setSelectedMetric(metric); setSelectedObservation(latestForMetric(observations, metric)?.id ?? ''); }} onStructure={setSelectedStructure}
          onReview={(item) => openReview(item, 'console')} onAdd={(metric, taskId) => startMeasurement(metric, taskId)}
          onTask={startTaskFromToday} onCare={() => navigate('care')} />}

        {page === 'measurements' && <section className="page-view measurements-page">
          <PageHeading title="Measurements" description="See what a reading means, then record it."
            actions={<Button onClick={() => startMeasurement()}><Plus data-icon="inline-start" /> Add measurement</Button>} />
          <div className="measurement-grid">{METRIC_ORDER.map((metric) => {
            const item = latestForMetric(observations, metric);
            return <Card className="measurement-option" key={metric}>
              <CardHeader><div className="measurement-card-title"><MetricGlyph name={metric} /><div><CardDescription>{METRICS[metric].unit || 'Self report'}</CardDescription><CardTitle>{METRICS[metric].label}</CardTitle></div></div></CardHeader>
              <CardContent><p>{METRICS[metric].meaning}</p><div className="measurement-latest"><span>Last reading</span><strong>{item ? formatValue(item) : 'No reading yet'}</strong><small>{item ? `${fullDate(item.at, activeTimeZone)} · ${item.method}` : 'Add the first reading.'}</small></div>
                <Button onClick={() => startMeasurement(metric)}>{item ? 'Record another' : 'Record measurement'}<ArrowRight data-icon="inline-end" /></Button>
              </CardContent>
            </Card>;
          })}</div>
          <div className="context-capture-section">
            <div className="section-heading"><div><h2>Optional check-ins</h2></div></div>
            <div className="context-action-row">{CONTEXT_KINDS.map((kind) => <Button key={kind} variant="outline" onClick={() => startContext(kind)}>{kind === 'sleep quality' ? <SunMedium data-icon="inline-start" /> : <Plus data-icon="inline-start" />}{kind[0].toUpperCase() + kind.slice(1)}</Button>)}</div>
          </div>
          <Card className="csv-import-card"><CardHeader><div><CardDescription>OPTIONAL BULK ENTRY</CardDescription><CardTitle>Import a CSV</CardTitle></div></CardHeader><CardContent>
            <p>Check each row before saving. Different-time readings are kept.</p>
            <div className="csv-actions"><Button variant="outline" onClick={downloadTemplate}><ArrowDownToLine data-icon="inline-start" /> Download template</Button><Button variant="outline" onClick={() => fileInput.current?.click()}><Upload data-icon="inline-start" /> Choose CSV file</Button>
              <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={onCsvFile} hidden aria-label="Choose a CSV file" /></div>
            {csvError && <Alert variant="destructive" role="alert"><Info aria-hidden="true" /><AlertTitle>Import needs attention</AlertTitle><AlertDescription>{csvError}</AlertDescription></Alert>}
            {csvRows && <div className="csv-preview"><div className="csv-preview-head"><div><h3>Review import rows</h3><p>{csvRows.filter((row) => !row.error && !row.duplicate).length} ready · {csvRows.filter((row) => row.error).length} need edits · {csvRows.filter((row) => row.duplicate).length} duplicates</p></div><Button variant="ghost" size="icon-sm" aria-label="Close CSV preview" onClick={() => setCsvRows(null)}><X /></Button></div>
              <div className="csv-preview-table-wrap"><Table><TableHeader><TableRow><TableHead>Indicator</TableHead><TableHead>Value</TableHead><TableHead>Unit</TableHead><TableHead>Timestamp</TableHead><TableHead>Context</TableHead><TableHead>Method</TableHead><TableHead>Row status</TableHead><TableHead>Remove</TableHead></TableRow></TableHeader>
      <TableBody>{csvRows.map((row) => <TableRow key={row.id} data-invalid={row.error || row.duplicate || undefined}>
                  <TableCell><Input aria-label="Indicator" value={row.rawMetric} onChange={(event) => updateCsvRow(row.id, 'rawMetric', event.target.value)} placeholder="heart rate" /></TableCell>
                  <TableCell><Input aria-label="Value" value={row.value} onChange={(event) => updateCsvRow(row.id, 'value', event.target.value)} /></TableCell>
                  <TableCell><Input aria-label="Unit" value={row.unit} onChange={(event) => updateCsvRow(row.id, 'unit', event.target.value)} /></TableCell>
                  <TableCell><Input aria-label="Timestamp" value={row.at} onChange={(event) => updateCsvRow(row.id, 'at', event.target.value)} /></TableCell>
                  <TableCell><Input aria-label="Context" value={row.context} onChange={(event) => updateCsvRow(row.id, 'context', event.target.value)} /></TableCell>
                  <TableCell><Input aria-label="Method" value={row.method} onChange={(event) => updateCsvRow(row.id, 'method', event.target.value)} /></TableCell>
                  <TableCell>{row.error ? <Badge variant="attention">{row.error}</Badge> : row.duplicate ? <Badge variant="outline">Duplicate · skipped</Badge> : <Badge variant="secondary">Ready</Badge>}</TableCell>
                  <TableCell><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove row from this import" onClick={() => setCsvRows((rows) => rows ? validateImportRows(rows.filter((item) => item.id !== row.id), observations) : rows)}><X aria-hidden="true" /></Button></TableCell>
                </TableRow>)}</TableBody>
              </Table></div>
              <div className="csv-confirm-row"><small>Invalid rows and duplicates are skipped; valid rows can still be imported.</small><Button onClick={commitCsv} disabled={!csvRows.some((row) => !row.error && !row.duplicate && row.metric)}><Check data-icon="inline-start" /> Import valid rows</Button></div>
            </div>}
          </CardContent></Card>
        </section>}

        {page === 'history' && historyView === 'chart' && <section className="page-view trends-page history-page">
          <PageHeading title="History" description="Review readings, patterns, and the conditions around them."
            actions={<div className="trend-filters">
              <Select value={selectedMetric} onValueChange={(value) => value && setSelectedMetric(value as Metric)}>
                <SelectTrigger aria-label="Select indicator"><SelectValue>{METRICS[selectedMetric].label}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{METRIC_ORDER.map((metric) => <SelectItem key={metric} value={metric}>{METRICS[metric].label}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
              <div className="range-switch" aria-label="Trend time period"><Button variant={range === 7 ? 'secondary' : 'ghost'} aria-pressed={range === 7} onClick={() => setRange(7)}>7 days</Button><Button variant={range === 30 ? 'secondary' : 'ghost'} aria-pressed={range === 30} onClick={() => setRange(30)}>30 days</Button></div>
              <div className="history-view-toggle" role="group" aria-label="History view"><Button variant="secondary" aria-pressed="true">Chart</Button><Button variant="ghost" aria-pressed="false" onClick={() => setHistoryView('timeline')}>Timeline</Button></div>
            </div>} />
          <Card className="trend-chart-card"><CardHeader><div><CardDescription>{range} days · {trendRows.length} readings</CardDescription><CardTitle>{METRICS[selectedMetric].label}</CardTitle></div><Badge variant="outline">{METRICS[selectedMetric].unit || 'Self-rating'}</Badge></CardHeader>
            <CardContent><ObservationChart observations={trendRows} metric={selectedMetric} timeZone={activeTimeZone} onSelect={(item) => openReview(item, 'history')} />
              <div className="trend-legend-note">Each point is one reading. Gaps show days without readings.</div>
            </CardContent></Card>
          <div className="section-heading"><div><h2>Readings</h2><p>Each value keeps its method and conditions.</p></div><Badge variant="secondary">{trendRows.length}</Badge></div>
          <div className="trend-observation-table"><Table><TableHeader><TableRow><TableHead>Date and time</TableHead><TableHead>Reading</TableHead><TableHead>Method and conditions</TableHead><TableHead>Check</TableHead><TableHead /></TableRow></TableHeader><TableBody>
            {[...trendRows].reverse().map((item) => { const result = assessObservation(item, dataset, now); return <TableRow key={item.id}><TableCell>{fullDate(item.at, activeTimeZone)} · {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: activeTimeZone }).format(new Date(item.at))}</TableCell><TableCell><div className="table-reading"><MetricGlyph name={item.metric} /><strong>{formatValue(item)}</strong></div></TableCell><TableCell>{item.method} · {item.context}</TableCell><TableCell><Badge variant={result.state === 'within' ? 'secondary' : result.state === 'urgent' || result.state === 'attention' || result.state === 'verify' ? 'attention' : 'outline'}>{result.label}</Badge></TableCell><TableCell><Button size="sm" variant="ghost" onClick={() => openReview(item, 'history')}>Open<ArrowRight data-icon="inline-end" /></Button></TableCell></TableRow>; })}
            {!trendRows.length && <TableRow><TableCell colSpan={5}>No readings in this period.</TableCell></TableRow>}
          </TableBody></Table></div>
          <div className="section-heading context-events-heading"><div><h2>Related check-ins</h2></div></div>
          {contexts.filter((item) => new Date(item.at).getTime() >= trendStart && new Date(item.at).getTime() <= now).length
            ? contexts.filter((item) => new Date(item.at).getTime() >= trendStart && new Date(item.at).getTime() <= now).sort((a, b) => b.at.localeCompare(a.at)).map((item) => <div className="context-timeline-row" key={item.id}><span>{fullDate(item.at, activeTimeZone)}</span><strong>{item.kind}</strong><span>{item.value}</span></div>)
            : <p className="muted-empty-copy">No check-ins in this period.</p>}
        </section>}

        {page === 'review' && <section className="page-view review-page">
          <div className="review-page-heading"><Button variant="ghost" onClick={returnFromReview}><ArrowLeft data-icon="inline-start" /> Back to {returnPage === 'console' ? 'Today' : returnPage === 'care' ? 'Care Plan' : returnPage === 'history' ? 'History' : returnPage[0].toUpperCase() + returnPage.slice(1)}</Button>
            <div><h1>Reading review</h1><p className="subtitle">What it means. What to do next.</p></div>
          </div>
          {selected ? <div className="review-layout">
            <Card className="review-evidence-card"><CardHeader><div className="review-selected-label"><MetricGlyph name={selected.metric} /><div><CardDescription>Selected reading</CardDescription><CardTitle>{METRICS[selected.metric].label}</CardTitle></div></div>{selectedReadingAssessment && <Badge variant={selectedReadingAssessment.state === 'within' ? 'secondary' : ['urgent', 'attention', 'verify'].includes(selectedReadingAssessment.state) ? 'attention' : 'outline'}>{selectedReadingAssessment.label}</Badge>}</CardHeader>
              <CardContent>
                <div className="review-value-row"><strong>{formatValue(selected)}</strong><span>{fullDate(selected.at, activeTimeZone)} · {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: activeTimeZone }).format(new Date(selected.at))}</span></div>
                {selectedReadingAssessment && <p className={`review-assessment-reason assessment-${selectedReadingAssessment.state}`}>{selectedReadingAssessment.reason}</p>}
                <p className="review-meaning">{METRICS[selected.metric].meaning}</p>
                <div className="review-fact-grid"><div><span>How you measured</span><b>{selected.method}</b></div><div><span>Conditions</span><b>{selected.context}</b></div>{!selected.synthetic && <div><span>Source</span><b>{selected.source}</b></div>}</div>
                {selected.quality === 'verify' && <Alert className="review-quality-alert"><Info aria-hidden="true" /><AlertTitle>Check how this was measured</AlertTitle><AlertDescription>{selected.note || 'The method or conditions are missing. This affects comparisons.'}</AlertDescription></Alert>}
                {reviewOriginal && reviewResult && <section className="review-pair-section"><h2>Original and repeat</h2><div className="review-pair-grid"><div><span>Original</span><strong>{formatValue(reviewOriginal)}</strong><small>{fullDate(reviewOriginal.at, activeTimeZone)} · {localStamp(reviewOriginal.at, false, activeTimeZone)} · {reviewOriginal.method} · {reviewOriginal.context}</small></div><div><span>Repeat</span><strong>{formatValue(reviewResult)}</strong><small>{fullDate(reviewResult.at, activeTimeZone)} · {localStamp(reviewResult.at, false, activeTimeZone)} · {reviewResult.method} · {reviewResult.context}</small></div></div>
                  <p>{isComparable(reviewOriginal, reviewResult) ? 'Method and conditions match. Compare the values descriptively.' : 'Method or conditions differ or are unknown. Keep both readings, but do not compare them directly.'}</p>
                  <Button variant="outline" onClick={() => openPageCareTask(reviewTask)}>Review task in Care Plan<ArrowRight data-icon="inline-end" /></Button>
                </section>}
                <section className="review-comparison-section"><div><h2>Earlier readings</h2><p>Same method and conditions · past {rangeComparison?.days ?? 7} days.</p></div>
                  {rangeComparison && <><p className="comparison-description">{rangeComparison.comparison}</p><small>{rangeComparison.count} similar reading{rangeComparison.count === 1 ? '' : 's'} · past {rangeComparison.days} days</small>
                    {rangeComparison.previous && <Button variant="ghost" size="sm" onClick={() => openReview(rangeComparison.previous!, 'review')}>Open earlier reading<ArrowRight data-icon="inline-end" /></Button>}</>}
                </section>
                <ObservationChart observations={observations.filter((item) => item.metric === selected.metric && new Date(item.at).getTime() >= new Date(selected.at).getTime() - 7 * 86400000 && new Date(item.at).getTime() <= new Date(selected.at).getTime() + 7 * 86400000).sort((a, b) => a.at.localeCompare(b.at))} metric={selected.metric} timeZone={activeTimeZone} onSelect={(item) => openReview(item, 'review')} />
                <details className="review-source-details"><summary>More about this reading</summary><p><b>Why:</b> {METRICS[selected.metric].why}</p><p><b>How to measure:</b> {METRICS[selected.metric].how}</p><p><b>What it cannot tell you:</b> {METRICS[selected.metric].cannot}</p>{selectedReadingAssessment?.rule && <p><b>Configured check:</b> {selectedReadingAssessment.rule.source} · version {selectedReadingAssessment.rule.version}. {selectedReadingAssessment.rule.reviewStatus === 'practice-only' ? 'Illustrative; not an approved astronaut limit.' : 'Reviewed.'}</p>}<p><b>Source:</b> <a href={METRICS[selected.metric].sourceUrl} target="_blank" rel="noreferrer">{METRICS[selected.metric].source}</a></p><small>{selected.guidanceVersion} · {GUIDANCE_REVIEW_STATUS}</small></details>
              </CardContent>
            </Card>
            <aside className="review-action-column">
              <Card><CardHeader><CardDescription>Next action</CardDescription><CardTitle>{reviewTask?.status === 'complete' ? 'Follow-up complete' : reviewTask?.status === 'open' && reviewTask.resultId ? 'Review repeat reading' : selectedReadingAssessment?.state === 'attention' || selectedReadingAssessment?.state === 'urgent' ? 'Repeat this reading' : selectedReadingAssessment?.state === 'verify' ? 'Check the conditions' : 'Plan the next check'}</CardTitle></CardHeader>
                <CardContent className="review-action-content">
                  <p>{reviewTask?.status === 'complete' ? 'The follow-up was reviewed. That does not confirm a health concern has resolved.' : selectedReadingAssessment?.state === 'verify' ? 'Follow the device instructions. Record the method and conditions you used.' : selectedReadingAssessment?.rule?.reviewStatus === 'practice-only' ? 'This configured rule is illustrative only; repeat and review the reading under the recorded conditions.' : METRICS[selected.metric].how}</p>
                  {reviewTask?.status === 'open' && !reviewTask.resultId && <Button onClick={() => startMeasurement(selected.metric, reviewTask.id)}><RotateCcw data-icon="inline-start" /> Record repeat</Button>}
                  {reviewTask?.status === 'open' && reviewTask.resultId && <Button onClick={() => openPageCareTask(reviewTask)}>Review and complete follow-up<ArrowRight data-icon="inline-end" /></Button>}
                  {(!reviewTask || reviewTask.status === 'cancelled') && (selectedReadingAssessment && ['attention', 'urgent', 'verify', 'stale'].includes(selectedReadingAssessment.state)
                    ? <Button onClick={() => startMeasurement(selected.metric)}><RotateCcw data-icon="inline-start" /> Record repeat</Button>
                    : <Button onClick={() => openTaskComposer(selected)}><CalendarClock data-icon="inline-start" /> Schedule follow-up</Button>)}
                  <Button variant="ghost" onClick={() => navigate('library')}><CircleHelp data-icon="inline-start" /> Open reference guide</Button>
                  {reviewEpisode && reviewEpisode.status === 'open' && !(reviewTask?.status === 'open' && reviewTask.kind === 'measurement') && <Button variant="outline" onClick={() => markEpisodeReviewed(reviewEpisode)}><Check data-icon="inline-start" /> Mark reading reviewed</Button>}
                  <small>Differences show what changed; they do not explain why.</small>
                </CardContent></Card>
            </aside>
          </div> : <Empty><EmptyHeader><EmptyTitle>No reading selected</EmptyTitle><EmptyDescription>Choose a reading from Today or History.</EmptyDescription></EmptyHeader><Button onClick={returnFromReview}>Return to {returnPage}</Button></Empty>}
        </section>}

        {page === 'care' && <section className="page-view care-page">
          <PageHeading title="Care Plan" description="Review tasks and record what happened."
            actions={<Button onClick={() => { setTaskDraftKind('routine'); setTaskDraftObservation(''); setTaskDraftTitle(''); setTaskDraftDue(''); setTaskError(''); setTaskFormOpen(true); }}><Plus data-icon="inline-start" /> Add task</Button>} />
          <Alert className="care-guidance-boundary"><Info aria-hidden="true" /><AlertTitle>Completing a task doesn’t clear a health concern</AlertTitle><AlertDescription>Follow your mission’s medical instructions for health decisions.</AlertDescription></Alert>
          {taskFormOpen && <Card className="task-create-card"><CardHeader><CardTitle>Schedule an action</CardTitle><CardDescription>Choose the task and its time.</CardDescription></CardHeader><CardContent>
            <form className="task-create-form" onSubmit={createTask}><FieldGroup>
              <Field><FieldLabel htmlFor="task-kind">Task type</FieldLabel><Select value={taskDraftKind} onValueChange={(value) => { if (value) { setTaskDraftKind(value as TaskKind); if (value === 'routine') setTaskDraftObservation(''); } }}><SelectTrigger id="task-kind"><SelectValue>{taskDraftKind === 'measurement' ? 'Measurement follow-up' : 'Routine action'}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="measurement">Measurement follow-up</SelectItem><SelectItem value="routine">Routine action</SelectItem></SelectGroup></SelectContent></Select></Field>
              <Field><FieldLabel htmlFor="task-title">Action</FieldLabel><Input id="task-title" value={taskDraftTitle} onChange={(event) => setTaskDraftTitle(event.target.value)} placeholder="What needs to be done?" required /></Field>
              <Field><FieldLabel htmlFor="task-due">Schedule for</FieldLabel><Input id="task-due" type="datetime-local" value={taskDraftDue} onChange={(event) => setTaskDraftDue(event.target.value)} required /></Field>
              {taskDraftKind === 'measurement' && <Field><FieldLabel htmlFor="task-observation">Original reading</FieldLabel><Select value={taskDraftObservation || null} onValueChange={(value) => setTaskDraftObservation(value ?? '')}><SelectTrigger id="task-observation" aria-required="true"><SelectValue placeholder="Choose a reading to repeat">{selectedTaskObservation ? `${METRICS[selectedTaskObservation.metric].short} · ${formatValue(selectedTaskObservation)} · ${fullDate(selectedTaskObservation.at, activeTimeZone)}` : undefined}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{observations.map((item) => <SelectItem key={item.id} value={item.id}>{METRICS[item.metric].short} · {formatValue(item)} · {fullDate(item.at, activeTimeZone)}</SelectItem>)}</SelectGroup></SelectContent></Select><small>The repeat will stay linked to this reading.</small></Field>}
            </FieldGroup>
              {taskError && <Alert variant="destructive" role="alert"><Info aria-hidden="true" /><AlertDescription>{taskError}</AlertDescription></Alert>}
              <div className="task-form-actions"><Button type="submit"><Check data-icon="inline-start" /> Save task</Button><Button type="button" variant="outline" onClick={() => setTaskFormOpen(false)}>Cancel</Button></div>
            </form>
          </CardContent></Card>}
          <div className="care-section-heading"><h2>Pending</h2><Badge variant="secondary">{openTasks.length}</Badge></div>
          {openTasks.length ? <div className="care-task-list">{openTasks.map((task) => {
            const original = task.observationId ? observations.find((item) => item.id === task.observationId) : undefined;
            const result = task.resultId ? observations.find((item) => item.id === task.resultId) : undefined;
            const comparable = !!original && !!result && isComparable(original, result);
            const originalAssessment = original ? assessObservation(original, dataset, now) : undefined;
            const resultAssessment = result ? assessObservation(result, dataset, now) : undefined;
            const taskDue = new Date(task.due).getTime();
            return <article id={`care-task-${task.id}`} className="care-task-row" key={task.id}>
              <div className="care-task-main"><span className="task-kind-mark">{task.kind === 'measurement' ? <MetricGlyph name={original?.metric ?? selectedMetric} /> : <Activity aria-hidden="true" />}</span><div><div className="care-task-title-line"><h3>{task.title}</h3><Badge variant={taskDue < now ? 'attention' : 'secondary'}>{taskDue < now ? 'Overdue' : 'Upcoming'}</Badge></div><p>{formatDateTime(task.due, activeTimeZone)} · {task.kind === 'measurement' ? 'Repeat reading' : 'Routine task'}</p>
                {original && <p>Original · {METRICS[original.metric].short} · {formatValue(original)} · {fullDate(original.at, activeTimeZone)} · {original.context} · {originalAssessment?.label}</p>}
                {result && <div className="task-result-pair"><div><span>Original</span><b>{original ? formatValue(original) : 'Not recorded'}</b></div><div><span>Repeat</span><b>{formatValue(result)}</b></div>{resultAssessment && <Badge variant={resultAssessment.state === 'within' ? 'secondary' : ['attention', 'urgent', 'verify'].includes(resultAssessment.state) ? 'attention' : 'outline'}>{resultAssessment.label}</Badge>}<Badge variant={comparable ? 'secondary' : 'attention'}>{comparable ? 'Conditions match' : 'Method or conditions differ'}</Badge><Button variant="ghost" size="sm" onClick={() => openReview(result, 'care')}>Review readings<ArrowRight data-icon="inline-end" /></Button></div>}
              </div></div>
              <div className="care-task-actions">
                {task.kind === 'measurement' && <Button onClick={() => result ? openReview(result, 'care') : startMeasurement(original?.metric ?? selectedMetric, task.id)}>{result ? 'Review repeat' : 'Record follow-up'}<ArrowRight data-icon="inline-end" /></Button>}
                <Field><FieldLabel htmlFor={`task-note-${task.id}`}>{task.kind === 'routine' || (result && !comparable) ? 'Review note (required)' : 'Note (optional)'}</FieldLabel><textarea id={`task-note-${task.id}`} value={taskNotes[task.id] ?? ''} onChange={(event) => setTaskNotes((current) => ({ ...current, [task.id]: event.target.value }))} rows={2} placeholder="What did you review or do?" /></Field>
                <Button variant="outline" disabled={(task.kind === 'measurement' && !result) || ((!comparable || task.kind === 'routine') && !(taskNotes[task.id] ?? '').trim())} onClick={() => completeTask(task)}><Check data-icon="inline-start" /> Mark action complete</Button>
                <details className="task-reschedule"><summary>Change schedule</summary><div><Input aria-label={`New schedule for ${task.title}`} type="datetime-local" value={rescheduleValues[task.id] || toDateTimeInput(task.due, timeZone)} onChange={(event) => setRescheduleValues((current) => ({ ...current, [task.id]: event.target.value }))} /><Button size="sm" variant="outline" onClick={() => rescheduleTask(task)}>Save time</Button></div></details>
                <Button variant="ghost" size="sm" onClick={() => cancelTask(task)}>Cancel task</Button>
              </div>
            </article>;
          })}</div> : <Empty className="task-empty"><EmptyHeader><EmptyTitle>Nothing to do</EmptyTitle><EmptyDescription>Add a reminder when it’s useful.</EmptyDescription></EmptyHeader><Button onClick={() => { setTaskDraftKind('routine'); setTaskDraftTitle(''); setTaskDraftDue(''); setTaskFormOpen(true); }}>Add a task<Plus data-icon="inline-start" /></Button></Empty>}
          <div className="care-section-heading"><h2>Completed</h2><Badge variant="outline">{tasks.filter((task) => task.status === 'complete').length}</Badge></div>
          {tasks.filter((task) => task.status === 'complete').length ? <div className="completed-task-list">{tasks.filter((task) => task.status === 'complete').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).map((task) => <div className="completed-task-row" key={task.id}><Check aria-hidden="true" /><span><strong>{task.title}</strong><small>Done · {task.completedAt ? formatDateTime(task.completedAt, activeTimeZone) : ''}{task.completionNote ? ` · ${task.completionNote}` : ''}</small></span>{task.resultId && <Button variant="ghost" size="sm" onClick={() => { const result = observations.find((item) => item.id === task.resultId); if (result) openReview(result, 'care'); }}>Review readings<ArrowRight data-icon="inline-end" /></Button>}</div>)}</div> : <p className="muted-empty-copy">No completed tasks yet.</p>}
          <section className="care-reference-link"><h2>Mission guidance</h2><p>No mission treatment procedure is loaded.</p><Button variant="outline" onClick={() => navigate('library')}>Browse references<ArrowRight data-icon="inline-end" /></Button></section>
        </section>}

        {page === 'history' && historyView === 'timeline' && <section className="page-view records-page history-page">
          <PageHeading title="History" description="Find readings and actions, then choose what to share." actions={<div className="history-heading-actions"><div className="history-view-toggle" role="group" aria-label="History view"><Button variant="ghost" aria-pressed="false" onClick={() => setHistoryView('chart')}>Chart</Button><Button variant="secondary" aria-pressed="true">Timeline</Button></div><Button onClick={() => { setIncludeNotes(false); setExportPreviewOpen(true); }}><FileText data-icon="inline-start" /> Prepare export</Button></div>} />
          <div className="records-filter-bar">
            <div className="record-search-wrap"><Search aria-hidden="true" /><Input aria-label="Search records" value={search} onChange={(event) => setRecordFilter(setSearch, event.target.value)} placeholder="Search values, conditions, methods…" /></div>
            <Select value={recordMetric} onValueChange={(value) => setRecordFilter(setRecordMetric, value ?? 'all')}><SelectTrigger aria-label="Filter by indicator"><SelectValue>{recordMetric === 'all' ? 'All indicators' : METRICS[recordMetric as Metric].label}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All indicators</SelectItem>{METRIC_ORDER.map((metric) => <SelectItem key={metric} value={metric}>{METRICS[metric].label}</SelectItem>)}</SelectGroup></SelectContent></Select>
            <Input aria-label="From date" type="date" value={recordFrom} onChange={(event) => setRecordFilter(setRecordFrom, event.target.value)} /><Input aria-label="To date" type="date" value={recordTo} onChange={(event) => setRecordFilter(setRecordTo, event.target.value)} />
            <Select value={recordEpisode} onValueChange={(value) => setRecordFilter(setRecordEpisode, value ?? 'all')}><SelectTrigger aria-label="Filter by follow-up"><SelectValue>{selectedRecordEpisode ? `${METRICS[selectedRecordEpisodeOriginal?.metric ?? 'heart'].short} · ${fullDate(selectedRecordEpisode.openedAt, activeTimeZone)}` : 'All follow-ups'}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">All follow-ups</SelectItem>{episodes.map((episode) => <SelectItem key={episode.id} value={episode.id}>{METRICS[observations.find((item) => item.id === episode.observationId)?.metric ?? 'heart'].short} · {fullDate(episode.openedAt, activeTimeZone)}</SelectItem>)}</SelectGroup></SelectContent></Select>
          </div>
          <div className="record-selection-summary"><span>{visibleEvents.length} records</span><span>{selectedEventKeys.filter((key) => visibleEvents.some((event) => event.key === key)).length} selected</span><Button variant="ghost" size="sm" onClick={() => setExportSelection(visibleEvents.map((event) => event.key))}>Select all shown</Button><Button variant="ghost" size="sm" onClick={() => setExportSelection([])}>Clear</Button></div>
          {visibleEvents.length ? <div className="record-timeline">{visibleEvents.map((event) => { const readingAssessment = event.kind === 'observation' ? assessObservation(event.item as Observation, dataset, now) : undefined; return <article className="record-event" key={event.key}>
            <input aria-label={`Include ${event.title} in export`} type="checkbox" checked={selectedEventKeys.includes(event.key)} onChange={(change) => setExportSelection((current) => { const selectedKeys = new Set(current ?? visibleEvents.map((item) => item.key)); if (change.target.checked) selectedKeys.add(event.key); else selectedKeys.delete(event.key); return [...selectedKeys]; })} />
            <span className="record-event-marker" aria-hidden="true">{event.kind === 'observation' ? <MetricGlyph name={(event.item as Observation).metric} /> : event.kind === 'context' ? <SunMedium /> : <CalendarClock />}</span>
            <div><h2>{event.title}</h2><p>{event.detail}</p>{readingAssessment && ['urgent', 'attention', 'verify', 'stale'].includes(readingAssessment.state) && <Badge variant={readingAssessment.state === 'urgent' ? 'destructive' : 'attention'}>{readingAssessment.label}</Badge>}</div>
            <time>{fullDate(event.at, activeTimeZone)} · {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: activeTimeZone }).format(new Date(event.at))}</time>
            {event.kind === 'observation' && <Button variant="ghost" size="sm" onClick={() => openReview(event.item as Observation, 'history')}>Review<ArrowRight data-icon="inline-end" /></Button>}
          </article>; })}</div> : <Empty><EmptyHeader><EmptyTitle>No matching records</EmptyTitle><EmptyDescription>Change the filters or add a measurement.</EmptyDescription></EmptyHeader></Empty>}
          <p className="session-note">Private notes stay out unless you include them.</p>
        </section>}

        {page === 'library' && <section className="page-view library-page">
          <PageHeading title="Reference Library" description="Guides, spaceflight hazards, limits, and sources." />
          <div className="library-search-wrap"><Search aria-hidden="true" /><Input aria-label="Search reference library" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Search indicators and spaceflight hazards…" /></div>
          <section className="library-section"><h2>Five hazards of human spaceflight</h2><p className="library-section-intro">NASA’s hazards, with Tether’s available readings and limits.</p>
            <div className="hazard-list">{libraryHazards.map((hazard) => <article className="hazard-entry" key={hazard.key}><span className="hazard-entry-icon"><HazardGlyph name={hazard.key} /></span><div><h3>{hazard.name}</h3><p>{hazard.text}</p><small>{hazard.limit}</small></div></article>)}</div>
            {!libraryHazards.length && <p className="library-empty">No hazards match “{librarySearch}”. <Button variant="ghost" size="sm" onClick={() => setLibrarySearch('')}>Clear search</Button></p>}
            <a className="library-source-link" href="https://www.nasa.gov/hrp/hazards/" target="_blank" rel="noreferrer">NASA Human Research Program · Five hazards <ArrowRight aria-hidden="true" /></a>
          </section>
          <section className="library-section"><h2>Measurement guides</h2><p className="library-section-intro">Why to measure, how to record, and what it cannot show.</p>
            <div className="guide-list">{libraryGuides.map((metric) => <details className="guide-entry" key={metric}><summary><MetricGlyph name={metric} /><span>{METRICS[metric].label}</span><Badge variant="outline">{METRICS[metric].unit || 'Self report'}</Badge></summary><div className="guide-entry-content"><p><b>Why measure:</b> {METRICS[metric].why}</p><p><b>How to record:</b> {METRICS[metric].how}</p><p><b>Limits:</b> {METRICS[metric].cannot}</p><p><b>Mission procedure:</b> Not reviewed.</p><a href={METRICS[metric].sourceUrl} target="_blank" rel="noreferrer">{METRICS[metric].source} <ArrowRight aria-hidden="true" /></a><small>{GUIDANCE_VERSION} · {GUIDANCE_REVIEW_STATUS}</small></div></details>)}</div>
            {!libraryGuides.length && <p className="library-empty">No measurement guides match “{librarySearch}”. <Button variant="ghost" size="sm" onClick={() => setLibrarySearch('')}>Clear search</Button></p>}
            <a className="library-source-link" href="https://www.nasa.gov/hhp/human-system-risks/" target="_blank" rel="noreferrer">NASA Human System Risks · background only (not a measurement procedure) <ArrowRight aria-hidden="true" /></a>
          </section>
          <section className="library-section"><h2>Body systems</h2><p className="library-section-intro">The body model shows location, not health.</p><div className="body-system-list">{libraryBodySystems.map((item) => <article key={item.name}><strong>{item.name}</strong><span>{item.text}</span><small>Related readings: {item.metrics.length ? item.metrics.map((metric) => METRICS[metric].short).join(' · ') : 'Not assessed'}</small><div><a href={item.url} target="_blank" rel="noreferrer">{item.source} <ArrowRight aria-hidden="true" /></a><small>{GUIDANCE_VERSION} · {GUIDANCE_REVIEW_STATUS}</small></div></article>)}</div>{!libraryBodySystems.length && <p className="library-empty">No body systems match “{librarySearch}”. <Button variant="ghost" size="sm" onClick={() => setLibrarySearch('')}>Clear search</Button></p>}</section>
          <p className="session-note">Educational background only. No reviewed mission procedures are available.</p>
        </section>}

        {page === 'settings' && <section className="page-view settings-page">
          <PageHeading title="Settings" description="Mission setup and display." />
          <div className="settings-list">
            <section className="settings-group"><h2>Mission context</h2>
              <FieldGroup>
                {dataset === 'personal' && <Field><FieldLabel htmlFor="profile-name">Crew name (optional)</FieldLabel><Input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your name" /></Field>}
                <Field><FieldLabel htmlFor="mission-environment">Mission environment</FieldLabel><Select value={environment} onValueChange={(value) => value && setEnvironment(value)}><SelectTrigger id="mission-environment"><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{['Spacecraft', 'Space station', 'Lunar rover', 'Surface base'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectGroup></SelectContent></Select><small>Included in reports. No environment sensor is connected.</small></Field>
                <Field><FieldLabel htmlFor="mission-start">Mission start date</FieldLabel><Input id="mission-start" type="date" value={missionStartDate} onChange={(event) => setMissionStartDate(event.target.value)} /><small>Sets the mission day shown on Today.</small></Field>
                <Field><FieldLabel htmlFor="mission-time-zone">Displayed time zone</FieldLabel><Select value={timeZone} onValueChange={(value) => value && setTimeZone(value)}><SelectTrigger id="mission-time-zone"><SelectValue>{timeZone === 'UTC' ? 'UTC' : `Device time · ${Intl.DateTimeFormat().resolvedOptions().timeZone}`}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Local device">Device time · {Intl.DateTimeFormat().resolvedOptions().timeZone}</SelectItem><SelectItem value="UTC">UTC</SelectItem></SelectGroup></SelectContent></Select><small>Used for displayed and new reading times.</small></Field>
              </FieldGroup>
            </section>
            <section className="settings-group"><h2>Interface</h2>
              <label className="settings-toggle-row" htmlFor="reminder-prompts"><span><b>Reminders on Today</b><small>Show an in-app reminder when a follow-up is due. Tether must be open.</small></span><Switch id="reminder-prompts" checked={reminders} onCheckedChange={setReminders} aria-label="Reminder prompts on Today" /></label>
              <label className="settings-toggle-row" htmlFor="reduce-motion"><span><b>Reduce motion</b><small>Limit page and camera transitions.</small></span><Switch id="reduce-motion" checked={compactMotion} onCheckedChange={setCompactMotion} aria-label="Reduce motion" /></label>
              <label className="settings-toggle-row" htmlFor="show-milo"><span><b>Milo helper</b><small>Show Milo in the navigation rail.</small></span><Switch id="show-milo" checked={showMilo} onCheckedChange={setShowMilo} aria-label="Show Milo helper" /></label>
              <div className="settings-readonly"><b>Units</b><span>bpm · mmHg · mg/dL · °C · hours. Unit conversion is unavailable.</span></div>
            </section>
            <section className="settings-group"><h2>Data mode</h2>
              <Field><FieldLabel htmlFor="active-dataset">Readings</FieldLabel><Select value={dataset} onValueChange={(value) => { if (value) { setDataset(value as Dataset); setSelectedObservation(''); } }}><SelectTrigger id="active-dataset"><SelectValue>{dataset === 'demo' ? 'Current mission' : 'My readings'}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="demo">Current mission</SelectItem><SelectItem value="personal">My readings</SelectItem></SelectGroup></SelectContent></Select><small>Readings reset when you close the app.</small></Field>
              <Button variant="outline" onClick={() => setResetDemoOpen(true)}><RotateCcw data-icon="inline-start" /> Restore starting readings</Button>
            </section>
          </div>
        </section>}

        {page === 'medical' && <section className="page-view medical-support-page">
          <PageHeading title="Medical support" description="Review mission guidance or prepare a report to share." />
          <Card className="medical-support-card"><CardHeader><span className="medical-support-icon"><LifeBuoy aria-hidden="true" /></span><CardTitle>Mission instructions unavailable</CardTitle><CardDescription>Tether cannot contact your medical team.</CardDescription></CardHeader>
            <CardContent>
              <p>For health concerns, follow your mission’s approved medical plan.</p>
              <Field><FieldLabel htmlFor="handoff-episode">Reading review to include</FieldLabel><Select value={activeHandoffEpisode?.id ?? 'none'} onValueChange={(value) => { setHandoffEpisode(value === 'none' ? '' : value ?? ''); setHandoffError(''); }}><SelectTrigger id="handoff-episode"><SelectValue placeholder="Choose a review">{activeHandoffEpisode ? `${METRICS[observations.find((item) => item.id === activeHandoffEpisode.observationId)?.metric ?? 'heart'].short} · ${fullDate(activeHandoffEpisode.openedAt, activeTimeZone)}` : episodes.length ? 'Choose a review' : 'No reading reviews yet'}</SelectValue></SelectTrigger><SelectContent><SelectGroup>{episodes.length ? episodes.map((episode) => { const original = observations.find((item) => item.id === episode.observationId); return <SelectItem key={episode.id} value={episode.id}>{original ? METRICS[original.metric].short : 'Reading'} · {fullDate(episode.openedAt, activeTimeZone)}</SelectItem>; }) : <SelectItem value="none">No reading reviews yet</SelectItem>}</SelectGroup></SelectContent></Select><small>Only this review and its linked readings are included.</small></Field>
              {activeHandoffEpisode && handoffData && <div className="handoff-contents"><strong>Included in this episode</strong>{handoffData.observations.map((item) => <span key={item.id}><MetricGlyph name={item.metric} /> {METRICS[item.metric].short} · {formatValue(item)} · {fullDate(item.at, activeTimeZone)}</span>)}{handoffData.tasks.map((item) => <span key={item.id}><CalendarClock aria-hidden="true" /> {item.title} · {item.status}</span>)}{handoffData.contexts.map((item) => <span key={item.id}><SunMedium aria-hidden="true" /> {item.kind} · {item.value}</span>)}</div>}
              {handoffError && <Alert variant="destructive" role="alert"><Info aria-hidden="true" /><AlertDescription>{handoffError}</AlertDescription></Alert>}
              <div className="medical-actions"><Button onClick={prepareHandoff}><FileHeart data-icon="inline-start" /> Preview report</Button><Button variant="outline" onClick={() => navigate('library')}>Open references<ArrowRight data-icon="inline-end" /></Button></div>
            </CardContent><CardFooter><small>The report isn’t sent. Share it through your mission process.</small></CardFooter>
          </Card>
        </section>}
      </main>
    </div>

    <EntryDialog key={entrySession} open={entryOpen} onOpenChange={(open) => { setEntryOpen(open); if (!open) setLinkTask(null); }} mode={entryMode} metric={entryMetric} metricOrder={METRIC_ORDER}
      contextKind={contextKind} contextKinds={CONTEXT_KINDS} metrics={METRICS} moods={MOOD} entryContext={entryContext}
      repeatOriginal={linkTask ? observations.find((item) => item.id === tasks.find((task) => task.id === linkTask)?.observationId) : undefined}
      isFollowup={!!linkTask} restrictMetric={!!linkTask} timeZone={timeZone} sessionKey={entrySession} sleepQualityLabels={SLEEP_QUALITY} error={entryError} onMetric={(metric) => { setEntryMetric(metric); setEntryContext(''); }}
      onContextKind={setContextKind} onEntryContext={setEntryContext} onSubmit={saveEntry} />

    <Dialog open={exportPreviewOpen} onOpenChange={setExportPreviewOpen}><DialogContent className="export-preview-dialog"><DialogHeader><DialogTitle>Review export</DialogTitle><DialogDescription>Only selected records are included. Nothing is sent.</DialogDescription></DialogHeader>
      {previewPayload ? <><div className="export-preview-summary"><span>{previewPayload.observations.length} readings</span><span>{previewPayload.contexts.length} check-ins</span><span>{previewPayload.tasks.length} actions</span><span>{previewPayload.episodes.length} reviews</span></div>
        <div className="export-preview-list">{previewPayload.observations.map((item) => <div key={item.id}><MetricGlyph name={item.metric} /><span>{METRICS[item.metric].short}</span><strong>{formatValue(item)}</strong><small>{item.synthetic ? item.guidanceVersion : `${item.source} · ${item.guidanceVersion}`} · {fullDate(item.at, activeTimeZone)}</small>{includeNotes && item.note && <em>Note included: {item.note}</em>}</div>)}{previewPayload.contexts.map((item) => <div key={item.id}><SunMedium aria-hidden="true" /><span>{item.kind}</span><strong>{item.value}</strong><small>{fullDate(item.at, activeTimeZone)}</small>{includeNotes && item.note && <em>Note included: {item.note}</em>}</div>)}{previewPayload.tasks.map((item) => <div key={item.id}><CalendarClock aria-hidden="true" /><span>{item.status}</span><strong>{item.title}</strong><small>{item.resultId ? 'Repeat linked' : 'No repeat recorded'}</small>{includeNotes && item.completionNote && <em>Note included: {item.completionNote}</em>}</div>)}{previewPayload.episodes.map((item) => <div key={item.id}><Info aria-hidden="true" /><span>Reading review</span><strong>{item.status}</strong><small>{fullDate(item.openedAt, activeTimeZone)}</small>{includeNotes && item.reviewNote && <em>Note included: {item.reviewNote}</em>}</div>)}</div>
        <label className="include-notes-check"><input type="checkbox" checked={includeNotes} onChange={(event) => setIncludeNotes(event.target.checked)} /> Include private notes</label>
        <DialogFooter><Button variant="outline" onClick={() => setExportPreviewOpen(false)}>Cancel</Button><Button variant="secondary" onClick={() => exportRecords('json')}><FileText data-icon="inline-start" /> Export JSON</Button><Button onClick={() => exportRecords('html')}><ArrowDownToLine data-icon="inline-start" /> Export HTML</Button></DialogFooter>
      </> : <Empty><EmptyHeader><EmptyTitle>No records selected</EmptyTitle><EmptyDescription>Choose records to include.</EmptyDescription></EmptyHeader><Button onClick={() => setExportPreviewOpen(false)}>Return to Records</Button></Empty>}
    </DialogContent></Dialog>

    <Dialog open={handoffPreviewOpen} onOpenChange={setHandoffPreviewOpen}><DialogContent className="export-preview-dialog"><DialogHeader><DialogTitle>Review medical report</DialogTitle><DialogDescription>Only selected records are included. Not sent.</DialogDescription></DialogHeader>
      {handoffPreviewPayload && <><div className="export-preview-summary"><span>{handoffPreviewPayload.observations.length} readings</span><span>{handoffPreviewPayload.contexts.length} check-ins</span><span>{handoffPreviewPayload.tasks.length} actions</span></div><div className="export-preview-list">{handoffPreviewPayload.observations.map((item) => <div key={item.id}><MetricGlyph name={item.metric} /><span>{METRICS[item.metric].short}</span><strong>{formatValue(item)}</strong><small>{item.method} · {item.context} · {item.guidanceVersion} · {fullDate(item.at, activeTimeZone)}</small>{handoffIncludeNotes && item.note && <em>Note included: {item.note}</em>}</div>)}{handoffPreviewPayload.contexts.map((item) => <div key={item.id}><SunMedium aria-hidden="true" /><span>{item.kind}</span><strong>{item.value}</strong><small>{fullDate(item.at, activeTimeZone)}</small>{handoffIncludeNotes && item.note && <em>Note included: {item.note}</em>}</div>)}{handoffPreviewPayload.tasks.map((item) => <div key={item.id}><CalendarClock aria-hidden="true" /><span>{item.status}</span><strong>{item.title}</strong><small>{item.resultId ? 'Repeat linked' : 'No repeat recorded'}</small>{handoffIncludeNotes && item.completionNote && <em>Note included: {item.completionNote}</em>}</div>)}</div>
        <label className="include-notes-check"><input type="checkbox" checked={handoffIncludeNotes} onChange={(event) => setHandoffIncludeNotes(event.target.checked)} /> Include private notes</label>
        <DialogFooter><Button variant="outline" onClick={() => setHandoffPreviewOpen(false)}>Cancel</Button><Button variant="secondary" onClick={() => exportHandoff('json')}>Export JSON</Button><Button onClick={() => exportHandoff('html')}>Export HTML</Button></DialogFooter></>}
    </DialogContent></Dialog>

    <Dialog open={resetDemoOpen} onOpenChange={setResetDemoOpen}><DialogContent><DialogHeader><DialogTitle>Restore starting readings?</DialogTitle><DialogDescription>This restores the initial mission readings and follow-up. My readings stay separate.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setResetDemoOpen(false)}>Cancel</Button><Button variant="destructive" onClick={resetDemo}><RotateCcw data-icon="inline-start" /> Restore readings</Button></DialogFooter></DialogContent></Dialog>

    <div className="toast-region" aria-live="polite" aria-atomic="true">{toast && <div className="toast-message"><Check aria-hidden="true" />{toast}</div>}</div>
  </div>;

  function openPageCareTask(task?: Followup) {
    if (task) setFocusTaskId(task.id);
    navigate('care');
  }
}
