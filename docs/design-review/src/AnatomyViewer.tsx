import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls as OrbitControlsImpl } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import { Minus, Plus } from 'lucide-react';
import { Button } from './components/ui/button';
import { anatomyManifest, metricNames, structureForNode } from './anatomyManifest';
import type { AssessmentState } from './assessment';
import './anatomy.css';

type MetricKey = 'heart' | 'bp' | 'glucose' | 'temperature' | 'sleep' | 'mood';
type ViewerProps = { selectedMetric: MetricKey | null; selectedStructure: string; focusRequestKey?: number; reducedMotion: boolean; onMetric: (key: MetricKey | null) => void; onStructure: (id: string) => void; highlightState?: AssessmentState; priorityStructure?: string; priorityState?: AssessmentState; compact?: boolean };

const layers = [
  { id: 'surface', label: 'Body surface' }, { id: 'skeleton', label: 'Skeleton' },
  { id: 'muscular', label: 'Muscles' }, { id: 'cardiovascular', label: 'Cardiovascular' },
  { id: 'respiratory', label: 'Respiratory' }, { id: 'digestive', label: 'Digestive' },
] as const;

type ZoomRequest = { sequence: number; direction: 'in' | 'out' };
type FrameTarget = { center: THREE.Vector3; size: THREE.Vector3 } | null;

