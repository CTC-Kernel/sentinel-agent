---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
workflowType: 'prd'
workflow_completed: true
project_type: 'feature_enhancement'
domain: 'document_security'
complexity: 'high'
created: '2026-01-17'
author: 'John (PM) + Thibaultllopis'
---

# PRD - Module Coffre-Fort Documentaire Sécurisé

**Sentinel GRC v2 - Enterprise Document Vault**

**Auteur:** Thibaultllopis
**Date:** 2026-01-17
**Version:** 1.0
**Statut:** Ready for Architecture

---

## Executive Summary

### Le Problème

Le module documentaire actuel de Sentinel GRC est **fonctionnel mais pas sécurisé** pour des documents critiques d'entreprise. Les organisations manipulant des données sensibles (audits, contrats, politiques de sécurité) ont besoin d'un **vrai coffre-fort numérique** avec :
- Chiffrement bout-en-bout
- Conformité légale (retention, legal hold)
- Traçabilité complète
- Contrôle d'accès granulaire

### La Solution

Transformer le module documentaire existant en un **Enterprise Document Vault** qui :
1. **Sécurise** les documents avec chiffrement serveur-side (KMS)
2. **Garantit** la conformité RGPD/ISO 27001 (retention, legal hold, audit trail)
3. **Contrôle** l'accès de manière granulaire (par document, par rôle)
4. **Trace** chaque action avec preuve d'intégrité cryptographique

### What Makes This Special

| Différenciateur | Description |
|-----------------|-------------|
| **Chiffrement E2E** | Premier GRC SaaS EU avec chiffrement serveur-side intégré |
| **Legal Hold natif** | Conformité eDiscovery sans add-on externe |
| **Signatures certifiées** | Intégration PKI pour valeur probante |
| **Multi-classification** | Public/Interne/Confidentiel/Secret avec RBAC |

---

## Project Classification

**Type:** Feature Enhancement (Brownfield)
**Module:** Documents / Coffre-Fort
**Priorité:** P0 - Sécurité Critique
**Complexité:** Haute
**Effort estimé:** 10-12 sprints

### État Actuel (Audit 2026-01-17)

**Ce qui existe :**
- ✅ CRUD documents avec versioning
- ✅ Workflows d'approbation (5 états)
- ✅ Intégrations cross-modules (Risques, Contrôles, Audits)
- ✅ Audit trail basique (Firestore)
- ✅ Multi-tenant avec RBAC

**Ce qui manque :**
- ❌ Chiffrement serveur-side (E2EE)
- ❌ Legal Hold & Retention Policy
- ❌ Classification des documents
- ❌ Certificats numériques (signatures)
- ❌ DRM (watermark, liens expirants)
- ❌ eDiscovery & Compliance Reports

---

## User Personas & Journeys

### Persona 1: RSSI (Marie, 42 ans)

**Contexte:** Responsable de la sécurité, doit garantir la confidentialité des documents critiques.

**Besoins critiques:**
- Chiffrer automatiquement les politiques de sécurité
- Restreindre l'accès aux documents classifiés "Secret"
- Tracer qui a accédé à quoi et quand
- Empêcher le téléchargement non autorisé

**Journey actuel (frustrant):**
1. Upload une politique de sécurité
2. Doit manuellement restreindre l'accès
3. Aucune visibilité sur qui a téléchargé
4. Pas de chiffrement → inquiétude constante

**Journey cible (satisfaisant):**
1. Upload avec classification automatique "Confidentiel"
2. Chiffrement automatique côté serveur
3. Dashboard des accès en temps réel
4. Watermark automatique sur téléchargement
5. Alerte si accès suspect

### Persona 2: Auditeur Externe (Pierre, 35 ans)

**Contexte:** Réalise des audits ISO 27001, doit accéder aux preuves.

**Besoins critiques:**
- Accès temporaire aux documents d'audit
- Visualiser sans pouvoir télécharger (view-only)
- Preuve d'intégrité des documents
- Export sécurisé pour rapport

