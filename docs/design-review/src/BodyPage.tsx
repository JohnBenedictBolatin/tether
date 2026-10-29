import { ArrowLeft, ArrowRight, Info, Plus } from 'lucide-react';
import { anatomyManifest } from './anatomyManifest';
import { AnatomyViewer } from './AnatomyViewer';
import { MetricGlyph } from './TetherIcons';
import type { Metric, Observation } from './domain';
import { formatValue, fullDate } from './domain';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';

type Props = {
  selectedMetric: Metric | null;
  selectedStructure: string;
  selected?: Observation;
  reducedMotion: boolean;
  timeZone: string;
  observations: Observation[];
  onMetric: (metric: Metric | null) => void;
  onStructure: (structure: string) => void;
  onReview: (item: Observation) => void;
  onAdd: (metric: Metric) => void;
  onBack: () => void;
};

const labels: Record<Metric, string> = { heart: 'Heart rate', bp: 'Blood pressure', glucose: 'Blood glucose', temperature: 'Temperature', sleep: 'Sleep duration', mood: 'Mood check-in' };

export function BodyPage(props: Props) {
  const structure = anatomyManifest.find((item) => item.id === props.selectedStructure);
  const linkedMetrics = (structure?.metricKeys ?? []) as Metric[];
  const activeMetric = props.selectedMetric && linkedMetrics.includes(props.selectedMetric) ? props.selectedMetric : linkedMetrics[0];
  const linked = activeMetric ? props.observations.filter((item) => item.metric === activeMetric).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3) : [];
  const hasSupportedData = linked.length > 0;
  const activeTimeZone = props.timeZone === 'UTC' ? 'UTC' : undefined;
  const wholePersonMetrics: Metric[] = ['glucose', 'temperature', 'sleep', 'mood'];

  return <section className="body-page page-view">
    <header className="page-heading"><div>
      <Button variant="ghost" className="body-back-button" onClick={props.onBack}><ArrowLeft data-icon="inline-start" /> Today</Button>
      <div className="eyebrow-row"><span className="eyebrow">REFERENCE ANATOMY</span></div>
      <h1>Explore the body</h1>
      <p className="subtitle">Select a structure to see related readings.</p>
    </div></header>
    <div className="body-page-grid">
      <Card className="anatomy-card"><CardContent>
        <AnatomyViewer selectedMetric={props.selectedMetric} selectedStructure={props.selectedStructure} reducedMotion={props.reducedMotion}
          onMetric={props.onMetric} onStructure={props.onStructure} />
      </CardContent></Card>
      <aside className="body-detail-column">
        <Card className="body-detail-card"><CardHeader><CardDescription>Selected structure</CardDescription><CardTitle>{structure?.label ?? 'Whole body'}</CardTitle></CardHeader>
          <CardContent>
            <Badge variant={hasSupportedData ? 'secondary' : 'outline'}>{hasSupportedData ? `Related ${labels[activeMetric!] ?? 'indicator'} readings` : 'Not assessed'}</Badge>
            <p className="body-detail-copy">{linkedMetrics.length
              ? 'Related readings do not measure this structure.'
              : 'No reading measures this structure.'}</p>
            {linked.length ? <div className="body-linked-readings">{linked.map((item) => <button key={item.id} type="button" className="body-reading-row" onClick={() => props.onReview(item)}>
              <span className="body-reading-label"><MetricGlyph name={item.metric} /><span><b>{labels[item.metric]}</b><small>{fullDate(item.at, activeTimeZone)}</small></span></span>
              <strong>{formatValue(item)} <ArrowRight aria-hidden="true" /></strong>
            </button>)}</div> : <Alert className="body-not-assessed"><Info aria-hidden="true" /><AlertDescription>{linkedMetrics.length ? `No ${labels[activeMetric!] ?? 'related'} reading yet.` : 'Selection shows location, not health status.'}</AlertDescription></Alert>}
            {!!linkedMetrics.length && <div className="body-metric-links"><span>Related indicators</span>{linkedMetrics.map((metric) => <div className="body-metric-action" key={metric}>
              <Button variant={activeMetric === metric ? 'secondary' : 'outline'} aria-pressed={activeMetric === metric} onClick={() => props.onMetric(metric)}><MetricGlyph name={metric} />{labels[metric]}</Button>
              <Button variant="ghost" size="sm" onClick={() => props.onAdd(metric)}><Plus data-icon="inline-start" /> Record</Button>
            </div>)}</div>}
          </CardContent>
        </Card>
        <Card className="body-controls-card"><CardHeader><CardDescription>Reference model controls</CardDescription><CardTitle>Move around the model</CardTitle></CardHeader>
          <CardContent><ul><li>Drag to rotate · wheel to zoom · right-drag to pan</li><li>Front, Back, and Reset set the view</li><li>Toggle layers or focus a structure</li><li>Use the structure list with a keyboard</li></ul><small>BodyParts3D reference model · attribution and license included.</small></CardContent></Card>
        <Card className="body-whole-person-card"><CardHeader><CardTitle>Other readings</CardTitle></CardHeader>
          <CardContent><div className="body-whole-person-list">{wholePersonMetrics.map((metric) => {
            const item = props.observations.filter((reading) => reading.metric === metric).sort((a, b) => b.at.localeCompare(a.at))[0];
            return <div className="body-whole-person-row" key={metric}><span><MetricGlyph name={metric} /><span><b>{labels[metric]}</b><small>{item ? `${formatValue(item)} · ${fullDate(item.at, activeTimeZone)}` : 'No reading yet'}</small></span></span>
              <div>{item && <Button variant="ghost" size="sm" onClick={() => props.onReview(item)}>Review</Button>}<Button variant="outline" size="sm" onClick={() => props.onAdd(metric)}>Add</Button></div></div>;
          })}</div><p>These readings do not assess a body structure.</p></CardContent>
        </Card>
      </aside>
    </div>
  </section>;
}