function CameraControls({ resetKey, face, focus, frameTarget, reducedMotion, zoomRequest, compact }: { resetKey: number; face: 'front' | 'back'; focus: FrameTarget; frameTarget: FrameTarget; reducedMotion: boolean; zoomRequest: ZoomRequest; compact: boolean }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  useEffect(() => {
    const orbit = new OrbitControlsImpl(camera, gl.domElement);
    orbit.enableDamping = !reducedMotion;
    orbit.dampingFactor = 0.075;
    orbit.minDistance = 1.4;
    orbit.maxDistance = 8.5;
    orbit.minPolarAngle = 0.22;
    orbit.maxPolarAngle = Math.PI - 0.22;
    orbit.target.set(0, 0.95, 0);
    controls.current = orbit;
    orbit.addEventListener('change', () => invalidate());
    orbit.update();
    return () => { orbit.dispose(); controls.current = null; };
  }, [camera, gl, invalidate, reducedMotion]);
  useEffect(() => {
    if (!controls.current) return;
    const center = frameTarget?.center ?? new THREE.Vector3(0, 0.95, 0);
    const direction = new THREE.Vector3(face === 'front' ? 0.43 : -0.43, 0.08, face === 'front' ? 0.9 : -0.9).normalize();
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov ?? 31);
    const aspect = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1);
    const size = frameTarget?.size ?? new THREE.Vector3(1.4, 3.25, 0.7);
    const fit = compact && gl.domElement.clientHeight < 160 ? 0.9 : 1.2;
    const distance = Math.max(size.y / (2 * Math.tan(fov / 2)), size.x / (2 * Math.tan(fov / 2) * aspect), size.z) * fit;
    controls.current.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    controls.current.update();
  }, [face, resetKey, camera, gl, frameTarget, compact]);
  useEffect(() => {
    if (!focus || !controls.current) return;
    controls.current.target.copy(focus.center);
    const direction = camera.position.clone().sub(focus.center).normalize();
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov ?? 31);
    const aspect = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1);
    const distance = Math.max(
      focus.size.y / (2 * Math.tan(fov / 2)),
      focus.size.x / (2 * Math.tan(fov / 2) * aspect),
      focus.size.z,
      1.4,
    ) * 1.08;
    const destination = focus.center.clone().add(direction.multiplyScalar(distance));
    if (reducedMotion) camera.position.copy(destination);
    else camera.position.lerp(destination, 0.82);
    controls.current.update();
  }, [focus, camera, gl, reducedMotion]);
  useEffect(() => {
    if (!zoomRequest.sequence || !controls.current) return;
    if (zoomRequest.direction === 'in') controls.current.dollyIn(1.15);
    else controls.current.dollyOut(1.15);
    controls.current.update();
    invalidate();
  }, [zoomRequest, invalidate]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches('button,input,select,textarea,[contenteditable="true"]')) return;
      if (event.key !== '+' && event.key !== '=' && event.key !== '-') return;
      event.preventDefault();
      if (event.key === '-') controls.current?.dollyOut(1.15);
      else controls.current?.dollyIn(1.15);
      controls.current?.update();
      invalidate();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [invalidate]);
  useFrame(() => { if (controls.current?.update()) invalidate(); });
  return null;
}
function Anatomy({ visibleLayers, selected, onSelect, onFocus, onFrame, frameTarget, surfaceAlpha, isolated, focusKey, highlightState, priorityStructure, priorityState, assetAttempt }: {
  visibleLayers: Set<string>; selected: string; onSelect: (id: string, metricKeys: string[]) => void;
  onFocus: (frame: FrameTarget) => void; onFrame: (center: THREE.Vector3, size: THREE.Vector3) => void; frameTarget: FrameTarget; surfaceAlpha: number; isolated: boolean; focusKey: number; highlightState?: AssessmentState; priorityStructure?: string; priorityState?: AssessmentState; assetAttempt: number;
}) {
  const assetUrl = (path: string) => `${path}?attempt=${assetAttempt}`;
  const [bodyAsset, heartAsset, lungsAsset] = useLoader(GLTFLoader, [assetUrl('/assets/anatomy/reference-body.glb'), assetUrl('/assets/anatomy/heart.glb'), assetUrl('/assets/anatomy/lungs.glb')]);
  const invalidate = useThree((state) => state.invalidate);
  const body = useMemo(() => bodyAsset.scene.clone(true), [bodyAsset]);
  const heart = useMemo(() => heartAsset.scene.clone(true), [heartAsset]);
  const lungs = useMemo(() => lungsAsset.scene.clone(true), [lungsAsset]);
  const model = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const rawBounds = new THREE.Box3();
    body.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
      if (node.geometry.boundingBox) rawBounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrix));
    });
    const rawSize = rawBounds.getSize(new THREE.Vector3());
    if (model.current && rawSize.z > 0) {
      const rawCenter = rawBounds.getCenter(new THREE.Vector3());
      const scale = 3.25 / rawSize.z;
      const rotatedCenter = rawCenter.multiplyScalar(scale).applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
      model.current.rotation.x = -Math.PI / 2;
      model.current.scale.setScalar(scale);
      model.current.position.set(-rotatedCenter.x, 0.95 - rotatedCenter.y, -rotatedCenter.z);
      model.current.updateMatrixWorld(true);
    }
    lungs.traverse((node) => { if (node instanceof THREE.Mesh) node.name = `lungs|${node.name}`; });
    body.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const structure = structureForNode(node.name);
      node.userData.tetherStructure = structure?.id ?? 'other';
      node.userData.tetherLayer = structure?.system ?? 'other';
      node.geometry.computeVertexNormals();
      const source = Array.isArray(node.material) ? node.material : [node.material];
      node.userData.tetherMaterials = source.map((material) => material.clone());
      node.material = node.userData.tetherMaterials.length === 1 ? node.userData.tetherMaterials[0] : node.userData.tetherMaterials;
    });
    for (const organ of [heart, lungs]) organ.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.userData.tetherStructure = structureForNode(node.name)?.id ?? (node.name.startsWith('lungs|') ? 'lungs' : 'heart');
      node.userData.tetherLayer = node.userData.tetherStructure === 'lungs' ? 'respiratory' : 'cardiovascular';
      node.geometry.computeVertexNormals();
      const source = Array.isArray(node.material) ? node.material : [node.material];
      node.userData.tetherMaterials = source.map((material) => material.clone());
      node.material = node.userData.tetherMaterials.length === 1 ? node.userData.tetherMaterials[0] : node.userData.tetherMaterials;
    });
    if (model.current) {
      model.current.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.current);
      if (!bounds.isEmpty()) onFrame(bounds.getCenter(new THREE.Vector3()), bounds.getSize(new THREE.Vector3()));
    }
    invalidate();
  }, [body, heart, lungs, invalidate, onFrame]);
  useEffect(() => {
    for (const scene of [body, heart, lungs]) scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || node.userData.tetherOutline) return;
      const structure = structureForNode(node.name);
      const layer = structure?.system ?? 'other';
      const isSelected = !!selected && node.userData.tetherStructure === selected;
      const isPriorityTarget = !!priorityStructure && node.userData.tetherStructure === priorityStructure;
      node.visible = (visibleLayers.has(layer) || layer === 'other') && (!isolated || isSelected || isPriorityTarget);
      const skin = layer === 'surface';
      const materials = node.userData.tetherMaterials as THREE.Material[] | undefined;
      materials?.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          const baseColor = skin ? '#9fb2c0' : layer === 'skeleton' ? '#d3c5b2' : layer === 'muscular' ? '#a97882' : layer === 'cardiovascular' ? '#c46f82' : layer === 'respiratory' ? '#72a6b4' : '#b79c7c';
          const selectedColor = highlightState === 'urgent' ? '#e85e67' : highlightState === 'attention' ? '#f0ad39' : '#3988c4';
          const priorityColor = priorityState === 'urgent' ? '#e85e67' : '#f0ad39';
          const numericPriority = isPriorityTarget && (priorityState === 'urgent' || priorityState === 'attention');
          const fillHighlight = node.userData.tetherStructure !== 'skin' && (numericPriority || isSelected);
          const fillColor = numericPriority ? priorityColor : selectedColor;
          material.color.set(fillHighlight ? fillColor : baseColor);
          material.emissive.set(fillHighlight ? fillColor : '#000000');
          material.emissiveIntensity = fillHighlight ? (numericPriority ? priorityState === 'urgent' ? 1.8 : 1.35 : 0.62) : 0;
          material.transparent = skin && surfaceAlpha < 0.99;
          material.opacity = skin ? surfaceAlpha : 1;
          material.depthWrite = !(skin && surfaceAlpha < 0.6);
          material.roughness = 0.63;
          material.metalness = 0.08;
          material.needsUpdate = true;
        }
      });
    });
    invalidate();
  }, [body, heart, lungs, visibleLayers, selected, priorityStructure, priorityState, surfaceAlpha, isolated, invalidate, highlightState]);
  useEffect(() => {
    const outlines: Array<{ parent: THREE.Mesh; outline: THREE.Mesh }> = [];
    for (const scene of [body, heart, lungs]) scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || node.userData.tetherOutline) return;
      const isSelected = !!selected && node.userData.tetherStructure === selected;
      const isPriorityTarget = !!priorityStructure && node.userData.tetherStructure === priorityStructure;
      if (!isSelected && !isPriorityTarget) return;
      const priorityHasCue = isPriorityTarget && ['urgent', 'attention', 'verify'].includes(priorityState ?? '');
      const color = priorityHasCue
        ? priorityState === 'urgent' ? '#e85e67' : '#f0ad39'
        : highlightState === 'urgent' ? '#e85e67' : highlightState === 'attention' ? '#f0ad39' : '#3988c4';
      const skinTarget = node.userData.tetherStructure === 'skin';
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: skinTarget ? priorityHasCue ? 0.34 : 0.2 : priorityState === 'verify' && isPriorityTarget ? 0.88 : 0.82, depthWrite: false });
      const outline = new THREE.Mesh(node.geometry, material);
      outline.name = `${node.name}-tether-highlight`;
      outline.scale.setScalar(skinTarget ? 1.012 : priorityHasCue ? 1.16 : 1.055);
      outline.renderOrder = 2;
      outline.raycast = () => {};
      outline.userData.tetherOutline = true;
      outline.userData.tetherStructure = node.userData.tetherStructure;
      outline.userData.tetherLayer = node.userData.tetherLayer;
      node.add(outline);
      outlines.push({ parent: node, outline });
    });
    invalidate();
    return () => {
      outlines.forEach(({ parent, outline }) => { parent.remove(outline); (outline.material as THREE.Material).dispose(); });
      invalidate();
    };
  }, [body, heart, lungs, selected, highlightState, priorityStructure, priorityState, invalidate]);
  useEffect(() => {
    if (!focusKey) return;
    if (selected === 'skin' && frameTarget) {
      onFocus(frameTarget);
      return;
    }
    const bounds = new THREE.Box3();
    for (const scene of [body, heart, lungs]) scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible || node.userData.tetherStructure !== selected) return;
      node.updateWorldMatrix(true, false);
      bounds.expandByObject(node);
    });
    if (!bounds.isEmpty()) onFocus({ center: bounds.getCenter(new THREE.Vector3()), size: bounds.getSize(new THREE.Vector3()) });
  }, [body, heart, lungs, selected, focusKey, onFocus, frameTarget]);
  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return;
    event.stopPropagation();
    const hits = event.intersections.length ? event.intersections : [{ object: event.object } as THREE.Intersection];
    const hit = hits.find((candidate) => {
      const structure = structureForNode(candidate.object.name);
      return structure && structure.id !== 'skin';
    }) ?? hits.find((candidate) => structureForNode(candidate.object.name));
    let node: THREE.Object3D | null = hit?.object ?? event.object;
    let structure = structureForNode(node.name);
    while (!structure && node?.parent) { node = node.parent; structure = structureForNode(node.name); }
    if (!structure) return;
    onSelect(structure.id, structure.metricKeys);
  }, [onSelect]);
  return <group ref={model} onClick={handleClick}>
    <primitive object={body} dispose={null} />
    <group position={[30, -170, 1205]} rotation={[Math.PI / 2, 0, 0]} scale={39}><primitive object={heart} dispose={null} /></group>
    <group position={[0, -132, 1260]} rotation={[Math.PI / 2, 0, 0]} scale={64}><primitive object={lungs} dispose={null} /></group>
  </group>;
}

