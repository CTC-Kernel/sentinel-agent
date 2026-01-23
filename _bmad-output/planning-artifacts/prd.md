---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments: ['_bmad-output/planning-artifacts/product-brief-sentinel-grc-2026-01-20.md', '_bmad-output/planning-artifacts/research/market-grc-competitive-analysis-2026-01-20.md', '_bmad-output/planning-artifacts/research/brainstorming-verticaux-2026-01-20.md', 'docs/index.md', 'docs/architecture-overview.md', 'docs/data-models.md', 'docs/api-reference.md', 'docs/features-guide.md', 'docs/development-guide.md', 'docs/security-guide.md']
workflowType: 'prd'
lastStep: 11
workflow_completed: true
briefCount: 1
researchCount: 2
brainstormingCount: 1
projectDocsCount: 7
project_type: 'saas_b2b'
domain: 'grc_compliance'
complexity: 'high'
last_updated: '2026-01-20'
version: '2.0'
---

# Product Requirements Document - sentinel-grc-v2-prod

**Author:** Thibaultllopis
**Date:** 2026-01-10 | **Updated:** 2026-01-20
**Version:** 2.0

## Executive Summary

> **"Sentinel-GRC transforme la gouvernance cyber de réactive à prédictive, en augmentant la capacité cognitive des experts grâce à l'IA et à la visualisation 3D."**

Face à la complexité exponentielle des menaces et des infrastructures, le cerveau humain ne suffit plus pour corréler des milliers de vecteurs de risques. L'Intelligence Artificielle ne vient pas remplacer l'expert — elle vient **augmenter sa capacité de vision**.

Sentinel-GRC ne "stocke" pas les risques. **Il les comprend.**

### Le Statu Quo : La "Terre Plate" de la Cybersécurité

| Symptôme | Impact Business |
|----------|-----------------|
| Risques gérés dans des fichiers Excel | Données statiques, déconnectées de la réalité |
| Outils GRC jugés inefficaces par 66% des RSSI | €4.45M coût moyen d'une brèche |
| 85% des RSSI sans visibilité sur les menaces tierces | Seulement 21% ont des plans de crise testés |
| Questionnaires traditionnels insuffisants (71%) | Fatigue d'évaluation, faux sentiment de sécurité |

*Sources: Panorays 2026, ISACA Journal 2024, Gartner 2024*

### Les 3 Piliers de Sentinel-GRC

#### Pilier 1 : Voir l'Invisible — Technologie Voxel

| Capacité | Bénéfice |
|----------|----------|
| Modélisation 3D du SI | Navigation visuelle vs lecture de rapports |
| Identification nœuds critiques | Priorisation instantanée |
| Propagation incident temps réel | Anticipation vs réaction |
| Impact cascade fournisseur | Visibilité supply chain |

#### Pilier 2 : Intelligence au Service de la Méthode — EBIOS + Gemini AI

| Avant Sentinel | Avec Sentinel |
|----------------|---------------|
| 3 semaines pour définir scénarios | Suggestions automatiques contextuelles |
| Analyse manuelle des actifs | Pré-analyse IA des vecteurs d'attaque |
| Plans de traitement génériques | Recommandations personnalisées |
| Expert seul face à la complexité | IA comme analyste d'élite 24/7 |

#### Pilier 3 : Souveraineté — Votre Donnée, Vos Règles

| Engagement | Détail |
|------------|--------|
| Hébergement | 100% Europe (conformité NIS2/DORA) |
| Traçabilité | Audit Trail inaltérable |
| Gouvernance | RBAC granulaire |
| Résilience | Playbooks PCA/PRA en un clic |

### Proposition de Valeur Unique

> **Pour** les RSSI et équipes GRC des entreprises européennes soumises à NIS2/DORA
> **Qui** doivent gérer une complexité cyber exponentielle avec des ressources limitées
> **Sentinel-GRC est** une plateforme de gouvernance cyber augmentée par l'IA
> **Qui** cartographie dynamiquement les risques, quantifie l'impact financier et prédit les crises
> **Contrairement à** Egerie (interface classique), Citalid (focus quantification seule), OneTrust (complexité + US)
> **Notre produit** offre une visualisation 3D unique (Voxel), l'IA Gemini intégrée et une souveraineté européenne garantie

**Tagline:** *"Governance. Risk. Command."*

### What Makes This Special

1. **Visualisation Voxel 3D** - Unique sur le marché, cartographie dynamique du SI
2. **IA Gemini Intégrée** - Suggestions EBIOS contextuelles, analyse prédictive
3. **Focus Européen** - NIS2, DORA, HDS, RGS natifs vs concurrents US-centric
4. **Souveraineté Garantie** - Hébergement 100% EU, audit trail inaltérable
5. **Time-to-Value** - < 8 semaines vs 3-6 mois concurrents
6. **UX Apple-like** - Interface intuitive pour non-techniciens

## Project Classification

**Technical Type:** saas_b2b
**Domain:** GRC/Compliance
**Complexity:** High (multi-framework regulatory compliance)
**Project Context:** Brownfield - extending existing system

**Existing Architecture:**
- Frontend: React 19 + TypeScript + Expo (web + mobile)
- Backend: Firebase (Firestore, Cloud Functions, Authentication)
- Security: Multi-tenant avec RBAC (6 rôles, matrice de permissions)
- Modules: 14 modules fonctionnels (Risques, Actifs, Audits, Conformité, etc.)

**Focus PRD:** Évolutions UX, personnalisation par rôle, et fonctionnalités de collaboration.

## Success Criteria

### User Success Metrics

| Métrique | Baseline | Target | Mesure |
|----------|----------|--------|--------|
| Time-to-compliance | 3-6 mois | < 8 semaines | Date certification |
| Temps analyse risque | 3 semaines | 3 jours | Logs plateforme |
| Couverture assets | 40-60% | 100% | Inventaire automatique |
| Visibilité third-party | 15% | 100% | Fournisseurs audités |
| Temps préparation audit | 2 mois | 2 semaines | Effort ETP |

**Moments de satisfaction ("Aha!"):**
- Premier login: "Je vois mon SI en 3D, je comprends enfin mes risques"
- Analyse EBIOS: "L'IA m'a suggéré des scénarios en 10 minutes"
- Préparation audit: "Toutes mes preuves sont organisées automatiquement"
- Dashboard COMEX: "Je peux enfin justifier mon budget en euros"

