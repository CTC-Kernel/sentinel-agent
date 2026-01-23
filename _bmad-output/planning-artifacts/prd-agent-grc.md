---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: ['brainstorming-session-2026-01-23.md', 'comprehensive-agent-grc-research-2026-01-23.md', 'project-context.md', 'prd.md']
workflowType: 'prd'
lastStep: 1
briefCount: 0
researchCount: 1
brainstormingCount: 1
projectDocsCount: 2
project_type: 'endpoint_agent'
domain: 'grc_compliance'
complexity: 'high'
---

# Product Requirements Document - Agent GRC Sentinel

**Author:** Thibaultllopis
**Date:** 2026-01-23

## Executive Summary

L'**Agent GRC Sentinel** est un agent intelligent multi-plateforme qui comble le fossé critique entre la gouvernance (GRC) et la technique (endpoints). Alors que les solutions GRC SaaS actuelles (Vanta, Drata) restent agentless et que les solutions Endpoint Security (CrowdStrike, Tanium) n'offrent pas de mapping réglementaire, l'Agent GRC Sentinel est le premier à unifier ces deux mondes.

Connecté à la plateforme Sentinel GRC SaaS existante, l'agent déploie une **double fonction unique** :
- **Conseiller IA** : Assiste sur les mesures à implémenter pour atteindre la conformité NIS2, DORA et autres référentiels
- **Contrôleur Technique** : Vérifie factuellement l'application des mesures sur chaque endpoint

Cette boucle fermée (Conseil → Implémentation → Contrôle → Écart → Conseil) transforme la conformité de déclaratif à factuel.

### What Makes This Special

1. **Pont GRC ↔ Technique** — Positionnement unique sur un marché de $50-65B, aucun concurrent ne couvre ce gap
2. **Validation humaine obligatoire** — Pas d'auto-remediation, confiance et audit trail garantis
3. **Intelligence collective opt-in** — Effet réseau premium entre clients participants
4. **Score conformité enrichi temps réel** — Écarts détaillés + tendances historiques + recommandations
5. **UI-first, zero code** — Adoption massive sans expertise scripting requise
6. **Mode offline robuste** — Contrôles avec règles en cache, stockage local, synchronisation ultérieure

## Project Classification

**Technical Type:** endpoint_agent (Agent système natif multi-plateforme)
**Domain:** grc_compliance (Gouvernance, Risque, Conformité)
**Complexity:** HIGH
**Project Context:** Brownfield — Extension de la plateforme Sentinel GRC SaaS existante

### Justification de la complexité élevée

| Facteur | Impact |
|---------|--------|
| **Multi-OS** | Windows + Linux V1, macOS V1.1 — compilation croisée Rust |
| **Conformité réglementaire** | NIS2 (10 mesures Art.21), DORA (5 piliers) — sanctions jusqu'à €10M |
| **Sécurité endpoint** | Privilèges admin/root, code signing, TLS 1.3, certificate pinning |
| **Architecture distribuée** | Agent léger + Intelligence cloud, mode offline, synchronisation |
| **Intégration SaaS** | API bidirectionnelle avec Sentinel GRC existant |

### Stack technique validée

- **Langage :** Rust (sécurité mémoire, cross-compile natif, 1000x moins de bugs que C++)
- **Runtime :** Tokio (async)
- **Communication :** REST/HTTPS (universel, passe firewalls)
- **Stockage local :** SQLite (ACID, robuste, un fichier)
- **Déploiement :** Service/Daemon (toujours actif, peut bloquer)
- **Mise à jour :** Staged Rollout (1%→10%→50%→100%, rollback auto)

## Success Criteria

### User Success

**Persona cible :** Responsable Conformité / RSSI / DPO

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Automatisation contrôles** | % contrôles manuels automatisés | ≥ 80% |
| **Score temps réel** | Latence mise à jour score | < 5 minutes |
| **Alertes dégradation** | Notification sur baisse score | Immédiat (< 1 min) |
| **Réduction effort** | Temps économisé par endpoint/mois | ≥ 2h |
| **Visibilité conformité** | Écarts identifiés avec recommandations | 100% traçables |

**Moment "Aha!"** : L'utilisateur voit son score conformité se mettre à jour automatiquement après application d'une mesure, sans intervention manuelle.

**Succès émotionnel** : "Je sais exactement où j'en suis à tout moment, plus de surprises lors des audits."

### Business Success

| Horizon | Métrique | Cible |
|---------|----------|-------|
| **6 mois** | Endpoints déployés | 10 000+ |
| **6 mois** | Clients avec agent actif | 50+ |
| **6 mois** | Revenu additionnel MRR | €30-50k |
| **12 mois** | Endpoints déployés | 50 000+ |
| **12 mois** | Conversion SaaS → SaaS+Agent | ≥ 40% |
| **12 mois** | Revenu additionnel MRR | €150-250k |

**Pricing validé :** €3-5/endpoint/mois (tiering basé sur volume)

**Indicateur clé :** Taux de rétention clients agent > 95% (valeur prouvée)

### Technical Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Fiabilité agent** | Uptime service | ≥ 99.5% |
| **Performance** | CPU/RAM impact | < 2% CPU, < 100MB RAM |
| **Sécurité** | Vulnérabilités critiques | 0 en production |
| **Compatibilité** | OS supportés V1 | Windows 10+, Ubuntu 20.04+, RHEL 8+ |
| **Mode offline** | Durée autonomie | ≥ 7 jours |
| **Synchronisation** | Réconciliation après reconnexion | < 5 min |

### Measurable Outcomes

**Conformité réglementaire vérifiable :**

| Référentiel | Checks automatisables | Cible V1 |
|-------------|----------------------|----------|
| **NIS2 Art.21** | 6/10 mesures | 100% coverage |
| **DORA** | 2/5 piliers (ICT Risk, Resilience Testing) | 100% coverage |

**Impact client démontrable :**
- Réduction temps audit : -50%
- Écarts détectés proactivement : +300%
- Conformité factuelle vs déclarative : 100%

## Product Scope

### MVP - Minimum Viable Product

**Objectif :** Valider le concept Pont GRC ↔ Technique

| Composant | Périmètre MVP |
|-----------|---------------|
| **OS Support** | Windows 10/11, Ubuntu 20.04+ |
| **Checks** | 20 contrôles prioritaires (NIS2/DORA) |
| **Communication** | REST/HTTPS vers SaaS Sentinel |
| **Stockage local** | SQLite, cache règles, preuves |
| **Mode offline** | Contrôles en cache, sync ultérieure |
| **Dashboard** | Score endpoint, écarts, tendance 30j |
| **Authentification** | Token agent + mTLS |

**Hors scope MVP :**
- macOS
- Remediation automatique
- Intelligence collective
- Checks personnalisés

### Growth Features (Post-MVP)

| Feature | Valeur | Priorité |
|---------|--------|----------|
| **macOS Support** | Couverture 95%+ parc client | P1 |
| **Intelligence collective opt-in** | Effet réseau, premium | P1 |
| **Checks personnalisés (UI)** | Flexibilité client | P2 |
| **Alertes enrichies** | Intégration SIEM/SOAR | P2 |
| **API publique agent** | Intégrations tierces | P3 |

### Vision (Future)

**Agent GRC Sentinel 2.0 :**
- **Remediation assistée** : Propositions avec validation humaine one-click
- **IA prédictive** : Anticipation dérives conformité
- **Multi-tenant MSP** : Gestion centralisée pour MSSP
- **Marketplace checks** : Communauté de règles partagées
- **Certification continue** : Attestation temps réel pour auditeurs

