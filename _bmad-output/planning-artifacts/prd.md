---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
inputDocuments: ['_bmad-output/planning-artifacts/research/comprehensive-grc-research-2026-01-10.md', '_bmad-output/analysis/brainstorming-session-2026-01-10.md', 'docs/index.md', 'docs/architecture-overview.md', 'docs/data-models.md', 'docs/api-reference.md', 'docs/features-guide.md', 'docs/development-guide.md', 'docs/security-guide.md']
workflowType: 'prd'
lastStep: 11
workflow_completed: true
briefCount: 0
researchCount: 1
brainstormingCount: 1
projectDocsCount: 7
project_type: 'saas_b2b'
domain: 'grc_compliance'
complexity: 'high'
---

# Product Requirements Document - sentinel-grc-v2-prod

**Author:** Thibaultllopis
**Date:** 2026-01-10

## Executive Summary

Sentinel-GRC est une plateforme SaaS de Governance, Risk & Compliance (GRC) conçue pour les PME et ETI européennes. L'application offre une solution complète pour gérer la conformité multi-framework (ISO 27001:2022, NIS2, DORA, RGPD) avec une expérience utilisateur intuitive de niveau Apple.

Ce PRD définit les évolutions prioritaires pour améliorer l'expérience utilisateur, renforcer la personnalisation par rôle, et ajouter des fonctionnalités de collaboration innovantes.

### What Makes This Special

**Positionnement unique sur le marché GRC:**

1. **Focus Européen** - Conçu pour les réglementations EU (NIS2, DORA) vs concurrents US-centric (Vanta, Drata, Secureframe)
2. **Wizard SMSI Guidé** - Implémentation ISO 27001 pas-à-pas, unique sur le marché
3. **Prix Accessible** - Positionnement compétitif pour PME ($5K-25K vs $10K-100K concurrents)
4. **UX Apple-like** - Interface intuitive pour non-techniciens (dirigeants, RSSI, auditeurs)
5. **Collaboration Multi-org** - Threat Intelligence partagé entre organisations partenaires
6. **Support Français** - Langue native et expertise conformité locale

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

### User Success

**Expérience sans friction:**
- Zero erreur de validation liée aux formats FR/EN (dates, nombres)
- Formulaires avec mode brouillon - sauvegarde automatique toutes les 30s
- Messages d'erreur humanisés et actionnables (vs messages techniques cryptiques)

**Personnalisation par rôle:**
- Chaque persona voit un dashboard adapté à ses besoins dès la connexion
- Temps de prise en main divisé par 2 pour nouveaux utilisateurs
- Dirigeants: Score global + 3 KPIs + alertes critiques uniquement
- RSSI: Vue risques, incidents, actions prioritaires
- Auditeurs: Checklist audit, preuves, progression

**Moments de satisfaction ("Aha!"):**
- Premier login: "Je vois exactement ce dont j'ai besoin"
- Création risque: "C'était rapide et intuitif"
- Préparation audit: "Toutes mes preuves sont organisées automatiquement"

### Business Success

**Positionnement marché (3 mois):**
- Différenciation claire vs Vanta/Drata sur le segment EU
- Prix compétitif PME: $5K-15K entrée, $15K-25K scale-up
- Support français comme avantage concurrentiel

**Acquisition clients (12 mois):**
- Premiers clients payants utilisant le wizard SMSI
- Taux de rétention >90% (vs ~85% industrie SaaS B2B)
- NPS >50 (users satisfaits qui recommandent)

**Métriques clés:**
- Time-to-value: <30 min de l'inscription au premier risque créé
- Adoption des features: >70% utilisent les dashboards personnalisés
- Completion rate: >80% des audits terminés vs abandonnés

### Technical Success

**Qualité et stabilité:**
- Zero bug de validation FR/EN en production
- Cohérence RBAC: 100% des pages respectent la matrice de permissions
- Performance: <2s chargement pages, <500ms actions utilisateur

**Architecture:**
- Config locale centralisée utilisée par Zod, date-fns, i18n
- Mode brouillon fonctionnel sur toutes les entités principales
- Auto-save avec debounce et gestion des conflits

**Conformité:**
- Compatibilité ISO 27001:2022 (93 contrôles, 4 catégories)
- Support NIS2 et DORA pour clients secteur financier/critique
- Audit trail complet pour toutes les modifications

### Measurable Outcomes

| Métrique | Baseline Actuel | Cible | Timeline |
|----------|-----------------|-------|----------|
| Erreurs validation FR/EN | Multiple | 0 | Quick Win |
| Temps prise en main | Variable | -50% | 3 mois |
| NPS utilisateurs | Non mesuré | >50 | 6 mois |
| Time-to-value | >1h estimé | <30min | 3 mois |
| Taux completion audit | ~70% estimé | >85% | 6 mois |

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

