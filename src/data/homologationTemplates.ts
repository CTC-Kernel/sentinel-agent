/**
 * ANSSI Homologation Document Templates
 *
 * Templates for generating ANSSI-compliant homologation documents.
 * Each template includes sections with placeholders that are replaced
 * with actual data during generation.
 */

import type { HomologationDocumentType } from '../types/homologation';

// ============================================================================
// Template Types
// ============================================================================

export interface DocumentSection {
  id: string;
  title: string;
  titleEn: string;
  content: string; // Markdown with placeholders
  contentEn: string;
  required: boolean;
  order: number;
  dataSource?: 'organization' | 'dossier' | 'ebios' | 'controls' | 'manual';
}

export interface DocumentTemplate {
  type: HomologationDocumentType;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  sections: DocumentSection[];
}

// ============================================================================
// Placeholder Definitions
// ============================================================================

export const PLACEHOLDERS = {
  // Organization
  '{{organization.name}}': 'Nom de l\'organisation',
  '{{organization.address}}': 'Adresse de l\'organisation',
  '{{organization.sector}}': 'Secteur d\'activité',

  // Dossier
  '{{dossier.name}}': 'Nom du dossier',
  '{{dossier.systemScope}}': 'Périmètre du système',
  '{{dossier.description}}': 'Description du dossier',
  '{{dossier.level}}': 'Niveau d\'homologation',
  '{{dossier.levelJustification}}': 'Justification du niveau',
  '{{dossier.validityYears}}': 'Durée de validité',
  '{{dossier.responsibleName}}': 'Nom du responsable',
  '{{dossier.authorityName}}': 'Autorité d\'homologation',

  // Dates
  '{{date.current}}': 'Date actuelle',
  '{{date.validityStart}}': 'Date de début de validité',
  '{{date.validityEnd}}': 'Date de fin de validité',

  // EBIOS Data
  '{{ebios.fearedEvents}}': 'Événements redoutés',
  '{{ebios.riskSources}}': 'Sources de risque',
  '{{ebios.strategicScenarios}}': 'Scénarios stratégiques',
  '{{ebios.operationalScenarios}}': 'Scénarios opérationnels',
  '{{ebios.treatmentPlan}}': 'Plan de traitement',
  '{{ebios.residualRisks}}': 'Risques résiduels',

  // Controls
  '{{controls.implemented}}': 'Contrôles implémentés',
  '{{controls.planned}}': 'Contrôles planifiés',
  '{{controls.gaps}}': 'Écarts identifiés'
} as const;

export type PlaceholderKey = keyof typeof PLACEHOLDERS;

// ============================================================================
// Document Templates
// ============================================================================

/**
 * Stratégie d'homologation - Required for all levels
 */
