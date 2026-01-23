import { Group } from 'three';
import React, { useState, useEffect } from 'react';
import { ModelLibrary, loadSafe } from './modelLibraryConstants';
import { ModelLibraryContext } from './ModelLibraryContextDefinition';


const assetModelUrl = '/models/server/console.obj';
const riskModelUrl = '/models/flame/flame.obj';
const incidentModelUrl = '/models/shield/shield.obj';
const supplierModelUrl = '/models/cap/cap.obj';
const projectModelUrl = '/models/box/box.obj';

export const ModelLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [library, setLibrary] = useState<ModelLibrary>({
        asset: new Group(),
        risk: new Group(),
        incident: new Group(),
        supplier: new Group(),
        project: new Group()
    });

    useEffect(() => {
        const loadModels = async () => {
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

    // Library is now always initialized with fallbacks, so we don't return null

    return <ModelLibraryContext.Provider value={library}>{children}</ModelLibraryContext.Provider>;
};