### Business Success Metrics

| Métrique | Y1 Target | Y2 Target | Y3 Target |
|----------|-----------|-----------|-----------|
| ARR | €500K | €1.5M | €4M |
| Clients payants | 20 | 60 | 150 |
| NRR (Net Revenue Retention) | 100% | 115% | 125% |
| CAC Payback | 18 mois | 12 mois | 9 mois |
| Logo churn | < 10% | < 8% | < 5% |

**Positionnement par vertical:**

| Vertical | Y1 Clients | Message Principal |
|----------|------------|-------------------|
| Finance (DORA) | 8 | Registre ICT automatisé |
| Industrie (NIS2) | 5 | Vision IT/OT unifiée |
| Santé (HDS) | 4 | Souveraineté + simplicité |
| Public (RGS) | 3 | Homologation simplifiée |

### Product Success Metrics

| Métrique | Target | Mesure |
|----------|--------|--------|
| Activation (first value) | < 7 jours | Premier dashboard Voxel créé |
| Adoption features core | > 60% | Usage Voxel + EBIOS + Reporting |
| NPS | > 40 | Survey trimestriel |
| Time-in-app | > 2h/semaine/user | Analytics |
| Support tickets | < 5/client/mois | Zendesk |

### Technical Success

**Performance:**
- Page load: <2s (Core Web Vitals LCP)
- API response: <500ms (p95)
- Voxel render: <1s pour SI <1000 nœuds

**Architecture:**
- Config locale centralisée (Zod, date-fns, i18n)
- Mode brouillon sur toutes les entités principales
- Auto-save avec debounce et gestion conflits

**Conformité plateforme:**
- Hébergement EU (Firebase europe-west1) ✓
- Chiffrement transit (TLS 1.3) + repos (AES-256) ✓
- Audit trail complet + non-modifiable ✓
- RGPD compliant (droit effacement, portabilité) ✓

## Product Scope

### MVP - Minimum Viable Product

**Quick Wins (priorité immédiate):**
1. Config locale centralisée (localeConfig.ts)
2. Messages d'erreur humanisés
3. Actions contextuelles sur les listes

**Core Improvements:**
4. Mode brouillon pour tous les formulaires
5. Validation live avec feedback immédiat
6. Score global type "Apple Health" avec tendance

### Growth Features (Post-MVP)

**Personnalisation:**
7. Dashboards configurables par rôle
8. Widgets drag & drop personnalisables
9. Formulaires wizard multi-étapes

**Valeur ajoutée:**
10. Wizard onboarding SMSI (implémentation ISO 27001 guidée)
11. Rapports automatiques pour la direction
12. Export multi-format (PDF, Excel, CSV)

### Vision (Future)

**Collaboration et différenciation:**
13. Collaboration multi-org via Threat Intelligence partagé
14. Benchmark anonymisé entre organisations
15. IA suggestions de contrôles basées sur le contexte
16. Portail client transparent (au-delà du portail auditeur)
17. Intégrations tierces (SSO enterprise, SIEM, ticketing)

## Personas par Vertical

### Persona Primaire : Le RSSI Débordé

```
NOM: Jean-Marc Duval
TITRE: RSSI / Directeur Cybersécurité
SECTEUR: Multi-vertical (Finance, Santé, Industrie, Public)
TAILLE ORGANISATION: ETI à Grand Compte (500-10,000 employés)

PROFIL TYPE:
- 40-55 ans
- 10-20 ans d'expérience IT/Sécurité
- Équipe réduite (2-5 ETP sécurité)
- Rapport direct au DSI ou DG

OBJECTIFS PROFESSIONNELS:
1. Conformité réglementaire (DORA, NIS2, HDS, RGS)
2. Réduction du risque cyber quantifiable
3. Justification budget auprès du COMEX
4. Protection de la réputation personnelle

FRUSTRATIONS QUOTIDIENNES:
- "Je passe plus de temps à remplir des registres qu'à sécuriser"
- "Mon Excel ne scale pas pour 88 fournisseurs"
- "Le COMEX veut des chiffres, j'ai des vulnérabilités"
- "Je suis seul face à une complexité exponentielle"

CRITÈRES DE DÉCISION:
1. Time-to-value rapide (< 3 mois)
2. ROI démontrable au COMEX
3. Conformité pré-packagée (templates)
4. Souveraineté données (EU obligatoire)
```

### Personas Secondaires par Vertical

#### Finance : RSSI Banque/Assurance (DORA)

| Attribut | Spécificité |
|----------|-------------|
| **Driver principal** | DORA (obligatoire Jan 2025) |
| **Pain spécifique** | Registre ICT, 88+ fournisseurs |
| **Deadline** | URGENT - deadline passee (30 avril 2025) |
| **Budget** | Élevé mais contrôlé |
| **Citation** | "Le régulateur va auditer dans 6 mois" |
| **Message clé** | "DORA entre en vigueur. Votre registre ICT est-il prêt ?" |
| **Tagline** | "Sentinel-GRC. DORA-Ready depuis le premier jour." |

#### Santé : RSSI Hôpital/Groupe (HDS)

| Attribut | Spécificité |
|----------|-------------|
| **Driver principal** | HDS v2 (transition mai 2026) |
| **Pain spécifique** | Sous-effectif, budget minimal |
| **Contexte** | Post-cyberattaques (Corbeil, Versailles) |
| **Budget** | Contraint (secteur public) |
| **Citation** | "Après l'attaque, le DG m'écoute. Mais zéro budget." |
| **Message clé** | "Vos données patients méritent mieux qu'un Excel et un hébergeur US." |
| **Tagline** | "Sentinel-GRC. La santé de vos données, en toute souveraineté." |

#### Industrie : RSSI OT/IT (NIS2)

| Attribut | Spécificité |
|----------|-------------|
| **Driver principal** | NIS2 (secteurs critiques) |
| **Pain spécifique** | Convergence IT/OT, legacy SCADA |
| **Contexte** | Culture "production first" |
| **Budget** | Variable, justification ROI cruciale |
| **Citation** | "Ton firewall a arrêté ma chaîne 4h = €200K perdus" |
| **Message clé** | "Votre chaîne de production est connectée. Votre vision cyber aussi ?" |
| **Tagline** | "Sentinel-GRC. La résilience industrielle, du SCADA au COMEX." |