export const STRATEGIE_TEMPLATE: DocumentTemplate = {
  type: 'strategie',
  title: 'Stratégie d\'homologation',
  titleEn: 'Homologation Strategy',
  description: 'Document définissant le périmètre, les objectifs et la démarche d\'homologation',
  descriptionEn: 'Document defining the scope, objectives and homologation approach',
  sections: [
    {
      id: 'introduction',
      title: 'Introduction',
      titleEn: 'Introduction',
      order: 1,
      required: true,
      dataSource: 'dossier',
      content: `## Introduction

Le présent document définit la stratégie d'homologation du système d'information **{{dossier.name}}** de **{{organization.name}}**.

### Contexte
{{dossier.description}}

### Objectif
L'objectif de cette démarche d'homologation est de garantir que le système d'information offre un niveau de sécurité adapté aux risques identifiés, conformément aux exigences du Référentiel Général de Sécurité (RGS).`,
      contentEn: `## Introduction

This document defines the homologation strategy for the information system **{{dossier.name}}** of **{{organization.name}}**.

### Context
{{dossier.description}}

### Objective
The objective of this homologation process is to ensure that the information system provides a level of security appropriate to the identified risks, in accordance with the General Security Framework (RGS) requirements.`
    },
    {
      id: 'perimetre',
      title: 'Périmètre',
      titleEn: 'Scope',
      order: 2,
      required: true,
      dataSource: 'dossier',
      content: `## Périmètre de l'homologation

### Système concerné
**{{dossier.systemScope}}**

### Niveau d'homologation retenu
**{{dossier.level}}**

### Justification du niveau
{{dossier.levelJustification}}

### Éléments inclus dans le périmètre
- [À compléter : liste des composants, applications, données]

### Éléments exclus du périmètre
- [À compléter : éléments hors périmètre]`,
      contentEn: `## Homologation Scope

### Concerned System
**{{dossier.systemScope}}**

### Selected Homologation Level
**{{dossier.level}}**

### Level Justification
{{dossier.levelJustification}}

### Elements Included in Scope
- [To complete: list of components, applications, data]

### Elements Excluded from Scope
- [To complete: out-of-scope elements]`
    },
    {
      id: 'gouvernance',
      title: 'Gouvernance',
      titleEn: 'Governance',
      order: 3,
      required: true,
      dataSource: 'dossier',
      content: `## Gouvernance de l'homologation

### Autorité d'homologation
**{{dossier.authorityName}}**

L'autorité d'homologation est responsable de la décision finale d'homologation et de l'acceptation des risques résiduels.

### Responsable de la sécurité
**{{dossier.responsibleName}}**

Le responsable de la sécurité pilote la démarche d'homologation et s'assure de la mise en œuvre des mesures de sécurité.

### Comité d'homologation
[À compléter : composition du comité]`,
      contentEn: `## Homologation Governance

### Homologation Authority
**{{dossier.authorityName}}**

The homologation authority is responsible for the final homologation decision and acceptance of residual risks.

### Security Officer
**{{dossier.responsibleName}}**

The security officer leads the homologation process and ensures the implementation of security measures.

### Homologation Committee
[To complete: committee composition]`
    },
    {
      id: 'demarche',
      title: 'Démarche',
      titleEn: 'Approach',
      order: 4,
      required: true,
      dataSource: 'manual',
      content: `## Démarche d'homologation

### Méthodologie
La démarche d'homologation suit les recommandations de l'ANSSI et s'appuie sur :
- L'analyse de risques selon la méthode EBIOS RM
- L'évaluation des mesures de sécurité existantes
- L'identification des écarts et des actions correctives

### Calendrier prévisionnel
| Phase | Description | Échéance |
|-------|-------------|----------|
| Cadrage | Définition du périmètre | [Date] |
| Analyse | Analyse de risques | [Date] |
| Plan d'action | Définition des mesures | [Date] |
| Décision | Homologation | [Date] |

### Durée de validité
L'homologation sera valide pour une durée de **{{dossier.validityYears}} ans** à compter de la date de décision.`,
      contentEn: `## Homologation Approach

### Methodology
The homologation process follows ANSSI recommendations and relies on:
- Risk analysis according to the EBIOS RM method
- Evaluation of existing security measures
- Identification of gaps and corrective actions

### Planned Schedule
| Phase | Description | Deadline |
|-------|-------------|----------|
| Framing | Scope definition | [Date] |
| Analysis | Risk analysis | [Date] |
| Action plan | Measures definition | [Date] |
| Decision | Homologation | [Date] |

### Validity Period
The homologation will be valid for **{{dossier.validityYears}} years** from the decision date.`
    },
    {
      id: 'documents',
      title: 'Documents constitutifs',
      titleEn: 'Constituent Documents',
      order: 5,
      required: true,
      dataSource: 'manual',
      content: `## Documents constitutifs du dossier

Le dossier d'homologation comprend les documents suivants :

| Document | Statut | Responsable |
|----------|--------|-------------|
| Stratégie d'homologation | En cours | {{dossier.responsibleName}} |
| Analyse de risques | [Statut] | [Responsable] |
| Plan d'action | [Statut] | [Responsable] |
| Décision d'homologation | [Statut] | {{dossier.authorityName}} |
| Attestation | [Statut] | {{dossier.authorityName}} |`,
      contentEn: `## Dossier Constituent Documents

The homologation dossier includes the following documents:

| Document | Status | Responsible |
|----------|--------|-------------|
| Homologation strategy | In progress | {{dossier.responsibleName}} |
| Risk analysis | [Status] | [Responsible] |
| Action plan | [Status] | [Responsible] |
| Homologation decision | [Status] | {{dossier.authorityName}} |
| Certificate | [Status] | {{dossier.authorityName}} |`
    }
  ]
};

