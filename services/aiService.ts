import { GoogleGenerativeAI } from "@google/generative-ai";
import { Asset, Risk, Project, Audit, Incident, Supplier, AISuggestedLink, AIInsight } from "../types";

// Initialize Gemini API
// Note: In a real production app, this should be proxied through a backend to hide the key.
// For this "production-ready" frontend demo, we use the env var directly.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

const MODEL_NAME = "gemini-1.5-flash";

interface GraphData {
    assets: Asset[];
    risks: Risk[];
    projects: Project[];
    audits: Audit[];
    incidents: Incident[];
    suppliers: Supplier[];
}

export const aiService = {
    /**
     * Analyzes the graph data to find hidden relationships and generate insights.
     */
    async analyzeGraph(data: GraphData): Promise<{ suggestions: AISuggestedLink[]; insights: AIInsight[] }> {
        if (!API_KEY) {
            console.warn("Gemini API Key is missing. Returning mock data for demonstration.");
            return this.getMockAnalysis(data);
        }

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            // Prepare a summarized version of the data to avoid token limits if necessary
            // For now, we send the raw data assuming it fits within the context window of 1.5 Flash (1M tokens).
            // We strip unnecessary fields to be efficient.
            const promptData = {
                assets: data.assets.map(a => ({ id: a.id, name: a.name, type: a.type, criticality: a.confidentiality })),
                risks: data.risks.map(r => ({ id: r.id, threat: r.threat, score: r.score, assetId: r.assetId })),
                projects: data.projects.map(p => ({ id: p.id, name: p.name, status: p.status })),
                incidents: data.incidents.map(i => ({ id: i.id, title: i.title, severity: i.severity, affectedAssetId: i.affectedAssetId })),
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

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown code blocks if present
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed = JSON.parse(jsonString);

            return {
                suggestions: parsed.suggestions.map((s: any, i: number) => ({ ...s, id: `ai-link-${i}` })),
                insights: parsed.insights.map((s: any, i: number) => ({ ...s, id: `ai-insight-${i}` })),
            };

        } catch (error) {
            console.error("AI Analysis failed:", error);
            throw new Error("Failed to analyze graph with Gemini.");
        }
    },



    /**
     * Analyzes CSV import data to map columns and identify anomalies.
     */
    async analyzeImportData(csvPreview: string): Promise<{ mappings: Record<string, string>; confidence: number }> {
        if (!API_KEY) return { mappings: {}, confidence: 0 };

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
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

            const result = await model.generateContent(prompt);
            const text = (await result.response).text();
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            console.error("AI Import Analysis failed:", error);
            return { mappings: {}, confidence: 0 };
        }
    },

    /**
     * Suggests a value for a specific field based on context.
     */
    async suggestField(context: any, fieldName: string): Promise<{ value: string; reasoning: string }> {
        if (!API_KEY) return { value: '', reasoning: 'AI Key missing' };

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const prompt = `
                Context: ${JSON.stringify(context)}
                Suggest a value for the field "${fieldName}" (e.g., Type, Criticality, Description).
                Return JSON: { "value": "suggested_value", "reasoning": "short explanation" }
            `;

            const result = await model.generateContent(prompt);
            const text = (await result.response).text();
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            console.error("AI Suggestion failed:", error);
            return { value: '', reasoning: 'Error generating suggestion' };
        }
    },

    /**
     * Fallback mock data generator for when API key is missing or error occurs.
     */
    getMockAnalysis(data: GraphData): { suggestions: AISuggestedLink[]; insights: AIInsight[] } {
        const suggestions: AISuggestedLink[] = [];
        const insights: AIInsight[] = [];

        // Mock Logic: Link high severity incidents to high value assets if not already linked
        data.incidents.filter(i => i.severity === 'Critique').forEach((incident, idx) => {
            const criticalAsset = data.assets.find(a => a.confidentiality === 'Critique' && a.id !== incident.affectedAssetId);
            if (criticalAsset) {
                suggestions.push({
                    id: `mock-link-${idx}`,
                    sourceId: incident.id,
                    targetId: criticalAsset.id,
                    type: 'impact',
                    confidence: 0.85,
                    reasoning: `L'incident critique "${incident.title}" pourrait avoir un impact latéral sur l'actif critique "${criticalAsset.name}".`
                });
            }
        });

        insights.push({
            id: 'mock-insight-1',
            type: 'cluster',
            title: 'Concentration de Risques',
            description: 'Une concentration anormale de risques élevés a été détectée sur les actifs de type "Serveur".',
            relatedIds: data.risks.slice(0, 3).map(r => r.id),
            severity: 'high'
        });

        return { suggestions, insights };
    }
};
