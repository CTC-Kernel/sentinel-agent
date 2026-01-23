# Product Brief: Coffre-Fort Documentaire Securise

**Sentinel GRC v2 - Enterprise Document Vault**

**Version:** 1.0
**Date:** 2026-01-23
**Statut:** Ready for Implementation
**Type:** Extension Module

---

## Executive Summary

### Vision Produit

Transformer le module documentaire existant de Sentinel GRC en un **Enterprise Document Vault** de niveau bancaire, offrant chiffrement bout-en-bout, conformite legale (retention, legal hold), et tracabilite complete.

### Proposition de Valeur Unique

> "Le premier coffre-fort documentaire GRC europeen avec chiffrement E2E et conformite RGPD native."

**Differenciateurs cles:**

| Fonctionnalite | Sentinel Vault | Concurrents |
|----------------|----------------|-------------|
| Chiffrement serveur-side (KMS) | Natif | Add-on payant |
| Legal Hold (gel juridique) | Integre | Inexistant |
| Classification 4 niveaux | Automatique + RBAC | Manuelle |
| Signatures eIDAS | Qualifiees | Basiques |
| Retention Policy | Automatisee | Manuelle |
| Watermarking | Visible + invisible | Inexistant |

---

## Contexte Strategique

### Pourquoi Maintenant?

1. **Exigences reglementaires** - RGPD, NIS2, DORA exigent protection des documents sensibles
2. **Attente marche** - Clients demandent coffre-fort securise integre a la plateforme GRC
3. **Differentiation** - Aucun concurrent GRC EU n'offre cette fonctionnalite complete
4. **Upsell** - Opportunite tier "Vault Premium" (+30% ARPU)

### Positionnement Marche

- **Segment cible:** ETI et Grands Comptes avec documents confidentiels
- **Verticals prioritaires:** Finance (DORA), Sante (HDS), Public (ANSSI)
- **Pricing:** Feature Premium avec quota stockage

---

## Problem Statement

### Le Probleme Central

Le module documentaire actuel de Sentinel GRC est **fonctionnel mais pas securise** pour des documents critiques d'entreprise:

| Gap | Impact |
|-----|--------|
| Pas de chiffrement serveur-side | Documents lisibles en cas de breach |
| Pas de classification | Tous les documents au meme niveau d'acces |
| Pas de Legal Hold | Risque juridique (destruction preuves) |
| Pas de retention policy | Non-conformite RGPD/ISO 27001 |
| Pas de signatures certifiees | Documents sans valeur probante |
| Audit trail basique | Insuffisant pour audits externes |

### Consequences Business

- Clients Finance refusent d'uploader documents sensibles
- Perte deals vs concurrents avec vault securise
- Risque conformite pour clients existants
- Limitation upsell tier Enterprise

---

## Target Users

### Persona 1: RSSI (Marie, 42 ans)

**Contexte:** Responsable securite, garantit confidentialite des documents critiques.

**Journey actuel (frustrant):**
1. Upload politique de securite
2. Restriction acces manuelle
3. Aucune visibilite sur qui telecharge
4. Inquietude constante (pas de chiffrement)

**Journey cible (satisfaisant):**
1. Upload avec classification automatique "Confidentiel"
2. Chiffrement automatique cote serveur
3. Dashboard acces temps reel
4. Watermark automatique sur telechargement
5. Alerte si acces suspect

### Persona 2: Auditeur Externe (Pierre, 35 ans)

**Contexte:** Audits ISO 27001, doit acceder aux preuves.

**Besoins:**
- Acces temporaire (7 jours)
- View-only avec watermark "AUDIT EXTERNE"
- Verification integrite (hash SHA-256)
- Export securise pour rapport

### Persona 3: DPO (Sophie, 38 ans)

**Contexte:** Responsable RGPD, gere demandes acces/suppression.

