# 🔍 AUDIT COMPLET - SENTINEL GRC V2

**Date de l'audit:** 5 janvier 2026
**Version:** 2.0.0
**Auditeur:** Claude AI
**Statut:** ⚠️ Actions correctives requises

---

## RÉSUMÉ EXÉCUTIF

| Domaine | Score | Statut | Priorité |
|---------|-------|--------|----------|
| **Architecture** | 7.5/10 | 🟡 Acceptable | Moyenne |
| **Sécurité** | 4/10 | 🔴 **CRITIQUE** | Immédiate |
| **Qualité du Code** | 7.2/10 | 🟡 Acceptable | Moyenne |
| **Performance** | 6.8/10 | 🟡 À améliorer | Haute |
| **Tests** | 2.8/10 | 🔴 **CRITIQUE** | Haute |
| **Dépendances** | 5/10 | 🟠 Préoccupant | Haute |
| **Configuration** | 3/10 | 🔴 **CRITIQUE** | Immédiate |
| **Accessibilité** | 7.6/10 | 🟡 Acceptable | Moyenne |

**Score Global : 5.5/10** - Nécessite des actions correctives immédiates

---

## TABLE DES MATIÈRES

1. [Problèmes Critiques](#-problèmes-critiques)
2. [Architecture](#1-architecture-7510)
3. [Sécurité](#2-sécurité-410-)
4. [Qualité du Code](#3-qualité-du-code-7210)
5. [Performance](#4-performance-6810)
6. [Tests](#5-tests-2810-)
7. [Dépendances](#6-dépendances-510)
8. [Configuration](#7-configuration-310-)
9. [Accessibilité](#8-accessibilité-7610)
10. [Plan d'Action](#-plan-daction-prioritaire)
11. [Métriques Cibles](#-métriques-cibles)

---

## 🚨 PROBLÈMES CRITIQUES

### 1. SECRETS EXPOSÉS DANS GIT

**Fichiers concernés:**
- `.env` - Clés Firebase, Google Client ID, ReCaptcha
- `.env.production` - Clé Gemini AI
- `functions/.env` - Mots de passe SMTP OVH
- `functions/.env.sentinel-grc-a8701` - Mot de passe Gmail
- `apphosting.yaml` - Toutes les variables d'environnement
- `public/firebase-messaging-sw.js` - Config Firebase
- `functions/test_ovh.js` - Mot de passe hardcodé

**Secrets exposés:**
```
VITE_FIREBASE_API_KEY=***REDACTED***
VITE_GOOGLE_CLIENT_ID=728667422032-seo1j9c4a1lci8cfrok2raeogurpu3qr.apps.googleusercontent.com
VITE_GEMINI_API_KEY=***REDACTED***
SMTP_PASS=Al21689a!
```

**Action requise:**
1. Régénérer TOUTES les clés API immédiatement
2. Nettoyer l'historique Git avec `git filter-branch` ou BFG Repo-Cleaner
3. Configurer Firebase Secrets pour les credentials sensibles

### 2. VULNÉRABILITÉS DÉPENDANCES

| Package | Version | Sévérité | Problème |
|---------|---------|----------|----------|
| **jsPDF** | 2.5.2 | CRITIQUE | Local File Inclusion/Path Traversal (GHSA-f8cm-6447-x5h2) |
| **jsPDF** | 2.5.2 | HAUTE | Regular Expression DoS (GHSA-w532-jxjh-hjhj) |
| **qs** | 6.14.0 | HAUTE | DoS via Memory Exhaustion (GHSA-6rw7-vpxm-498p) |

**Action requise:**
```bash
npm update jspdf@^4.0.0
cd functions && npm update express@^4.22.1
```

### 3. CORS MAL CONFIGURÉ

**Fichier:** `functions/api.js:11`
```javascript
// ❌ TRÈS DANGEREUX - Accepte TOUTES les origines
app.use(cors({ origin: true }));
```

**Action requise:**
```javascript
// ✅ Configuration sécurisée
app.use(cors({
  origin: [
    'https://app.cyber-threat-consulting.com',
    'https://sentinel-grc-a8701.web.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
}));
```

### 4. COUVERTURE TESTS QUASI-NULLE

| Métrique | Actuel | Cible Minimum |
|----------|--------|---------------|
| Couverture globale | 2.8% | 70% |
| Tests unitaires | 18 fichiers | 200+ |
| Hooks testés | 0/88 | 70/88 |
| Services testés | 3/56 | 45/56 |

---

## 1. ARCHITECTURE (7.5/10)

### Structure du Projet

```
sentinel-grc-v2-prod/
├── src/                    # Application React (654 fichiers TypeScript)
│   ├── components/         # 40 dossiers, 354 fichiers
│   ├── hooks/              # 88 hooks personnalisés
│   ├── services/           # 55 services métier
│   ├── utils/              # 25 utilitaires
│   ├── types/              # 18 définitions de types
│   ├── views/              # Pages/vues principales
│   ├── contexts/           # 4 contextes React
│   └── schemas/            # 17 schémas Zod
├── functions/              # Firebase Cloud Functions (6291 lignes)
├── mobile/                 # Application Capacitor
├── tests/                  # Tests E2E
└── playwright/             # Tests Playwright
```

### Stack Technique

| Catégorie | Technologies |
|-----------|--------------|
| Frontend | React 19.2, TypeScript 5.7, Vite 6.0 |
| State | Zustand 5.0, React Query 5.90 |
| UI | Tailwind CSS 3.4, Lucide React |
| Backend | Firebase 11.0, Cloud Functions |
| Validation | Zod 4.2 |
| Testing | Vitest 2.1, Playwright 1.57 |

### Points Forts ✅

- Architecture bien stratifiée (views, components, services)
- TypeScript strict mode activé
- Lazy loading des 30+ routes
- PWA support avec Workbox
- Component-driven architecture

### Points Faibles ❌

| Problème | Impact | Fichier |
|----------|--------|---------|
| Monolithe backend | Maintenabilité | `functions/index.js` (3971 lignes) |
| Service trop volumineux | Testabilité | `PdfService.ts` (88KB) |
| i18n trop gros | Bundle size | `i18n.ts` (286KB) |
| Pas d'interface service | Consistance | Services variés |

### Recommandations

1. Décomposer `functions/index.js` en modules par domaine
2. Diviser `PdfService.ts` en générateurs spécialisés
3. Externaliser les traductions i18n en fichiers JSON
4. Créer une interface `BaseService<T>` commune

---

## 2. SÉCURITÉ (4/10) 🔴

### Authentification

| Aspect | Statut | Détail |
|--------|--------|--------|
| Firebase Auth | ✅ | OAuth Google, Apple, Microsoft, SAML |
| MFA | ✅ | TOTP supporté |
| JWT Tokens | ⚠️ | Fallback secret non sécurisé |
| App Check | ✅ | ReCAPTCHA Enterprise |
| Session Timeout | ❌ | Non implémenté |

### Vulnérabilités Identifiées

| Sévérité | Problème | Localisation |
|----------|----------|--------------|
| 🔴 CRITIQUE | Secrets en Git | `.env*`, `apphosting.yaml` |
| 🔴 CRITIQUE | CORS origin:true | `functions/api.js` |
| 🔴 CRITIQUE | jsPDF LFI | `package.json` |
| 🟠 HAUTE | SecureStorage = base64 | `secureStorage.ts` |
| 🟠 HAUTE | JWT_SECRET fallback | `tokenService.ts` |
| 🟡 MODÉRÉE | CSP unsafe-inline | `server.js`, `firebase.json` |

### Firestore Security Rules

Les règles Firestore sont bien implémentées avec:
- Validation du `organizationId` pour l'isolation des tenants
- Vérification des rôles via custom claims
- Ownership checks sur les ressources

### Headers de Sécurité

| Header | Valeur | Statut |
|--------|--------|--------|
| HSTS | 2 ans, includeSubDomains | ✅ |
| X-Frame-Options | DENY | ✅ |
| CSP | Configurée mais unsafe-inline | ⚠️ |
| X-Content-Type-Options | nosniff | ✅ |

### Recommandations Prioritaires

1. **Immédiat:** Régénérer toutes les clés API
2. **Immédiat:** Configurer CORS avec liste blanche
3. **Semaine 1:** Implémenter Firebase Secrets
4. **Semaine 1:** Remplacer SecureStorage par AES-256
5. **Semaine 2:** Supprimer unsafe-inline de CSP

---

## 3. QUALITÉ DU CODE (7.2/10)

### Statistiques

| Métrique | Valeur | Statut |
|----------|--------|--------|
| Fichiers TypeScript | 654 | ✅ |
| Lignes de code | ~115,832 | ✅ |
| `: any` occurrences | 11 | ✅ Excellent |
| `as any` casts | 25 | ⚠️ |
| `eslint-disable` | 47 | ❌ Trop élevé |
| Try sans catch | 92 | ❌ |

### Fichiers Problématiques

| Fichier | Lignes | Problème |
|---------|--------|----------|
| VoxelView.tsx | 1,284 | Viole Single Responsibility |
| Help.tsx | 969 | Trop long |
| Onboarding.tsx | 940 | Trop long |
| VoxelStudio.tsx | 786 | Complexe |
| Risks.tsx | 783 | Complexe |

### Anti-patterns Détectés

1. **Type Assertions Dangereuses**
   ```typescript
   // ❌ Trouvé dans useComplianceActions.ts
   relatedAssetIds: arrayUnion(assetId) as unknown as string[]
   ```

2. **Code Dupliqué**
   ```typescript
   // 8 copies du même pattern dans useComplianceActions.ts
   const handleLinkAsset = async (control, assetId) => { ... }
   const handleLinkSupplier = async (control, supplierId) => { ... }
   ```

3. **Dépendances useEffect Excessives**
   ```typescript
   // DashboardStats.tsx - 11 dépendances
   useEffect(() => { ... }, [loading, complianceScore, activeIncidentsCount,
     stats.financialRisk, storedSummary, activeIncidents, generateContent,
     saveSummary, topRisks]);
   ```

### Recommandations

1. Refactoriser les fichiers > 500 lignes
2. Éliminer les `as unknown as` casts
3. Réduire les `eslint-disable` de 47 à < 10
4. Ajouter des catch blocks aux 92 try orphelins
5. Créer des factories pour éviter la duplication

---

## 4. PERFORMANCE (6.8/10)

### Points Forts ✅

| Aspect | Implémentation |
|--------|----------------|
| Code Splitting | Chunks manuels bien définis |
| Lazy Loading | 30+ routes lazy-loadées |
| React Query | staleTime 5min, retry 1 |
| PWA Caching | Workbox configuré |
| Memoization | 101 composants optimisés |

### Problèmes Critiques ❌

#### 1. Requêtes Firestore Séquentielles

```typescript
// ❌ useGlobalSearch.ts - Anti-pattern
if (activeTypeFilter === 'all' || activeTypeFilter === 'asset') {
    const assetsSnap = await getDocs(...); // Attend
}
if (activeTypeFilter === 'all' || activeTypeFilter === 'risk') {
    const risksSnap = await getDocs(...); // Attend le précédent
}
// Impact: 4x plus lent!

// ✅ Solution
const [assetsSnap, risksSnap] = await Promise.all([
    getDocs(query(collection(db, 'assets'), ...)),
    getDocs(query(collection(db, 'risks'), ...))
]);
```

#### 2. Aucune Virtualisation

- 0 utilisation de react-virtual ou @tanstack/react-virtual
- Listes longues (Assets, Risks, Incidents) rendent tous les éléments
- Impact: Freeze UI avec 1000+ éléments

#### 3. Debounce/Throttle Minimal

- 1 seul debounce trouvé (aiService.ts)
- Recherche globale sans debounce = requête à chaque keystroke
- Scroll/resize sans throttle

### Recommandations

| Priorité | Action | Gain Estimé |
|----------|--------|-------------|
| P0 | Paralléliser requêtes Firestore | 3-4x plus rapide |
| P0 | Implémenter virtualisation | 50-70% réduction render |
| P1 | Ajouter debounce sur recherche | 90% réduction requêtes |
| P1 | Lazy load images | 30-50% réduction initial load |

---

## 5. TESTS (2.8/10) 🔴

### État Actuel

| Type | Fichiers | Couverture |
|------|----------|------------|
| Tests unitaires | 18 | ~2.8% |
| Tests E2E | 18 | Flux critiques |
| Tests snapshot | 0 | 0% |
| Tests accessibilité | 0 | 0% |

### Composants Critiques Non Testés

**Hooks (0/88 testés):**
- `useAuth.ts` - Authentification
- `useDashboardData.ts` - Données dashboard
- `useFirestore.ts` - Accès données
- `useRiskData.ts` - Données risques
- `useComplianceData.ts` - Données conformité

**Services (3/56 testés):**
- `aiService.ts` - Non testé
- `assetService.ts` - Non testé
- `incidentService.ts` - Non testé

### Problèmes de Qualité des Tests

1. **Sur-mocking:** Tous les enfants mockés, ne teste rien de réel
2. **Assertions limitées:** 98 assertions pour 3,571 lignes
3. **Pas de tests d'erreur:** 20 occurrences seulement
4. **Pas de tests négatifs:** Auth échouée, erreurs serveur non testés

### Recommandations

```json
{
  "coverage": {
    "lines": 40,
    "functions": 40,
    "branches": 35,
    "statements": 40
  }
}
```

**Phase 1:** Tester les 10 hooks critiques
**Phase 2:** Atteindre 40% de couverture
**Phase 3:** Tests d'accessibilité avec axe-core

---

## 6. DÉPENDANCES (5/10)

### Vulnérabilités

| Package | Actuel | Recommandé | Sévérité |
|---------|--------|------------|----------|
| jspdf | 2.5.2 | 4.0.0 | CRITIQUE |
| qs | 6.14.0 | 6.14.1 | HAUTE |
| express | 4.18.2 | 4.22.1 | HAUTE |
| dompurify | 3.3.0 | 3.2.4+ | MODÉRÉE |

### Incohérences Entre Projets

| Package | Main | Mobile | Functions |
|---------|------|--------|-----------|
| firebase | 11.0.2 | 12.6.0 | (admin) 13.6.0 |
| react | 19.2.1 | 19.1.0 | - |
| @google/generative-ai | 0.14.1 | - | 0.21.0 |

### Dépendances Dépréciées

- `nprogress` - Non supportée
- `rimraf` v3 - Utiliser v4+
- `glob` v7 - Utiliser v9+
- `q` - Utiliser Promises natives

### Actions Requises

```bash
# Critique
npm update jspdf@^4.0.0

# Haute
cd functions && npm update express@^4.22.1

# Synchronisation Firebase
npm update firebase@^12.7.0
cd mobile && npm update firebase@^12.7.0
```

---

## 7. CONFIGURATION (3/10) 🔴

### Fichiers Exposés dans Git

| Fichier | Secrets Exposés |
|---------|-----------------|
| `.env` | Firebase, Google, ReCaptcha |
| `.env.production` | Gemini API |
| `functions/.env` | SMTP OVH |
| `functions/.env.sentinel-grc-a8701` | SMTP Gmail |
| `apphosting.yaml` | Toutes les variables |
| `.env.example` | Clé NVD réelle |

### Problèmes de Configuration

1. **Pas de séparation environnements**
   - Manque `.env.development`
   - Manque `.env.staging`

2. **Docker non sécurisé**
   ```dockerfile
   # ❌ Pas d'utilisateur non-root
   # ❌ Pas de healthcheck
   FROM node:18-alpine
   ```

3. **CSP Permissive**
   ```javascript
   // ❌ Dangereux
   script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:
   ```

4. **CI/CD Incomplet**
   - Pas de gestion des secrets GitHub
   - Pas de npm audit
   - Pas de déploiement automatique

### Actions Correctives

1. **Nettoyer l'historique Git:**
   ```bash
   git filter-branch -f --tree-filter 'rm -f .env .env.production functions/.env' -- --all
   git push --force --all
   ```

2. **Configurer Firebase Secrets:**
   ```bash
   firebase functions:secrets:set SMTP_PASSWORD
   firebase functions:secrets:set STRIPE_SECRET_KEY
   ```

3. **Sécuriser Dockerfile:**
   ```dockerfile
   FROM node:20-alpine
   RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
   USER nodejs
   HEALTHCHECK --interval=30s CMD node healthcheck.js
   ```

---

## 8. ACCESSIBILITÉ (7.6/10)

### Score WCAG 2.1

| Critère | Score | Notes |
|---------|-------|-------|
| 1.1.1 Contenu non textuel | 65/100 | Alt text partiel |
| 1.4.3 Contraste AA | 70/100 | slate-400 < 4.5:1 |
| 2.1.1 Clavier | 85/100 | Bonne couverture |
| 2.4.1 Bypass blocks | 100/100 | SkipLink implémenté |
| 2.4.7 Focus visible | 90/100 | Ring indicators excellents |
| 4.1.2 Nom, rôle, valeur | 70/100 | 70% ARIA couverts |

### Points Forts ✅

- 389 attributs ARIA
- SkipLink pour navigation clavier
- Focus indicators bien définis
- i18n FR/EN configuré
- Headless UI pour modals

### Points Faibles ❌

| Problème | Impact |
|----------|--------|
| 1 seule aria-live="polite" | Notifications non annoncées |
| Contraste slate-400 | < 4.5:1 WCAG AA |
| Touch targets < 44x44px | Difficile sur mobile |
| Formulaires sans fieldset | Structure non claire |

### Recommandations

1. Ajouter `aria-live="polite"` sur NotificationSystem
2. Remplacer `slate-400` par `slate-600` pour contraste
3. Augmenter padding boutons icônes à 44x44px
4. Encapsuler formulaires avec `<fieldset><legend>`

---

## 📋 PLAN D'ACTION PRIORITAIRE

### PHASE 1 - CRITIQUE (Cette semaine)

| # | Action | Temps | Responsable |
|---|--------|-------|-------------|
| 1 | Régénérer toutes les clés API | 2h | DevOps |
| 2 | Nettoyer historique Git des secrets | 2h | DevOps |
| 3 | Mettre à jour jsPDF → 4.0.0 | 4h | Frontend |
| 4 | Corriger CORS dans functions | 1h | Backend |
| 5 | Mettre à jour express/qs | 30min | Backend |

### PHASE 2 - HAUTE (2 semaines)

| # | Action | Temps |
|---|--------|-------|
| 6 | Configurer Firebase Secrets | 4h |
| 7 | Implémenter SecureStorage avec AES-256 | 8h |
| 8 | Paralléliser requêtes Firestore | 2j |
| 9 | Ajouter virtualisation listes | 2j |
| 10 | Tests hooks critiques (10) | 3j |

### PHASE 3 - MOYENNE (1 mois)

| # | Action | Temps |
|---|--------|-------|
| 11 | Refactoriser functions/index.js | 1 sem |
| 12 | Décomposer PdfService.ts | 3j |
| 13 | Atteindre 40% couverture tests | 2 sem |
| 14 | Corriger contrastes accessibilité | 2j |
| 15 | Configurer CI/CD complet | 3j |

### PHASE 4 - AMÉLIORATION (3 mois)

| # | Action | Temps |
|---|--------|-------|
| 16 | Atteindre 70% couverture tests | 1 mois |
| 17 | Certification WCAG 2.1 AA | 2 sem |
| 18 | Performance Lighthouse 95+ | 2 sem |
| 19 | Documentation architecture | 1 sem |

---

## 📈 MÉTRIQUES CIBLES

| Métrique | Actuel | 1 mois | 3 mois | 6 mois |
|----------|--------|--------|--------|--------|
| Score Sécurité | 4/10 | 7/10 | 8/10 | 9/10 |
| Couverture Tests | 2.8% | 25% | 50% | 70% |
| Vulnérabilités | 6 | 0 | 0 | 0 |
| Lighthouse Perf | ~70 | 80 | 90 | 95 |
| WCAG Level | Partiel | A | AA | AAA |
| Bundle Size | - | -10% | -20% | -30% |

---

## 🔧 COMMANDES UTILES

```bash
# Audit de sécurité
npm audit
npm audit fix

# Mettre à jour les dépendances critiques
npm update jspdf@^4.0.0
cd functions && npm update express@^4.22.1

# Tests avec couverture
npm run test:coverage

# Lint strict
npm run lint -- --max-warnings 0

# Build de production
npm run build

# Nettoyer historique Git (ATTENTION!)
git filter-branch -f --tree-filter 'rm -f .env .env.production functions/.env' -- --all
```

---

## CONCLUSION

L'application Sentinel GRC v2 possède une **base architecturale solide** avec de bonnes pratiques TypeScript et React. Cependant, elle présente des **failles de sécurité critiques** qui doivent être corrigées **immédiatement** avant tout déploiement en production :

1. **Secrets exposés** - Régénérer toutes les clés
2. **CORS mal configuré** - Risque CSRF élevé
3. **Dépendances vulnérables** - jsPDF, qs, express
4. **Tests insuffisants** - 2.8% de couverture

**Estimation effort total:** 4-6 semaines pour atteindre un niveau acceptable de sécurité et qualité.

---

*Rapport généré automatiquement lors de l'audit du 5 janvier 2026*