/**
 * Analyse de risques - Required for Simple, Standard, Renforcé
 */
export const ANALYSE_RISQUES_TEMPLATE: DocumentTemplate = {
  type: 'analyse_risques',
  title: 'Analyse de risques',
  titleEn: 'Risk Analysis',
  description: 'Identification et évaluation des risques de sécurité selon EBIOS RM',
  descriptionEn: 'Identification and assessment of security risks according to EBIOS RM',
  sections: [
    {
      id: 'introduction',
      title: 'Introduction',
      titleEn: 'Introduction',
      order: 1,
      required: true,
      dataSource: 'dossier',
      content: `## Introduction

Ce document présente l'analyse de risques réalisée pour le système **{{dossier.name}}** dans le cadre de sa démarche d'homologation.

L'analyse suit la méthodologie EBIOS Risk Manager (EBIOS RM) recommandée par l'ANSSI.`,
      contentEn: `## Introduction

This document presents the risk analysis performed for the **{{dossier.name}}** system as part of its homologation process.

The analysis follows the EBIOS Risk Manager (EBIOS RM) methodology recommended by ANSSI.`
    },
    {
      id: 'evenements_redoutes',
      title: 'Événements redoutés',
      titleEn: 'Feared Events',
      order: 2,
      required: true,
      dataSource: 'ebios',
      content: `## Événements redoutés

Les événements redoutés identifiés pour le système sont :

{{ebios.fearedEvents}}

*Si aucune analyse EBIOS n'est liée, compléter manuellement cette section.*`,
      contentEn: `## Feared Events

The feared events identified for the system are:

{{ebios.fearedEvents}}

*If no EBIOS analysis is linked, complete this section manually.*`
    },
    {
      id: 'sources_risque',
      title: 'Sources de risque',
      titleEn: 'Risk Sources',
      order: 3,
      required: true,
      dataSource: 'ebios',
      content: `## Sources de risque

Les sources de risque pertinentes identifiées sont :

{{ebios.riskSources}}

*Si aucune analyse EBIOS n'est liée, compléter manuellement cette section.*`,
      contentEn: `## Risk Sources

The relevant risk sources identified are:

{{ebios.riskSources}}

*If no EBIOS analysis is linked, complete this section manually.*`
    },
    {
      id: 'scenarios',
      title: 'Scénarios de risque',
      titleEn: 'Risk Scenarios',
      order: 4,
      required: true,
      dataSource: 'ebios',
      content: `## Scénarios de risque

### Scénarios stratégiques
{{ebios.strategicScenarios}}

### Scénarios opérationnels
{{ebios.operationalScenarios}}

*Si aucune analyse EBIOS n'est liée, compléter manuellement cette section.*`,
      contentEn: `## Risk Scenarios

### Strategic Scenarios
{{ebios.strategicScenarios}}

### Operational Scenarios
{{ebios.operationalScenarios}}

*If no EBIOS analysis is linked, complete this section manually.*`
    },
    {
      id: 'risques_residuels',
      title: 'Risques résiduels',
      titleEn: 'Residual Risks',
      order: 5,
      required: true,
      dataSource: 'ebios',
      content: `## Risques résiduels

Après application des mesures de sécurité, les risques résiduels sont :

{{ebios.residualRisks}}

Ces risques résiduels sont considérés comme acceptables par l'autorité d'homologation.`,
      contentEn: `## Residual Risks

After applying security measures, the residual risks are:

{{ebios.residualRisks}}

These residual risks are considered acceptable by the homologation authority.`
    }
  ]
};

/**
 * Plan d'action - Required for Standard, Renforcé
 */
