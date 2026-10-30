export type AnatomyStructure = {
  id: string;
  label: string;
  system: 'surface' | 'skeleton' | 'muscular' | 'cardiovascular' | 'respiratory' | 'digestive' | 'other';
  metricKeys: string[];
  aliases: string[];
  sourceConceptIds: string[];
};

// The GLB preparation script preserves the source organ names and writes these IDs
// into node names. Every selection maps back to the source structure here.
export const anatomyManifest: AnatomyStructure[] = [
  { id: 'heart', label: 'Heart', system: 'cardiovascular', metricKeys: ['heart', 'bp'], aliases: ['heart', 'cardiac', 'atrium', 'ventricle', 'aorta', 'coronary'], sourceConceptIds: ['FMA7088'] },
  { id: 'lungs', label: 'Lungs', system: 'respiratory', metricKeys: [], aliases: ['lung', 'bronch', 'pulmonary', 'fma73'], sourceConceptIds: ['FMA7309', 'FMA7310'] },
  { id: 'vessels', label: 'Blood vessels', system: 'cardiovascular', metricKeys: ['bp'], aliases: ['vessel', 'vena cava', 'artery', 'vein'], sourceConceptIds: ['FMA3734', 'FMA4720', 'FMA8612'] },
  { id: 'skeleton', label: 'Skeleton', system: 'skeleton', metricKeys: [], aliases: ['bone', 'skeleton', 'vertebra', 'skull', 'rib', 'femur'], sourceConceptIds: ['FMA7481', 'FMA7483'] },
  { id: 'muscles', label: 'Muscles', system: 'muscular', metricKeys: [], aliases: ['muscle', 'muscles'], sourceConceptIds: [] },
  { id: 'skin', label: 'Body surface', system: 'surface', metricKeys: ['temperature', 'glucose'], aliases: ['skin', 'integument', 'surface'], sourceConceptIds: ['FMA7163'] },
  { id: 'digestive', label: 'Digestive organs', system: 'digestive', metricKeys: [], aliases: ['stomach', 'intestin', 'liver', 'pancreas', 'digestive', 'colon', 'gallbladder', 'esophagus'], sourceConceptIds: ['FMA7148', 'FMA7197', 'FMA7198', 'FMA7200', 'FMA7201'] },
];

export const metricNames: Record<string, string> = {
  heart: 'Heart rate', bp: 'Blood pressure', glucose: 'Blood glucose',
  temperature: 'Body temperature', sleep: 'Sleep', mood: 'Mood',
};

export function structureForNode(name: string): AnatomyStructure | undefined {
  const value = name.toLocaleLowerCase();
  return anatomyManifest.find((item) => item.aliases.some((alias) => value.includes(alias)));
}
