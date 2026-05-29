import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

// Shape of the shared `assets.json` manifest (the forest-census format).
export interface AssetManifest {
  assets: {
    characters: Record<string, string>;
    animals: Record<string, string>;
    environment: {
      flora: Record<string, string>;
      resources: Record<string, string>;
    };
  };
}

// Resolved, ready-to-load asset paths for the current scene.
export interface AssetPaths {
  player: string;
}

export interface LoadedGltf {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

const loader = new GLTFLoader();
const assetCache = new Map<string, { scene: THREE.Object3D; animations: THREE.AnimationClip[] }>();

// `public/` is served at the site root by Vite, so manifest entries (which are
// stored relative, e.g. `assets/Characters/...`) resolve to absolute `/assets/...`.
function resolveAssetPath(rel: string): string {
  if (typeof rel !== 'string' || rel.startsWith('http') || rel.startsWith('/')) {
    return rel;
  }
  return `/${rel}`;
}

export async function loadManifest(): Promise<AssetPaths> {
  const manifest: AssetManifest = await fetch('/assets.json').then((res) => res.json());
  const player = resolveAssetPath(manifest.assets.characters.Male_1);
  if (!player) throw new Error('Missing player asset path');
  return { player };
}

export async function loadGltf(key: string, url: string): Promise<LoadedGltf> {
  const cached = assetCache.get(key);
  if (cached) {
    return { root: clone(cached.scene), animations: cached.animations };
  }

  const gltf = await loader.loadAsync(url);
  gltf.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const material = child.material as THREE.MeshStandardMaterial | undefined;
      if (material?.map) {
        material.map.colorSpace = THREE.SRGBColorSpace;
      }
    }
  });

  const animations = gltf.animations ?? [];
  assetCache.set(key, { scene: gltf.scene, animations });
  return { root: clone(gltf.scene), animations };
}
