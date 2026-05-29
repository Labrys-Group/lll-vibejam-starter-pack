import * as THREE from 'three';

// An animated actor: a set of named clip actions keyed by lowercase clip name,
// plus the name of whichever action is currently playing.
export interface Actor {
  actions: Map<string, THREE.AnimationAction>;
  currentAction: string | null;
}

// ---- Animation + transform helpers (ported from forest-census) -----------

export function yawFromDirection(direction: THREE.Vector3): number {
  // This asset pack visually faces +Z at yaw=0.
  return Math.atan2(direction.x, direction.z);
}

export function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  const tau = 1 - Math.exp(-lambda * dt);
  const delta = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + delta * tau;
}

export function buildActionMap(
  mixer: THREE.AnimationMixer,
  animations: THREE.AnimationClip[],
): Map<string, THREE.AnimationAction> {
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of animations) {
    const name = (clip.name || '').trim();
    if (name) actions.set(name.toLowerCase(), mixer.clipAction(clip));
  }
  return actions;
}

export function pickActionName(
  actions: Map<string, THREE.AnimationAction>,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (actions.has(key)) return key;
  }
  return null;
}

export function playAction(actor: Actor, nextName: string | null, fadeSeconds = 0.15): void {
  if (!nextName || actor.currentAction === nextName) return;
  const next = actor.actions.get(nextName);
  if (!next) return;
  next.enabled = true;
  next.reset();
  next.fadeIn(fadeSeconds);
  next.play();
  if (actor.currentAction) {
    const prev = actor.actions.get(actor.currentAction);
    if (prev && prev !== next) prev.fadeOut(fadeSeconds);
  }
  actor.currentAction = nextName;
}

export function normalizeToHeightAndGround(
  object: THREE.Object3D,
  targetHeight: number,
  sink = 0.0,
): THREE.Object3D {
  const boxBefore = new THREE.Box3().setFromObject(object);
  const heightBefore = boxBefore.max.y - boxBefore.min.y || 1;
  object.scale.setScalar(targetHeight / heightBefore);
  const boxAfter = new THREE.Box3().setFromObject(object);
  object.position.y += -boxAfter.min.y + sink;
  return object;
}

export function anchorMinYToGround(object: THREE.Object3D, sink = 0): void {
  object.updateWorldMatrix(true, true);
  object.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton) child.skeleton.update();
  });
  const box = new THREE.Box3().setFromObject(object);
  object.position.y += -box.min.y + sink;
}
