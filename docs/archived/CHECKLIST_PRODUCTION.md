# ✅ Checklist Production - Sentinel GRC v2

**Objectif**: Passer de Beta à Production en 4 semaines  
**Date cible**: 24 décembre 2025

---

## 🔴 Semaine 1: Sécurité Critique (26 nov - 2 déc)

### Firestore Security Rules ⚠️ CRITIQUE
- [ ] Créer fichier `firestore.rules` complet
- [ ] Helper functions (`isAuthenticated`, `belongsToOrganization`, `hasRole`)
- [ ] Rules pour collection `risks`
- [ ] Rules pour collection `assets`
- [ ] Rules pour collection `controls`
- [ ] Rules pour collection `audits`
- [ ] Rules pour collection `projects`
- [ ] Rules pour collection `documents`
- [ ] Rules pour collection `incidents`
- [ ] Rules pour collection `suppliers`
- [ ] Rules pour collection `users`
- [ ] Rules pour collection `organizations`
- [ ] Tester avec Firebase Emulator
- [ ] Déployer: `firebase deploy --only firestore:rules`

**Temps estimé**: 2 jours  
**Responsable**: Dev Senior  
**Test**: Essayer d'accéder aux données d'une autre org → doit échouer

---

### Validation Inputs avec Zod
- [ ] Installer Zod: `npm install zod`
- [ ] Créer schemas dans `schemas/` folder
  - [ ] `RiskSchema`
  - [ ] `AssetSchema`
  - [ ] `ProjectSchema`
  - [ ] `AuditSchema`
  - [ ] `DocumentSchema`
- [ ] Appliquer validation dans formulaires (Risks, Assets, Projects)
- [ ] Messages d'erreur user-friendly
- [ ] Tests validation

**Temps estimé**: 1.5 jours  
**Responsable**: Dev  
**Test**: Soumettre formulaire invalide → message clair

---

### ErrorLogger Service
- [ ] Créer `services/errorLogger.ts`
- [ ] Méthodes: `error()`, `warn()`, `info()`
- [ ] Différenciation DEV/PROD
- [ ] Remplacer tous les `console.error()` (47 occurrences)
- [ ] Intégrer Sentry (version trial)
- [ ] Config Sentry dans `.env`

**Temps estimé**: 1 jour  
**Responsable**: Dev  
**Test**: Déclencher erreur → visible dans Sentry

---

### CSP Headers
- [ ] Ajouter meta CSP dans `index.html`
- [ ] Tester avec browser dev tools
- [ ] Ajuster pour Google APIs (reCAPTCHA)
- [ ] Ajuster pour Firebase

**Temps estimé**: 2 heures  
**Responsable**: Dev  
**Test**: Console browser sans erreurs CSP

---

### Audit Dépendances
- [ ] Exécuter `npm audit`
- [ ] Corriger vulnérabilités high/critical: `npm audit fix`
- [ ] Mettre à jour dépendances obsolètes
- [ ] Tester après updates
- [ ] Configurer Dependabot GitHub

**Temps estimé**: 3 heures  
**Responsable**: DevOps  
**Test**: `npm audit` → 0 high/critical

---

## 🟡 Semaine 2: Qualité Code (3-9 déc)

### Supprimer `as any`
- [ ] Lister toutes les occurrences (47+)
- [ ] Créer types stricts
  - [ ] `InspectorTab` type union
  - [ ] `TabId` type union
  - [ ] `StatusType` type union
- [ ] Refactorer Risks.tsx (12 occurrences)
- [ ] Refactorer Documents.tsx (8 occurrences)
- [ ] Refactorer Assets.tsx (6 occurrences)
- [ ] Refactorer Audits.tsx (5 occurrences)
- [ ] Refactorer Projects.tsx (4 occurrences)
- [ ] Autres fichiers (12 occurrences)
- [ ] Configurer ESLint: `"@typescript-eslint/no-explicit-any": "error"`

**Temps estimé**: 2 jours  
**Responsable**: Dev Senior  
**Test**: Build sans erreurs TypeScript

---

### Tests Unitaires (Pages Critiques)
- [ ] Installer @testing-library: `npm install -D @testing-library/react @testing-library/jest-dom vitest`
- [ ] Configurer Vitest
- [ ] Tests Dashboard.tsx
  - [ ] Render sans erreur
  - [ ] Stats affichées
  - [ ] Export PDF
