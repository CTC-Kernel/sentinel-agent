import { useState, useCallback } from 'react';
import { ErrorLogger } from '../../services/errorLogger';

const STORAGE_KEY = 'sentinel_ai_summary';

interface StoredSummary {
    content: string;
    timestamp: number;
}

export const useAIAnalysisPersistence = () => {
    const getToday7AM = () => {
        const now = new Date();
        const sevenAM = new Date(now);
        sevenAM.setHours(7, 0, 0, 0);
        return sevenAM.getTime();
    };

    const [storedSummary, setStoredSummary] = useState<string | null>(() => {
        try {
            const item = localStorage.getItem(STORAGE_KEY);
            if (item) {
                const parsed: StoredSummary = JSON.parse(item);
                const sevenAM = getToday7AM();

                // Valid if created after today's 7 AM
                if (parsed.timestamp > sevenAM) {
                    return parsed.content;
                }
            }
        } catch (error) {
            ErrorLogger.error(error, 'useAIAnalysisPersistence.getStoredSummary');
        }
        return null;
    });

    const saveSummary = useCallback((content: string) => {
        try {
            const data: StoredSummary = {
                content,
                timestamp: Date.now()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            setStoredSummary(content);
        } catch (error) {
            ErrorLogger.error(error, 'useAIAnalysisPersistence.saveSummary');
        }
    }, []);

    const clearSummary = useCallback(() => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            setStoredSummary(null);
        } catch (error) {
            ErrorLogger.error(error, 'useAIAnalysisPersistence.clearSummary');
        }
    }, []);

    return {
        storedSummary,
        saveSummary,
        clearSummary
    };
};
