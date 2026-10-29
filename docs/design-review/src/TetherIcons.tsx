import type { ComponentType, ReactNode, SVGProps } from 'react';

type GlyphProps = SVGProps<SVGSVGElement> & { size?: number };
type Glyph = ComponentType<GlyphProps>;

function Canvas({ children, size = 24, className, ...props }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      className={['tether-glyph', className].filter(Boolean).join(' ')}
      aria-hidden="true"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HeartGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M16 26.1 5.8 16.4C.1 10.8 7.8 3.9 13 9.1l3 3 3-3c5.2-5.2 12.9 1.7 7.2 7.3L16 26.1Z" fill="var(--icon-fill-magenta)" stroke="var(--icon-magenta)" strokeWidth="1.35"/><path d="M6.6 16.2h5l2.1-3.7 3.1 7 2.1-4h6.4" stroke="var(--icon-ice)" strokeWidth="1.65"/><circle cx="25.3" cy="7.1" r="2.1" fill="var(--icon-violet)"/></Canvas>;
}

export function PressureGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M5.2 22.8a11 11 0 1 1 21.6 0" stroke="var(--icon-blue)" strokeWidth="3.1"/><path d="M8 22.5a8 8 0 0 1 16 0" stroke="var(--icon-cyan)" strokeWidth="2.2"/><path d="m16 20.8 5.2-6.2" stroke="var(--icon-blue)" strokeWidth="2.1"/><circle cx="16" cy="21" r="2.5" fill="var(--icon-blue)"/><path d="M8 25.2h16" stroke="var(--icon-cyan)" strokeWidth="1.4"/></Canvas>;
}

export function GlucoseGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M16 4.5S7.3 15.2 7.3 20a8.7 8.7 0 1 0 17.4 0c0-4.8-8.7-15.5-8.7-15.5Z" fill="var(--icon-fill-teal)" stroke="var(--icon-teal)" strokeWidth="1.45"/><path d="M11 20.7a5.1 5.1 0 0 0 4.7 4.7" stroke="var(--icon-ice)" strokeWidth="1.8"/><circle cx="22.8" cy="8" r="2.1" fill="var(--icon-blue)"/></Canvas>;
}

export function TemperatureGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M12.2 18.3V8.5a3.8 3.8 0 0 1 7.6 0v9.8a6.1 6.1 0 1 1-7.6 0Z" fill="var(--icon-fill-blue)" stroke="var(--icon-cyan)" strokeWidth="1.5"/><path d="M16 11.4v10.1" stroke="var(--icon-cyan)" strokeWidth="2.3"/><circle cx="16" cy="22.1" r="2.6" fill="var(--icon-cyan)"/><path d="M21.4 9.2h3.2M21.4 13h2.1" stroke="var(--icon-cyan)" strokeWidth="1.4"/><circle cx="8" cy="9" r="2" fill="var(--icon-violet)"/></Canvas>;
}

export function SleepGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M22.8 20.6A10.1 10.1 0 0 1 11.4 7.2a10.8 10.8 0 1 0 11.4 13.4Z" fill="var(--icon-fill-violet)" stroke="var(--icon-violet)" strokeWidth="1.35"/><path d="m22.8 7.1.8 2.1 2.2.8-2.2.8-.8 2.2-.8-2.2-2.1-.8 2.1-.8.8-2.1Z" fill="var(--icon-cyan)"/><circle cx="9" cy="9" r="1.2" fill="var(--icon-ice)"/></Canvas>;
}

export function MoodGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="16" cy="16" r="11.2" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.4"/><circle cx="12.1" cy="14" r="1.1" fill="var(--icon-ice)"/><circle cx="19.9" cy="14" r="1.1" fill="var(--icon-ice)"/><path d="M11.6 18.1c1 2.2 2.5 3.3 4.4 3.3s3.4-1.1 4.4-3.3" stroke="var(--icon-ice)" strokeWidth="1.65"/><path d="M6.3 9.1 8 7.4M24 9l1.7-1.7" stroke="var(--icon-violet)" strokeWidth="1.6"/></Canvas>;
}

export const metricGlyphs: Record<string, Glyph> = {
  heart: HeartGlyph,
  bp: PressureGlyph,
  glucose: GlucoseGlyph,
  temperature: TemperatureGlyph,
  sleep: SleepGlyph,
  mood: MoodGlyph,
};

export function MetricGlyph({ name, ...props }: GlyphProps & { name: string }) {
  const GlyphComponent = metricGlyphs[name] ?? HeartGlyph;
  return <GlyphComponent {...props} className={['metric-glyph', `metric-glyph-${name}`, props.className].filter(Boolean).join(' ')} />;
}

function OverviewGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="16" cy="16" r="9.2" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.4"/><ellipse cx="16" cy="16" rx="14" ry="5.4" transform="rotate(-30 16 16)" stroke="var(--icon-cyan)" strokeWidth="1.5"/><circle cx="25.3" cy="8.1" r="2.5" fill="var(--icon-violet)"/><circle cx="11.2" cy="15" r="3.5" fill="var(--icon-teal)"/><path d="m10.3 15.1.7.8 1.5-1.8" stroke="var(--icon-ice)" strokeWidth="1.4"/></Canvas>;
}

function BodyGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="16" cy="7.2" r="3.6" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.35"/><path d="M10.8 12.4c1.3-1.2 2.8-1.8 5.2-1.8s3.9.6 5.2 1.8l2.2 7.2-3.1 1.1-1.7-4.8v9.2h-5v-9.2l-1.7 4.8-3.1-1.1 2-7.2Z" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.35"/><path d="M16 12.2v7.1m-2.3-2.7 2.3 1.8 2.3-1.8" stroke="var(--icon-ice)" strokeWidth="1.4"/></Canvas>;
}

function MeasureGlyph(props: GlyphProps) {
  return <Canvas {...props}><rect x="7" y="5" width="18" height="22" rx="4" fill="var(--icon-fill-blue)" stroke="var(--icon-cyan)" strokeWidth="1.4"/><path d="M12 5.5h8v3h-8z" fill="var(--icon-violet)"/><path d="M10.5 17h3l1.5-3.2 2.4 6 1.6-3.1h2.5" stroke="var(--icon-blue)" strokeWidth="1.7"/><circle cx="11" cy="11.7" r="1.1" fill="var(--icon-teal)"/></Canvas>;
}

function TrendsGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M6 25.5h21M7 23V8" stroke="var(--icon-blue)" strokeWidth="1.4"/><rect x="10" y="17" width="3.2" height="6.5" rx="1" fill="var(--icon-violet)"/><rect x="16" y="13" width="3.2" height="10.5" rx="1" fill="var(--icon-teal)"/><rect x="22" y="9" width="3.2" height="14.5" rx="1" fill="var(--icon-blue)"/><path d="m8 16 5-3 4 1 7-6" stroke="var(--icon-blue)" strokeWidth="1.5"/><circle cx="24" cy="8" r="1.8" fill="var(--icon-ice)"/></Canvas>;
}

function CareGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M16 4.7 26 9v6.4c0 6-4 9.7-10 12-6-2.3-10-6-10-12V9l10-4.3Z" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.45"/><path d="m10.4 16.2 3.5 3.3 7.8-8" stroke="var(--icon-teal)" strokeWidth="2.2"/><circle cx="24.2" cy="7.4" r="2.1" fill="var(--icon-fill-violet)"/></Canvas>;
}

function RecordsGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M10 6h12l4 4v15H10z" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.35"/><path d="M22 6v4h4" stroke="var(--icon-blue)" strokeWidth="1.35"/><path d="M14 14h8m-8 4h8m-8 4h5" stroke="var(--icon-blue)" strokeWidth="1.5"/><path d="M6 10v16h14" stroke="var(--icon-violet)" strokeWidth="1.5"/></Canvas>;
}

function LibraryGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M5.5 8.1c4.2-1.4 7.7-.8 10.5 1.1v16c-2.8-1.9-6.3-2.5-10.5-1.1v-16Zm21 0c-4.2-1.4-7.7-.8-10.5 1.1v16c2.8-1.9 6.3-2.5 10.5-1.1v-16Z" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.3"/><path d="M9 12h3.4m-3.4 3h3.4m7.2-3H23m-3.4 3H23" stroke="var(--icon-teal)" strokeWidth="1.45"/><circle cx="16" cy="6" r="2" fill="var(--icon-violet)"/></Canvas>;
}

function SettingsGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="16" cy="16" r="10.5" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.4"/><circle cx="16" cy="16" r="4.2" fill="var(--icon-cyan)" stroke="var(--icon-blue)" strokeWidth="1.4"/><path d="M16 3.7v3m0 18.6v3M3.7 16h3m18.6 0h3M7.3 7.3l2.1 2.1m13.2 13.2 2.1 2.1M24.7 7.3l-2.1 2.1M9.4 22.6l-2.1 2.1" stroke="var(--icon-violet)" strokeWidth="1.7"/></Canvas>;
}

function MedicalGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M16 4.7 26 9v6.4c0 6-4 9.7-10 12-6-2.3-10-6-10-12V9l10-4.3Z" fill="var(--icon-fill-blue)" stroke="var(--icon-cyan)" strokeWidth="1.4"/><path d="M16 11v9m-4.5-4.5h9" stroke="var(--icon-blue)" strokeWidth="2.5"/><circle cx="24.3" cy="7.6" r="1.8" fill="var(--icon-teal)"/></Canvas>;
}