#### Public : RSSI Collectivité/État (RGS)

| Attribut | Spécificité |
|----------|-------------|
| **Driver principal** | RGS, Homologation ANSSI |
| **Pain spécifique** | Multi-SI (15+ téléservices) |
| **Contexte** | Transition RGS → NIS2 |
| **Budget** | Très contraint, appels d'offres |
| **Citation** | "L'ANSSI exige l'homologation. Avec quel budget ?" |
| **Message clé** | "L'ANSSI exige l'homologation. Vos téléservices sont-ils prêts ?" |
| **Tagline** | "Sentinel-GRC. L'homologation simplifiée pour le service public." |

### Matrice Urgence par Vertical

| Vertical | Driver | Urgence | Message Principal |
|----------|--------|---------|-------------------|
| Finance | DORA Jan 2025 | 🔴 Critique | Registre ICT automatisé |
| Santé | HDS v2 Mai 2026 | 🟠 Haute | Souveraineté + simplicité |
| Industrie | NIS2 2025 | 🔴 Critique | IT/OT unifié |
| Public | RGS/Homologation | 🟠 Haute | Homologation simplifiée |

## User Journeys

### Journey 1: Philippe Durand - Le Dirigeant Sous Pression

Philippe est PDG d'une ETI industrielle de 150 personnes. Son principal client, un grand groupe du CAC40, vient de lui annoncer que tous les fournisseurs devront être certifiés ISO 27001 d'ici 18 mois sous peine de perdre le contrat. Philippe ne connaît rien à la cybersécurité mais sait que ce client représente 40% de son chiffre d'affaires.

Un matin, après une recherche Google fébrile, Philippe découvre Sentinel-GRC. Contrairement aux solutions américaines qu'il a vues, celle-ci est en français et promet un "Wizard SMSI" pour guider l'implémentation ISO 27001. Il décide d'essayer.

**Premier contact:** À sa première connexion, Philippe voit immédiatement un dashboard épuré avec un score global "Maturité SMSI: 12%" et trois KPIs critiques. Pas de jargon technique, juste "Voici où vous en êtes, voici ce qu'il reste à faire." Il respire - enfin quelque chose qu'il comprend.

**Le déclic:** Deux semaines plus tard, lors d'un comité de direction, Philippe partage son écran et montre le rapport automatique "État de la conformité" généré en un clic. Son DAF est impressionné: "C'est exactement ce dont on avait besoin pour le board." Philippe réalise qu'il peut enfin suivre ce projet stratégique sans devenir expert cyber.

**Six mois après:** Le score est passé à 68%. Philippe reçoit une notification: "Félicitations, vous êtes prêt pour l'audit de certification." Il planifie l'audit avec confiance, sachant que toutes les preuves sont organisées automatiquement.

**Capability Requirements:**
- Dashboard dirigeant avec score global et tendance
- Rapports automatiques pour direction/board
- Langage non-technique dans toute l'interface
- Notifications intelligentes sur les jalons clés

---

### Journey 2: Sarah Martin - La RSSI Débordée

Sarah est RSSI d'une scale-up fintech de 80 personnes. Elle gère seule la sécurité et doit maintenant préparer simultanément ISO 27001, NIS2 (car secteur financier), et DORA. Elle jongle entre 15 tableurs Excel, des emails éparpillés, et une dette documentaire croissante.

**La découverte:** Sarah entend parler de Sentinel-GRC lors d'un webinar sur NIS2. Elle est sceptique - encore un outil à gérer. Mais le multi-framework l'intrigue. Elle lance un essai.

**L'effet immédiat:** Dès l'import de ses données existantes, Sarah découvre le mapping automatique entre frameworks. Un risque identifié pour ISO 27001 est automatiquement lié aux exigences NIS2 et DORA correspondantes. Elle n'a plus à maintenir trois analyses parallèles.

**Le workflow quotidien:** Chaque matin, Sarah ouvre son dashboard RSSI. Elle voit les risques ouverts classés par criticité, les incidents en cours, et les actions qui lui sont assignées. Un clic sur un risque lui montre directement les contrôles à implémenter et les preuves à collecter.

**Le moment magique:** Lors de la préparation d'un audit interne, Sarah génère en 2 minutes un dossier de preuves complet pour le domaine "Gestion des accès". Fini les 3 heures à rassembler des screenshots et documents épars. Elle murmure: "J'aurais dû avoir ça il y a deux ans."

**Capability Requirements:**
- Dashboard RSSI avec vue opérationnelle
- Mapping automatique entre frameworks
- Gestion des risques avec contrôles liés
- Génération automatique de dossiers de preuves
- Actions et tâches assignables

---

### Journey 3: Marc Leroy - L'Auditeur Externe Méthodique

Marc est auditeur senior dans un organisme de certification ISO. Il réalise 80 audits par an et a vu toutes les configurations possibles: du client ultra-préparé au chaos total. Son temps est précieux et il déteste chercher des documents pendant des heures.

**L'accueil inattendu:** Pour sa première mission avec un client utilisant Sentinel-GRC, Marc reçoit un lien vers le "Portail Auditeur". Il s'attend au pire mais découvre une interface claire avec tout ce dont il a besoin.

**L'efficacité retrouvée:** Le portail lui présente la checklist d'audit structurée par domaine ISO 27001. Pour chaque contrôle, il voit immédiatement: statut de conformité, preuves attachées, historique des revues. Il peut annoter directement, poser des questions, et suivre les réponses.

**La conversation facilitée:** Lors de l'audit sur site, Marc pose une question sur la gestion des incidents. La RSSI ouvre Sentinel-GRC et lui montre en temps réel: le registre des incidents, les analyses post-mortem, les actions correctives. Tout est tracé, daté, signé.

**Le verdict:** Marc termine son audit en 2 jours au lieu de 3 habituellement. Dans son rapport, il note: "Excellente préparation et documentation. Recommandation de certification sans non-conformité majeure."

**Capability Requirements:**
- Portail auditeur externe avec accès sécurisé
- Checklist d'audit interactive par framework
- Preuves liées directement aux contrôles
- Système de questions/réponses avec notifications
- Historique et traçabilité complète

---

### Journey 4: Julie Chen - La PM qui Coordonne le Chaos

