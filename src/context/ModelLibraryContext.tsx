
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Group } from 'three';
import { OBJLoader } from 'three-stdlib';
import { ErrorLogger } from '../services/errorLogger';
import { VoxelNode } from '../types';

const assetModelUrl = '/models/server/console.obj';
const riskModelUrl = '/models/shield/shield.obj';
const incidentModelUrl = '/models/flame/flame.obj';
const supplierModelUrl = '/models/cap/cap.obj';
const projectModelUrl = '/models/box/box.obj';

export interface ModelLibrary {
    asset: Group;
    risk: Group;
    incident: Group;
    supplier: Group;
    project: Group;
}

const ModelLibraryContext = createContext<ModelLibrary | null>(null);

export const useModelLibrary = (): ModelLibrary => {
    const context = useContext(ModelLibraryContext);
    if (!context) {
        throw new Error('ModelLibraryContext must be used within ModelLibraryProvider');
    }
    return context;
};

export const ModelLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [library, setLibrary] = useState<ModelLibrary | null>(null);

    useEffect(() => {
        const loadModels = async () => {
            const loader = new OBJLoader();

            const loadSafe = async (url: string): Promise<Group> => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Status ${response.status}`);

                    const text = await response.text();
                    // Critical check: if the server returns HTML (e.g., fallback index.html), abort parsing
                    if (text.trim().toLowerCase().startsWith('<!doctype html') || text.trim().toLowerCase().startsWith('<html')) {
                        throw new Error('Received HTML instead of 3D model');
                    }

                    return loader.parse(text);
                } catch (error) {
                    ErrorLogger.warn(`Failed to load 3D model from ${url}`, 'ModelLibraryProvider.loadModels', { metadata: { error } });
                    // Return an empty group as fallback to prevent crash
                    return new Group();
                }
            };

            const [asset, risk, incident, supplier, project] = await Promise.all([
                loadSafe(assetModelUrl),
                loadSafe(riskModelUrl),
                loadSafe(incidentModelUrl),
                loadSafe(supplierModelUrl),
                loadSafe(projectModelUrl)
            ]);

            setLibrary({ asset, risk, incident, supplier, project });
        };

        loadModels();
    }, []);

    if (!library) return null;

    return <ModelLibraryContext.Provider value={library}>{children}</ModelLibraryContext.Provider>;
};

export const MODEL_LIBRARY_CONFIG: Partial<Record<VoxelNode['type'], { key: keyof ModelLibrary; scale: number; position?: [number, number, number]; rotation?: [number, number, number]; }>> = {
    asset: { key: 'asset', scale: 0.28, position: [0, -0.28, 0], rotation: [0, Math.PI, 0] },
    risk: { key: 'risk', scale: 0.25, position: [0, -0.22, 0], rotation: [-Math.PI / 2, 0, Math.PI] },
    incident: { key: 'incident', scale: 0.22, position: [0, -0.2, 0], rotation: [-Math.PI / 2, 0, 0] },
    supplier: { key: 'supplier', scale: 0.0045, position: [0, -0.004, 0], rotation: [-Math.PI / 2, Math.PI, 0] },
    project: { key: 'project', scale: 0.35, position: [0, -0.25, 0], rotation: [0, Math.PI, 0] },
};
