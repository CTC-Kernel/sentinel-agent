# Rapport d'Audit Backend & Logging - Sentinel GRC

**Date :** 22 Janvier 2026
**Auditeur :** Unité Sentinel-Core (Product Owner, Lead Dev, UX/UI, QA)
**Périmètre :** Cloud Functions, Firestore Logs, RBAC, Data Isolation.

## 1. Tableau d'Audit (Strict User Rules)

| Catégorie | Élément concerné | Problème détecté | Impact | Solution / Correction |
| :--- | :--- | :--- | :--- | :--- |
| **Traçabilité** | Fragmentation des logs | 4+ collections distinctes (`system_logs`, `audit_logs`, `document_audit_logs`, `auth_audit_logs`). Corrélation complexe. | **HAUT** | Centraliser via un `AuditTrailService` unique avec moteur de tag. |
| **Intégrité** | Logs GRC (Risques) | Absence de chainage d'intégrité (hashing SHA-256) pour les logs hors "Vault". Preuve d'audit falsifiable. | **HAUT** | Étendre le mécanisme `calculateLogHash` de la Vault à tous les logs métier. |
| **Sécurité** | Identification Acteur | `auditTriggers.js` dépend de `updatedBy` dans le document. Si omis par le client, log marqué "SYSTEM". | **MOYEN** | Forcer l'injection de l'UID via l'API ou utiliser les métadonnées de requête si possible. |
| **Workflows** | Traçabilité Destructive | Usage de "Hard Delete" et cascading cleanup sans archivage préalable. Perte de traces historiques. | **MOYEN** | Implémenter le "Soft Delete" (flag `isDeleted`) pour préserver l'historique d'audit. |
| **UX/UI** | Feedback Errors | Certaines fonctions (ex: `api.js`) renvoient des erreurs génériques sans contexte utilisateur. | **BAS** | Standardiser les réponses avec des codes d'erreur i18n et des liens vers la doc de résolution. |

---

## 2. Analyse Priorisée

### 🔴 CRITIQUE (Sécurité & Intégrité)
*   **Intégrité des Preuves :** Pour un outil GRC (ISO 27001), l'absence de chainage d'intégrité sur les modifications de risques ou de contrôles est un point de non-conformité majeur. Un administrateur malveillant pourrait modifier la base et supprimer le log simple.
*   **Fragmentation des logs :** Empêche une vue consolidée "360°" de l'activité d'un utilisateur suspect à travers plusieurs modules.

### 🟡 MAJEUR (Workflow & RBAC)
*   **Attribution des actions :** La fiabilité de l'Audit Trail repose trop sur la discipline du code frontend (envoi de `updatedBy`).
*   **Hard Delete :** Une suppression accidentelle d'un actif critique ne laisse aucune trace de son contenu antérieur exploitable par un auditeur.

---

## 3. RoadMap de Remédiation

### Must-have (0-30j)
- [ ] **Unified Logger :** Création de `functions/services/auditTrailService.js` regroupant toutes les méthodes de log.
- [ ] **Hash Chaining :** Mise en place du chainage SHA-256 pour la collection `system_logs`.
- [ ] **Audit Trail Dashboard :** Vue unifiée dans le dashboard pour Admin/RSSI exportable en un clic.

### Scale (30-90j)
- [ ] **Soft Delete Pattern :** Migration globale vers un pattern de suppression logique.
- [ ] **Automated Compliance Verification :** Tâche planifiée vérifiant quotidiennement que la chaine de hashage n'est pas brisée.

### Enterprise (90j+)
- [ ] **SIEM Integration :** Export en temps réel vers des outils tiers (Splunk, Datadog) via HTTPS Webhooks.
- [ ] **Blockchain Archiving :** Ancrage périodique de l'empreinte de l'audit trail sur une blockchain publique/privée pour immuabilité absolue vis-à-vis des tiers.

---

## 4. Checklists de Validation (Sentinel-Core Compliance)

### 4.1 Actions & Formulaires
- [x] Validation Zod/Joi côté Front ET Back ? **OUI** (Consistant via `utils/validation`)
- [x] Prévention du double-clic ? **OUI** (Observé dans les scripts front)
- [x] États visuels (Loading/Disabled) ? **OUI** (Composants UI conformes)

### 4.2 Sécurité GRC
- [ ] Preuve d'audit exportable ? **PARTIEL** (Exports séparés par domaine)
- [x] Backend autorité seule ? **OUI** (Vérifications strictes des claims/orgId)
- [x] Log de l'action dans l'Audit Trail ? **OUI** (Mais fragmentation à corriger)

---

> [!IMPORTANT]
> **Conclusion de l'Audit :** L'architecture est saine et respecte la souveraineté des données (multi-tenant strict). Cependant, pour atteindre un niveau de conformité "Assurance Raisonnable" exigé par les certificateurs ISO 27001, la **centralisation et l'immuabilité (hashing) des logs métier** doivent être traitées en priorité P0.
