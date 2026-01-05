import { useState, useCallback } from 'react';
import { aiService } from '../services/aiService';

export const useAIGemini = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const generateContent = useCallback(async (prompt: string): Promise<string | null> => {
        setLoading(true);
        setError(null);
        try {
            const response = await aiService.generateText(prompt);
            return response;
        } catch (err) {
            console.error("AI Generation Error:", err);
            setError(err instanceof Error ? err : new Error('Unknown error'));
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        generateContent,
        loading,
        error
    };
};