**Besoins:**
- eDiscovery (trouver tous documents d'une personne)
- Droit a l'oubli (suppression certifiee)
- Prouver retention policy appliquee
- Rapport conformite RGPD automatique

### Persona 4: Direction (Jean, 55 ans)

**Contexte:** PDG, signe documents strategiques.

**Besoins:**
- Signature electronique valide juridiquement
- Acces mobile securise
- Vue consolidee documents critiques
- Alerte si document expire

---

## Proposed Solution

### Architecture Fonctionnelle

```
┌──────────────────────────────────────────────────────────┐
│                    DOCUMENT VAULT                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐    ┌─────────────────┐             │
│  │   UPLOAD        │    │   CLASSIFICATION │             │
│  │   + Chiffrement │───▶│   Automatique    │             │
│  │   KMS           │    │   (IA + RBAC)    │             │
│  └─────────────────┘    └─────────────────┘             │
│           │                      │                       │
│           ▼                      ▼                       │
│  ┌─────────────────────────────────────────┐            │
│  │            STOCKAGE SECURISE            │            │
│  │   Cloud Storage + Chiffrement AES-256   │            │
│  └─────────────────────────────────────────┘            │
│           │                      │                       │
│           ▼                      ▼                       │
│  ┌─────────────────┐    ┌─────────────────┐             │
│  │   LEGAL HOLD    │    │   RETENTION     │             │
│  │   (Gel juridique)│    │   POLICY        │             │
│  └─────────────────┘    └─────────────────┘             │
│           │                      │                       │
│           ▼                      ▼                       │
│  ┌─────────────────────────────────────────┐            │
│  │             AUDIT TRAIL COMPLET         │            │
│  │   (Immutable, 7 ans, SHA-256)           │            │
│  └─────────────────────────────────────────┘            │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Fonctionnalites Cles

| # | Fonctionnalite | Description | Priorite |
|---|----------------|-------------|----------|
| 1 | **Chiffrement E2E** | AES-256-GCM via Cloud KMS, rotation 90j | P0 |
| 2 | **Classification** | 4 niveaux (Public/Interne/Confidentiel/Secret) | P0 |
| 3 | **Legal Hold** | Gel documents en cas de procedure legale | P0 |
| 4 | **Retention Policy** | Regles cycle de vie automatisees | P1 |
| 5 | **Integrite Hash** | SHA-256 a l'upload, verification auto | P1 |
| 6 | **Signatures eIDAS** | PKI integration, horodatage certifie | P1 |
| 7 | **ACL Document** | Permissions granulaires par document | P1 |
| 8 | **Watermarking** | Visible + invisible, anti-fuite | P2 |
| 9 | **Audit Trail** | Log immutable, 100% actions tracees | P1 |
| 10 | **eDiscovery** | Recherche full-text, export compliance | P2 |

---

## Success Criteria

### Metriques Utilisateur

| Critere | Cible |
|---------|-------|
| NPS question securite | >70 |
| Temps classification | <5s (auto) |
| Temps partage auditeur | <2 min |
| Temps eDiscovery | <10 min |

### Metriques Business

| Critere | Cible |
|---------|-------|
| Conversion prospects "securite docs" | +30% |
| Adoption coffre-fort (6 mois) | >80% clients |
| Upsell tier Vault Premium | 25% base |

### Metriques Techniques

| Critere | Cible |
|---------|-------|
| Documents chiffres | 100% nouveaux |
| Verification hash | 100% downloads |
| Latence chiffrement | <500ms (<10MB) |
| Couverture audit trail | 100% actions |

---

## Technical Considerations

### Stack Technologique

| Composant | Technologie |
|-----------|-------------|
| Chiffrement | Google Cloud KMS (AES-256-GCM) |
| Stockage | Cloud Storage (chiffre au repos) |
| Signatures | PKI tiers (Certigna/DocuSign) |
| Recherche | Algolia ou Elasticsearch |
| Audit Logs | Firestore (collection immutable) |
| Archive | Cloud Storage Archive class |

### Nouveaux Services

1. **VaultEncryptionService** - Chiffrement/dechiffrement KMS
2. **VaultClassificationService** - Classification automatique IA
3. **VaultRetentionService** - Jobs retention policy
4. **VaultAuditService** - Logging immutable
5. **VaultSignatureService** - Integration PKI
6. **VaultEDiscoveryService** - Recherche et export

### Cloud Functions

| Function | Trigger | Role |
|----------|---------|------|
| encryptOnUpload | Storage finalize | Chiffre fichiers |
| hashOnUpload | Storage finalize | Calcule SHA-256 |
| applyRetention | Scheduled (daily) | Applique policies |
| archiveExpired | Scheduled (daily) | Archive documents |
| alertSuspiciousAccess | Firestore write | Detecte patterns |

---

## Risks & Mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance chiffrement | Moyenne | Haute | Cache, streaming |
| Cout KMS eleve | Moyenne | Moyenne | Monitoring, batch |
| Complexite migration | Haute | Moyenne | Migration progressive |
| Resistance utilisateurs | Moyenne | Moyenne | UX transparente |

---

## Roadmap

### Phase 1: Securite Critique (Sprints 1-4)

| Sprint | Livrables |
|--------|-----------|
| Sprint 1 | Chiffrement KMS + migration |
| Sprint 2 | Classification + Integrite hash |
| Sprint 3 | Legal Hold complet |
| Sprint 4 | Retention Policy + jobs |

### Phase 2: Controle & Tracabilite (Sprints 5-7)

| Sprint | Livrables |
|--------|-----------|
| Sprint 5 | ACL document-level |
| Sprint 6 | Audit trail complet |
| Sprint 7 | Signatures electroniques |

### Phase 3: Enterprise Features (Sprints 8-10)

| Sprint | Livrables |
|--------|-----------|
| Sprint 8 | Watermarking & DRM |
| Sprint 9 | eDiscovery & Search |
| Sprint 10 | Polish, tests, migration |

**Total: 10 sprints, 10 FRs majeurs**

---

## Alignement Conformite

### ISO 27001:2022

| Controle | Implementation |
|----------|----------------|
| A.5.33 - Protection enregistrements | Retention Policy |
| A.7.10 - Supports stockage | Chiffrement E2E |
| A.8.10 - Suppression informations | Retention + eDiscovery |
| A.8.24 - Cryptographie | KMS + Hash |

### RGPD

| Article | Implementation |
|---------|----------------|
| Art. 17 - Droit effacement | Destruction certifiee |
| Art. 20 - Portabilite | Export eDiscovery |
| Art. 32 - Securite traitement | Chiffrement + ACL |
| Art. 33 - Notification violation | Audit trail + Alertes |

---

## Dependencies

### Externes
- Google Cloud KMS (chiffrement)
- Fournisseur PKI (a selectionner)
- Algolia/Elasticsearch (recherche)

### Internes
- RBAC existant (extension)
- Notification system (alertes)
- Audit logging (extension)
- Module Documents existant (brownfield)

---

*Product Brief genere le 2026-01-23 pour combler la documentation manquante*
*Base sur: PRD Coffre-Fort Documentaire + Architecture*