export const PLAN_ACTION_TEMPLATE: DocumentTemplate = {
  type: 'plan_action',
  title: 'Plan d\'action',
  titleEn: 'Action Plan',
  description: 'Mesures de sécurité et calendrier de mise en œuvre',
  descriptionEn: 'Security measures and implementation timeline',
  sections: [
    {
      id: 'introduction',
      title: 'Introduction',
      titleEn: 'Introduction',
      order: 1,
      required: true,
      dataSource: 'dossier',
      content: `## Introduction

Ce document décrit le plan d'action sécurité pour le système **{{dossier.name}}**, incluant les mesures à mettre en œuvre pour atteindre le niveau de sécurité requis.`,
      contentEn: `## Introduction

This document describes the security action plan for the **{{dossier.name}}** system, including the measures to be implemented to achieve the required security level.`
    },
    {
      id: 'mesures_existantes',
      title: 'Mesures existantes',
      titleEn: 'Existing Measures',
      order: 2,
      required: true,
      dataSource: 'controls',
      content: `## Mesures de sécurité existantes

Les mesures de sécurité déjà en place sont :

{{controls.implemented}}

*Liste des contrôles implémentés depuis Sentinel GRC.*`,
      contentEn: `## Existing Security Measures

The security measures already in place are:

{{controls.implemented}}

*List of implemented controls from Sentinel GRC.*`
    },
    {
      id: 'mesures_planifiees',
      title: 'Mesures planifiées',
      titleEn: 'Planned Measures',
      order: 3,
      required: true,
      dataSource: 'controls',
      content: `## Mesures de sécurité planifiées

Les mesures à mettre en œuvre sont :

{{controls.planned}}

### Calendrier de mise en œuvre

| Mesure | Responsable | Échéance | Priorité |
|--------|-------------|----------|----------|
| [Mesure 1] | [Responsable] | [Date] | Haute |
| [Mesure 2] | [Responsable] | [Date] | Moyenne |`,
      contentEn: `## Planned Security Measures

The measures to be implemented are:

{{controls.planned}}

### Implementation Schedule

| Measure | Responsible | Deadline | Priority |
|---------|-------------|----------|----------|
| [Measure 1] | [Responsible] | [Date] | High |
| [Measure 2] | [Responsible] | [Date] | Medium |`
    },
    {
      id: 'plan_traitement',
      title: 'Plan de traitement des risques',
      titleEn: 'Risk Treatment Plan',
      order: 4,
      required: true,
      dataSource: 'ebios',
      content: `## Plan de traitement des risques

Le plan de traitement des risques issu de l'analyse EBIOS RM est :

{{ebios.treatmentPlan}}

*Si aucune analyse EBIOS n'est liée, compléter manuellement cette section.*`,
      contentEn: `## Risk Treatment Plan

The risk treatment plan from the EBIOS RM analysis is:

{{ebios.treatmentPlan}}

*If no EBIOS analysis is linked, complete this section manually.*`
    },
    {
      id: 'ecarts',
      title: 'Écarts identifiés',
      titleEn: 'Identified Gaps',
      order: 5,
      required: false,
      dataSource: 'controls',
      content: `## Écarts identifiés

Les écarts par rapport aux exigences de sécurité sont :

{{controls.gaps}}

### Plan de remédiation

[À compléter : actions correctives pour chaque écart]`,
      contentEn: `## Identified Gaps

The gaps from security requirements are:

{{controls.gaps}}

### Remediation Plan

[To complete: corrective actions for each gap]`
    }
  ]
};

/**
 * Décision d'homologation - Required for Standard, Renforcé
 */
