import { Group } from 'three';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ModelType, LazyModelLibrary, loadSafe, MODEL_URLS } from './modelLibraryConstants';
import { ModelLibraryContext } from './ModelLibraryContextDefinition';

// Cache for loaded models (persists across component remounts)
const modelCache: Partial<Record<ModelType, Group>> = {};
const loadingPromises: Partial<Record<ModelType, Promise<Group>>> = {};

// Track pending lazy load requests (to trigger effect-based loading)
const pendingLazyLoads = new Set<ModelType>();

export const ModelLibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [loadedModels, setLoadedModels] = useState<Partial<Record<ModelType, Group>>>(() => ({ ...modelCache }));
    const [loadingStates, setLoadingStates] = useState<Partial<Record<ModelType, boolean>>>({});
    const [lazyLoadTrigger, setLazyLoadTrigger] = useState(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Effect to process pending lazy loads (avoids setState during render)
    useEffect(() => {
        if (pendingLazyLoads.size === 0) return;

        const toLoad = Array.from(pendingLazyLoads);
        pendingLazyLoads.clear();

        toLoad.forEach(type => {
            // Skip if already loaded or loading
            if (modelCache[type] || loadingPromises[type]) return;

            setLoadingStates(prev => ({ ...prev, [type]: true }));

            const loadPromise = (async () => {
                try {
                    const url = MODEL_URLS[type];
                    // Model loading: ${type}
                    const model = await loadSafe(url);

                    modelCache[type] = model;

                    if (mountedRef.current) {
                        setLoadedModels(prev => ({ ...prev, [type]: model }));
                        setLoadingStates(prev => ({ ...prev, [type]: false }));
                    }

                    // Model loaded successfully
                    return model;
                } catch {
                    if (mountedRef.current) {
                        setLoadingStates(prev => ({ ...prev, [type]: false }));
                    }
                    const fallback = new Group();
                    modelCache[type] = fallback;
                    return fallback;
                } finally {
                    delete loadingPromises[type];
                }
            })();

            loadingPromises[type] = loadPromise;
        });
    }, [lazyLoadTrigger]);

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
                // Model loading: ${type}
                const model = await loadSafe(url);

                // Cache the loaded model
                modelCache[type] = model;

                if (mountedRef.current) {
                    setLoadedModels(prev => ({ ...prev, [type]: model }));
                    setLoadingStates(prev => ({ ...prev, [type]: false }));
                }

                // Model loaded successfully
                return model;
            } catch {
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
        // Schedule lazy load via effect (avoid setState during render)
        if (!loadingPromises[type] && !pendingLazyLoads.has(type)) {
            pendingLazyLoads.add(type);
            // Trigger effect on next tick
            setTimeout(() => {
                if (mountedRef.current) {
                    setLazyLoadTrigger(prev => prev + 1);
                }
            }, 0);
        }
        return null;
    }, [loadedModels]);

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
