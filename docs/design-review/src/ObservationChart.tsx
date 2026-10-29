import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartConfig, ChartContainer } from './components/ui/chart';
import { MOOD, type Metric, type Observation, fullDate } from './domain';

export type ChartPresentation = 'history' | 'console-main' | 'console-compact' | 'bars';
type Props = {
  observations: Observation[];
  metric: Metric;
  timeZone?: string;
  onSelect?: (item: Observation) => void;
  presentation?: ChartPresentation;
  rangeDays?: 7 | 30;
  rangeEnd?: number;
  replayAt?: number;
  reducedMotion?: boolean;
};

const config: ChartConfig = {
  primary: { label: 'Reading', color: 'var(--chart-1)' },
  secondary: { label: 'Bottom number', color: 'var(--chart-2)' },
};

type Point = { timestamp: number; value: number; secondary?: number; observation: Observation };
type LinePoint = { timestamp: number; value: number | null; secondary?: number | null; gap?: true };

function ChartTooltip({ active, payload, timeZone }: { active?: boolean; payload?: Array<{ payload?: LinePoint & { observation?: Observation } }>; timeZone?: string }) {
  if (!active || !payload?.length) return null;
  const observation = payload.find((item) => item.payload?.observation)?.payload?.observation;
  if (!observation) return null;
  return <div className="observation-tooltip">
    <strong>{fullDate(observation.at, timeZone)}</strong>
    <span>{observation.metric === 'bp'
      ? `${observation.value} / ${observation.secondary} ${observation.unit}`
      : `${observation.value}${observation.unit ? ` ${observation.unit}` : ''}`}</span>
    <small>{observation.method} · {observation.context}</small>
  </div>;
}

export function ObservationChart({
  observations, metric, timeZone, onSelect, presentation = 'history', rangeDays, rangeEnd, replayAt, reducedMotion = false,
}: Props) {
  const points: Point[] = observations.flatMap((item) => {
    if (item.metric !== metric) return [];
    const timestamp = new Date(item.at).getTime();
    if (Number.isNaN(timestamp)) return [];
    const value = metric === 'mood' ? MOOD.indexOf(String(item.value)) + 1 : Number(item.value);
    if (!Number.isFinite(value) || value < 0) return [];
    const secondary = metric === 'bp' ? Number(item.secondary) : undefined;
    return [{ timestamp, value, secondary: Number.isFinite(secondary) ? secondary : undefined, observation: item }];
  }).sort((a, b) => a.timestamp - b.timestamp);

  if (!points.length) return <div className={`chart-empty ${presentation === 'console-main' ? 'console-chart-empty' : ''}`}>No observations in this period.</div>;

  const linePoints: LinePoint[] = [];
  points.forEach((point, index) => {
    linePoints.push({ ...point });
    const next = points[index + 1];
    if (next && next.timestamp - point.timestamp > 48 * 60 * 60 * 1000) {
      linePoints.push({ timestamp: point.timestamp + (next.timestamp - point.timestamp) / 2, value: null, secondary: null, gap: true });
    }
  });

  const pointLabel = (event: unknown) => {
    if (!onSelect || !event || typeof event !== 'object') return;
    const candidate = event as { payload?: Point; observation?: Observation };
    const item = candidate.payload?.observation ?? candidate.observation;
    if (item) onSelect(item);
  };
  const moodTick = (value: number) => MOOD[Math.round(value) - 1] ?? '';
  const axisDate = (value: number) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone }).format(new Date(value));
  const hasBp = metric === 'bp';
  const isMood = metric === 'mood';
  const isBars = presentation === 'bars';
  const isCompact = presentation === 'console-compact' || isBars;
  const allValues = points.flatMap((point) => [point.value, point.secondary].filter((value): value is number => Number.isFinite(value)));
  const low = Math.min(...allValues);
  const high = Math.max(...allValues);
  const padding = Math.max(1, (high - low) * 0.14);
  const yDomain: [number, number] = isMood ? [0.5, 5.5] : [Math.floor(low - padding), Math.ceil(high + padding)];
  const end = rangeEnd ?? points[points.length - 1].timestamp;
  const xDomain: [number | 'dataMin', number | 'dataMax'] = rangeDays
    ? [end - rangeDays * 86400000, end]
    : ['dataMin', 'dataMax'];
  const animate = !reducedMotion && presentation !== 'console-compact' && presentation !== 'bars';
  const chartLabel = `${metric === 'bp' ? 'Systolic and diastolic blood pressure' : isMood ? 'Mood check-ins' : 'Recorded observations'} by date`;

  return <ChartContainer config={config} className={`observation-chart ${presentation === 'console-main' ? 'console-main-plot' : ''} ${isCompact ? 'console-support-plot' : ''}`}
    role="group" aria-label={chartLabel}>
    <ComposedChart data={isBars ? points : linePoints} margin={{ top: 12, right: isCompact ? 6 : 16, bottom: 2, left: 0 }}>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 5" />
      <XAxis dataKey="timestamp" type="number" scale="time" domain={xDomain}
        tickFormatter={axisDate} tickLine={false} axisLine={false} minTickGap={32} tick={{ fill: 'var(--muted-foreground)', fontSize: isCompact ? 10 : 11 }} />
      <YAxis dataKey="value" type="number" domain={yDomain} ticks={isMood ? [1, 2, 3, 4, 5] : undefined}
        tickFormatter={isMood ? moodTick : undefined} width={isMood ? 76 : 48} tickLine={false} axisLine={false}
        tick={{ fill: 'var(--muted-foreground)', fontSize: isCompact ? 10 : 11 }} />
      <Tooltip cursor={{ stroke: 'var(--chart-cursor)', strokeDasharray: '3 4' }} content={<ChartTooltip timeZone={timeZone} />} />
      {isBars ? <Bar name="Sleep duration" dataKey="value" fill="var(--color-primary)" maxBarSize={24} radius={[3, 3, 0, 0]}
        onClick={pointLabel} isAnimationActive={animate} animationDuration={260} cursor={onSelect ? 'pointer' : 'default'} /> : <>
        <Line name={hasBp ? 'Top number' : 'Reading'} dataKey="value" type="linear" stroke="var(--color-primary)" strokeWidth={isCompact ? 2 : 2.5}
          dot={false} activeDot={false} connectNulls={false} isAnimationActive={animate} animationDuration={260} />
        {hasBp && <Line name="Bottom number" dataKey="secondary" type="linear" stroke="var(--color-secondary)" strokeWidth={isCompact ? 2 : 2.2}
          dot={false} activeDot={false} connectNulls={false} isAnimationActive={animate} animationDuration={260} />}
        {replayAt !== undefined && Number.isFinite(replayAt) && <ReferenceLine x={replayAt} stroke="var(--chart-replay)" strokeWidth={1.5} strokeDasharray="4 4" />}
        <Scatter name={hasBp ? 'Top number' : isMood ? 'Mood' : 'Reading'} data={points} dataKey="value"
          fill="var(--color-primary)" onClick={pointLabel} isAnimationActive={false} cursor={onSelect ? 'pointer' : 'default'} />
        {hasBp && <Scatter name="Bottom number" data={points} dataKey="secondary" fill="var(--color-secondary)"
          onClick={pointLabel} isAnimationActive={false} cursor={onSelect ? 'pointer' : 'default'} />}
      </>}
    </ComposedChart>
  </ChartContainer>;
}
