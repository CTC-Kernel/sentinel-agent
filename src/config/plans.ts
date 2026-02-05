import { PlanType, PlanLimits } from '../types';
export type { PlanType };

export interface PlanConfig {
 id: PlanType;
 name: string;
 description: string;
 priceMonthly: number;
 priceYearly: number; // -20% discount implied
 limits: PlanLimits;
 highlight?: boolean; // Recommended plan
 featuresList: string[]; // For marketing display
}

export const PLANS: Record<PlanType, PlanConfig> = {
 discovery: {
 id: 'discovery',
 name: 'Discovery',
 description: 'Démarrez votre conformité ISO 27001 gratuitement et sans engagement.',
 priceMonthly: 0,
 priceYearly: 0,
 highlight: false,
 limits: {
 maxUsers: 3,
 maxProjects: 1,
 maxAssets: 50,
 maxStorageGB: 1,
 maxFrameworks: 2,
 features: {
 apiAccess: false,
 sso: false,
 whiteLabelReports: false,
 customTemplates: false,
 aiAssistant: true, // Teaser
 },
 },
 featuresList: [
 '3 Utilisateurs inclus',
 '1 Projet d\'audit',
 'Jusqu\'à 50 Actifs',
 'Méthode ISO 27005 complète',
 'Rapports standards (Filigranés)',
 'Accès Communauté'
 ]
 },
 professional: {
 id: 'professional',
 name: 'Professional',
 description: 'Crédibilisez votre démarche avec des rapports pro et plus de capacité.',
 priceMonthly: 199,
 priceYearly: 1910, // -20% discount
 highlight: true,
 limits: {
 maxUsers: 10,
 maxProjects: 10,
 maxAssets: 250,
 maxStorageGB: 10,
 maxFrameworks: 5,
 features: {
 apiAccess: false,
 sso: false,
 whiteLabelReports: true,
 customTemplates: true,
 aiAssistant: true,
 },
 },
 featuresList: [
 'Jusqu\'à 10 Utilisateurs',
 '10 Projets simultanés',
 '250 Actifs gérés',
 '✅ Rapports Marque Blanche',
 '✅ Modèles personnalisables',
 '✅ Stockage 10 Go',
 '✅ Option Stockage SecNumCloud (OVH)',
 'Support Email prioritaire'
 ]
 },
 enterprise: {
 id: 'enterprise',
 name: 'Enterprise',
 description: 'La puissance totale sans aucune limite. L\'offre GRC la plus compétitive du marché.',
 priceMonthly: 499,
 priceYearly: 4790, // -20% discount
 highlight: false,
 limits: {
 maxUsers: 9999,
 maxProjects: 9999,
 maxAssets: 9999,
 maxStorageGB: 100,
 maxFrameworks: 14, // All frameworks
 features: {
 apiAccess: true,
 sso: true,
 whiteLabelReports: true,
 customTemplates: true,
 aiAssistant: true,
 },
 },
 featuresList: [
 '🚀 Utilisateurs Illimités',
 '🚀 Projets & Actifs Illimités',
 'API REST complète',
 'SSO (SAML / OIDC)',
 'Logs d\'audit avancés',
 'Stockage 100 Go',
 '✅ Option Stockage SecNumCloud (OVH)',
 'Support Dédié 24/7'
 ]
 }
};

export const getPlanLimits = (planId: PlanType): PlanLimits => {
 return PLANS[planId]?.limits || PLANS['discovery'].limits;
};
