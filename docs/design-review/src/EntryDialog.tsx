import { AlertCircle, ArrowRight, Clock3, X } from 'lucide-react';
import type React from 'react';
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from './components/ui/field';
import { Input } from './components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { localStamp, type Metric, type MetricInfo, type Observation } from './domain';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'measurement' | 'context';
  metric: Metric;
  metricOrder: Metric[];
  contextKind: string;
  contextKinds: readonly string[];
  metrics: Record<Metric, MetricInfo>;
  moods: string[];
  sleepQualityLabels: string[];
  entryContext: string;
  repeatOriginal?: Observation;
  isFollowup: boolean;
  restrictMetric: boolean;
  timeZone: string;
  sessionKey: number;
  error: string;
  onMetric: (metric: Metric) => void;
  onContextKind: (kind: string) => void;
  onEntryContext: (context: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function EntryDialog(props: Props) {
  const help = props.metrics[props.metric];
  const effectiveZone = props.timeZone === 'UTC' ? 'UTC' : undefined;
  const now = new Date();
  const defaultTime = props.timeZone === 'UTC' ? now.toISOString().slice(0, 16)
    : new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}>
    <DialogContent className="entry-dialog" aria-describedby="entry-description">
      <DialogHeader>
        <DialogTitle>{props.mode === 'context' ? 'Add an optional check-in' : props.isFollowup ? `Repeat ${help.short.toLowerCase()}` : `Record ${help.label.toLowerCase()}`}</DialogTitle>
        <DialogDescription id="entry-description">{props.mode === 'context'
          ? 'A quick check-in about how you feel or what happened.'
          : help.meaning}</DialogDescription>
      </DialogHeader>
      <form key={props.sessionKey} onSubmit={props.onSubmit} className="entry-form">
        <FieldGroup className="entry-field-group">
          {props.mode === 'measurement' ? <>
            {props.repeatOriginal && <div className="repeat-reference" aria-label="Original reading for this follow-up">
              <Clock3 aria-hidden="true" />
              <span><b>Original</b><small>{props.repeatOriginal.value}{props.repeatOriginal.secondary !== undefined ? ` / ${props.repeatOriginal.secondary}` : ''} {props.repeatOriginal.unit} · {localStamp(props.repeatOriginal.at, true, effectiveZone)}</small><small>Method: {props.repeatOriginal.method} · Conditions: {props.repeatOriginal.context}</small></span>
            </div>}
            {!props.restrictMetric && <Field>
              <FieldLabel htmlFor="entry-indicator">Reading</FieldLabel>
              <Select name="metric" value={props.metric} onValueChange={(value) => { if (value) props.onMetric(value as Metric); }}>
                <SelectTrigger id="entry-indicator"><SelectValue>{props.metrics[props.metric].label}</SelectValue></SelectTrigger>
                <SelectContent><SelectGroup>{props.metricOrder.map((metric) => <SelectItem key={metric} value={metric}>{props.metrics[metric].label}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>}
            {props.metric === 'bp' ? <div className="form-two">
              <Field><FieldLabel htmlFor="entry-systolic">Top number · mmHg</FieldLabel><Input id="entry-systolic" name="value" inputMode="decimal" type="number" min="1" max="350" required placeholder="Enter value" /></Field>
              <Field><FieldLabel htmlFor="entry-diastolic">Bottom number · mmHg</FieldLabel><Input id="entry-diastolic" name="secondary" inputMode="decimal" type="number" min="1" max="250" required placeholder="Enter value" /></Field>
            </div> : props.metric === 'mood' ? <Field>
              <FieldLabel htmlFor="entry-mood">Mood</FieldLabel>
              <Select name="value" defaultValue="">
                <SelectTrigger id="entry-mood"><SelectValue placeholder="Choose a description" /></SelectTrigger>
                <SelectContent><SelectGroup>{props.moods.map((mood) => <SelectItem key={mood} value={mood}>{mood}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field> : <Field>
              <FieldLabel htmlFor="entry-value">{help.short} · {help.unit}</FieldLabel>
              <Input id="entry-value" name="value" inputMode="decimal" type="number" step="any" min="0" required placeholder="Enter observed value" />
            </Field>}
            <Field><FieldLabel htmlFor="entry-at">Date and time</FieldLabel>
              <Input id="entry-at" name="at" type="datetime-local" defaultValue={defaultTime} required />
            </Field>
            <Field><FieldLabel htmlFor="entry-method">How did you measure?</FieldLabel>
              <Input id="entry-method" name="method" placeholder="Device or method" />
            </Field>
            <Field>
              <FieldLabel htmlFor="entry-context">{help.contextLabel}</FieldLabel>
              <Select name="context" value={props.entryContext || null} onValueChange={(value) => props.onEntryContext(value ?? '')}>
                <SelectTrigger id="entry-context" aria-required="true"><SelectValue placeholder="Choose the conditions you used" /></SelectTrigger>
                <SelectContent><SelectGroup>{help.contextOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            {props.isFollowup && <p className="entry-context-hint">Use the conditions you actually used. They are not copied from the original.</p>}
            <Field><FieldLabel htmlFor="entry-note">Extra note (optional)</FieldLabel>
              <textarea id="entry-note" name="note" rows={2} placeholder="Anything else to remember" />
            </Field>
            <div className="instruction-box"><b>How to measure</b><p>{help.how}</p><small>{help.cannot}</small></div>
          </> : <>
            <Field><FieldLabel htmlFor="context-kind">Check-in type</FieldLabel>
              <Select value={props.contextKind} onValueChange={(value) => value && props.onContextKind(value)}>
                <SelectTrigger id="context-kind"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{props.contextKinds.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            {props.contextKind === 'sleep quality' ? <Field><FieldLabel htmlFor="context-value">How restorative did sleep feel?</FieldLabel>
              <Select name="value" defaultValue="">
                <SelectTrigger id="context-value"><SelectValue placeholder="Choose a description" /></SelectTrigger>
                <SelectContent><SelectGroup>{props.sleepQualityLabels.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field> : <Field><FieldLabel htmlFor="context-value">{contextKindLabel(props.contextKind)}</FieldLabel>
              <Input id="context-value" name="value" placeholder={contextPlaceholder(props.contextKind)} required />
            </Field>}
            <Field><FieldLabel htmlFor="context-at">Date and time</FieldLabel><Input id="context-at" name="at" type="datetime-local" defaultValue={defaultTime} required /></Field>
            <Field><FieldLabel htmlFor="context-note">Additional context (optional)</FieldLabel><textarea id="context-note" name="note" rows={2} placeholder="Anything useful to remember?" /></Field>
          </>}
        </FieldGroup>
        {props.error && <Alert variant="destructive" role="alert"><AlertCircle aria-hidden="true" /><AlertTitle>Check this entry</AlertTitle><AlertDescription>{props.error}</AlertDescription></Alert>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}><X data-icon="inline-start" /> Cancel</Button>
          <Button type="submit">{props.mode === 'context' ? 'Save check-in' : props.isFollowup ? 'Save repeat' : 'Save reading'}<ArrowRight data-icon="inline-end" /></Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

function contextKindLabel(kind: string) {
  return ({ symptom: 'Symptom or observation', exercise: 'Activity and duration', 'meal / hydration': 'Meal or hydration note' })[kind] ?? 'Check-in';
}

function contextPlaceholder(kind: string) {
  return ({ symptom: 'Describe briefly', exercise: 'Activity and duration', 'meal / hydration': 'Meal or water note' })[kind] ?? 'Add a short note';
}