Julie est Project Manager dans une entreprise de services numériques. On lui a confié le projet "Certification ISO 27001" avec un budget serré et une deadline dans 9 mois. Elle doit coordonner 12 contributeurs de différents départements qui ont tous "d'autres priorités".

**Le défi initial:** Julie découvre que le projet précédent a échoué à cause du manque de suivi. Les gens oubliaient leurs actions, les deadlines glissaient, et personne ne savait vraiment où en était le projet.

**La solution organisationnelle:** Dans Sentinel-GRC, Julie crée le plan projet avec les jalons ISO 27001. Chaque action est assignée à un responsable avec une deadline. Le système envoie des rappels automatiques et elle voit en temps réel qui est en retard.

**Le suivi sans friction:** Lors des réunions hebdomadaires, Julie partage son écran de suivi projet. En un coup d'œil, tout le monde voit: le pourcentage d'avancement, les blocages, les prochaines échéances. Plus de "je ne savais pas que c'était urgent."

**La victoire partagée:** À 3 semaines de l'audit, Julie envoie un email avec le lien vers le dashboard: "Nous sommes à 94% de conformité. Bravo à tous!" Elle reçoit des félicitations de la direction et une prime de succès projet.

**Capability Requirements:**
- Vue projet avec jalons et planning
- Assignation d'actions avec responsables et deadlines
- Rappels automatiques et notifications
- Dashboard de suivi d'avancement
- Export pour reporting direction

---

### Journey 5: Thomas Petit - L'Admin Tenant Pragmatique

Thomas est responsable IT dans une PME de 45 personnes. En plus de gérer l'infrastructure, on lui a demandé d'administrer Sentinel-GRC pour l'équipe de conformité.

**L'onboarding simple:** Thomas reçoit les accès admin. En 30 minutes, il a configuré: l'organisation, les départements, et importé la liste des 45 utilisateurs depuis un CSV. Les rôles sont assignés automatiquement selon les règles qu'il a définies.

**La gestion quotidienne:** Un nouveau collaborateur arrive? Thomas l'ajoute en 2 clics et le système lui envoie automatiquement ses identifiants avec un guide de démarrage. Quelqu'un quitte l'entreprise? Thomas désactive le compte et l'audit trail montre qui a accédé à quoi.

**L'intégration fluide:** Thomas configure le SSO avec l'Azure AD de l'entreprise. Plus de mots de passe à gérer séparément. Les utilisateurs se connectent avec leurs identifiants habituels.

**Capability Requirements:**
- Console d'administration tenant
- Import/export utilisateurs (CSV, Azure AD sync)
- Gestion des rôles et permissions
- SSO et intégration annuaire
- Audit trail des accès et modifications

---

### Journey 6: Emma Dubois - Support CTC en Première Ligne

Emma travaille chez Cyber Threat Consulting, l'éditeur de Sentinel-GRC. Elle gère le support niveau 1 pour les clients.

**La demande type:** Un client appelle: "Je n'arrive pas à valider mon formulaire de risque, ça me dit 'date invalide'." Emma accède au compte client (avec les permissions appropriées) et voit immédiatement: le client utilise le format de date français alors que son navigateur est configuré en anglais.

**La résolution rapide:** Emma explique le problème et note dans le ticket que c'est un cas récurrent. Elle escalade à l'équipe produit avec la suggestion: "Centraliser la config locale pour éviter ces incompatibilités."

**Le suivi proactif:** Une semaine plus tard, le fix est déployé. Emma contacte proactivement les 12 clients qui avaient signalé ce problème: "Nous avons résolu le problème de validation des dates. Merci pour votre patience."

**Capability Requirements:**
- Accès support avec permissions limitées
- Logs et diagnostic des erreurs utilisateur
- Système de tickets intégré
- Communication proactive aux clients

### Journey Requirements Summary

Les parcours révèlent les capacités clés suivantes:

| Domaine | Capacités Requises |
|---------|-------------------|
| **Dashboards** | Vue personnalisée par rôle (Dirigeant, RSSI, PM, Admin) |
| **Formulaires** | Mode brouillon, validation live, config locale FR/EN |
| **Reporting** | Rapports automatiques, export multi-format |
| **Audit** | Portail externe, checklist interactive, preuves liées |
| **Collaboration** | Assignation actions, notifications, commentaires |
| **Administration** | Gestion users, rôles, SSO, audit trail |
| **Multi-framework** | Mapping automatique ISO/NIS2/DORA/RGPD |

## Domain-Specific Requirements

### GRC Compliance & Regulatory Overview

Sentinel-GRC opère dans le domaine hautement réglementé de la Governance, Risk & Compliance (GRC). Ce domaine impose des exigences strictes de conformité aux normes internationales et aux réglementations européennes.

**Contexte réglementaire 2025-2026:**
- ISO 27001:2022 avec 93 contrôles réorganisés en 4 catégories
- NIS2 en vigueur depuis octobre 2024 (directive transposée)
- DORA applicable depuis janvier 2025 (règlement direct)
- RGPD toujours central pour la protection des données

### Key Domain Concerns

#### 1. Multi-Framework Compliance
L'application doit supporter simultanément plusieurs référentiels avec des chevauchements significatifs:

| Framework | Type | Applicable à | Contrôles |
|-----------|------|--------------|-----------|
| ISO 27001:2022 | Certification volontaire | Toute organisation | 93 contrôles |
| NIS2 | Directive EU | Secteurs essentiels/importants | ~50 exigences |
| DORA | Règlement EU | Entités financières | ~100 exigences |
| RGPD | Règlement EU | Tout traitement données personnelles | 99 articles |

**Implication produit:** Mapping automatique entre frameworks avec gestion des doublons et différences.

#### 2. Audit Trail & Evidence Management
Les audits de certification et de conformité exigent:
- Traçabilité complète des modifications (qui, quoi, quand)
- Conservation des preuves avec horodatage non-modifiable
- Historisation des versions de documents
- Logs de toutes les actions utilisateur

**Implication produit:** Audit trail complet, versioning, et archivage sécurisé des preuves.

#### 3. Risk-Based Approach
ISO 27001:2022 et NIS2 imposent une approche basée sur les risques:
- Méthodologie d'analyse des risques documentée
- Évaluation impact x probabilité
- Plan de traitement avec contrôles associés
- Revue périodique et mise à jour