class ModelBoundary extends React.Component<{ children: React.ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error('WebGL anatomy viewer error', error); }
  render() { return this.state.failed ? <div className="anatomy-failure"><strong>Body view isn’t available</strong><span>Your other readings are still available.</span><button onClick={this.props.onRetry}>Try the body again</button></div> : this.props.children; }
}

class CanvasModelBoundary extends React.Component<{ children: React.ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

function ModelReady({ onLoaded }: { onLoaded: () => void }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    invalidate();
    const retryFrames = [0, 48, 180].map((delay) => window.setTimeout(invalidate, delay));
    onLoaded();
    return () => retryFrames.forEach(window.clearTimeout);
  }, [invalidate, onLoaded]);
  return null;
}

function ModelScene({ selected, visibleLayers, onSelect, onFocus, surfaceAlpha, face, resetKey, focusKey, zoomRequest, onLoaded, isolated, reducedMotion, highlightState, priorityStructure, priorityState, assetAttempt, compact }: any) {
  const [focus, setFocus] = useState<FrameTarget>(null);
  const [frameTarget, setFrameTarget] = useState<FrameTarget>(null);
  const reportFrame = useCallback((center: THREE.Vector3, size: THREE.Vector3) => {
    setFrameTarget((current) => current && current.center.distanceToSquared(center) < 1e-8 && current.size.distanceToSquared(size) < 1e-8 ? current : { center: center.clone(), size: size.clone() });
  }, []);
  useEffect(() => { if (focus) onFocus(focus); }, [focus, onFocus]);
  return <>
    <ModelReady onLoaded={onLoaded} />
    <ambientLight intensity={1.25} />
    <directionalLight position={[4, 6, 4]} intensity={2.15} color="#d7f2f5" />
    <directionalLight position={[-4, 2, -3]} intensity={1.15} color="#4bbac8" />
    <directionalLight position={[0, 4, 5]} intensity={0.45} color="#fff1e6" />
    <Anatomy visibleLayers={visibleLayers} selected={selected} onSelect={onSelect} onFocus={setFocus} onFrame={reportFrame} frameTarget={frameTarget} surfaceAlpha={surfaceAlpha} isolated={isolated} focusKey={focusKey} highlightState={highlightState} priorityStructure={priorityStructure} priorityState={priorityState} assetAttempt={assetAttempt} />
    <CameraControls resetKey={resetKey} face={face} focus={focus} frameTarget={frameTarget} reducedMotion={reducedMotion} zoomRequest={zoomRequest} compact={compact} />
  </>;
}

