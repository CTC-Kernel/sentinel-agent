
import { getFunctions, httpsCallable } from "firebase/functions";
import { Asset, Risk, Project, Audit, Incident, Supplier, Control, AISuggestedLink, AIInsight } from "../types";
import { ErrorLogger } from "./errorLogger";



const FAST_MODEL = "gemini-1.5-flash";
const SMART_MODEL = "gemini-3-pro-preview";

let lastChatCall = 0;
let lastGenCall = 0;

interface GraphData {
    assets: Asset[];
    risks: Risk[];
    projects: Project[];
    audits: Audit[];
    incidents: Incident[];
    suppliers: Supplier[];
    controls: Control[];
}

export const aiService = {
    /**
     * Analyzes the graph data to find hidden relationships and generate insights.
     */
    async analyzeGraph(data: GraphData): Promise<{ suggestions: AISuggestedLink[]; insights: AIInsight[] }> {
        try {
            // Prepare a summarized version of the data to avoid token limits if necessary
            // For now, we send the raw data assuming it fits within the context window of 1.5 Flash (1M tokens).
            // We strip unnecessary fields to be efficient.
            const promptData = {
                assets: data.assets.map(a => ({ id: a.id, name: a.name, type: a.type, criticality: a.confidentiality })),
                risks: data.risks.map(r => ({ id: r.id, threat: r.threat, score: r.score, assetId: r.assetId })),
                projects: data.projects.map(p => ({ id: p.id, name: p.name, status: p.status })),
                incidents: data.incidents.map(i => ({ id: i.id, title: i.title, severity: i.severity, affectedAssetId: i.affectedAssetId })),
                controls: data.controls.map(c => ({ id: c.id, name: c.name, status: c.status, type: c.type })),
            };

            const prompt = `
        You are a Cybersecurity Expert AI analyzing a GRC (Governance, Risk, Compliance) graph.
        
        Analyze the following JSON data representing a company's security posture:
        ${JSON.stringify(promptData)}

        Your task is to:
        1. Identify HIDDEN relationships (links) between items that are not explicitly linked but should be.
           - Example: A high-risk asset might be related to a project that is "Delayed".
           - Example: Similar risks across different assets.
        2. Generate high-level INSIGHTS about the overall security posture.
           - Example: "Cluster of critical risks in the Finance department assets."

        Return the result strictly in the following JSON format:
        {
          "suggestions": [
            {
              "sourceId": "string",
              "targetId": "string",
              "type": "risk_factor" | "dependency" | "impact" | "mitigation",
              "confidence": number (0-1),
              "reasoning": "string"
            }
          ],
          "insights": [
            {
              "type": "critical_path" | "cluster" | "anomaly" | "recommendation",
              "title": "string",
              "description": "string",
              "relatedIds": ["string"],
              "severity": "low" | "medium" | "high" | "critical"
            }
          ]
        }
      `;

            const text = await generateContentSafe(prompt, SMART_MODEL);

            // Clean up markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(cleanText);

            return {
                suggestions: parsed.suggestions.map((s: Omit<AISuggestedLink, 'id'>, i: number) => ({ ...s, id: `ai-link-${i}` })),
                insights: parsed.insights.map((s: Omit<AIInsight, 'id'>, i: number) => ({ ...s, id: `ai-insight-${i}` })),
            };
        } catch (error) {
            ErrorLogger.error(error, 'aiService.analyzeGraph');
            throw new Error("Failed to analyze graph with Sentinel AI.");
        }
    },



    /**
     * Analyzes CSV import data to map columns and identify anomalies.
     */
    async analyzeImportData(csvPreview: string): Promise<{ mappings: Record<string, string>; confidence: number }> {
        try {
            const prompt = `
                You are a Data Import Assistant. Map the columns of this CSV preview to the following internal fields:
                - name (Nom de l'actif)
                - type (Type: Matériel, Logiciel, Données, Service, Humain)
                - owner (Propriétaire)
                - confidentiality (Confidentialité: Faible, Moyenne, Élevée, Critique)
                - location (Localisation)

                CSV Preview:
                ${csvPreview}

                Return JSON: { "mappings": { "csv_col_name": "internal_field_name" }, "confidence": 0-1 }
                Only map if confident.
            `;

            const text = await generateContentSafe(prompt);
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.analyzeImportData');
            return { mappings: {}, confidence: 0 };
        }
    },

    /**
     * Suggests a value for a specific field based on context.
     */
    async suggestField(context: Record<string, unknown>, fieldName: string): Promise<{ value: string; reasoning: string }> {
        try {
            const prompt = `
                Context: ${JSON.stringify(context)}
                Suggest a value for the field "${fieldName}" (e.g., Type, Criticality, Description).
                Return JSON: { "value": "suggested_value", "reasoning": "short explanation" }
            `;

            const text = await generateContentSafe(prompt);
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.suggestField', { metadata: { fieldName } });
            return { value: '', reasoning: 'Error generating suggestion' };
        }
    },

    /**
     * General chat with the AI assistant.
     */
    async chatWithAI(message: string, context?: Record<string, unknown>): Promise<string> {
        // [DEBUG] Log caller to identify source of unexpected calls


        // Prevent loops: Rate limit client-side (1 second debounce)
        const now = Date.now();
        if (lastChatCall && (now - lastChatCall < 2000)) {
            console.warn('[aiService] Rate limit prevented rapid call.');
            return "Veuillez patienter quelques secondes avant de renvoyer un message.";
        }
        lastChatCall = now;

        const systemPrompt = `Tu es Sentinel AI, un assistant expert en cybersécurité et GRC (Gouvernance, Risque, Conformité).
            Ton rôle est d'aider les utilisateurs à gérer leur sécurité, comprendre les normes (ISO 27001, RGPD) et rédiger des documents.
            Sois professionnel, concis et précis. Réponds toujours en Français.${context ? `\n\nContexte actuel de l'application :\n${JSON.stringify(context)}` : ''}`;

        try {
            return await runChatSafe(systemPrompt, message, FAST_MODEL);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            ErrorLogger.error(error, 'aiService.chatWithAI');

            // If it's a specific backend error or rate limit message, return it to the user
            if (msg.includes('Erreur IA:') || msg.includes('L\'IA est très sollicitée') || msg.includes('Daily AI limit')) {
                return msg;
            }

            return "Désolé, une erreur est survenue lors de la communication avec l'IA. Veuillez réessayer.";
        }
    },

    /**
     * Generates a policy document based on parameters.
     */
    async generatePolicy(type: string, topic: string, details: string): Promise<string> {
        try {
            const prompt = `
                Rédige un document de politique de sécurité (Format Markdown).
                Type: ${type}
                Sujet: ${topic}
                Détails spécifiques: ${details}

                Structure attendue:
                1. Objectif
                2. Champ d'application
                3. Responsabilités
                4. Règles et Directives
                5. Conformité et Sanctions

                Le ton doit être formel et adapté à une entreprise certifiée ISO 27001.
            `;

            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.generatePolicy', { metadata: { type, topic } });
            throw new Error("Échec de la génération de politique.");
        }
    },

    /**
     * Generates a specific audit checklist for a list of controls.
     */
    async generateAuditChecklist(auditContext: string, controls: { code: string; description: string }[]): Promise<{ controlCode: string; questions: string[] }[]> {
        try {
            // Batch controls to avoid token limits if too many
            // For now, take top 20 or all if less
            const controlsToProcess = controls.slice(0, 20);

            const prompt = `
                You are an ISO 27001 Lead Auditor.
                Context: ${auditContext}

                For each of the following security controls, generate 3 specific, actionable verification questions (checklist) to verify its effective implementation.
                Questions must be in French.

                Controls:
                ${JSON.stringify(controlsToProcess.map(c => ({ code: c.code, description: c.description })))}

                Return strictly a JSON array:
                [
                  {
                    "controlCode": "A.5.1",
                    "questions": ["Question 1?", "Question 2?", "Question 3?"]
                  }
                ]
            `;

            const text = await generateContentSafe(prompt, SMART_MODEL);
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.generateAuditChecklist');
            // Fallback to generic
            return controls.map(c => ({ controlCode: c.code, questions: [`Le contrôle ${c.code} est-il implémenté ?`] }));
        }
    },

    /**
     * Generates an executive summary for an audit report.
     */
    async generateAuditExecutiveSummary(auditName: string, findings: { type: string, description: string }[], risks: { threat: string, score: number }[]): Promise<string> {
        try {
            const prompt = `
                You are a Cybersecurity Auditor writing an Executive Summary for an audit report.
                Audit Name: ${auditName}

                Findings:
                ${JSON.stringify(findings)}

                Top Risks:
                ${JSON.stringify(risks.slice(0, 5))}

                Write a professional Executive Summary (in French) of 2-3 paragraphs.
                - Summarize the overall compliance posture.
                - Highlight critical issues (findings).
                - Mention key risks identified.
                - Conclude with a general recommendation.
                
                Do not use markdown formatting (bold, italic) as this will be put in a PDF. Just plain text with paragraphs.
            `;

            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.generateAuditExecutiveSummary');
            return "Impossible de générer le résumé exécutif.";
        }
    },

    /**
     * Evaluates a questionnaire response and provides analysis.
     */
    async evaluateQuestionnaire(context: unknown): Promise<string> {
        try {
            const prompt = `
                You are an expert Auditor evaluating a response to a security questionnaire.
                Context: ${JSON.stringify(context)}
                
                Please analyze the responses provided.
                1. Identify gaps or non-conformities based on the answers (or lack thereof).
                2. Check if evidence is provided where necessary (booleans provided in context).
                3. Provide a summary of compliance.
                4. Estimate a compliance score (0-100%).
                
                Format the output as HTML (using <h4>, <p>, <ul>, <li>, <strong>).
                Keep the tone professional and constructive.
                Language: French.
            `;

            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.evaluateQuestionnaire');
            return "<p>L'analyse IA n'a pas pu être générée.</p>";
        }
    },

    /**
     * Generates an executive summary for the Risk Treatment Plan (RTP).
     */
    async generateRTPSummary(risks: { threat: string; score: number; strategy: string; status: string }[]): Promise<string> {
        try {
            const prompt = `
                You are a CISO writing an Executive Summary for the Risk Treatment Plan (RTP).
                
                Risks Overview:
                ${JSON.stringify(risks.slice(0, 20))} (Top 20 risks shown)
                Total Risks: ${risks.length}

                Write a professional Executive Summary (in French) of 2 paragraphs.
                - Summarize the overall risk landscape.
                - Highlight the progress of risk treatment (Accepted vs Mitigated).
                - Mention the most critical risks being addressed.
                
                Do not use markdown formatting. Just plain text.
            `;

            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.generateRTPSummary');
            return "Impossible de générer le résumé RTP.";
        }
    },

    /**
     * Generates an executive summary for the Main Dashboard Report.
     */
    async generateExecutiveDashboardSummary(context: Record<string, unknown>): Promise<string> {
        try {
            const prompt = `
                You are a CISO writing an Executive Summary for the Global Security Board Report.
                
                Context Data:
                ${JSON.stringify(context)}

                Write a professional Executive Summary (in French) of 2-3 paragraphs.
                - Analyze the overall security score and compliance status.
                - Highlight key risks and active incidents.
                - Provide a strategic recommendation for the board.
                
                Tone: Professional, Strategic, Concise.
                Do not use markdown formatting. Just plain text with paragraphs.
            `;

            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.generateExecutiveDashboardSummary');
            return "Impossible de générer le résumé exécutif du tableau de bord.";
        }
    },

    /**
     * Generates an executive summary for the Continuity (BCP) Report.
     */
    async generateContinuityReportSummary(context: Record<string, unknown>): Promise<string> {
        try {
            const prompt = `
                You are a Business Continuity Manager writing an Executive Summary for the Annual Continuity Report.
                
                Context Data:
                ${JSON.stringify(context)}

                Write a professional Executive Summary (in French) of 2-3 paragraphs.
                - Analyze the current BCP readiness and coverage.
                - Highlight critical processes and their RTO/RPO status.
                - Summarize recent drill results and readiness.
                
                Tone: Professional, Reassuring, Strategic.
                Do not use markdown formatting. Just plain text with paragraphs.
            `;

            return await generateContentSafe(prompt, SMART_MODEL);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.generateContinuityReportSummary');
            return "Impossible de générer le résumé du rapport de continuité.";
        }
    },

    /**
     * Generates text based on a prompt.
     */
    async generateText(prompt: string): Promise<string> {
        try {
            return await generateContentSafe(prompt);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.generateText');
            return "";
        }
    },
    /**
     * Suggests continuity plan details (RTO, RPO, Priority, Tasks).
     */
    async suggestContinuityPlan(processName: string, description: string): Promise<import("../types").ContinuitySuggestion> {
        try {
            const prompt = `
                You are a Business Continuity Expert.
                Process Name: ${processName}
                Description: ${description}

                Suggest realistic values for a Business Impact Analysis (BIA) and Recovery Plan.
                Values to determine:
                - RTO (Recovery Time Objective): e.g. "4h", "24h", "1h"
                - RPO (Recovery Point Objective): e.g. "1h", "15m", "0"
                - Priority: Critique, Élevée, Moyenne, Faible
                - Recovery Tasks: 3-5 main steps to recover this process.

                Return strictly JSON:
                {
                  "rto": "string",
                  "rpo": "string",
                  "priority": "Critique" | "Élevée" | "Moyenne" | "Faible",
                  "recoveryTasks": [
                    { "title": "string", "owner": "role or job title", "duration": "string e.g. 30m", "description": "optional detail" }
                  ],
                  "reasoning": "Short explanation of why this priority/RTO was chosen."
                }
            `;

            const text = await generateContentSafe(prompt, SMART_MODEL);
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            ErrorLogger.error(error, 'aiService.suggestContinuityPlan', { metadata: { processName } });
            throw new Error("Impossible de générer une suggestion de continuité.");
        }
    }
};

