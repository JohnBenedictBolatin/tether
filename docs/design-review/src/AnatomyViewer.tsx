import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame, useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls as OrbitControlsImpl } from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import { Minus, Plus } from 'lucide-react';
import { Button } from './components/ui/button';
import { MetricGlyph } from './TetherIcons';
import { anatomyManifest, metricNames, structureForNode } from './anatomyManifest';
import { bodyTargetForMetric, type AssessmentState } from './assessment';
import './anatomy.css';

type MetricKey = 'heart' | 'bp' | 'glucose' | 'temperature' | 'sleep' | 'mood';
type ViewerProps = { selectedMetric: MetricKey | null; selectedStructure: string; focusRequestKey?: number; reducedMotion: boolean; onMetric: (key: MetricKey | null) => void; onStructure: (id: string) => void; highlightState?: AssessmentState; priorityStructure?: string; priorityState?: AssessmentState; compact?: boolean };

const layers = [
  { id: 'surface', label: 'Body surface' }, { id: 'skeleton', label: 'Skeleton' },
  { id: 'muscular', label: 'Muscles' }, { id: 'cardiovascular', label: 'Cardiovascular' },
  { id: 'respiratory', label: 'Respiratory' }, { id: 'digestive', label: 'Digestive' },
] as const;
const ANATOMY_ASSET_REVISION = '20261031a';

type ZoomRequest = { sequence: number; direction: 'in' | 'out' };
type FrameTarget = { center: THREE.Vector3; size: THREE.Vector3 } | null;
type TurnRef = { current: THREE.Group | null };