export const DECISION_TEMPLATE: DocumentTemplate = {
  type: 'decision',
  title: 'Décision d\'homologation',
  titleEn: 'Homologation Decision',
  description: 'Acte officiel de l\'autorité d\'homologation',
  descriptionEn: 'Official act of the homologation authority',
  sections: [
    {
      id: 'decision',
      title: 'Décision',
      titleEn: 'Decision',
      order: 1,
      required: true,
      dataSource: 'dossier',
      content: `## Décision d'homologation

**{{organization.name}}**

**Système d'information : {{dossier.name}}**

---

### Décision

Vu les résultats de l'analyse de risques,
Vu le plan d'action sécurité,
Vu l'avis du responsable de la sécurité des systèmes d'information,

**L'autorité d'homologation décide :**

☐ D'homologuer le système d'information **{{dossier.systemScope}}** au niveau **{{dossier.level}}**

☐ De ne pas homologuer le système en l'état

☐ D'homologuer sous réserve (conditions ci-dessous)

### Conditions et réserves
[À compléter si applicable]

### Risques résiduels acceptés
L'autorité d'homologation accepte les risques résiduels identifiés dans l'analyse de risques.

### Durée de validité
Cette homologation est valide du **{{date.validityStart}}** au **{{date.validityEnd}}**, soit **{{dossier.validityYears}} ans**.

---

Fait à _________________, le **{{date.current}}**

**L'autorité d'homologation**

{{dossier.authorityName}}

Signature : _________________________`,
      contentEn: `## Homologation Decision

**{{organization.name}}**

**Information System: {{dossier.name}}**

---

### Decision

Having reviewed the risk analysis results,
Having reviewed the security action plan,
Having received the opinion of the information systems security officer,

**The homologation authority decides:**

☐ To homologate the information system **{{dossier.systemScope}}** at level **{{dossier.level}}**

☐ Not to homologate the system in its current state

☐ To homologate with reservations (conditions below)

### Conditions and Reservations
[To complete if applicable]

### Accepted Residual Risks
The homologation authority accepts the residual risks identified in the risk analysis.

### Validity Period
This homologation is valid from **{{date.validityStart}}** to **{{date.validityEnd}}**, i.e., **{{dossier.validityYears}} years**.

---

Done at _________________, on **{{date.current}}**

**The Homologation Authority**

{{dossier.authorityName}}

Signature: _________________________`
    }
  ]
};

/**
 * Attestation - Required for Standard, Renforcé
 */
export const ATTESTATION_TEMPLATE: DocumentTemplate = {
  type: 'attestation',
  title: 'Attestation d\'homologation',
  titleEn: 'Homologation Certificate',
  description: 'Attestation formelle de l\'homologation',
  descriptionEn: 'Formal certificate of homologation',
  sections: [
    {
      id: 'attestation',
      title: 'Attestation',
      titleEn: 'Certificate',
      order: 1,
      required: true,
      dataSource: 'dossier',
      content: `# ATTESTATION D'HOMOLOGATION

---

## {{organization.name}}

---

**Atteste que le système d'information :**

### {{dossier.name}}

**Périmètre :** {{dossier.systemScope}}

---

**A été homologué au niveau : {{dossier.level}}**

**Conformément aux exigences du Référentiel Général de Sécurité (RGS)**

---

| | |
|---|---|
| **Date de décision** | {{date.current}} |
| **Début de validité** | {{date.validityStart}} |
| **Fin de validité** | {{date.validityEnd}} |
| **Durée** | {{dossier.validityYears}} ans |

---

**Autorité d'homologation**

{{dossier.authorityName}}

---

*Cette attestation doit être renouvelée avant la date de fin de validité ou en cas de modification majeure du système.*`,
      contentEn: `# HOMOLOGATION CERTIFICATE

---

## {{organization.name}}

---

**Certifies that the information system:**

### {{dossier.name}}

**Scope:** {{dossier.systemScope}}

---

**Has been homologated at level: {{dossier.level}}**

**In accordance with the General Security Framework (RGS) requirements**

---

| | |
|---|---|
| **Decision date** | {{date.current}} |
| **Validity start** | {{date.validityStart}} |
| **Validity end** | {{date.validityEnd}} |
| **Duration** | {{dossier.validityYears}} years |

---

**Homologation Authority**

{{dossier.authorityName}}

---

*This certificate must be renewed before the expiration date or in case of major system changes.*`
    }
  ]
};

/**
 * Tests d'intrusion - Required for Renforcé only
 */
