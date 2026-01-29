import { doc, setDoc, serverTimestamp, Timestamp, FieldValue } from 'firebase/firestore';
import { db, functions } from '../firebase';
import { httpsCallable } from "firebase/functions";
import { Asset, Risk, Project, Audit, Incident, Supplier, Control, AISuggestedLink, AIInsight } from "../types";
import { ErrorLogger } from "./errorLogger";
import { aiPrivacyService } from "./aiPrivacyService";
import { useStore } from '../store';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isError?: boolean;
}

export interface Conversation {
    messages: ChatMessage[];
    createdAt: Date;
    updatedAt: Date;
}

const FAST_MODEL = "gemini-3-flash-preview";
const SMART_MODEL = "gemini-3-pro-preview";
const ULTRA_MODEL = "gemini-3-pro-preview"; // Alias for clarity

const rateLimitMap = new Map<string, number>();
const pendingRequests = new Set<string>();
const RATE_LIMIT_MS = 2000;
const MAX_CACHE_SIZE = 500;

const isRateLimited = (key: string): boolean => {
    const now = Date.now();
    if (pendingRequests.has(key)) return true;
    const lastCall = rateLimitMap.get(key) || 0;
    if (now - lastCall < RATE_LIMIT_MS) return true;
    pendingRequests.add(key);
    rateLimitMap.set(key, now);
    if (rateLimitMap.size > MAX_CACHE_SIZE) {
        const cutoff = now - RATE_LIMIT_MS * 2;
        for (const [k, v] of rateLimitMap.entries()) {
            if (v < cutoff) {
                rateLimitMap.delete(k);
                pendingRequests.delete(k);
            }
        }
    }
    return false;
};

const releaseRateLimit = (key: string): void => {
    pendingRequests.delete(key);
};

interface GraphData {
    assets: Asset[];
    risks: Risk[];
    projects: Project[];
    audits: Audit[];
    incidents: Incident[];
    suppliers: Supplier[];
    controls: Control[];
}

const getAISettings = () => {
    const state = useStore.getState();
    const settings = state.organization?.settings?.aiSettings;
    return {
        enabled: settings?.enabled !== false,
        sanitization: settings?.dataSanitization !== false,
        consent: settings?.consentGiven === true
    };
};