**Journey cible:**
1. Reçoit un lien d'accès temporaire (7 jours)
2. Visualise les documents avec watermark "AUDIT EXTERNE"
3. Vérifie l'intégrité via hash SHA-256
4. Téléchargement limité avec traçabilité

### Persona 3: DPO (Sophie, 38 ans)

**Contexte:** Responsable conformité RGPD, gère les demandes d'accès/suppression.

**Besoins critiques:**
- Trouver tous les documents d'une personne (eDiscovery)
- Appliquer le droit à l'oubli (suppression certifiée)
- Prouver la retention policy appliquée
- Rapport de conformité RGPD

**Journey cible:**
1. Recherche documents par personne concernée
2. Visualise la retention policy de chaque document
3. Applique suppression avec certificat de destruction
4. Génère rapport RGPD automatique

### Persona 4: Direction (Jean, 55 ans)

**Contexte:** PDG, signe les documents stratégiques.

**Besoins critiques:**
- Signature électronique valide juridiquement
- Accès mobile sécurisé
- Vue consolidée des documents critiques
- Alerte si document expire

**Journey cible:**
1. Notification de document à signer
2. Ouvre sur mobile avec authentification forte
3. Signe avec certificat numérique
4. Document horodaté et archivé automatiquement

---

## Success Criteria

### User Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Confiance sécurité** | Survey NPS question sécurité | >70 |
| **Temps classification** | Secondes pour classifier | <5s (auto) |
| **Accès auditeur** | Temps pour partager preuves | <2 min |
| **Conformité DPO** | Temps pour eDiscovery | <10 min |

### Business Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Différenciation** | Fonctionnalité unique marché EU | Legal Hold + E2EE |
| **Conversion** | Prospects mentionnant sécurité docs | +30% conversion |
| **Retention** | Clients utilisant coffre-fort | >80% à 6 mois |
| **Upsell** | Passage au tier "Vault Premium" | 25% base clients |

### Technical Success

| Critère | Métrique | Cible |
|---------|----------|-------|
| **Chiffrement** | Documents chiffrés serveur | 100% nouveaux |
| **Intégrité** | Vérification hash automatique | 100% downloads |
| **Performance** | Latence chiffrement/déchiffrement | <500ms |
| **Audit** | Couverture audit trail | 100% actions |

---

## Functional Requirements

### FR-VAULT-001: Chiffrement Serveur-Side (E2EE)

**Priorité:** P0 - CRITIQUE
**Effort:** 3 sprints

**Description:**
Tous les documents uploadés doivent être chiffrés côté serveur avant stockage, avec gestion des clés via Google Cloud KMS.

**Acceptance Criteria:**
1. Chiffrement AES-256-GCM automatique à l'upload
2. Clés gérées par Cloud KMS (rotation automatique 90j)
3. Déchiffrement transparent au download pour utilisateurs autorisés
4. Métadonnées (titre, type) chiffrées optionnellement
5. Migration des documents existants (batch job)
6. Indicateur visuel "🔒 Chiffré" sur chaque document

**Technical Notes:**
```typescript
// Cloud Function - Chiffrement à l'upload
exports.encryptDocument = onDocumentCreated("documents/{docId}", async (event) => {
  const kms = new KeyManagementServiceClient();
  const [encryptResponse] = await kms.encrypt({
    name: keyName,
    plaintext: documentBuffer,
  });
  // Store encrypted + metadata
});
```

---

### FR-VAULT-002: Classification des Documents

**Priorité:** P0 - CRITIQUE
**Effort:** 1 sprint

**Description:**
Système de classification à 4 niveaux avec RBAC automatique.

**Niveaux de classification:**