#### 1. Wizard SMSI Guidé (Innovation Principale)
**Ce qui est nouveau:** Aucune solution GRC ne propose un wizard pas-à-pas pour implémenter ISO 27001 de A à Z. Les concurrents (Vanta, Drata) fournissent des templates mais laissent l'utilisateur naviguer seul.

**L'approche Sentinel-GRC:**
- Parcours guidé de la création du SMSI à la certification
- Étapes progressives avec validation avant passage à la suivante
- Estimation de temps restant et progression visuelle
- Suggestions contextuelles basées sur le secteur d'activité

**Assumption challengée:** "La conformité ISO 27001 requiert un consultant externe."

#### 2. Score de Maturité "Apple Health Style"
**Ce qui est nouveau:** Présentation de la conformité comme un score de santé évolutif plutôt qu'une checklist binaire.

**L'approche Sentinel-GRC:**
- Score global visible en permanence (0-100%)
- Tendance sur le temps (amélioration/dégradation)
- Décomposition par domaine ISO 27001
- Alertes proactives sur les baisses de score

**Assumption challengée:** "La conformité est un état statique (conforme/non-conforme)."

#### 3. Collaboration Multi-Org (Threat Intel Social)
**Ce qui est nouveau:** Partage anonymisé de threat intelligence entre organisations utilisatrices (opt-in).

**L'approche Sentinel-GRC:**
- Organisations partenaires partagent les menaces détectées
- Benchmark anonymisé de maturité par secteur
- Alertes précoces sur les vecteurs d'attaque émergents
- Effet réseau: plus il y a d'utilisateurs, plus la valeur augmente

**Assumption challengée:** "La sécurité est compétitive, pas collaborative."

### Market Context & Competitive Landscape

**Différenciation vs Leaders du marché:**

| Aspect | Vanta/Drata | Sentinel-GRC |
|--------|-------------|--------------|
| Approche | Template + automation | Wizard guidé |
| Focus géo | US (SOC 2 first) | EU (ISO/NIS2/DORA first) |
| UX cible | Technique (DevOps) | Non-technique (Dirigeants) |
| Collaboration | Tenant isolé | Multi-org opt-in |
| Visualisation | Dashboards classiques | Score santé Apple |

**Gap marché identifié:** Pas de solution GRC pensée pour le marché européen PME avec une UX accessible aux non-experts.

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

**MVP Approach:** Experience MVP hybride
- Corriger les frictions UX existantes (Quick Wins)
- Ajouter les différenciateurs clés (Wizard SMSI, Score)
- Préparer la monétisation (tiers de pricing)

**Rationale:** Sentinel-GRC est déjà fonctionnel. L'enjeu n'est pas de créer un MVP from scratch mais d'atteindre un niveau de polish et de différenciation suffisant pour commercialiser.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- ✓ Philippe (Dirigeant) - Dashboard score global, rapports direction
- ✓ Sarah (RSSI) - Gestion risques, multi-framework
- ✓ Marc (Auditeur) - Portail externe, preuves
- ✓ Julie (PM) - Suivi projet, actions

**Must-Have Capabilities (Quick Wins + Core):**

| # | Feature | Impact | Effort | Priorité |
|---|---------|--------|--------|----------|
| 1 | Config locale centralisée | Fix bugs FR/EN | Faible | P0 |
| 2 | Messages erreur humanisés | UX | Faible | P0 |
| 3 | Actions contextuelles | UX | Faible | P0 |
| 4 | Mode brouillon formulaires | UX | Moyen | P1 |
| 5 | Validation live | UX | Moyen | P1 |
| 6 | Score global Apple Health | Différenciation | Moyen | P1 |

**MVP Success Criteria:**
- Zero erreur validation FR/EN
- Time-to-value <30 min
- NPS >40

### Post-MVP Features

**Phase 2 - Growth:**

| # | Feature | Value |
|---|---------|-------|
| 7 | Dashboards par rôle | Personnalisation |
| 8 | Widgets configurables | Personnalisation |
| 9 | Formulaires wizard | UX avancée |
| 10 | Wizard SMSI | Différenciation majeure |
| 11 | Rapports auto direction | Value executive |
| 12 | Export multi-format | Praticité |

**Phase 3 - Expansion:**

| # | Feature | Value |
|---|---------|-------|
| 13 | Collaboration multi-org | Unique |
| 14 | Threat Intel partagé | Network effect |
| 15 | IA suggestions | Innovation |
| 16 | SSO Enterprise | Enterprise |
| 17 | Intégrations tierces | Ecosystem |

### Risk Mitigation Strategy

**Technical Risks:**

| Risque | Mitigation |
|--------|------------|
| Complexité wizard SMSI | Prototype avec 5 PME pilotes |
| Performance dashboards | Lazy loading, caching |
| Multi-org data isolation | Revue sécurité avant déploiement |

**Market Risks:**

| Risque | Mitigation |
|--------|------------|
| Marché EU plus petit | Premium pricing, valeur locale |
| Concurrence US (Vanta) | Focus différenciation EU |
| Adoption lente | Onboarding guidé, support FR |

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