// --- Helpers ---
async function generateContentSafe(prompt: string, modelName: string = FAST_MODEL): Promise<string> {
    // [DEBUG] Log caller for generateContentSafe


    // Prevent loops: Rate limit client-side (1 second debounce)
    const now = Date.now();
    if (lastGenCall && (now - lastGenCall < 2000)) {
        console.warn('[aiService] Rate limit prevented rapid generateContentSafe call.');
        return ""; // Return empty string or handle gracefully
    }
    lastGenCall = now;

    try {
        const functions = getFunctions();
        const callGeminiGenerateContent = httpsCallable<
            { prompt: string; modelName: string },
            { text?: string }
        >(functions, 'callGeminiGenerateContent');
        const result = await callGeminiGenerateContent({ prompt, modelName });
        const text = result.data?.text;
        if (typeof text === 'string' && text.trim().length > 0) {
            return text;
        }
    } catch (error: unknown) {
        // ErrorLogger context
        const anyError = error as { code?: unknown; message?: unknown };
        const code = typeof anyError.code === 'string' ? anyError.code : undefined;
        const message = typeof anyError.message === 'string' ? anyError.message : '';

        if (code === 'functions/not-found' || message.includes('404')) {
            ErrorLogger.warn('callGeminiGenerateContent Cloud Function not found', 'aiService.generateContentSafe', {
                metadata: { code, message }
            });
            throw new Error("Le service IA est temporairement indisponible (Fonction introuvable).");
        } else if (code === 'unauthenticated' || code === 'failed-precondition') {
            ErrorLogger.warn('Backend Gemini not available', 'aiService.generateContentSafe', {
                metadata: { code, message }
            });
            throw new Error("Le service IA est temporairement indisponible (Erreur d'authentification).");
        } else {
            throw error;
        }
    }

    throw new Error("Impossible de générer le contenu via le service IA.");
}