**Implication produit:** Module de gestion des risques avec méthodologie configurable et liaison aux contrôles.

#### 4. Documentation & Records Management
Exigences documentaires strictes:
- Politiques et procédures obligatoires (PSSI, PCA, etc.)
- Enregistrements de sensibilisation et formation
- Rapports d'incidents et analyses post-mortem
- Déclarations d'applicabilité (SoA)

**Implication produit:** GED intégrée avec templates réglementaires et workflow de validation.

### Compliance Requirements

#### ISO 27001:2022 - Documentation obligatoire

| Document | Clause | Statut Sentinel-GRC |
|----------|--------|---------------------|
| Politique de sécurité | 5.2 | Template fourni |
| Statement of Applicability (SoA) | 6.1.3 | Génération automatique |
| Plan de traitement des risques | 6.1.3 | Module Risques |
| Registre des actifs | A.5.9 | Module Actifs |
| Plan de continuité | A.5.30 | Module PCA/PRA |
| Registre des incidents | A.5.24 | Module Incidents |

#### NIS2 - Exigences spécifiques

| Exigence | Article | Support Sentinel-GRC |
|----------|---------|---------------------|
| Notification incident 24h | Art. 23 | Workflow notifications |
| Gestion supply chain | Art. 21 | Module Fournisseurs |
| Formation direction | Art. 20 | Suivi sensibilisation |
| Tests de résilience | Art. 21 | Planification audits |

#### DORA - Exigences financières

| Exigence | Article | Support Sentinel-GRC |
|----------|---------|---------------------|
| ICT Risk Management | Art. 5-15 | Framework risques ICT |
| Incident Reporting 4h | Art. 17-23 | Workflow prioritaire |
| Resilience Testing | Art. 24-27 | Tests planifiés |
| Third-Party Risk | Art. 28-44 | Gestion fournisseurs ICT |

### Industry Standards & Best Practices

**Standards de référence:**
- EBIOS Risk Manager (méthodologie risques française)
- NIST Cybersecurity Framework (complémentaire)
- CIS Controls (contrôles techniques)
- OWASP Top 10 (développement sécurisé)

**Best practices UX GRC (de la recherche):**
- Progressive disclosure pour complexité
- Dashboards personnalisés par rôle
- Wizard guidé pour implémentation
- Langage non-technique pour dirigeants

### Required Expertise & Validation

**Expertise nécessaire:**
- Connaissance des référentiels ISO 27001, NIS2, DORA
- Expérience audits de certification
- Compréhension des méthodologies de risques
- Maîtrise des exigences RGPD

**Validations requises:**
- Mapping contrôles vérifié par expert conformité
- Templates documentaires validés
- Workflows de notification conformes aux délais réglementaires
- Calculs de risques selon méthodologie reconnue

### Implementation Considerations

#### Priorités techniques domaine-spécifiques

1. **Intégrité des données**
   - Horodatage non-modifiable
   - Signatures électroniques si nécessaire
   - Archivage conforme

2. **Multi-tenant isolation**
   - Données client strictement isolées
   - Aucun partage sauf explicite (threat intel)
   - Audit trail par tenant

3. **Disponibilité**
   - SLA adapté aux exigences DORA
   - PCA/PRA pour la plateforme elle-même
   - Backup et restauration testés

4. **Mise à jour réglementaire**
   - Veille sur évolutions des frameworks
   - Mise à jour des mappings de contrôles
   - Communication aux clients des changements

## Innovation & Novel Patterns

### Detected Innovation Areas

#### 1. Technologie Voxel 3D (Innovation Principale)
**Ce qui est nouveau:** Aucune solution GRC ne propose une visualisation 3D dynamique du système d'information avec propagation en temps réel des risques.

**L'approche Sentinel-GRC:**
- Modélisation 3D du SI avec nœuds et connexions
- Visualisation propagation d'incident en temps réel
- Identification automatique des nœuds critiques (SPOF)
- Impact cascade fournisseurs visible instantanément

**Assumption challengée:** "Les tableaux et rapports suffisent pour comprendre les risques."

#### 2. IA EBIOS + Gemini
**Ce qui est nouveau:** Intégration native d'une IA générative pour automatiser et enrichir la méthodologie EBIOS RM.

**L'approche Sentinel-GRC:**
- Suggestions automatiques de scénarios de menaces
- Pré-analyse des vecteurs d'attaque par asset
- Recommandations personnalisées par secteur d'activité
- Réduction du temps d'analyse de 3 semaines à 3 jours

**Assumption challengée:** "L'analyse EBIOS nécessite un expert dédié pendant des semaines."

#### 3. Score de Maturité "Apple Health Style"
**Ce qui est nouveau:** Présentation de la conformité comme un score de santé évolutif plutôt qu'une checklist binaire.

**L'approche Sentinel-GRC:**
- Score global visible en permanence (0-100%)
- Tendance sur le temps (amélioration/dégradation)
- Décomposition par domaine ISO 27001
- Alertes proactives sur les baisses de score

**Assumption challengée:** "La conformité est un état statique (conforme/non-conforme)."

### Market Context & Competitive Landscape

**Taille du Marché (2024-2033):**

| Segment | Valeur 2024 | Projection | CAGR |
|---------|-------------|------------|------|
| Europe GRC | $14.8 Mrd | $27.8 Mrd (2033) | 6.88% |
| Global GRC | $62.5 Mrd | $151.5 Mrd (2034) | 13.2% |
| GRC Cybersécurité | $7.2 Mrd | $18.2 Mrd (2030) | 17% |

*Sources: IMARC Group, Yahoo Finance, Mordor Intelligence*

**Carte du Marché:**

```
                    PROFONDEUR FONCTIONNELLE
                    ─────────────────────────►
                    Basique              Complète

    │               │                    │
    │   Vanta       │                    │ Archer
    │   Drata       │                    │ ServiceNow
 P  │               │                    │ OneTrust
 R  ├───────────────┼────────────────────┤
 I  │               │                    │
 X  │               │   ★ SENTINEL       │
    │   Eramba      │                    │ Egerie
    │   (Open)      │      Citalid       │
    │               │                    │
    ▼               │                    │
```

**Matrice Différenciation Détaillée:**