- [ ] Tests Risks.tsx
  - [ ] Créer risque
  - [ ] Calcul score
  - [ ] Matrice cliquable
- [ ] Tests Assets.tsx
  - [ ] Créer actif
  - [ ] Calcul dépréciation
  - [ ] TCO
- [ ] Tests Compliance.tsx
  - [ ] Switch frameworks
  - [ ] Génération SoA
- [ ] Target: >50% coverage

**Temps estimé**: 3 jours  
**Responsable**: Dev + QA  
**Test**: `npm run test` → >50% coverage

---

### Améliorer Gestion Erreurs
- [ ] Standardiser try/catch
- [ ] Messages d'erreur contextuels
- [ ] Rollback transactions en cas d'échec
- [ ] Toast notifications cohérentes
- [ ] Logs structurés

**Temps estimé**: 1 jour  
**Responsable**: Dev  
**Test**: Simuler erreurs → messages clairs

---

### ESLint/Prettier Strict
- [ ] Configurer ESLint strict
- [ ] Configurer Prettier
- [ ] Ajouter scripts: `lint`, `format`
- [ ] Git hooks (Husky + lint-staged)
- [ ] Corriger warnings existants

**Temps estimé**: 1 jour  
**Responsable**: Dev  
**Test**: `npm run lint` → 0 errors

---

## 🟢 Semaine 3: Performance (10-16 déc)

### React Query (Cache)
- [ ] Installer React Query: `npm install @tanstack/react-query`
- [ ] Configurer QueryClient
- [ ] Wrapper App avec QueryClientProvider
- [ ] Refactorer Dashboard fetches
- [ ] Refactorer Assets fetches
- [ ] Refactorer Risks fetches
- [ ] Stale time: 5 min
- [ ] Cache time: 10 min
- [ ] React Query DevTools

**Temps estimé**: 2 jours  
**Responsable**: Dev Senior  
**Test**: Dashboard load time < 1s (cache hit)

---

### Pagination Complète
- [ ] Implémenter sur Risks.tsx
- [ ] Implémenter sur Documents.tsx
- [ ] Implémenter sur Audits.tsx
- [ ] Implémenter sur Projects.tsx
- [ ] Composant Pagination réutilisable (déjà existe)
- [ ] Page size configurable

**Temps estimé**: 1 jour  
**Responsable**: Dev  
**Test**: Listes >100 items → fluide

---

### Images Optimisées
- [ ] Convertir en WebP
- [ ] Lazy loading
- [ ] CDN Cloudflare
- [ ] Responsive images (srcset)
- [ ] Compression automatique

**Temps estimé**: 1 jour  
**Responsable**: Dev  
**Test**: Lighthouse score >90

---

### Service Worker (Offline)
- [ ] Installer Workbox
- [ ] Configurer service worker
- [ ] Cache stratégies
- [ ] Offline fallback page
- [ ] Update notifications

**Temps estimé**: 2 jours  
**Responsable**: Dev Senior  
**Test**: Mode avion → app fonctionne

---

## 🔵 Semaine 4: Monitoring & Doc (17-24 déc)

### Sentry Production
- [ ] Compte Sentry Team
- [ ] Config production
- [ ] Source maps upload
- [ ] Release tracking
- [ ] Alertes critiques
- [ ] Dashboards

**Temps estimé**: 1 jour  
**Responsable**: DevOps  
**Test**: Erreur → alerte reçue

---

### Analytics
- [ ] Choisir solution (Mixpanel/Amplitude)
- [ ] Installer SDK
- [ ] Track événements clés
  - Login/Logout
  - Création risque/actif/projet
  - Export documents
  - Génération rapports
- [ ] Dashboards métier

**Temps estimé**: 1 jour  
**Responsable**: Product Manager  
**Test**: Événements visibles dashboard

---

### Tests E2E (Playwright)
- [ ] Installer Playwright
- [ ] Configurer CI
- [ ] Test: Login → Dashboard
- [ ] Test: Créer risque complet
- [ ] Test: Créer actif avec QR code
- [ ] Test: Générer rapport audit
- [ ] Test: Workflow projet Kanban
- [ ] Test: Multi-browser (Chrome, Firefox, Safari)