| Niveau | Icône | Accès par défaut | Exemples |
|--------|-------|------------------|----------|
| **Public** | 🌍 | Tous | Brochures, FAQ |
| **Interne** | 🏢 | Tous employés | Procédures générales |
| **Confidentiel** | 🔐 | Managers + RSSI | Politiques sécurité |
| **Secret** | ⛔ | Admin + Direction | Contrats, audits |

**Acceptance Criteria:**
1. Dropdown de classification à l'upload (défaut: Interne)
2. Classification suggérée automatiquement par IA (type de document)
3. RBAC automatique selon classification
4. Escalade pour accès à niveau supérieur (workflow approbation)
5. Badge visuel de classification sur chaque document
6. Audit log de chaque changement de classification

---

### FR-VAULT-003: Legal Hold (Gel Juridique)

**Priorité:** P0 - CRITIQUE
**Effort:** 1.5 sprint

**Description:**
Empêcher la modification/suppression de documents lors de procédures légales.

**Acceptance Criteria:**
1. Interface admin pour créer un "Legal Hold" (nom, raison, date fin)
2. Sélection des documents concernés (recherche + multi-select)
3. Documents en hold : suppression/modification bloquée
4. Indicateur visuel "⚖️ Legal Hold" sur les documents
5. Notification aux propriétaires des documents
6. Rapport des documents sous hold (export PDF)
7. Libération du hold avec justification obligatoire

**Firestore Rules:**
```javascript
match /documents/{docId} {
  allow delete: if !resource.data.legalHold;
  allow update: if !resource.data.legalHold ||
    (request.auth.token.role == 'admin' && !('content' in request.resource.data));
}
```

---

### FR-VAULT-004: Retention Policy (Politique de Conservation)

**Priorité:** P1 - HAUTE
**Effort:** 1.5 sprint

**Description:**
Gestion automatisée du cycle de vie des documents.

**Acceptance Criteria:**
1. Configuration des règles de retention par type de document
2. Règles : durée (jours), action (archiver/supprimer), exceptions
3. Job automatique quotidien pour appliquer les règles
4. Notification 30j avant expiration aux propriétaires
5. Archive cold storage pour documents expirés (Google Cloud Archive)
6. Certificat de destruction pour suppressions RGPD
7. Dashboard de suivi des retention policies

**Règles par défaut:**

| Type | Retention | Action | Raison |
|------|-----------|--------|--------|
| Politique | 5 ans | Archiver | Conformité |
| Procédure | 3 ans | Archiver | Conformité |
| Preuve audit | 7 ans | Archiver | ISO 27001 |
| Rapport | 2 ans | Supprimer | Obsolescence |
| Autre | 1 an | Notifier | Review |

---

### FR-VAULT-005: Intégrité Cryptographique

**Priorité:** P1 - HAUTE
**Effort:** 1 sprint

**Description:**
Garantir l'intégrité des documents avec vérification hash.

**Acceptance Criteria:**
1. Hash SHA-256 calculé automatiquement à l'upload
2. Hash stocké dans Firestore (immutable)
3. Vérification automatique au download
4. Alerte si hash ne correspond pas (document altéré)
5. Certificat d'intégrité téléchargeable (PDF avec hash)
6. Historique des vérifications dans audit log

---

### FR-VAULT-006: Signature Électronique Avancée

**Priorité:** P1 - HAUTE
**Effort:** 2 sprints

**Description:**
Signatures électroniques avec valeur probante (eIDAS).

**Acceptance Criteria:**
1. Intégration avec fournisseur PKI (ex: Certigna, DocuSign)
2. Signature liée au hash du document (non-répudiation)
3. Horodatage certifié (TSA - Time Stamping Authority)
4. Multi-signature avec workflow séquentiel/parallèle
5. Vérification de signature dans l'interface
6. Export avec preuves de signature (PDF/A-3)
7. Validation long-terme (LTV) pour archivage

---

### FR-VAULT-007: Contrôle d'Accès Granulaire (Document-Level)

**Priorité:** P1 - HAUTE
**Effort:** 1.5 sprint

