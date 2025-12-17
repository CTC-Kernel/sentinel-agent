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
    const [preferences, setPreferences] = useState<DashboardPreferences>({ layout: defaultLayout });
    const [hasLoaded, setHasLoaded] = useState(false);

    // Load preferences on mount or when user changes
    useEffect(() => {
        if (!userId) return;

        const key = `${STORAGE_KEY_PREFIX}${userId}_${role}`;
        const stored = localStorage.getItem(key);

        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Basic validation: ensure we have a layout array
                if (parsed && Array.isArray(parsed.layout)) {
                    // Merge with default layout to ensure new widgets appear if added in code
                    // For simplicity, we'll trust the stored layout but you might want migration logic here
                    // A simple strategy: if a widgetId in defaultLayout is missing in stored, add it to the end.
                    const storedIds = new Set(parsed.layout.map((w: WidgetLayout) => w.widgetId));
                    const newWidgets = defaultLayout.filter(w => !storedIds.has(w.widgetId));

                    setPreferences({
                        layout: [...parsed.layout, ...newWidgets]
                    });
                } else {
                    setPreferences({ layout: defaultLayout });
                }
            } catch (e) {
                console.error("Failed to parse dashboard preferences", e);
                setPreferences({ layout: defaultLayout });
            }
        } else {
            setPreferences({ layout: defaultLayout });
        }
        setHasLoaded(true);
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
