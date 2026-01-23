import { Group } from 'three';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ModelType, LazyModelLibrary, loadSafe, MODEL_URLS } from './modelLibraryConstants';
import { ModelLibraryContext } from './ModelLibraryContextDefinition';

// Cache for loaded models (persists across component remounts)
const modelCache: Partial<Record<ModelType, Group>> = {};
const loadingPromises: Partial<Record<ModelType, Promise<Group>>> = {};

export const ModelLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [loadedModels, setLoadedModels] = useState<Partial<Record<ModelType, Group>>>(() => ({ ...modelCache }));
    const [loadingStates, setLoadingStates] = useState<Partial<Record<ModelType, boolean>>>({});
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const loadModel = useCallback(async (type: ModelType): Promise<Group> => {
        // Return cached model if available
        if (modelCache[type]) {
            return modelCache[type]!;
        }

        // Return existing loading promise if already loading
        if (loadingPromises[type]) {
            return loadingPromises[type]!;
        }

        // Start loading
        if (mountedRef.current) {
            setLoadingStates(prev => ({ ...prev, [type]: true }));
        }

        const loadPromise = (async () => {
            try {
                const url = MODEL_URLS[type];
                console.log(`[3D Models] Loading ${type} model...`);
                const model = await loadSafe(url);

                // Cache the loaded model
                modelCache[type] = model;

                if (mountedRef.current) {
                    setLoadedModels(prev => ({ ...prev, [type]: model }));
                    setLoadingStates(prev => ({ ...prev, [type]: false }));
                }

                console.log(`[3D Models] Loaded ${type} model`);
                return model;
            } catch (_error) {
                if (mountedRef.current) {
                    setLoadingStates(prev => ({ ...prev, [type]: false }));
                }
                // Return empty group as fallback
                const fallback = new Group();
                modelCache[type] = fallback;
                return fallback;
            } finally {
                delete loadingPromises[type];
            }
        })();

        loadingPromises[type] = loadPromise;
        return loadPromise;
    }, []);

    const getModel = useCallback((type: ModelType): Group | null => {
        // First check local state
        if (loadedModels[type]) {
            return loadedModels[type]!;
        }
        // Check global cache
        if (modelCache[type]) {
            return modelCache[type]!;
        }
        // Trigger lazy load
        loadModel(type);
        return null;
    }, [loadedModels, loadModel]);

    const isLoaded = useCallback((type: ModelType): boolean => {
        return !!loadedModels[type] || !!modelCache[type];
    }, [loadedModels]);

    const isLoading = useCallback((type: ModelType): boolean => {
        return !!loadingStates[type];
    }, [loadingStates]);

    const library: LazyModelLibrary = {
        getModel,
        loadModel,
        isLoaded,
        isLoading,
    };

    return <ModelLibraryContext.Provider value={library}>{children}</ModelLibraryContext.Provider>;
};
