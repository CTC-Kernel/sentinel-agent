
import { useState, useEffect } from 'react';
import { ErrorLogger } from '../../services/errorLogger';

type WidgetState = 'expanded' | 'retracted' | 'closed';

export const useGettingStartedState = (userId: string | undefined) => {
    const storageKey = `getting-started-widget-${userId}`;

    // Initialize state
    const [state, setState] = useState<WidgetState>(() => {
        // Default to expanded until we know the user
        if (!userId) return 'expanded';
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? (JSON.parse(saved) as WidgetState) : 'expanded';
        } catch {
            return 'expanded';
        }
    });

    // Effect to read from storage when userId changes (e.g., login loads)
    useEffect(() => {
        if (!userId) {
            // Reset to default or keep current? 
            // If we logout, maybe reset? But for now, just do nothing.
            return;
        }

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                // We found a saved state for this user, apply it
                const parsed = JSON.parse(saved) as WidgetState;
                setState(parsed);
            } else {
                // No saved state for this user, ensure we are expanded by default
                // But do NOT write yet, let the user action or next effect handle it
                // Actually, if it's a new user, 'expanded' is correct.
                // If we switched users, we need to ensure we don't keep the previous user's state in memory if it differs
                // But the useState initializer only ran once.
                // So we MUST explicitly set state here if storage is empty.
                setState('expanded');
            }
        } catch (error) {
            ErrorLogger.warn('Failed to read widget state', 'useGettingStartedState', { metadata: { error } });
        }
    }, [userId, storageKey]);

    // Effect to write to storage when state changes
    useEffect(() => {
        if (!userId) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(state));
        } catch (error) {
            ErrorLogger.warn('Failed to save widget state', 'useGettingStartedState', { metadata: { error } });
        }
    }, [state, userId, storageKey]);

    return [state, setState] as const;
};