export const navigationGlyphs: Record<string, Glyph> = {
  console: OverviewGlyph,
  body: BodyGlyph,
  measurements: MeasureGlyph,
  trends: TrendsGlyph,
  care: CareGlyph,
  records: RecordsGlyph,
  library: LibraryGlyph,
  settings: SettingsGlyph,
  medical: MedicalGlyph,
};

function RadiationGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="16" cy="16" r="3.1" fill="var(--icon-blue)"/><path d="M13.4 11.4 9.2 4.7a13 13 0 0 0-6.1 10.7h8a5.2 5.2 0 0 1 2.3-4Zm5.2 0 4.2-6.7a13 13 0 0 1 6.1 10.7h-8a5.2 5.2 0 0 0-2.3-4Zm-5.2 9.2-4.2 6.7a13 13 0 0 1-6.1-10.7h8a5.2 5.2 0 0 0 2.3 4Z" fill="var(--icon-fill-blue)" stroke="var(--icon-cyan)" strokeWidth="1.1"/><circle cx="16" cy="16" r="12.7" stroke="var(--icon-violet)" strokeWidth="1.1" strokeDasharray="2.2 2.8"/></Canvas>;
}

function IsolationGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="11" cy="11" r="4" fill="var(--icon-fill-violet)"/><circle cx="21" cy="11" r="4" fill="var(--icon-fill-cyan)"/><path d="M4.7 24c.4-4.2 2.3-6.3 6.3-6.3s5.9 2.1 6.3 6.3m-1.4 0c.4-4.2 2.3-6.3 6.3-6.3s5.9 2.1 6.3 6.3" stroke="var(--icon-blue)" strokeWidth="1.6"/><path d="M13.8 12.3h4.4" stroke="var(--icon-teal)" strokeWidth="1.5"/></Canvas>;
}

function DistanceGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="13" cy="17" r="8.2" fill="var(--icon-fill-cyan)" stroke="var(--icon-cyan)" strokeWidth="1.4"/><path d="M5 16.5h16M12 9.2c-2.1 2.1-2.1 14.5 0 16m2-16c2.1 2.1 2.1 14.5 0 16" stroke="var(--icon-ice)" strokeWidth="1.15"/><path d="M19 8c3-2 5.1-1.1 6.5.1M20.5 12.4c2.6.1 4.1-1.1 5-2.7" stroke="var(--icon-violet)" strokeWidth="1.5"/><circle cx="25.6" cy="7.4" r="1.5" fill="var(--icon-violet)"/></Canvas>;
}

function GravityGlyph(props: GlyphProps) {
  return <Canvas {...props}><circle cx="19.5" cy="12.5" r="6.2" fill="var(--icon-fill-teal)" stroke="var(--icon-teal)" strokeWidth="1.35"/><path d="M4.5 23.8c3.1-6 7.2-8 12.1-6m-12.1 1c3.5-5.6 7.5-7.2 12.1-6.4" stroke="var(--icon-blue)" strokeWidth="1.55"/><path d="m11.2 21.1 3.3 2.7-4.1.7" fill="var(--icon-violet)"/><circle cx="8" cy="8" r="1.7" fill="var(--icon-violet)"/></Canvas>;
}

function EnvironmentGlyph(props: GlyphProps) {
  return <Canvas {...props}><path d="M5.5 10.1 16 4.8l10.5 5.3v6.8c0 5-3.5 8.5-10.5 11.1-7-2.6-10.5-6.1-10.5-11.1v-6.8Z" fill="var(--icon-fill-blue)" stroke="var(--icon-blue)" strokeWidth="1.4"/><path d="M9 15.2c2.1-2.1 4.2-2.1 6.3 0s4.2 2.1 6.3 0M9 19c2.1-2.1 4.2-2.1 6.3 0" stroke="var(--icon-teal)" strokeWidth="1.6"/><circle cx="23.5" cy="8.3" r="1.7" fill="var(--icon-violet)"/></Canvas>;
}

export const hazardGlyphs: Record<string, Glyph> = {
  radiation: RadiationGlyph,
  isolation: IsolationGlyph,
  distance: DistanceGlyph,
  gravity: GravityGlyph,
  environment: EnvironmentGlyph,
};

export function HazardGlyph({ name, ...props }: GlyphProps & { name: string }) {
  const GlyphComponent = hazardGlyphs[name] ?? EnvironmentGlyph;
  return <GlyphComponent {...props} className={['hazard-glyph', `hazard-glyph-${name}`, props.className].filter(Boolean).join(' ')} />;
}