export function AnatomyViewer({ selectedMetric, selectedStructure, focusRequestKey, reducedMotion, onMetric, onStructure, highlightState, priorityStructure, priorityState, compact = false }: ViewerProps) {
  const selected = selectedStructure;
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(['surface', 'cardiovascular', 'respiratory', 'digestive']));
  const [isolated, setIsolated] = useState(false);
  const [surfaceAlpha, setSurfaceAlpha] = useState(compact ? 0.3 : 0.5);
  const [resetKey, setResetKey] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest>({ sequence: 0, direction: 'in' });
  const [face, setFace] = useState<'front' | 'back'>('front');
  const [assetAttempt, setAssetAttempt] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const info = anatomyManifest.find((item) => item.id === selected);
  const selectedSystem = info?.system;
  const markModelLoaded = useCallback(() => setModelLoaded(true), []);
  const retryModel = useCallback(() => {
    setModelError(false);
    setModelLoaded(false);
    setAssetAttempt((attempt) => attempt + 1);
  }, []);
  const toggleLayer = (id: string) => setVisibleLayers((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const requestZoom = (direction: ZoomRequest['direction']) => setZoomRequest((current) => ({ sequence: current.sequence + 1, direction }));
  const selectStructure = (id: string, metricKeys: string[]) => {
    onStructure(id);
    const structure = anatomyManifest.find((item) => item.id === id);
    if (structure) setVisibleLayers((current) => new Set(current).add(structure.system));
    onMetric(metricKeys.length ? metricKeys[0] as MetricKey : null);
    if (!metricKeys.length || focusRequestKey === undefined) setFocusKey((x) => x + 1);
  };
  useEffect(() => {
    if (!focusRequestKey) return;
    if (selected && selectedSystem) {
      setVisibleLayers((current) => current.has(selectedSystem) ? current : new Set(current).add(selectedSystem));
      setFocusKey((x) => x + 1);
    } else {
      setIsolated(false);
      setResetKey((x) => x + 1);
    }
  }, [focusRequestKey, selected, selectedSystem]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const node = event.target as HTMLElement;
      if (node.matches('button,input,select,textarea')) return;
      if (event.key === 'ArrowLeft') setFace('back');
      if (event.key === 'ArrowRight') setFace('front');
      if (event.key === '0') setResetKey((x) => x + 1);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  return <div className={`anatomy-shell ${compact ? 'compact-anatomy' : ''}`}>
    {!compact && <div className="anatomy-header"><div><span className="anatomy-title">Reference anatomy</span><span className="anatomy-tag"><i /> 3D MODEL</span></div><span className="anatomy-hint">Drag to rotate <b>·</b> Scroll or use zoom buttons</span></div>}
    <div className="anatomy-stage">
      <ModelBoundary key={assetAttempt} onRetry={retryModel}><Canvas frameloop="demand" camera={{ position: [3.7, 1.35, 5.9], fov: 31 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={['#171d23']} />
        <CanvasModelBoundary onError={(error) => { console.error('Unable to load the offline anatomy assets', error); setModelError(true); }}>
        <Suspense fallback={null}><ModelScene selected={selected} visibleLayers={visibleLayers} onSelect={selectStructure} onFocus={() => {}} surfaceAlpha={surfaceAlpha} face={face} resetKey={resetKey} focusKey={focusKey} zoomRequest={zoomRequest} onLoaded={markModelLoaded} isolated={isolated} reducedMotion={reducedMotion} highlightState={highlightState} priorityStructure={priorityStructure} priorityState={priorityState} assetAttempt={assetAttempt} compact={compact} /></Suspense>
        </CanvasModelBoundary>
      </Canvas></ModelBoundary>
      {modelError ? <div className="anatomy-loading anatomy-error" role="alert"><strong>3D anatomy could not load</strong><span>Your readings and actions are still available.</span><button onClick={retryModel}>Try again</button></div> : !modelLoaded && <div className="anatomy-loading" role="status">Loading anatomy meshes…</div>}
      {!compact && <div className="anatomy-watermark">BODY SYSTEMS <span>·</span> REFERENCE MODEL</div>}
      {!compact && <div className="anatomy-view-controls"><button onClick={() => setFace('front')} aria-pressed={face === 'front'}>Front</button><button onClick={() => setFace('back')} aria-pressed={face === 'back'}>Back</button><Button type="button" variant="outline" size="icon-sm" aria-label="Zoom out" title="Zoom out" onClick={() => requestZoom('out')}><Minus aria-hidden="true" /></Button><Button type="button" variant="outline" size="icon-sm" aria-label="Zoom in" title="Zoom in" onClick={() => requestZoom('in')}><Plus aria-hidden="true" /></Button><button aria-label="Focus selection" title="Focus selection" disabled={!selected} onClick={() => setFocusKey((x) => x + 1)}>Focus</button><button onClick={() => setResetKey((x) => x + 1)}>Reset</button></div>}
      {!compact && <div className="anatomy-structure-list" aria-label="Select anatomy structure">
        {anatomyManifest.map((item) => <button key={item.id} className={selected === item.id ? 'selected' : ''} aria-pressed={selected === item.id} onClick={() => selectStructure(item.id, item.metricKeys)}>{item.label}</button>)}
      </div>}
      {!compact && <div className="anatomy-selection"><span>SELECTED STRUCTURE</span><b>{info?.label ?? 'Select a structure'}</b>{info?.metricKeys.length ? <div className="anatomy-linked-metrics">{info.metricKeys.map((key) => <button key={key} className={selectedMetric === key ? 'active' : ''} aria-pressed={selectedMetric === key} onClick={() => onMetric(key as MetricKey)}>{metricNames[key]}</button>)}</div> : <small>{info ? 'Not assessed · no linked measurement' : 'Choose a related reading marker'}</small>}</div>}
    </div>
    {!compact && <div className="anatomy-tools"><div className="layer-tools"><span>LAYERS</span>{layers.map((layer) => <button key={layer.id} className={visibleLayers.has(layer.id) ? 'on' : ''} aria-pressed={visibleLayers.has(layer.id)} onClick={() => toggleLayer(layer.id)}><i />{layer.label}</button>)}</div><div className="surface-control"><label htmlFor="surfaceOpacity">Surface</label><input id="surfaceOpacity" type="range" min="0.1" max="1" step="0.05" value={surfaceAlpha} onChange={(e) => setSurfaceAlpha(Number(e.target.value))} /><button className={isolated ? 'active' : ''} aria-pressed={isolated} disabled={!selected} onClick={() => setIsolated((x) => !x)}>Isolate selection</button></div></div>}
    {!compact && <div className="anatomy-credit">BodyParts3D, © The Database Center for Life Science · CC BY 4.0 · Adapted for Tether</div>}
  </div>;
}
