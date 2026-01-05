import React, { useState, useEffect } from 'react';
import { ModelLibrary, loadSafe } from './modelLibraryConstants';
import { ModelLibraryContext } from './ModelLibraryContextDefinition';


const assetModelUrl = '/models/lock/lock.obj';
const riskModelUrl = '/models/warning/warning.obj';
const incidentModelUrl = '/models/alert/alert.obj';
const supplierModelUrl = '/models/cap/cap.obj';
const projectModelUrl = '/models/box/box.obj';

export const ModelLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [library, setLibrary] = useState<ModelLibrary | null>(null);

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

    if (!library) return null;

    return <ModelLibraryContext.Provider value={library}>{children}</ModelLibraryContext.Provider>;
};

