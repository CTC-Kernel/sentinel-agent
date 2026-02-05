/**
 * Unit tests for riskKnowledgeBase.ts
 * Tests risk knowledge base data structure and suggestion function
 */

import { describe, it, expect } from 'vitest';
import { RISK_KNOWLEDGE_BASE, getSuggestionsForAsset } from '../riskKnowledgeBase';

describe('RISK_KNOWLEDGE_BASE', () => {
 it('contains all expected asset categories', () => {
 expect(RISK_KNOWLEDGE_BASE).toHaveProperty('Serveur');
 expect(RISK_KNOWLEDGE_BASE).toHaveProperty('Laptop');
 expect(RISK_KNOWLEDGE_BASE).toHaveProperty('SaaS');
 expect(RISK_KNOWLEDGE_BASE).toHaveProperty('Données');
 expect(RISK_KNOWLEDGE_BASE).toHaveProperty('Réseau');
 expect(RISK_KNOWLEDGE_BASE).toHaveProperty('Bâtiment');
 });

 describe('category structure', () => {
 it.each(Object.keys(RISK_KNOWLEDGE_BASE))('%s has valid risk array structure', (category) => {
 const risks = RISK_KNOWLEDGE_BASE[category];

 expect(Array.isArray(risks)).toBe(true);
 expect(risks.length).toBeGreaterThan(0);

 // Each risk should have required properties
 risks.forEach(risk => {
 expect(risk).toHaveProperty('threat');
 expect(risk).toHaveProperty('vulnerability');
 expect(risk).toHaveProperty('probability');
 expect(risk).toHaveProperty('impact');
 expect(risk).toHaveProperty('strategy');

 expect(typeof risk.threat).toBe('string');
 expect(typeof risk.vulnerability).toBe('string');
 expect(typeof risk.probability).toBe('number');
 expect(typeof risk.impact).toBe('number');
 expect(typeof risk.strategy).toBe('string');

 expect(risk.probability).toBeGreaterThanOrEqual(1);
 expect(risk.probability).toBeLessThanOrEqual(5);
 expect(risk.impact).toBeGreaterThanOrEqual(1);
 expect(risk.impact).toBeLessThanOrEqual(5);
 });
 });
 });

 describe('Serveur category', () => {
 it('contains expected server risks', () => {
 const serverRisks = RISK_KNOWLEDGE_BASE.Serveur;
 const threats = serverRisks.map(r => r.threat);

 expect(threats).toContain('Panne matérielle');
 expect(threats).toContain('Ransomware');
 expect(threats).toContain('Accès non autorisé');
 });

 it('has appropriate risk strategies', () => {
 const strategies = RISK_KNOWLEDGE_BASE.Serveur.map(r => r.strategy);
 expect(strategies.every(s => ['Atténuer', 'Transférer', 'Accepter', 'Éviter'].includes(s))).toBe(true);
 });
 });

 describe('Laptop category', () => {
 it('contains mobile device risks', () => {
 const laptopRisks = RISK_KNOWLEDGE_BASE.Laptop;
 const threats = laptopRisks.map(r => r.threat);

 expect(threats).toContain('Vol ou Perte');
 expect(threats).toContain('Malware');
 });
 });

 describe('SaaS category', () => {
 it('contains cloud service risks', () => {
 const saasRisks = RISK_KNOWLEDGE_BASE.SaaS;
 const threats = saasRisks.map(r => r.threat);

 expect(threats).toContain('Fuite de données');
 expect(threats).toContain('Compromission de compte');
 });
 });

 describe('Données category', () => {
 it('contains data-specific risks', () => {
 const dataRisks = RISK_KNOWLEDGE_BASE.Données;
 const threats = dataRisks.map(r => r.threat);

 expect(threats).toContain('Vol de données');
 expect(threats).toContain('Corruption de données');
 });
 });

 describe('Réseau category', () => {
 it('contains network risks', () => {
 const networkRisks = RISK_KNOWLEDGE_BASE.Réseau;
 const threats = networkRisks.map(r => r.threat);

 expect(threats).toContain('Intrusion réseau');
 expect(threats).toContain('Déni de service (DDoS)');
 });
 });

 describe('Bâtiment category', () => {
 it('contains physical security risks', () => {
 const buildingRisks = RISK_KNOWLEDGE_BASE.Bâtiment;
 const threats = buildingRisks.map(r => r.threat);

 expect(threats).toContain('Intrusion physique');
 expect(threats).toContain('Incendie');
 });
 });
});

describe('getSuggestionsForAsset', () => {
 it('returns suggestions for Serveur type', () => {
 const result = getSuggestionsForAsset('Serveur');
 expect(Array.isArray(result)).toBe(true);
 expect(result.length).toBeGreaterThan(0);
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Serveur);
 });

 it('returns suggestions for Laptop type', () => {
 const result = getSuggestionsForAsset('Laptop');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Laptop);
 });

 it('returns suggestions for SaaS type', () => {
 const result = getSuggestionsForAsset('SaaS');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.SaaS);
 });

 it('returns suggestions for Données type', () => {
 const result = getSuggestionsForAsset('Données');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Données);
 });

 it('returns suggestions for Réseau type', () => {
 const result = getSuggestionsForAsset('Réseau');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Réseau);
 });

 it('returns suggestions for Bâtiment type', () => {
 const result = getSuggestionsForAsset('Bâtiment');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Bâtiment);
 });

 it('returns empty array for unknown asset type', () => {
 const result = getSuggestionsForAsset('Unknown');
 expect(result).toEqual([]);
 });

 it('returns empty array for empty string', () => {
 const result = getSuggestionsForAsset('');
 expect(result).toEqual([]);
 });

 describe('case-insensitive matching', () => {
 it('matches lowercase serveur', () => {
 const result = getSuggestionsForAsset('serveur');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Serveur);
 });

 it('matches uppercase LAPTOP', () => {
 const result = getSuggestionsForAsset('LAPTOP');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Laptop);
 });

 it('matches mixed case SaAs', () => {
 const result = getSuggestionsForAsset('SaAs');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.SaaS);
 });
 });

 describe('partial matching', () => {
 it('matches when asset type contains category name', () => {
 const result = getSuggestionsForAsset('Serveur Web Production');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Serveur);
 });

 it('matches laptop in longer string', () => {
 const result = getSuggestionsForAsset('Mon Laptop personnel');
 expect(result).toEqual(RISK_KNOWLEDGE_BASE.Laptop);
 });
 });
});
