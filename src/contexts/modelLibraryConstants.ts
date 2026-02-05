import { Group } from 'three';
import { VoxelNode } from '../types';
import { ErrorLogger } from '../services/errorLogger';

export type ModelType = 'asset' | 'risk' | 'incident' | 'supplier' | 'project';

export interface ModelLibrary {
 asset: Group;
 risk: Group;
 incident: Group;
 supplier: Group;
 project: Group;
}

export interface LazyModelLibrary {
 getModel: (type: ModelType) => Group | null;
 loadModel: (type: ModelType) => Promise<Group>;
 isLoaded: (type: ModelType) => boolean;
 isLoading: (type: ModelType) => boolean;
}

export const MODEL_URLS: Record<ModelType, string> = {
 asset: '/models/server/console.obj',
 risk: '/models/flame/flame.obj',
 incident: '/models/shield/shield.obj',
 supplier: '/models/cap/cap.obj',
 project: '/models/box/box.obj',
};

export const MODEL_LIBRARY_CONFIG: Partial<Record<VoxelNode['type'], { key: ModelType; scale: number; position?: [number, number, number]; rotation?: [number, number, number]; }>> = {
 asset: { key: 'asset', scale: 0.28, position: [0, -0.28, 0], rotation: [0, Math.PI, 0] },
 risk: { key: 'risk', scale: 0.25, position: [0, -0.22, 0], rotation: [-Math.PI / 2, 0, Math.PI] },
 incident: { key: 'incident', scale: 0.22, position: [0, -0.2, 0], rotation: [-Math.PI / 2, 0, 0] },
 supplier: { key: 'supplier', scale: 0.0045, position: [0, -0.004, 0], rotation: [-Math.PI / 2, Math.PI, 0] },
 project: { key: 'project', scale: 0.35, position: [0, -0.25, 0], rotation: [0, Math.PI, 0] },
};

export const loadSafe = async (url: string): Promise<Group> => {
 const { OBJLoader } = await import('three-stdlib');
 const loader = new OBJLoader();
 
 try {
 const response = await fetch(url);
 if (!response.ok) throw new Error(`Status ${response.status}`);

 const text = await response.text();
 // Critical check: if the server returns HTML (e.g., fallback index.html), abort parsing
 if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
 throw new Error('Received HTML instead of 3D model');
 }

 const object = loader.parse(text);
 return object;
 } catch (error) {
 ErrorLogger.warn(`Failed to load 3D model from ${url}`, 'modelLibraryConstants.loadSafe', {
 metadata: { error }
 });
 // Return a fallback empty group to prevent crashes
 return new Group();
 }
};