function installBodyContour(material: THREE.MeshStandardMaterial) {
  if (material.userData.tetherBodyContour) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.tetherContourColor = { value: new THREE.Color('#9adab8') };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTetherViewNormal;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvTetherViewNormal = normalize(normalMatrix * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 tetherContourColor;\nvarying vec3 vTetherViewNormal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float tetherRim = 1.0 - abs(normalize(vTetherViewNormal).z);
        float tetherContour = smoothstep(0.94, 0.985, tetherRim);
        diffuseColor.rgb = mix(diffuseColor.rgb, tetherContourColor, tetherContour);
        diffuseColor.a = mix(diffuseColor.a, 0.9, tetherContour);`);
  };
  material.customProgramCacheKey = () => 'tether-body-contour-v1';
  material.userData.tetherBodyContour = true;
  material.needsUpdate = true;
}

function CameraControls({ resetKey, face, focus, frameTarget, reducedMotion, zoomRequest, compact, autoTurn }: { resetKey: number; face: 'front' | 'back'; focus: FrameTarget; frameTarget: FrameTarget; reducedMotion: boolean; zoomRequest: ZoomRequest; compact: boolean; autoTurn: TurnRef }) {
  const { camera, gl, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl | null>(null);
  const trackedPoint = useRef<{ local: THREE.Vector3; previousWorld: THREE.Vector3 } | null>(null);
  useEffect(() => {
    const orbit = new OrbitControlsImpl(camera, gl.domElement);
    orbit.enabled = !compact;
    orbit.enableRotate = !compact;
    orbit.enablePan = !compact;
    orbit.enableZoom = !compact;
    orbit.enableDamping = !compact && !reducedMotion;
    orbit.dampingFactor = 0.075;
    orbit.minDistance = compact ? 0.65 : 1.4;
    orbit.maxDistance = 8.5;
    orbit.minPolarAngle = 0.22;
    orbit.maxPolarAngle = Math.PI - 0.22;
    orbit.target.set(0, 0.95, 0);
    controls.current = orbit;
    orbit.addEventListener('change', () => invalidate());
    orbit.update();
    return () => { orbit.dispose(); controls.current = null; };
  }, [camera, gl, invalidate, reducedMotion, compact]);
  useEffect(() => {
    if (!controls.current) return;
    const center = frameTarget?.center ?? new THREE.Vector3(0, 0.95, 0);
    const direction = new THREE.Vector3(face === 'front' ? 0.43 : -0.43, 0.08, face === 'front' ? 0.9 : -0.9).normalize();
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov ?? 31);
    const aspect = gl.domElement.clientWidth / Math.max(gl.domElement.clientHeight, 1);
    const size = frameTarget?.size ?? new THREE.Vector3(1.4, 3.25, 0.7);
    const fit = compact ? gl.domElement.clientHeight < 160 ? 0.9 : 1.02 : 1.2;
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
      compact ? 1.05 : 1.4,
    ) * (compact ? 0.94 : 1.08);
    const destination = focus.center.clone().add(direction.multiplyScalar(distance));
    // The Today panel is a fixed instrument view: frame the selected area
    // exactly so the anatomy never lands halfway between body and organ views.
    if (compact || reducedMotion) camera.position.copy(destination);
    else camera.position.lerp(destination, 0.82);
    controls.current.update();
    if (compact && autoTurn.current) {
      autoTurn.current.updateWorldMatrix(true, false);
      const inverse = autoTurn.current.matrixWorld.clone().invert();
      trackedPoint.current = { local: focus.center.clone().applyMatrix4(inverse), previousWorld: focus.center.clone() };
    } else {
      trackedPoint.current = null;
    }
    invalidate();
  }, [focus, camera, gl, reducedMotion, compact, invalidate, autoTurn]);
  useEffect(() => {
    if (!zoomRequest.sequence || !controls.current) return;
    if (zoomRequest.direction === 'in') controls.current.dollyIn(1.15);
    else controls.current.dollyOut(1.15);
    controls.current.update();
    invalidate();
  }, [zoomRequest, invalidate]);
  useEffect(() => {
    if (compact) return;
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
  }, [invalidate, compact]);
  useFrame(() => {
    const point = trackedPoint.current;
    const turn = autoTurn.current;
    if (compact && !reducedMotion && point && turn && controls.current) {
      turn.updateWorldMatrix(true, false);
      const nextWorld = point.local.clone().applyMatrix4(turn.matrixWorld);
      const delta = nextWorld.sub(point.previousWorld);
      if (delta.lengthSq() > 1e-12) {
        controls.current.target.add(delta);
        camera.position.add(delta);
        point.previousWorld.copy(point.local.clone().applyMatrix4(turn.matrixWorld));
        controls.current.update();
      }
      invalidate();
      return;
    }
    if (controls.current?.update()) invalidate();
  });
  return null;
}
function Anatomy({ visibleLayers, selected, onSelect, onFocus, onFrame, frameTarget, surfaceAlpha, isolated, focusKey, highlightState, priorityStructure, priorityState, assetAttempt, compact, reducedMotion, autoTurn }: {
  visibleLayers: Set<string>; selected: string; onSelect: (id: string, metricKeys: string[]) => void;
  onFocus: (frame: FrameTarget) => void; onFrame: (center: THREE.Vector3, size: THREE.Vector3) => void; frameTarget: FrameTarget; surfaceAlpha: number; isolated: boolean; focusKey: number; highlightState?: AssessmentState; priorityStructure?: string; priorityState?: AssessmentState; assetAttempt: number; compact: boolean; reducedMotion: boolean; autoTurn: TurnRef;
}) {
  const assetUrl = (path: string) => `${path}?rev=${ANATOMY_ASSET_REVISION}&attempt=${assetAttempt}`;
  const [bodyAsset] = useLoader(GLTFLoader, [assetUrl('/assets/anatomy/reference-body.glb')]);
  const invalidate = useThree((state) => state.invalidate);
  const body = useMemo(() => bodyAsset.scene.clone(true), [bodyAsset]);
  const model = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!compact || reducedMotion || !autoTurn.current) return;
    // Rotate around the converted anatomical vertical axis; the camera tracks
    // the focused point so this motion does not pull it off-center.
    autoTurn.current.rotation.z = Math.sin(clock.elapsedTime * 0.11) * 0.22;
    invalidate();
  });
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
    if (model.current) {
      model.current.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.current);
      if (!bounds.isEmpty()) onFrame(bounds.getCenter(new THREE.Vector3()), bounds.getSize(new THREE.Vector3()));
    }
    invalidate();
  }, [body, invalidate, onFrame]);
  useEffect(() => {
    body.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || node.userData.tetherOutline) return;
      const structure = structureForNode(node.name);
      const layer = structure?.system ?? 'other';
      const isSelected = !!selected && node.userData.tetherStructure === selected;
      const isPriorityTarget = !!priorityStructure && node.userData.tetherStructure === priorityStructure;
      // The compact Today view is a focused reading view: retain the faint
      // body surface for orientation, but render only the selected structure.
      // Full layer browsing remains available in the dedicated Body view.
      node.visible = compact
        ? layer === 'surface' || isSelected
        : (visibleLayers.has(layer) || layer === 'other') && (!isolated || isSelected || isPriorityTarget);
      const skin = layer === 'surface';
      const materials = node.userData.tetherMaterials as THREE.Material[] | undefined;
      materials?.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          const baseColor = skin ? '#a7b5aa' : layer === 'skeleton' ? '#aaa79b' : layer === 'muscular' ? '#987a76' : layer === 'cardiovascular' ? '#ad7771' : layer === 'respiratory' ? '#78947f' : '#9b907c';
          const selectedColor = highlightState === 'urgent' ? '#d97772' : ['attention', 'verify', 'stale'].includes(highlightState ?? '') ? '#e0a452' : '#78c6a4';
          const priorityColor = priorityState === 'urgent' ? '#d97772' : '#e0a452';
          const numericPriority = isPriorityTarget && (priorityState === 'urgent' || priorityState === 'attention');
          const fillHighlight = node.userData.tetherStructure !== 'skin' && (numericPriority || isSelected);
          const fillColor = numericPriority ? priorityColor : selectedColor;
          if (skin && compact) installBodyContour(material);
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
  }, [body, visibleLayers, selected, priorityStructure, priorityState, surfaceAlpha, isolated, invalidate, highlightState, compact]);
  useEffect(() => {
    const outlines: Array<{ parent: THREE.Mesh; outline: THREE.Mesh }> = [];
    body.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || node.userData.tetherOutline) return;
      const isSelected = !!selected && node.userData.tetherStructure === selected;
      const isPriorityTarget = !!priorityStructure && node.userData.tetherStructure === priorityStructure;
      const skinTarget = node.userData.tetherStructure === 'skin';
      if (compact && skinTarget) return;
      if (!isSelected && !isPriorityTarget) return;
      const priorityHasCue = isPriorityTarget && ['urgent', 'attention', 'verify'].includes(priorityState ?? '');
      const color = priorityHasCue
        ? priorityState === 'urgent' ? '#d97772' : '#e0a452'
        : isSelected ? highlightState === 'urgent' ? '#d97772' : ['attention', 'verify', 'stale'].includes(highlightState ?? '') ? '#e0a452' : '#78c6a4' : '#9adab8';
      const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, transparent: true, opacity: skinTarget ? priorityHasCue ? 0.4 : 0.3 : priorityState === 'verify' && isPriorityTarget ? 0.88 : 0.82, depthWrite: false });
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
  }, [body, selected, highlightState, priorityStructure, priorityState, compact, invalidate]);
  useEffect(() => {
    if (!focusKey) return;
    if (compact && selected === 'vessels' && frameTarget) {
      const center = frameTarget.center.clone();
      const size = frameTarget.size.clone();
      center.y += size.y * 0.18;
      onFocus({ center, size: new THREE.Vector3(size.x * 0.52, size.y * 0.32, size.z * 0.72) });
      return;
    }
    if (selected === 'skin' && frameTarget) {
      onFocus(frameTarget);
      return;
    }
    if (!selected && compact && frameTarget) {
      const size = frameTarget.size.clone();
      const center = frameTarget.center.clone();
      center.y += size.y * 0.39;
      onFocus({ center, size: new THREE.Vector3(size.x * 0.3, size.y * 0.22, size.z * 0.48) });
      return;
    }
    const bounds = new THREE.Box3();
    body.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible || node.userData.tetherStructure !== selected) return;
      node.updateWorldMatrix(true, false);
      bounds.expandByObject(node);
    });
    if (!bounds.isEmpty()) onFocus({ center: bounds.getCenter(new THREE.Vector3()), size: bounds.getSize(new THREE.Vector3()) });
  }, [body, selected, focusKey, onFocus, frameTarget, compact]);
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
  return <group ref={model} onClick={compact ? undefined : handleClick}>
    <group ref={autoTurn} position={[0, 0.95, 0]}>
      <group position={[0, -0.95, 0]}><primitive object={body} dispose={null} /></group>
    </group>
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
  const autoTurn = useRef<THREE.Group>(null);
  const reportFrame = useCallback((center: THREE.Vector3, size: THREE.Vector3) => {
    setFrameTarget((current) => current && current.center.distanceToSquared(center) < 1e-8 && current.size.distanceToSquared(size) < 1e-8 ? current : { center: center.clone(), size: size.clone() });
  }, []);
  useEffect(() => { if (focus) onFocus(focus); }, [focus, onFocus]);
  return <>
    <ModelReady onLoaded={onLoaded} />
    <ambientLight intensity={1.2} />
    <directionalLight position={[4, 6, 4]} intensity={1.9} color="#e5e9dd" />
    <directionalLight position={[-4, 2, -3]} intensity={0.85} color="#91b99d" />
    <directionalLight position={[0, 4, 5]} intensity={0.38} color="#d8be8f" />
    <Anatomy visibleLayers={visibleLayers} selected={selected} onSelect={onSelect} onFocus={setFocus} onFrame={reportFrame} frameTarget={frameTarget} surfaceAlpha={surfaceAlpha} isolated={isolated} focusKey={focusKey} highlightState={highlightState} priorityStructure={priorityStructure} priorityState={priorityState} assetAttempt={assetAttempt} compact={compact} reducedMotion={reducedMotion} autoTurn={autoTurn} />
    <CameraControls resetKey={resetKey} face={face} focus={focus} frameTarget={frameTarget} reducedMotion={reducedMotion} zoomRequest={zoomRequest} compact={compact} autoTurn={autoTurn} />
  </>;
}

export function AnatomyViewer({ selectedMetric, selectedStructure, focusRequestKey, reducedMotion, onMetric, onStructure, highlightState, priorityStructure, priorityState, compact = false }: ViewerProps) {
  // Today follows its selected reading, never a stale anatomy selection from
  // the separate Body view. This prevents an old skeleton selection from
  // tinting the skull amber when the current reading concerns another system.
  const selected = compact
    ? selectedMetric ? bodyTargetForMetric(selectedMetric) ?? '' : ''
    : selectedStructure;
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(['surface', 'cardiovascular', 'respiratory', 'digestive']));
  const [isolated, setIsolated] = useState(false);
  const [surfaceAlpha, setSurfaceAlpha] = useState(compact ? 0.16 : 0.5);
  const [resetKey, setResetKey] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [zoomRequest, setZoomRequest] = useState<ZoomRequest>({ sequence: 0, direction: 'in' });
  const [face, setFace] = useState<'front' | 'back'>('front');
  const [assetAttempt, setAssetAttempt] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelError, setModelError] = useState(false);
  const info = anatomyManifest.find((item) => item.id === selected);
  const focusTitle = selected === 'skin' ? 'Body surface' : info?.label ?? (selectedMetric === 'sleep' ? 'Sleep check-in' : selectedMetric === 'mood' ? 'Mood check-in' : selectedMetric === 'bp' ? 'Blood vessels' : selectedMetric === 'heart' ? 'Heart' : 'Whole body');
  const focusDetail = selectedMetric ? metricNames[selectedMetric] : 'Reference anatomy';
  const focusState = priorityStructure === selected ? priorityState : highlightState;
  const focusStatus = focusState ? ({ urgent: 'Urgent', attention: 'Review', verify: 'Check conditions', within: 'Within limits', unconfigured: 'Limits not set', missing: 'No reading', stale: 'Out of date' } as const)[focusState] : '';
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
    if (!focusRequestKey && !compact) return;
    if (selected && selectedSystem) {
      setVisibleLayers((current) => current.has(selectedSystem) ? current : new Set(current).add(selectedSystem));
      setFocusKey((x) => x + 1);
    } else if (compact) {
      setFocusKey((x) => x + 1);
    } else {
      setIsolated(false);
      setResetKey((x) => x + 1);
    }
  }, [focusRequestKey, selected, selectedSystem, compact]);
  useEffect(() => {
    if (compact) return;
    const keydown = (event: KeyboardEvent) => {
      const node = event.target as HTMLElement;
      if (node.matches('button,input,select,textarea')) return;
      if (event.key === 'ArrowLeft') setFace('back');
      if (event.key === 'ArrowRight') setFace('front');
      if (event.key === '0') setResetKey((x) => x + 1);
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [compact]);
  return <div className={`anatomy-shell ${compact ? 'compact-anatomy' : ''}`}>
    {!compact && <div className="anatomy-header"><div><span className="anatomy-title">Reference anatomy</span><span className="anatomy-tag"><i /> 3D MODEL</span></div><span className="anatomy-hint">Drag to rotate <b>·</b> Scroll or use zoom buttons</span></div>}
    <div className="anatomy-stage">
      <ModelBoundary key={assetAttempt} onRetry={retryModel}><Canvas aria-hidden={compact} frameloop="demand" camera={{ position: [3.7, 1.35, 5.9], fov: 31 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }}>
        <CanvasModelBoundary onError={(error) => { console.error('Unable to load the offline anatomy assets', error); setModelError(true); }}>
        <Suspense fallback={null}><ModelScene selected={selected} visibleLayers={visibleLayers} onSelect={selectStructure} onFocus={() => {}} surfaceAlpha={surfaceAlpha} face={face} resetKey={resetKey} focusKey={focusKey} zoomRequest={zoomRequest} onLoaded={markModelLoaded} isolated={isolated} reducedMotion={reducedMotion} highlightState={highlightState} priorityStructure={priorityStructure} priorityState={priorityState} assetAttempt={assetAttempt} compact={compact} /></Suspense>
        </CanvasModelBoundary>
      </Canvas></ModelBoundary>
      {compact && <div className="anatomy-focus-badge" data-state={focusState ?? 'unconfigured'} role="status" aria-live="polite">
        <MetricGlyph name={selectedMetric ?? 'heart'} size={24} />
        <span className="anatomy-focus-copy"><strong>{focusTitle}</strong><small>{focusDetail}</small></span>
        {focusStatus && <span className="anatomy-focus-status">{focusStatus}</span>}
      </div>}
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