| Critère | Sentinel | Egerie | Citalid | OneTrust | ServiceNow | Vanta |
|---------|----------|--------|---------|----------|------------|-------|
| **Visualisation 3D** | ✅ Voxel | ❌ | ❌ | ❌ | ❌ | ❌ |
| **IA intégrée** | ✅ Gemini | ⚠️ Limité | ✅ CRQ | ⚠️ Add-on | ✅ Native | ⚠️ Basic |
| **EBIOS RM natif** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Souveraineté EU** | ✅ 100% | ✅ | ✅ | ❌ US | ❌ US | ❌ US |
| **Time-to-value** | < 8 sem | 3+ mois | 2+ mois | 6+ mois | 6+ mois | 4 sem |
| **Prix entrée** | €€ | €€€ | €€ | €€€€ | €€€€€ | €€ |
| **NIS2/DORA natif** | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ | 🆕 2025 |

**Analyse Concurrentielle Clé:**

| Concurrent | Positionnement | Notre Angle d'Attaque |
|------------|----------------|----------------------|
| **Egerie** | Champion souverain FR, EBIOS natif | UX moderne + Voxel 3D (vs interface 2010) |
| **Citalid** | Leader quantification CRQ, 35% CAC40 | GRC complet (vs focus quantification seule) |
| **OneTrust** | #2 mondial, Privacy-first | Simplicité + souveraineté (vs complexité + US) |
| **ServiceNow** | Écosystème ITSM intégré | Indépendance + spécialisation (vs lock-in) |
| **Vanta/Drata** | Automatisation SOC2, startups | Profondeur EBIOS/NIS2 (vs focus SOC2 US) |
| **Archer** | Vétéran enterprise | Modernité + time-to-value (vs legacy lourd) |

**Gap marché identifié:** 66% des RSSI jugent leurs outils GRC inefficaces. Aucune solution ne combine visualisation 3D, IA intégrée et souveraineté européenne.

### Validation Approach

#### Validation Wizard SMSI
- **MVP Test:** 5 PME pilotes utilisent le wizard pour préparer ISO 27001
- **Métrique succès:** 80% atteignent l'étape "prêt pour audit" sans support externe
- **Timeline:** 3 mois de pilote

#### Validation Score Apple Health
- **MVP Test:** A/B test dashboard classique vs score santé
- **Métrique succès:** Time-on-dashboard, frequency of return, NPS
- **Timeline:** 1 mois après déploiement

#### Validation Collaboration Multi-Org
- **MVP Test:** 3 organisations partenaires partagent threat intel
- **Métrique succès:** Nombre d'alertes générées, temps de réaction
- **Timeline:** 6 mois (nécessite masse critique)

### Risk Mitigation

| Innovation | Risque | Mitigation |
|------------|--------|------------|
| Wizard SMSI | Trop simpliste pour cas complexes | Parcours "expert" alternatif |
| Score Apple Health | Confusion sur la signification | Explication progressive, tooltips |
| Collaboration Multi-Org | Confidentialité des données | Anonymisation stricte, opt-in explicite |
| Focus EU | Marché plus petit que US | Premium pricing, valeur perçue locale |

**Fallback Strategy:** Si les innovations majeures échouent, Sentinel-GRC reste une solution GRC solide avec multi-framework EU et UX Apple-like - suffisant pour différenciation marché.

## SaaS B2B Specific Requirements

### Project-Type Overview

Sentinel-GRC est une application SaaS B2B multi-tenant destinée aux entreprises européennes (PME/ETI). L'architecture existante utilise Firebase avec isolation par tenant et un système RBAC à 6 rôles.

**Caractéristiques SaaS B2B:**
- Multi-tenant avec isolation stricte des données
- Modèle de permissions granulaire (RBAC)
- Tiers de souscription pour différentes tailles d'entreprise
- Intégrations enterprise (SSO, API, exports)
- Conformité réglementaire (RGPD, hébergement EU)

### Technical Architecture Considerations

#### Tenant Model

**Architecture actuelle:**
- Isolation par `organizationId` dans Firestore
- Règles de sécurité Firestore vérifiant le tenant
- Données utilisateur liées à l'organisation via `organizationId`

**Évolutions identifiées:**
- Collaboration inter-tenant (Threat Intel) nécessite partage opt-in
- Portail auditeur externe = accès limité cross-tenant
- Super-admin CTC pour support multi-tenant

#### RBAC Matrix

**Rôles existants (permissions.ts):**

| Rôle | Description | Niveau d'accès |
|------|-------------|----------------|
| `admin` | Administrateur tenant | Manage all |
| `rssi` | Responsable sécurité | CRUD sur risques, actifs, incidents |
| `auditor` | Auditeur interne | Read + Create sur audits/preuves |
| `project_manager` | Chef de projet | CRUD sur projets/actions |
| `direction` | Direction | Read all + dashboards |
| `user` | Utilisateur standard | Read limité |

**Évolutions prévues:**
- Permissions plus granulaires par module
- Rôles personnalisables par tenant
- Audit externe = nouveau rôle avec accès restreint

#### Subscription Tiers

**Modèle de pricing proposé (basé sur recherche marché):**

| Tier | Cible | Utilisateurs | Frameworks | Prix/an |
|------|-------|--------------|------------|---------|
| **Starter** | TPE/PME | 1-10 | 1 | $5,000 |
| **Business** | PME | 10-50 | 2 | $15,000 |
| **Enterprise** | ETI | 50+ | Illimité | $25,000+ |

**Features par tier:**

| Feature | Starter | Business | Enterprise |
|---------|---------|----------|------------|
| Modules de base | ✓ | ✓ | ✓ |
| Wizard SMSI | ✓ | ✓ | ✓ |
| Multi-framework | 1 | 2 | Illimité |
| Portail auditeur | - | ✓ | ✓ |
| SSO | - | - | ✓ |
| API access | - | Limité | Full |
| Support | Email | Email+Chat | Dédié |
| Threat Intel | - | - | ✓ |

#### Integration List

**Intégrations prioritaires:**

| Catégorie | Intégration | Priorité | Statut |
|-----------|-------------|----------|--------|
| **Auth** | Azure AD SSO | Haute | À faire |
| **Auth** | Google Workspace | Moyenne | À faire |
| **Export** | PDF | Haute | Existant |
| **Export** | Excel/CSV | Haute | Existant |
| **Cloud** | AWS (evidence) | Basse | Future |
| **Ticketing** | Jira | Basse | Future |