export const aiService = {
    async initConversation(userId: string): Promise<void> {
        try {
            const conversationRef = doc(db, 'conversations_ai', userId);
            await setDoc(conversationRef, {
                messages: [{
                    id: 'welcome',
                    role: 'assistant',
                    content: "Bonjour je suis **Sentinel AI**. \n\nComment puis-je vous aider à sécuriser votre organisation aujourd'hui ?",
                    timestamp: serverTimestamp() as FieldValue
                }],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.initConversation');
            throw _error;
        }
    },

    async saveMessages(userId: string, messages: ChatMessage[]): Promise<void> {
        try {
            const conversationRef = doc(db, 'conversations_ai', userId);
            await setDoc(conversationRef, {
                messages: messages.map(m => ({
                    ...m,
                    timestamp: m.timestamp instanceof Date ? Timestamp.fromDate(m.timestamp) : m.timestamp
                })),
                updatedAt: serverTimestamp()
            }, { merge: true });
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.saveMessages');
            throw _error;
        }
    },

    async analyzeGraph(data: GraphData): Promise<{ suggestions: AISuggestedLink[]; insights: AIInsight[] }> {
        const aiSettings = getAISettings();
        if (!aiSettings.enabled) {
            throw new Error("Sentinel AI est désactivé par votre administrateur.");
        }

        try {
            const sanitizedData = aiPrivacyService.anonymizeData(data, aiSettings.sanitization) as GraphData;

            const promptData = {
                assets: sanitizedData.assets.map(a => ({ id: a.id, name: a.name, type: a.type, criticality: a.confidentiality })),
                risks: sanitizedData.risks.map(r => ({ id: r.id, threat: r.threat, score: r.score, assetId: r.assetId })),
                projects: sanitizedData.projects.map(p => ({ id: p.id, name: p.name, status: p.status })),
                incidents: sanitizedData.incidents.map(i => ({ id: i.id, title: i.title, severity: i.severity, affectedAssetId: i.affectedAssetId })),
                controls: sanitizedData.controls.map(c => ({ id: c.id, name: c.name, status: c.status, type: c.type })),
            };

            const prompt = `
        You are a Cybersecurity Expert AI analyzing a GRC (Governance, Risk, Compliance) graph.
        
        Analyze the following JSON data representing a company's security posture:
        ${JSON.stringify(promptData)}

        Your task is to:
        1. Identify HIDDEN relationships (links) between items that are not explicitly linked but should be.
        2. Generate high-level INSIGHTS about the overall security posture.

        Return the result strictly in the following JSON format:
        {
          "suggestions": [
            { "sourceId": "string", "targetId": "string", "type": "risk_factor", "confidence": 0.9, "reasoning": "..." }
          ],
          "insights": [
            { "type": "cluster", "title": "...", "description": "...", "relatedIds": [], "severity": "high" }
          ]
        }
      `;

            const text = await generateContentSafe(prompt, ULTRA_MODEL);
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanText);

            return {
                suggestions: (parsed.suggestions || []).map((s: Omit<AISuggestedLink, 'id'>, i: number) => ({ ...s, id: `ai-link-${i}` })),
                insights: (parsed.insights || []).map((s: Omit<AIInsight, 'id'>, i: number) => ({ ...s, id: `ai-insight-${i}` })),
            };
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.analyzeGraph');
            throw new Error("Failed to analyze graph with Sentinel AI.");
        }
    },

    async analyzeImportData(csvPreview: string): Promise<{ mappings: Record<string, string>; confidence: number }> {
        try {
            const aiSettings = getAISettings();
            if (!aiSettings.enabled) return { mappings: {}, confidence: 0 };

            const prompt = `Map CSV columns to name, type, owner, confidentiality, location. Preview: ${aiPrivacyService.sanitizeInput(csvPreview, aiSettings.sanitization)}`;
            const text = await generateContentSafe(prompt);
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.analyzeImportData');
            return { mappings: {}, confidence: 0 };
        }
    },

    async suggestField(context: Record<string, unknown>, fieldName: string): Promise<{ value: string; reasoning: string }> {
        try {
            const aiSettings = getAISettings();
            if (!aiSettings.enabled) return { value: '', reasoning: 'AI Disabled' };

            const prompt = `Context: ${JSON.stringify(aiPrivacyService.anonymizeData(context, aiSettings.sanitization))}. Suggest field "${fieldName}". Return JSON {value, reasoning}.`;
            const text = await generateContentSafe(prompt);
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.suggestField', { metadata: { fieldName } });
            return { value: '', reasoning: 'Error generating suggestion' };
        }
    },

    async chatWithAI(message: string, context?: Record<string, unknown>): Promise<string> {
        const aiSettings = getAISettings();
        if (!aiSettings.enabled) {
            return "Sentinel AI est désactivé par votre administrateur dans les réglages de l'organisation.";
        }

        if (isRateLimited('chat')) {
            return "Veuillez patienter quelques secondes avant de renvoyer un message.";
        }

        const systemPrompt = `Tu es Sentinel AI, un assistant expert en cybersécurité et GRC.
            Contexte actuel :
            ${context ? JSON.stringify(aiPrivacyService.anonymizeData(context, aiSettings.sanitization)) : 'Aucun contexte spécifique.'}`;

        try {
            return await runChatSafe(systemPrompt, message, FAST_MODEL);
        } catch (_error) {
            const msg = _error instanceof Error ? _error.message : String(_error);
            ErrorLogger.error(_error, 'aiService.chatWithAI');
            if (msg.includes('Erreur IA:') || msg.includes('L\'IA est très sollicitée') || msg.includes('Daily AI limit')) {
                return msg;
            }
            return "Désolé, une erreur est survenue lors de la communication avec l'IA.";
        } finally {
            releaseRateLimit('chat');
        }
    },

    async generatePolicy(type: string, topic: string, details: string): Promise<string> {
        try {
            const prompt = `Rédige une politique ${type} sur ${topic}. Détails: ${details}`;
            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.generatePolicy');
            throw new Error("Échec de la génération de politique.");
        }
    },

    async generateAuditChecklist(auditContext: string, controls: { code: string; description: string }[]): Promise<{ controlCode: string; questions: string[] }[]> {
        try {
            const prompt = `Audit ISO 27001 - Contexte: ${auditContext}. Checklist pour les contrôles: ${JSON.stringify(controls.slice(0, 10))}`;
            const text = await generateContentSafe(prompt, SMART_MODEL);
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.generateAuditChecklist');
            return controls.map(c => ({ controlCode: c.code, questions: [`Vérifier ${c.code}`] }));
        }
    },

    async generateAuditExecutiveSummary(auditName: string, findings: unknown[], risks: unknown[]): Promise<string> {
        try {
            const prompt = `Résumé exécutif pour audit ${auditName}. Findings: ${JSON.stringify(findings)}. Risks: ${JSON.stringify(risks)}`;
            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.generateAuditExecutiveSummary');
            return "Résumé indisponible.";
        }
    },

    async evaluateQuestionnaire(context: unknown): Promise<string> {
        try {
            const prompt = `Évalue ces réponses au questionnaire: ${JSON.stringify(context)}`;
            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.evaluateQuestionnaire');
            return "Analyse indisponible.";
        }
    },

    async generateRTPSummary(risks: unknown[]): Promise<string> {
        try {
            const prompt = `Résumé du Plan de Traitement des Risques: ${JSON.stringify(risks.slice(0, 10))}`;
            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.generateRTPSummary');
            return "Résumé RTP indisponible.";
        }
    },

    async generateExecutiveDashboardSummary(context: unknown): Promise<string> {
        try {
            const prompt = `Résumé stratégique pour le board: ${JSON.stringify(context)}`;
            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.generateExecutiveDashboardSummary');
            return "Résumé stratégique indisponible.";
        }
    },

    async generateContinuityReportSummary(context: unknown): Promise<string> {
        try {
            const prompt = `Résumé continuité d'activité: ${JSON.stringify(context)}`;
            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.generateContinuityReportSummary');
            return "Résumé continuité indisponible.";
        }
    },

    async generateText(prompt: string): Promise<string> {
        try {
            return await generateContentSafe(prompt);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.generateText');
            return "";
        }
    },

    async suggestContinuityPlan(processName: string, description: string): Promise<unknown> {
        try {
            const prompt = `Suggère un plan de continuité pour ${processName}: ${description}`;
            const text = await generateContentSafe(prompt, SMART_MODEL);
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (_error) {
            ErrorLogger.error(_error, 'aiService.suggestContinuityPlan');
            throw new Error("Suggestion indisponible.");
        }
    }
};

const aiCache = new Map<string, { data: unknown; timestamp: number }>();
const signatureStore = new Map<string, string>(); // Store signatures for context
const CACHE_DURATION = 5 * 60 * 1000;
const AI_CACHE_SIZE = 100;

const cleanupAiCache = () => {
    const now = Date.now();
    for (const [key, entry] of aiCache.entries()) {
        if (now - entry.timestamp > CACHE_DURATION) aiCache.delete(key);
    }
    if (aiCache.size > AI_CACHE_SIZE) {
        const entries = Array.from(aiCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
        entries.slice(0, entries.length - AI_CACHE_SIZE).forEach(([key]) => aiCache.delete(key));
    }
};

async function generateContentSafe(prompt: string, modelName: string = FAST_MODEL): Promise<string> {
    const cacheKey = `${modelName}:${prompt.substring(0, 100)}`;
    const cached = aiCache.get(cacheKey);
    const now = Date.now();
    if (cached && (now - cached.timestamp) < CACHE_DURATION) return cached.data as string;
    if (isRateLimited('generate')) return "";
    cleanupAiCache();
    try {
        const thoughtSignature = signatureStore.get('last_signature');
        const callGeminiGenerateContent = httpsCallable<{
            prompt: string;
            modelName: string;
            thinkingLevel?: string;
            thoughtSignature?: string;
        }, {
            text?: string;
            thoughtSignature?: string;
            model?: string;
            version?: string
        }>(functions, 'callGeminiGenerateContent');

        const result = await callGeminiGenerateContent({
            prompt,
            modelName,
            thinkingLevel: modelName.includes('pro') ? 'high' : 'low',
            thoughtSignature
        });

        const { text, thoughtSignature: nextSignature, model, version } = result.data;

        if (nextSignature) {
            signatureStore.set('last_signature', nextSignature);
        }

        if (typeof text === 'string' && text.trim().length > 0) {
            aiCache.set(cacheKey, { data: text, timestamp: now });
            if (import.meta.env.DEV) {
                ErrorLogger.info(`Generated content using ${model} (${version})`, 'aiService');
            }
            return text;
        }
    } catch (_error: unknown) {
        const err = _error as { code?: string; message?: string };
        const code = err.code;
        const message = err.message || '';
        if (code === 'functions/not-found' || message.includes('404')) throw new Error("Service IA indisponible (404).");
        if (code === 'resource-exhausted' || message.includes('429')) throw new Error("Quota IA atteint. Patientez.");
        throw _error;
    } finally {
        releaseRateLimit('generate');
    }
    throw new Error("Erreur génération IA.");
}

async function runChatSafe(systemPrompt: string, message: string, modelName: string = FAST_MODEL): Promise<string> {
    try {
        const thoughtSignature = signatureStore.get('chat_signature');
        const callGeminiChat = httpsCallable<{
            systemPrompt: string;
            message: string;
            modelName: string;
            thinkingLevel?: string;
            thoughtSignature?: string;
        }, {
            text?: string;
            thoughtSignature?: string;
            model?: string;
            version?: string
        }>(functions, 'callGeminiChat');

        const result = await callGeminiChat({
            systemPrompt,
            message,
            modelName,
            thinkingLevel: 'low',
            thoughtSignature
        });

        const { text, thoughtSignature: nextSignature, model, version } = result.data;

        if (nextSignature) {
            signatureStore.set('chat_signature', nextSignature);
        }

        if (typeof text === 'string' && text.trim().length > 0) {
            if (import.meta.env.DEV) {
                ErrorLogger.info(`Chat response using ${model} (${version})`, 'aiService');
            }
            return text;
        }
    } catch (_error: unknown) {
        const err = _error as { code?: string; message?: string };
        const code = err.code;
        const message = err.message || '';
        if (code === 'resource-exhausted' || message.includes('429')) throw new Error("IA très sollicitée. Patientez.");
        throw _error;
    }
    throw new Error("Erreur contact chat IA.");
}