export const TEST_INTRUSION_TEMPLATE: DocumentTemplate = {
  type: 'test_intrusion',
  title: 'Rapport de tests d\'intrusion',
  titleEn: 'Penetration Test Report',
  description: 'Rapport des tests d\'intrusion réalisés',
  descriptionEn: 'Report of penetration tests performed',
  sections: [
    {
      id: 'synthese',
      title: 'Synthèse exécutive',
      titleEn: 'Executive Summary',
      order: 1,
      required: true,
      dataSource: 'manual',
      content: `## Synthèse exécutive

### Contexte
Des tests d'intrusion ont été réalisés sur le système **{{dossier.name}}** dans le cadre de sa démarche d'homologation au niveau Renforcé.

### Prestataire
[Nom du prestataire qualifié PASSI]

### Période des tests
Du [date début] au [date fin]

### Résultats clés
- Nombre de vulnérabilités critiques : [X]
- Nombre de vulnérabilités hautes : [X]
- Nombre de vulnérabilités moyennes : [X]
- Nombre de vulnérabilités basses : [X]

### Conclusion
[Conclusion générale sur le niveau de sécurité]`,
      contentEn: `## Executive Summary

### Context
Penetration tests were performed on the **{{dossier.name}}** system as part of its Enhanced level homologation process.

### Provider
[Name of PASSI-qualified provider]

### Test Period
From [start date] to [end date]

### Key Results
- Number of critical vulnerabilities: [X]
- Number of high vulnerabilities: [X]
- Number of medium vulnerabilities: [X]
- Number of low vulnerabilities: [X]

### Conclusion
[General conclusion on security level]`
    },
    {
      id: 'perimetre_tests',
      title: 'Périmètre des tests',
      titleEn: 'Test Scope',
      order: 2,
      required: true,
      dataSource: 'manual',
      content: `## Périmètre des tests

### Composants testés
[Liste des composants, serveurs, applications testés]

### Types de tests réalisés
- ☐ Test d'intrusion externe
- ☐ Test d'intrusion interne
- ☐ Test d'intrusion applicatif
- ☐ Test d'ingénierie sociale
- ☐ Test de configuration

### Exclusions
[Éléments exclus du périmètre de test]`,
      contentEn: `## Test Scope

### Tested Components
[List of tested components, servers, applications]

### Types of Tests Performed
- ☐ External penetration test
- ☐ Internal penetration test
- ☐ Application penetration test
- ☐ Social engineering test
- ☐ Configuration test

### Exclusions
[Elements excluded from test scope]`
    },
    {
      id: 'vulnerabilites',
      title: 'Vulnérabilités identifiées',
      titleEn: 'Identified Vulnerabilities',
      order: 3,
      required: true,
      dataSource: 'manual',
      content: `## Vulnérabilités identifiées

### Vulnérabilités critiques
[Détail des vulnérabilités critiques]

### Vulnérabilités hautes
[Détail des vulnérabilités hautes]

### Vulnérabilités moyennes
[Détail des vulnérabilités moyennes]

### Vulnérabilités basses
[Détail des vulnérabilités basses]`,
      contentEn: `## Identified Vulnerabilities

### Critical Vulnerabilities
[Details of critical vulnerabilities]

### High Vulnerabilities
[Details of high vulnerabilities]

### Medium Vulnerabilities
[Details of medium vulnerabilities]

### Low Vulnerabilities
[Details of low vulnerabilities]`
    },
    {
      id: 'recommandations',
      title: 'Recommandations',
      titleEn: 'Recommendations',
      order: 4,
      required: true,
      dataSource: 'manual',
      content: `## Recommandations

### Actions immédiates (< 1 mois)
[Liste des actions prioritaires]

### Actions à court terme (1-3 mois)
[Liste des actions à court terme]

### Actions à moyen terme (3-6 mois)
[Liste des actions à moyen terme]`,
      contentEn: `## Recommendations

### Immediate Actions (< 1 month)
[List of priority actions]

### Short-term Actions (1-3 months)
[List of short-term actions]

### Medium-term Actions (3-6 months)
[List of medium-term actions]`
    }
  ]
};

/**
 * Audit technique - Required for Renforcé only
 */