#### Compliance Requirements (Plateforme)

**RGPD - La plateforme elle-même:**
- Hébergement EU (Firebase europe-west1)
- DPA (Data Processing Agreement) avec clients
- Droit à l'effacement implémentable
- Registre des traitements maintenu

**Sécurité plateforme:**
- Chiffrement en transit (HTTPS) ✓
- Chiffrement au repos (Firestore) ✓
- Authentification Firebase Auth ✓
- MFA disponible via Firebase ✓

### Implementation Considerations

#### Performance SaaS

| Métrique | Cible | Mesure |
|----------|-------|--------|
| Page load | <2s | Core Web Vitals |
| API response | <500ms | p95 latency |
| Concurrent users | 1000+/tenant | Load testing |
| Uptime | 99.9% | SLA |

#### Enterprise Readiness Checklist

- [ ] SSO SAML/OIDC
- [ ] Provisioning SCIM
- [ ] Audit logs exportables
- [ ] SLA contractuel
- [ ] Support dédié
- [ ] Onboarding personnalisé

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Plateforme GRC augmentée par l'IA
- Différenciateurs uniques: Voxel 3D, Gemini AI, Souveraineté EU
- Compliance multi-framework native: EBIOS RM, ISO 27001, NIS2, DORA, HDS, RGS
- Time-to-value agressif: < 8 semaines vs 3-6 mois concurrents

**Rationale:** Sentinel-GRC est fonctionnel avec ses features core. L'objectif 2026 est d'accélérer sur les verticaux prioritaires (Finance/DORA, Industrie/NIS2) et d'affiner les différenciateurs clés.

### MVP Core (Actuel - Live)

| Feature | Statut | Valeur |
|---------|--------|--------|
| Cartographie Voxel 3D | ✅ Live | Différenciateur unique |
| EBIOS RM natif | ✅ Live | Conformité ANSSI |
| Intégration Gemini AI | ✅ Live | Suggestions automatiques |
| Dashboard COMEX | ✅ Live | Reporting décisionnel |
| Audit Trail | ✅ Live | Traçabilité absolue |
| RBAC granulaire | ✅ Live | Gouvernance |

### Frameworks Supportés

| Framework | Niveau Support |
|-----------|----------------|
| EBIOS RM 2024 (v1.5) | ✅ Complet |
| ISO 27001:2023 | ✅ Complet |
| NIS2 | ✅ Complet |
| DORA | ✅ Complet |
| HDS v2 | ✅ Complet |
| RGS | ✅ Complet |

### Roadmap Q1-Q2 2026 (Priorités Verticales)

| Feature | Priorité | Vertical Cible | Justification |
|---------|----------|----------------|---------------|
| Registre ICT automatisé (DORA Art. 28) | P0 | Finance | Deadline réglementaire 30 avril |
| Templates homologation ANSSI | P0 | Public | Demande forte collectivités |
| Connecteur SCADA/ICS | P1 | Industrie | Convergence IT/OT |
| Module Third-Party Risk | P1 | Tous | 85% RSSI sans visibilité tiers |
| Quantification financière avancée | P1 | Tous | ROI COMEX démontrable |

### Vision Long Terme (2026-2027)

| Capability | Description |
|------------|-------------|
| **Sentinel Intelligence** | CTI intégrée, monitoring menaces temps réel |
| **Sentinel Predict** | ML prédictif incidents basé sur patterns |
| **Sentinel Automate** | Playbooks réponse automatisés |
| **Sentinel Collaborate** | Multi-tenant pour cabinets conseil/MSSP |
| **Sentinel API** | Marketplace intégrations |

### Risk Mitigation Strategy

**Technical Risks:**

| Risque | Mitigation |
|--------|------------|
| Dépendance Gemini AI | Architecture multi-LLM |
| Performance Voxel 3D | Lazy loading, WebGL optimization |
| Scalabilité multi-tenant | Firebase auto-scaling |

**Market Risks:**

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Egerie renforce son UX | Moyenne | Élevé | Accélérer différenciation Voxel |
| OneTrust lance offre EU | Faible | Élevé | Renforcer narrative souveraineté |
| Consolidation marché | Moyenne | Moyen | Croissance rapide, base clients |
| Complexité NIS2/DORA | Élevée | Positif | Opportunité de marché |

## Functional Requirements

### User Experience & Interface

- FR1: Tous les utilisateurs peuvent voir des messages d'erreur humanisés en français
- FR2: Tous les utilisateurs peuvent saisir des dates dans le format local (FR: dd/MM/yyyy, EN: MM/dd/yyyy)
- FR3: Tous les utilisateurs peuvent sauvegarder des formulaires en mode brouillon avant validation complète
- FR4: Tous les utilisateurs peuvent voir une validation en temps réel lors de la saisie
- FR5: Tous les utilisateurs peuvent effectuer des actions contextuelles depuis les listes (modifier, supprimer, dupliquer)

### Dashboards & Visualisation

- FR6: Les dirigeants peuvent voir un score de maturité global avec tendance sur le temps
- FR7: Les dirigeants peuvent voir les 3 KPIs critiques sans jargon technique
- FR8: Les RSSI peuvent voir les risques ouverts classés par criticité
- FR9: Les RSSI peuvent voir les incidents en cours et actions assignées
- FR10: Les project managers peuvent voir l'avancement du projet de conformité
- FR11: Tous les utilisateurs peuvent personnaliser leur dashboard selon leur rôle

### Gestion des Risques

- FR12: Les RSSI peuvent créer, modifier et supprimer des risques
- FR13: Les RSSI peuvent évaluer les risques selon une méthodologie (impact x probabilité)
- FR14: Les RSSI peuvent lier des risques à des contrôles de sécurité
- FR15: Les RSSI peuvent assigner des actions de traitement avec responsables et deadlines
- FR16: Tous les utilisateurs autorisés peuvent voir le registre des risques

### Multi-Framework Compliance

- FR17: Les administrateurs peuvent activer plusieurs frameworks de conformité (ISO 27001, NIS2, DORA, RGPD)
- FR18: Le système peut mapper automatiquement les contrôles entre frameworks
- FR19: Les RSSI peuvent voir les exigences partagées entre frameworks
- FR20: Les RSSI peuvent générer un Statement of Applicability (SoA)

### Audit & Preuves