**Description:**
Permissions au niveau de chaque document (au-delà du RBAC collection).

**Acceptance Criteria:**
1. ACL par document : liste d'utilisateurs/groupes autorisés
2. Permissions : Lire, Télécharger, Modifier, Supprimer, Partager
3. Partage temporaire avec date d'expiration
4. Lien de partage externe avec mot de passe optionnel
5. Révocation d'accès instantanée
6. Audit log de chaque accès

---

### FR-VAULT-008: Watermarking & DRM

**Priorité:** P2 - MOYENNE
**Effort:** 1.5 sprint

**Description:**
Protection des documents contre la fuite d'information.

**Acceptance Criteria:**
1. Watermark automatique au téléchargement (nom user, date, IP)
2. Watermark visible (diagonal texte) et invisible (métadonnées)
3. Option view-only (pas de téléchargement) pour auditeurs
4. Limite de téléchargements par document (configurable)
5. Désactivation du print pour documents sensibles
6. Alerte si tentative de capture d'écran (détection limitée)

---

### FR-VAULT-009: Audit Trail Complet

**Priorité:** P1 - HAUTE
**Effort:** 1 sprint

**Description:**
Traçabilité complète de toutes les actions sur les documents.

**Actions tracées:**
- Create, Read, Update, Delete
- Download, Print, Share
- Classification change
- Signature, Approval, Rejection
- Access denied (failed attempts)
- Legal hold apply/release
- Retention policy execution

**Acceptance Criteria:**
1. Log immutable dans collection séparée (document_audit_logs)
2. Champs: timestamp, userId, action, documentId, metadata, IP
3. Recherche avancée par période/user/action/document
4. Export CSV/PDF pour audits externes
5. Rétention des logs: 7 ans minimum
6. Alerting sur patterns suspects (ex: mass download)

---

### FR-VAULT-010: eDiscovery & Compliance Reports

**Priorité:** P2 - MOYENNE
**Effort:** 2 sprints

**Description:**
Outils pour répondre aux demandes légales et audits.

**Acceptance Criteria:**
1. Recherche full-text dans les documents (Algolia/Elasticsearch)
2. Filtres: période, auteur, classification, type, mots-clés
3. Export dossier eDiscovery (ZIP avec index)
4. Rapport RGPD automatique (documents par personne)
5. Rapport ISO 27001 (couverture documentaire par contrôle)
6. Dashboard conformité: documents expirés, non classifiés, sans propriétaire

---

## Non-Functional Requirements

### NFR-SEC-001: Performance Chiffrement

- Latence chiffrement: <500ms pour fichiers <10MB
- Latence déchiffrement: <300ms pour fichiers <10MB
- Throughput: 100 documents/minute en batch

### NFR-SEC-002: Disponibilité

- Uptime coffre-fort: 99.9%
- Recovery Point Objective (RPO): 1 heure
- Recovery Time Objective (RTO): 4 heures

### NFR-SEC-003: Scalabilité

- Support jusqu'à 1M documents par organisation
- Stockage illimité (tiers facturé)
- Recherche <2s jusqu'à 100K documents

### NFR-SEC-004: Conformité

- RGPD (article 17, 20, 32)
- ISO 27001:2022 (A.5.33, A.7.10, A.8.10)
- eIDAS (signatures électroniques qualifiées)

---

## Technical Architecture

### Composants Nouveaux

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT VAULT ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Frontend  │───▶│  Cloud      │───▶│  Cloud KMS  │        │
│  │   React     │    │  Functions  │    │  (Encrypt)  │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│         │                  │                                    │
│         │                  ▼                                    │
│         │           ┌─────────────┐    ┌─────────────┐        │
│         │           │  Firestore  │    │  Cloud      │        │
│         └──────────▶│  (Metadata) │    │  Storage    │        │
│                     └─────────────┘    │  (Encrypted)│        │
│                            │           └─────────────┘        │
│                            ▼                                    │
│                     ┌─────────────┐    ┌─────────────┐        │
│                     │  Audit Logs │    │  Archive    │        │
│                     │  (Immutable)│    │  (Cold)     │        │
│                     └─────────────┘    └─────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Services à Créer