export const AUDIT_TECHNIQUE_TEMPLATE: DocumentTemplate = {
  type: 'audit_technique',
  title: 'Rapport d\'audit technique',
  titleEn: 'Technical Audit Report',
  description: 'Audit technique approfondi du système',
  descriptionEn: 'In-depth technical audit of the system',
  sections: [
    {
      id: 'synthese',
      title: 'Synthèse',
      titleEn: 'Summary',
      order: 1,
      required: true,
      dataSource: 'manual',
      content: `## Synthèse de l'audit technique

### Objectif
Évaluer la conformité technique du système **{{dossier.name}}** aux exigences de sécurité.

### Prestataire
[Nom du prestataire qualifié]

### Période d'audit
Du [date début] au [date fin]

### Niveau de conformité global
[Score ou appréciation]`,
      contentEn: `## Technical Audit Summary

### Objective
Evaluate the technical compliance of the **{{dossier.name}}** system with security requirements.

### Provider
[Name of qualified provider]

### Audit Period
From [start date] to [end date]

### Overall Compliance Level
[Score or assessment]`
    },
    {
      id: 'architecture',
      title: 'Architecture',
      titleEn: 'Architecture',
      order: 2,
      required: true,
      dataSource: 'manual',
      content: `## Revue d'architecture

### Architecture réseau
[Analyse de la segmentation, des flux, des pare-feu]

### Architecture applicative
[Analyse des composants, des dépendances]

### Points d'attention
[Écarts identifiés par rapport aux bonnes pratiques]`,
      contentEn: `## Architecture Review

### Network Architecture
[Analysis of segmentation, flows, firewalls]

### Application Architecture
[Analysis of components, dependencies]

### Points of Attention
[Gaps identified from best practices]`
    },
    {
      id: 'configuration',
      title: 'Configuration',
      titleEn: 'Configuration',
      order: 3,
      required: true,
      dataSource: 'manual',
      content: `## Revue de configuration

### Systèmes d'exploitation
[Analyse du durcissement OS]

### Bases de données
[Analyse de la sécurité des BDD]

### Applications
[Analyse des configurations applicatives]

### Réseau
[Analyse des équipements réseau]`,
      contentEn: `## Configuration Review

### Operating Systems
[OS hardening analysis]

### Databases
[Database security analysis]

### Applications
[Application configuration analysis]

### Network
[Network equipment analysis]`
    },
    {
      id: 'recommandations',
      title: 'Recommandations',
      titleEn: 'Recommendations',
      order: 4,
      required: true,
      dataSource: 'manual',
      content: `## Recommandations

### Recommandations prioritaires
[Liste des recommandations critiques]

### Recommandations d'amélioration
[Liste des recommandations secondaires]

### Plan de mise en conformité
| Recommandation | Priorité | Échéance | Responsable |
|----------------|----------|----------|-------------|
| [Rec 1] | Haute | [Date] | [Resp] |`,
      contentEn: `## Recommendations

### Priority Recommendations
[List of critical recommendations]

### Improvement Recommendations
[List of secondary recommendations]

### Compliance Plan
| Recommendation | Priority | Deadline | Responsible |
|----------------|----------|----------|-------------|
| [Rec 1] | High | [Date] | [Resp] |`
    }
  ]
};

// ============================================================================
// Template Registry
// ============================================================================

export const DOCUMENT_TEMPLATES: Record<HomologationDocumentType, DocumentTemplate> = {
  strategie: STRATEGIE_TEMPLATE,
  analyse_risques: ANALYSE_RISQUES_TEMPLATE,
  plan_action: PLAN_ACTION_TEMPLATE,
  decision: DECISION_TEMPLATE,
  attestation: ATTESTATION_TEMPLATE,
  test_intrusion: TEST_INTRUSION_TEMPLATE,
  audit_technique: AUDIT_TECHNIQUE_TEMPLATE
};

/**
 * Get template by document type
 */
export function getDocumentTemplate(type: HomologationDocumentType): DocumentTemplate {
  return DOCUMENT_TEMPLATES[type];
}

/**
 * Get all templates for a homologation level
 */
export function getTemplatesForLevel(
  level: 'etoile' | 'simple' | 'standard' | 'renforce'
): DocumentTemplate[] {
  const { REQUIRED_DOCUMENTS } = require('../types/homologation');
  const requiredTypes = REQUIRED_DOCUMENTS[level] as HomologationDocumentType[];
  return requiredTypes.map((type) => DOCUMENT_TEMPLATES[type]);
}