**Temps estimé**: 2 jours  
**Responsable**: QA  
**Test**: CI green ✅

---

### Documentation
- [ ] README complet
  - Installation
  - Configuration
  - Architecture
  - Contribution
- [ ] API Documentation (si applicable)
- [ ] Runbook production
  - Déploiement
  - Rollback
  - Incidents communs
- [ ] Guide utilisateur (notion/confluence)
- [ ] Changelog

**Temps estimé**: 1 jour  
**Responsable**: Tech Lead  
**Test**: Nouveau dev peut setup en <30min

---

## 🚀 Déploiement Production (24 déc)

### Pre-flight Checklist
- [ ] Tous les tests passent (unit + E2E)
- [ ] Coverage >50%
- [ ] 0 vulnérabilités high/critical
- [ ] Lighthouse score >90
- [ ] Security Rules testées
- [ ] Backup automatique configuré
- [ ] Monitoring actif (Sentry, Analytics)
- [ ] DNS configuré
- [ ] SSL certificate valide
- [ ] Emails envoi configuré (SendGrid/Mailgun)
- [ ] Firestore indexes créés
- [ ] Rate limiting actif
- [ ] CSP headers OK
- [ ] RGPD compliance (banner cookies, privacy policy)

---

### Déploiement
- [ ] Tag version: `git tag v2.0.0`
- [ ] Build production: `npm run build`
- [ ] Deploy Firebase: `firebase deploy`
- [ ] Deploy Hosting: `firebase deploy --only hosting`
- [ ] Vérifier URL production
- [ ] Smoke tests manuels
- [ ] Notifications équipe

---

### Post-deployment
- [ ] Monitoring 24h actif
- [ ] Équipe on-call disponible
- [ ] Rollback plan ready
- [ ] Communication clients (email, changelog)
- [ ] Collecte feedback
- [ ] Hotfix branch créée

---

## 📊 Métriques de Succès

### Technique
- ✅ Uptime >99.5%
- ✅ Response time <500ms (p95)
- ✅ Error rate <1%
- ✅ Test coverage >50%
- ✅ Security score A (Mozilla Observatory)

### Métier
- ✅ 0 incidents sécurité
- ✅ <5 bugs critiques mois 1
- ✅ Satisfaction utilisateurs >8/10
- ✅ Adoption >80% des fonctionnalités

---

## 🆘 Contacts

### Équipe
- **Tech Lead**: [Nom] - [email]
- **DevOps**: [Nom] - [email]
- **QA Lead**: [Nom] - [email]
- **Product Owner**: [Nom] - [email]

### Escalation
1. Problème technique → Tech Lead
2. Incident critique → DevOps + Tech Lead
3. Décision métier → Product Owner
4. Sécurité → RSSI + Tech Lead

---

## 📅 Planning Détaillé

| Semaine | Focus | Livrables | Go/No-Go |
|---------|-------|-----------|----------|
| **S1** (26 nov) | Sécurité | Security Rules, Validation, ErrorLogger | ✅ Critique |
| **S2** (3 déc) | Qualité | Tests, Type safety, ESLint | ✅ Important |
| **S3** (10 déc) | Performance | React Query, Pagination, SW | 🟡 Nice-to-have |
| **S4** (17 déc) | Monitoring | Sentry, Analytics, Doc | 🟡 Nice-to-have |
| **GO** (24 déc) | 🚀 Production | Déploiement final | ✅ |

---

## ✅ Validation Finale

### Sign-off Requis

- [ ] **Tech Lead**: Code quality ✅
- [ ] **DevOps**: Infrastructure ✅
- [ ] **QA**: Tests passed ✅
- [ ] **Product Owner**: Fonctionnalités ✅
- [ ] **RSSI**: Sécurité ✅
- [ ] **Legal**: RGPD ✅

### Critères Bloquants

Si **UN SEUL** de ces critères échoue → **NO GO**:
- ❌ Firestore Security Rules incomplètes
- ❌ Vulnérabilités high/critical
- ❌ Tests E2E échouent
- ❌ Error rate >5%
- ❌ Downtime lors déploiement staging

---

*Checklist générée par Cascade AI*  
*Version 1.0 - 26 novembre 2025*

**Bonne chance pour le lancement ! 🚀**