1. **VaultEncryptionService** - Gestion chiffrement/déchiffrement
2. **VaultClassificationService** - Classification automatique IA
3. **VaultRetentionService** - Jobs de retention policy
4. **VaultAuditService** - Logging immutable
5. **VaultSignatureService** - Intégration PKI
6. **VaultEDiscoveryService** - Recherche et export

### Cloud Functions Requises

| Function | Trigger | Description |
|----------|---------|-------------|
| `encryptOnUpload` | Storage finalize | Chiffre les fichiers uploadés |
| `hashOnUpload` | Storage finalize | Calcule SHA-256 |
| `applyRetention` | Scheduled (daily) | Applique les policies |
| `archiveExpired` | Scheduled (daily) | Archive les documents |
| `alertSuspiciousAccess` | Firestore write | Détecte patterns suspects |

---

## Roadmap

### Phase 1: Sécurité Critique (Sprints 1-4)

| Sprint | Stories | Livrables |
|--------|---------|-----------|
| **Sprint 1** | FR-VAULT-001 | Chiffrement KMS + migration |
| **Sprint 2** | FR-VAULT-002, 005 | Classification + Intégrité hash |
| **Sprint 3** | FR-VAULT-003 | Legal Hold complet |
| **Sprint 4** | FR-VAULT-004 | Retention Policy + jobs |

### Phase 2: Contrôle & Traçabilité (Sprints 5-7)

| Sprint | Stories | Livrables |
|--------|---------|-----------|
| **Sprint 5** | FR-VAULT-007 | ACL document-level |
| **Sprint 6** | FR-VAULT-009 | Audit trail complet |
| **Sprint 7** | FR-VAULT-006 | Signatures électroniques |

### Phase 3: Enterprise Features (Sprints 8-10)

| Sprint | Stories | Livrables |
|--------|---------|-----------|
| **Sprint 8** | FR-VAULT-008 | Watermarking & DRM |
| **Sprint 9** | FR-VAULT-010 | eDiscovery & Search |
| **Sprint 10** | Polish | Tests, documentation, migration |

---

## Risks & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Performance dégradée (chiffrement) | Moyenne | Haute | Cache déchiffrement, streaming |
| Coût KMS élevé | Moyenne | Moyenne | Monitoring, optimisation requêtes |
| Complexité migration | Haute | Moyenne | Migration progressive, opt-in |
| Résistance utilisateurs | Moyenne | Moyenne | UX transparente, formation |

---

## Dependencies

### Externes
- Google Cloud KMS (chiffrement)
- Fournisseur PKI (signatures) - à sélectionner
- Algolia ou Elasticsearch (recherche full-text)

### Internes
- RBAC existant (extension)
- Notification system (alertes)
- Audit logging (extension)

---

## Appendix

### A. Mapping ISO 27001:2022

| Contrôle | Requirement | Implementation |
|----------|-------------|----------------|
| A.5.33 | Protection des enregistrements | Retention Policy |
| A.7.10 | Supports de stockage | Chiffrement E2EE |
| A.8.10 | Suppression des informations | Retention + eDiscovery |
| A.8.24 | Cryptographie | KMS + Hash |

### B. Mapping RGPD

| Article | Requirement | Implementation |
|---------|-------------|----------------|
| Art. 17 | Droit à l'effacement | Retention + Destruction certifiée |
| Art. 20 | Portabilité | Export eDiscovery |
| Art. 32 | Sécurité du traitement | Chiffrement + ACL |
| Art. 33 | Notification violation | Audit trail + Alertes |

---

**Document créé par:** John (PM) avec Thibaultllopis
**Prêt pour:** Architecture Review
**Prochaine étape:** Validation Architecture puis création des Epics & Stories
