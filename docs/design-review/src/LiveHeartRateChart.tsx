import { useEffect, useState } from 'react';
import type { HeartRateMonitorStatus } from './useHeartRateMonitor';
import type { LiveHeartRateSample } from './telemetry/heartRateBle';

type Props = { samples: LiveHeartRateSample[]; status: HeartRateMonitorStatus; timeZone?: string };

const WIDTH = 760;
const HEIGHT = 280;
const PAD = { top: 16, right: 18, bottom: 32, left: 48 };
const WINDOW_MS = 90000;

export function LiveHeartRateChart({ samples, status, timeZone }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== 'connected' && status !== 'stale') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const latestAt = now;
  const windowStart = latestAt - WINDOW_MS;
  const visible = samples.filter((sample) => sample.receivedAt >= windowStart);
  const reliable = visible.filter((sample) => sample.sensorContact !== 'not-detected');
  const width = WIDTH - PAD.left - PAD.right;
  const height = HEIGHT - PAD.top - PAD.bottom;
  const low = reliable.length ? Math.min(...reliable.map((sample) => sample.bpm)) : 0;
  const high = reliable.length ? Math.max(...reliable.map((sample) => sample.bpm)) : 100;
  const yMin = reliable.length ? Math.max(0, Math.floor((low - 6) / 10) * 10) : 0;
  const yMax = reliable.length ? Math.max(yMin + 20, Math.ceil((high + 6) / 10) * 10) : 100;
  const x = (at: number) => PAD.left + ((at - windowStart) / WINDOW_MS) * width;
  const y = (bpm: number) => PAD.top + ((yMax - bpm) / Math.max(1, yMax - yMin)) * height;

  let path = '';
  let previous: LiveHeartRateSample | undefined;
  for (const sample of visible) {
    if (sample.sensorContact === 'not-detected') { previous = undefined; continue; }
    const segment = !previous || sample.receivedAt - previous.receivedAt > 5000 ? 'M' : 'L';
    path += `${segment}${x(sample.receivedAt).toFixed(1)},${y(sample.bpm).toFixed(1)} `;
    previous = sample;
  }

  const gridValues = Array.from({ length: 5 }, (_, index) => yMax - ((yMax - yMin) / 4) * index);
  const latest = visible.at(-1);
  const lastSample = samples.at(-1);
  const accessibility = latest
    ? `Live heart-rate chart, ${latest.bpm} beats per minute, ${visible.length} sensor updates over the last 90 seconds, latest received ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone }).format(latest.receivedAt)}${latest.sensorContact === 'not-detected' ? ', sensor contact not detected' : ''}.`
    : status === 'connecting' || status === 'connected'
      ? 'Live heart-rate chart. Waiting for the first wearable update.'
      : 'Live heart-rate chart. No current wearable signal.';

  if (!latest) return <div className="live-heart-rate-empty" role="status">
    <strong>{status === 'connecting' || status === 'connected' ? 'Waiting for wearable signal' : 'No live signal in this window'}</strong>
    {lastSample && <span>Last update · {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone }).format(lastSample.receivedAt)}</span>}
  </div>;

  return <svg className="live-heart-rate-chart" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={accessibility}>
    <title>{accessibility}</title>
    {gridValues.map((value) => <g key={value}>
      <line x1={PAD.left} y1={y(value)} x2={WIDTH - PAD.right} y2={y(value)} className="live-chart-grid" />
      <text x={PAD.left - 8} y={y(value) + 4} textAnchor="end" className="live-chart-axis">{Math.round(value)}</text>
    </g>)}
    {['−90s', '−60s', '−30s', 'now'].map((label, index) => {
      const at = PAD.left + (width / 3) * index;
      return <text key={label} x={at} y={HEIGHT - 8} textAnchor={index === 0 ? 'start' : index === 3 ? 'end' : 'middle'} className="live-chart-axis">{label}</text>;
    })}
    <path d={path} className="live-chart-line" />
    {reliable.map((sample, index) => <circle key={`${sample.receivedAt}-${index}`} cx={x(sample.receivedAt)} cy={y(sample.bpm)} r={sample === latest ? 4.5 : 2.5}
      className={sample === latest ? 'live-chart-current' : 'live-chart-sample'}>
      <title>{`${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone }).format(sample.receivedAt)} · ${sample.bpm} bpm`}</title>
    </circle>)}
  </svg>;
}