async function runChatSafe(systemPrompt: string, message: string, modelName: string = FAST_MODEL): Promise<string> {
    try {
        const functions = getFunctions();
        const callGeminiChat = httpsCallable<
            { systemPrompt: string; message: string; modelName: string },
            { text?: string }
        >(functions, 'callGeminiChat');
        const result = await callGeminiChat({ systemPrompt, message, modelName });
        const text = result.data?.text;
        if (typeof text === 'string' && text.trim().length > 0) {
            return text;
        }
    } catch (error: unknown) {
        // ErrorLogger context
        const anyError = error as { code?: unknown; message?: unknown };
        const code = typeof anyError.code === 'string' ? anyError.code : undefined;
        const message = typeof anyError.message === 'string' ? anyError.message : '';

        if (code === 'functions/not-found' || message.includes('404')) {
            ErrorLogger.warn('callGeminiChat Cloud Function not found', 'aiService.runChatSafe', {
                metadata: { code, message }
            });
            throw new Error("Le chat IA est temporairement indisponible.");
        } else if (code === 'resource-exhausted' || message.includes('429') || message.includes('Too Many Requests')) {
            // New handling for rate limits
            ErrorLogger.warn('Gemini Rate Limit Hit', 'aiService.runChatSafe', {
                metadata: { code, message }
            });

            // If it's the daily limit, show the specific message from backend
            if (message.includes('Daily AI limit')) {
                throw new Error(message);
            }

            throw new Error("L'IA est très sollicitée en ce moment. Veuillez patienter quelques secondes.");
        } else if (code === 'unauthenticated' || code === 'failed-precondition') {
            ErrorLogger.warn('Backend Gemini chat not available', 'aiService.runChatSafe', {
                metadata: { code, message }
            });
            throw new Error("Le chat IA est temporairement indisponible.");
        } else {
            throw error;
        }
    }

    throw new Error("Impossible de contacter le service de chat IA.");
}

