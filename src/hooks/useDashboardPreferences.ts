import { useState, useEffect, useCallback } from 'react';

export interface WidgetLayout {
    id: string; // Unique instance ID
    widgetId: string; // Type of widget (e.g., 'stats-overview')
    colSpan?: number; // 1, 2, or 3 (out of 3 columns)
    isHidden?: boolean;
}

export interface DashboardPreferences {
    layout: WidgetLayout[];
}

const STORAGE_KEY_PREFIX = 'sentinel_dashboard_prefs_v1_';

export const useDashboardPreferences = (userId: string | undefined, role: string, defaultLayout: WidgetLayout[]) => {
    // Lazy initialization to avoid setState in effect on mount
    const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
        if (!userId) return { layout: defaultLayout };

        const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
        const stored = localStorage.getItem(key);

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && Array.isArray(parsed.layout)) {
                    const storedIds = new Set(parsed.layout.map((w: WidgetLayout) => w.widgetId));
                    const newWidgets = defaultLayout.filter(w => !storedIds.has(w.widgetId));
                    return { layout: [...parsed.layout, ...newWidgets] };
                }
            } catch (e) {
                console.error("Failed to parse dashboard preferences", e);
            }
        }
        return { layout: defaultLayout };
    });

    const [hasLoaded, setHasLoaded] = useState<boolean>(() => !userId);

    // Reload preferences if userId or role changes (after mount)
    useEffect(() => {
        if (!userId) {
            setHasLoaded(true);
            return;
        }

        setHasLoaded(false);

        const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
        const stored = localStorage.getItem(key);

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && Array.isArray(parsed.layout)) {
                    const storedIds = new Set(parsed.layout.map((w: WidgetLayout) => w.widgetId));
                    const newWidgets = defaultLayout.filter(w => !storedIds.has(w.widgetId));
                    // Wrap in setTimeout to avoid "setting state synchronously in effect" warning
                    setTimeout(() => {
                        setPreferences({ layout: [...parsed.layout, ...newWidgets] });
                        setHasLoaded(true);
                    }, 0);
                } else {
                    setTimeout(() => {
                        setPreferences({ layout: defaultLayout });
                        setHasLoaded(true);
                    }, 0);
                }
            } catch (e) {
                console.error("Failed to parse dashboard preferences", e);
                setTimeout(() => {
                    setPreferences({ layout: defaultLayout });
                    setHasLoaded(true);
                }, 0);
            }
        } else {
            // Only reset if key changed and nothing stored
            setTimeout(() => {
                setPreferences({ layout: defaultLayout });
                setHasLoaded(true);
            }, 0);
        }
    }, [userId, role, defaultLayout]);

    const saveLayout = useCallback((newLayout: WidgetLayout[]) => {
        if (!userId) return;

        const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
        const newPrefs = { layout: newLayout };

        setPreferences(newPrefs);
        localStorage.setItem(key, JSON.stringify(newPrefs));
    }, [userId, role]);

    const resetLayout = useCallback(() => {
        if (!userId) return;
        const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
        localStorage.removeItem(key);
        setPreferences({ layout: defaultLayout });
    }, [userId, role, defaultLayout]);

    return {
        layout: preferences.layout,
        updateLayout: saveLayout,
        resetLayout,
        hasLoaded
    };
};