- FR21: Les auditeurs internes peuvent créer et gérer des audits
- FR22: Les auditeurs peuvent lier des preuves aux contrôles audités
- FR23: Les auditeurs externes peuvent accéder au portail auditeur avec accès limité
- FR24: Les auditeurs peuvent utiliser une checklist interactive par domaine
- FR25: Tous les utilisateurs peuvent générer des dossiers de preuves automatiquement

### Gestion Documentaire

- FR26: Les utilisateurs autorisés peuvent créer, modifier et archiver des documents
- FR27: Les utilisateurs peuvent versionner les documents avec historique
- FR28: Les utilisateurs peuvent lier des documents aux contrôles et risques
- FR29: Le système peut générer des templates documentaires réglementaires

### Reporting & Export

- FR30: Les dirigeants peuvent générer des rapports automatiques pour le board
- FR31: Tous les utilisateurs peuvent exporter en PDF, Excel, CSV
- FR32: Les utilisateurs peuvent planifier des rapports récurrents

### Gestion de Projet

- FR33: Les project managers peuvent créer des plans projet avec jalons
- FR34: Les project managers peuvent assigner des actions avec deadlines
- FR35: Le système peut envoyer des rappels automatiques avant échéance
- FR36: Les utilisateurs assignés peuvent marquer les actions comme terminées

### Collaboration & Notifications

- FR37: Tous les utilisateurs peuvent recevoir des notifications sur leurs tâches
- FR38: Les utilisateurs peuvent commenter sur les entités (risques, audits, actions)
- FR39: Les utilisateurs peuvent @mentionner des collègues
- FR40: Le système peut notifier des alertes critiques (deadline, incident, baisse de score)

### Administration Tenant

- FR41: Les administrateurs peuvent créer et gérer les utilisateurs de leur organisation
- FR42: Les administrateurs peuvent assigner des rôles aux utilisateurs
- FR43: Les administrateurs peuvent importer des utilisateurs depuis CSV ou annuaire
- FR44: Les administrateurs peuvent configurer les paramètres de l'organisation
- FR45: Les administrateurs peuvent voir l'audit trail des actions utilisateur

### Authentification & Sécurité

- FR46: Tous les utilisateurs peuvent s'authentifier via email/mot de passe
- FR47: Les utilisateurs enterprise peuvent s'authentifier via SSO (Azure AD, Google)
- FR48: Tous les utilisateurs peuvent activer l'authentification multi-facteur
- FR49: Le système peut isoler les données par tenant (organisation)

### Wizard SMSI (Innovation)

- FR50: Les nouveaux utilisateurs peuvent suivre un parcours guidé pour implémenter ISO 27001
- FR51: Le wizard peut proposer des étapes progressives avec validation
- FR52: Le wizard peut estimer le temps restant jusqu'à certification
- FR53: Le wizard peut suggérer des contrôles selon le secteur d'activité

## Non-Functional Requirements

### Performance

| Critère | Cible | Mesure |
|---------|-------|--------|
| Page load time | <2s | Core Web Vitals LCP |
| Time to Interactive | <3s | Core Web Vitals TTI |
| API response time | <500ms | p95 latency |
| Dashboard refresh | <1s | Time to complete |
| Export génération | <10s | Pour documents <100 pages |
| Recherche | <500ms | Pour résultats <1000 items |

**Conditions:**
- Connexion standard (10 Mbps)
- Browser moderne (Chrome/Firefox/Safari/Edge dernières versions)
- Jusqu'à 1000 utilisateurs simultanés par tenant

### Security

**Authentification & Autorisation:**
- NFR-S1: Authentification multi-facteur disponible pour tous les utilisateurs
- NFR-S2: Sessions expirées après 8h d'inactivité
- NFR-S3: Verrouillage de compte après 5 tentatives échouées
- NFR-S4: Mots de passe minimum 12 caractères avec complexité

**Protection des données:**
- NFR-S5: Données chiffrées en transit (TLS 1.3)
- NFR-S6: Données chiffrées au repos (AES-256)
- NFR-S7: Isolation des données par tenant (organizationId)
- NFR-S8: Aucune donnée client accessible sans autorisation explicite

**Conformité:**
- NFR-S9: Hébergement en Europe (Firebase europe-west1)
- NFR-S10: Conformité RGPD (droit à l'effacement, portabilité)
- NFR-S11: Audit trail non-modifiable pour toutes les actions

### Scalability

| Dimension | Initial | Cible 12 mois | Cible 36 mois |
|-----------|---------|---------------|---------------|
| Tenants (organisations) | 10 | 100 | 500 |
| Utilisateurs par tenant | 50 | 200 | 500 |
| Utilisateurs totaux | 500 | 20,000 | 250,000 |
| Données par tenant | 1 GB | 10 GB | 50 GB |

**Scalabilité technique:**
- NFR-SC1: Architecture auto-scaling (Firebase)
- NFR-SC2: Pas de dégradation performance >10% avec charge 10x
- NFR-SC3: Ajout de tenant sans intervention manuelle

### Reliability

| Critère | Cible | Période |
|---------|-------|---------|
| Uptime | 99.9% | Mensuel |
| RTO (Recovery Time Objective) | <4h | Par incident |
| RPO (Recovery Point Objective) | <1h | Perte de données max |
| Backup | Quotidien | Rétention 30 jours |

**Disaster Recovery:**
- NFR-R1: Backup automatique quotidien
- NFR-R2: Restore testable par tenant
- NFR-R3: Multi-région Firebase (failover automatique)

### Accessibility

**Standards:**
- NFR-A1: Conformité WCAG 2.1 AA minimum
- NFR-A2: Navigation clavier complète
- NFR-A3: Contraste texte minimum 4.5:1
- NFR-A4: Labels ARIA pour les lecteurs d'écran
- NFR-A5: Textes alternatifs pour toutes les images

### Internationalization

- NFR-I1: Interface disponible en français et anglais
- NFR-I2: Formats de date/nombre selon la locale utilisateur
- NFR-I3: Architecture extensible pour autres langues
- NFR-I4: Documentation utilisateur en français et anglais

### Maintainability

- NFR-M1: Code couvert par tests automatisés >70%
- NFR-M2: Documentation technique à jour
- NFR-M3: Déploiement sans downtime (blue-green)
- NFR-M4: Rollback possible en <15min
