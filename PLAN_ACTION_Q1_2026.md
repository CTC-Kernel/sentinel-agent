# 🎯 PLAN D'ACTION Q1 2026 - Sentinel GRC v2.0

**Période**: Janvier - Mars 2026
**Objectif**: Atteindre un niveau de qualité 9/10
**Note actuelle**: 7.8/10

---

## 📅 Sprint 1: Qualité du Code (Semaines 1-2)

### Objectifs
- Éliminer les `any`
- Nettoyer les console.log
- Standardiser la gestion d'erreurs
- Améliorer la couverture de tests

### Tâches détaillées

#### Semaine 1: Type Safety & Clean Code

**Jour 1-2: Éliminer les `any` (171 → 0)**
- [x] services/aiService.ts (9 any)
  - Créer des types pour les responses Gemini
  - Typer les paramètres de configuration
- [ ] hooks/useFirestore.ts (8 any)
  - Générique `<T>` pour les collections
  - Types pour les queries Firestore
- [ ] services/integrationService.ts (6 any)
  - Interfaces pour les intégrations externes
  - Types pour les webhooks
- [ ] components/suppliers/SupplierForm.tsx (18 any!)
  - Props typées strictement
  - Event handlers typés
- [ ] Autres fichiers avec any < 5
  - Traiter par ordre de criticité

**Jour 3: Nettoyer console.log (508 → 0)**
- [x] Remplacer par ErrorLogger ou logger (pino)
- [x] Configuration: supprimer console.log en prod uniquement
- [x] Script: `npm run remove-console-logs`
- [ ] Validation: grep pour vérifier

**Jour 4-5: Standardiser Error Handling**
- [x] Créer ErrorHandler service ✅
- [ ] Migrer assetService vers ErrorHandler
- [ ] Migrer riskService vers ErrorHandler
- [ ] Migrer aiService vers ErrorHandler
- [ ] Ajouter Error Boundary au niveau App
- [ ] Tests unitaires ErrorHandler

#### Semaine 2: Tests & Documentation

**Jour 1-3: Tests Unitaires (29 → 100+)**

Priorité 1: Services critiques
- [ ] RiskCalculationService.test.ts (nouveau service) ✅ Créé
  - [ ] 10+ tests de calcul de score
  - [ ] Tests edge cases
  - [ ] Tests risque résiduel
- [ ] assetService.test.ts
  - [ ] CRUD operations
  - [ ] Validation
  - [ ] Permissions
- [ ] ComplianceService.test.ts
  - [ ] SoA generation
  - [ ] Gap analysis
  - [ ] Multi-framework

Priorité 2: Hooks
- [ ] useFirestore.test.ts
- [ ] useAssetDetails.test.ts
- [ ] useRiskActions.test.ts

Priorité 3: Utils
- [ ] permissions.test.ts ✅ Existe déjà
- [ ] errorHandler.test.ts ✅ Nouveau service
- [ ] dataSanitizer.test.ts ✅ Existe déjà

**Jour 4-5: Documentation**
- [x] README.md principal ✅
- [x] Guide de contribution ✅
- [ ] Architecture overview
- [ ] Database schema
- [ ] API reference

**Livrables Sprint 1**
- ✅ 0 `any` dans le code
- ✅ 0 console.log en production
- ✅ ErrorHandler implémenté
- □ 100+ tests unitaires (objectif 40% coverage)
- ✅ Documentation de base

---

## 📅 Sprint 2: Performance & UX (Semaines 3-4)

### Objectifs
- Optimiser le bundle size
- Améliorer les performances de rendu
- Code splitting avancé
- Accessibilité WCAG AAA

### Tâches détaillées

#### Semaine 3: Optimisation Bundle

**Jour 1: Analyse actuelle**
- [ ] `npm run build:analyze`
- [ ] Identifier les plus gros chunks
- [ ] Documenter les dépendances lourdes

**Jour 2-3: Code Splitting**
- [x] vite.config.performance.ts créé ✅
- [ ] Lazy loading des routes
  ```typescript
  const Assets = lazy(() => import('./views/Assets'));
  const Risks = lazy(() => import('./views/Risks'));
  // etc.
  ```
- [ ] Lazy loading des modules 3D
  ```typescript
  const VoxelEngine = lazy(() => import('./components/voxel/VoxelEngine'));
  ```
- [ ] Lazy loading PDF/Excel utils
  ```typescript
  const { generatePDF } = await import('./services/PdfService');
  ```

**Jour 4-5: Compression & Optimisations**
- [x] Brotli compression configurée ✅
- [ ] Images: Conversion WebP/AVIF
- [ ] Fonts: Optimisation et subset
- [ ] CSS: PurgeCSS audit
- [ ] Tree-shaking: Vérification
- [ ] Test Lighthouse: Score 90+

**Objectif**: Bundle < 500KB gzipped

#### Semaine 4: UX & Accessibilité

**Jour 1-2: Performance Rendering**
- [ ] React.memo sur composants lourds
  - [ ] DataTable
  - [ ] RiskMatrix
  - [ ] ComplianceScorecard
  - [ ] AssetCard, RiskCard, etc.
- [ ] useMemo/useCallback audit
- [ ] Virtualisation grandes listes (react-window)
  - [ ] Asset list > 100 items
  - [ ] Risk list > 100 items

**Jour 3-5: Accessibilité WCAG AAA**
- [ ] Installer @axe-core/react
- [ ] Audit complet avec Axe
  ```bash
  npx axe http://localhost:5173
  ```
- [ ] Contrast ratio 7:1 partout
- [ ] Focus indicators visibles (3px)
- [ ] Skip links navigation
- [ ] ARIA labels complets
- [ ] Live regions pour notifications
- [ ] Tests automatisés jest-axe
  ```typescript
  expect(container).toHaveNoViolations();
  ```

**Jour 5: Tests responsive**
- [ ] Tests Playwright multi-viewports
  - [ ] Mobile (375px)
  - [ ] Tablet (768px)
  - [ ] Desktop (1920px)
- [ ] Tables responsive (mode card mobile)
- [ ] Modals/Drawers mobile-friendly

**Livrables Sprint 2**
- □ Bundle < 500KB
- □ Lighthouse score 90+
- □ React.memo sur composants critiques
- □ WCAG AAA compliance
- □ Tests responsive E2E

---

## 📅 Sprint 3: Fonctionnalités & Robustesse (Semaines 5-6)

### Objectifs
- Améliorer les exports/imports
- Firestore query optimization
- Offline mode
- Monitoring & Alerting

### Tâches détaillées

#### Semaine 5: Exports & Queries

**Jour 1-2: Système d'export avancé**
- [ ] Excel export avec formatage
  ```typescript
  // services/ExcelExportService.ts
  exportToExcel(data, options: {
    sheetName,
    formatting,
    charts
  })
  ```
- [ ] PDF bulk export
- [ ] Import wizard
  - [ ] Step 1: Upload file
  - [ ] Step 2: Map columns
  - [ ] Step 3: Preview & validate
  - [ ] Step 4: Import
- [ ] Templates par module

**Jour 3-5: Optimisation Firestore**
- [ ] Audit de toutes les queries
  ```typescript
  // ❌ Avant
  getDocs(collection(db, 'assets'))

  // ✅ Après
  const q = query(
    collection(db, 'assets'),
    where('organizationId', '==', orgId),
    limit(100)
  );
  ```
- [ ] Pagination côté serveur
  ```typescript
  const [lastDoc, setLastDoc] = useState(null);

  const q = query(
    collection(db, 'assets'),
    where('organizationId', '==', orgId),
    orderBy('createdAt', 'desc'),
    startAfter(lastDoc),
    limit(25)
  );
  ```
- [ ] Cursor-based pagination
- [ ] Composite indexes
- [ ] Batched writes

#### Semaine 6: Offline & Monitoring

**Jour 1-3: Offline Mode**
- [ ] Background Sync API
  ```typescript
  // hooks/useOfflineQueue.ts
  navigator.serviceWorker.ready.then(reg =>
    reg.sync.register('sync-operations')
  );
  ```
- [ ] IndexedDB queue
- [ ] Offline indicator UI
- [ ] Retry logic
- [ ] Conflict resolution

**Jour 4-5: Monitoring**
- [ ] Structured logging (Pino)
  ```typescript
  logger.info({ userId, assetId, action }, 'Asset created');
  ```
- [ ] Métriques métier
  ```typescript
  analytics.logEvent('risk_created', {
    severity,
    framework,
    organizationId
  });
  ```
- [ ] Sentry alerts
  - [ ] Error rate > 5%
  - [ ] Response time > 3s
- [ ] Firebase Performance
  - [ ] Slow queries alert
- [ ] Uptime monitoring (external)

**Livrables Sprint 3**
- □ Excel/PDF export avancés
- □ Toutes queries optimisées
- □ Offline mode fonctionnel
- □ Monitoring complet
- □ Alerting configuré

---

## 📅 Sprint 4: Documentation & Tests E2E (Semaines 7-8)

### Objectifs
- Documentation technique complète
- Tests E2E complets
- Storybook
- CI/CD amélioré

### Tâches détaillées

#### Semaine 7: Documentation

**Jour 1-2: Architecture**
- [ ] docs/architecture/overview.md
  - [ ] Diagrammes architecture
  - [ ] Flow de données
  - [ ] Security model
- [ ] docs/architecture/database-schema.md
  - [ ] Schéma Firestore
  - [ ] Relations
  - [ ] Indexes
- [ ] docs/architecture/api-reference.md
  - [ ] Services
  - [ ] Hooks
  - [ ] Utils

**Jour 3-4: Features**
- [ ] docs/features/risk-management.md
  - [ ] Calcul des risques
  - [ ] Matrice
  - [ ] Traitement
- [ ] docs/features/compliance.md
  - [ ] Frameworks supportés
  - [ ] SoA
  - [ ] Gap analysis
- [ ] docs/features/audit-workflow.md
- [ ] docs/features/document-management.md
- [ ] docs/features/privacy-gdpr.md

**Jour 5: Deployment**
- [ ] docs/deployment/firebase-setup.md
- [ ] docs/deployment/environment-variables.md
- [ ] docs/deployment/ci-cd.md

#### Semaine 8: Tests & Storybook

**Jour 1-3: Tests E2E Playwright**

Coverage objectif: Tous les workflows critiques

- [ ] Assets workflow
  ```typescript
  test('complete asset lifecycle', async ({ page }) => {
    // Create → Edit → Link to Risk → Delete
  });
  ```
- [ ] Risk management workflow
  ```typescript
  test('risk assessment and treatment', async ({ page }) => {
    // Create risk → Assess → Link controls → Calculate residual
  });
  ```
- [ ] Compliance workflow
  ```typescript
  test('compliance check and SoA generation', async ({ page }) => {
    // Select framework → Check controls → Generate SoA
  });
  ```
- [ ] Document workflow
  ```typescript
  test('document approval workflow', async ({ page }) => {
    // Draft → Review → Approve → Publish
  });
  ```
- [ ] User permissions
  ```typescript
  test('role-based access control', async ({ page }) => {
    // Test all 6 roles permissions
  });
  ```

**Jour 4-5: Storybook**
- [ ] Installation
  ```bash
  npx storybook init
  ```
- [ ] Stories composants UI
  ```typescript
  // stories/DataTable.stories.tsx
  // stories/Modal.stories.tsx
  // stories/Button.stories.tsx
  // etc.
  ```
- [ ] Documentation design system

**Livrables Sprint 4**
- □ Documentation technique complète
- □ Tests E2E coverage 80%+
- □ Storybook avec 50+ stories
- □ CI/CD: tests automatiques sur PR

---

## 📅 Sprint 5-6: Features Avancées (Semaines 9-12)

### Objectifs
- Monorepo structure (optionnel)
- Virtualisation listes
- CSP strict
- Audit sécurité

### Semaine 9-10: Structure & Performance

**Monorepo (Optionnel)**
- [ ] Évaluer besoin (mobile/functions/web séparés)
- [ ] Setup pnpm workspaces ou Turborepo
  ```
  sentinel-grc/
  ├── apps/
  │   ├── web/
  │   ├── mobile/
  │   └── functions/
  ├── packages/
  │   ├── shared/
  │   ├── ui/
  │   └── services/
  ```
- [ ] Migration progressive

**Virtualisation**
- [ ] react-window pour listes > 100 items
  ```typescript
  import { FixedSizeList } from 'react-window';

  <FixedSizeList
    height={600}
    itemCount={assets.length}
    itemSize={80}
  >
    {({ index, style }) => (
      <div style={style}>
        <AssetCard asset={assets[index]} />
      </div>
    )}
  </FixedSizeList>
  ```

### Semaine 11-12: Sécurité & Audit

**CSP Strict**
- [ ] Configuration CSP complète
  ```typescript
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://apis.google.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://firebasestorage.googleapis.com"],
        // etc.
      }
    }
  }));
  ```

**Audit Sécurité**
- [ ] npm audit fix
- [ ] gitleaks scan
  ```bash
  gitleaks detect --source . --verbose
  ```
- [ ] Snyk scan
  ```bash
  npx snyk test
  ```
- [ ] OWASP ZAP scan
- [ ] Pentest externe (recommandé)

**Livrables Sprint 5-6**
- □ Monorepo (si validé)
- □ Virtualisation implémentée
- □ CSP strict
- □ Audit sécurité complet
- □ Rapport de sécurité

---

## 📊 MÉTRIQUES DE SUCCÈS

### Objectifs Finaux (Fin Mars 2026)

| Métrique | Actuel | Objectif | Statut |
|----------|--------|----------|--------|
| **Code Quality** |
| TypeScript any | 171 | < 10 | 🟡 |
| Console.log | 508 | 0 | 🟡 |
| Tests coverage | ~15% | 80%+ | 🔴 |
| ESLint errors | ~20 | 0 | 🟡 |
| **Performance** |
| Bundle size | ? | < 500KB | 🟡 |
| Lighthouse score | ? | 90+ | 🔴 |
| Time to Interactive | ? | < 3s | 🔴 |
| First Contentful Paint | ? | < 1.5s | 🔴 |
| **Accessibilité** |
| WCAG compliance | AA | AAA | 🔴 |
| Axe violations | ? | 0 | 🔴 |
| Keyboard navigation | ~80% | 100% | 🟡 |
| **Fiabilité** |
| Error rate | ? | < 1% | 🟡 |
| Uptime | ? | 99.9% | 🟡 |
| MTTR | ? | < 1h | 🔴 |

### KPIs Hebdomadaires

**Semaine 1-2**
- [ ] any: 171 → 50
- [ ] console.log: 508 → 0
- [ ] Tests: 29 → 80

**Semaine 3-4**
- [ ] Bundle: Analyse complète
- [ ] Lighthouse: Score baseline
- [ ] WCAG: Audit complet

**Semaine 5-6**
- [ ] Excel export: Fonctionnel
- [ ] Queries: 100% optimisées
- [ ] Offline: MVP fonctionnel

**Semaine 7-8**
- [ ] Docs: 100% complète
- [ ] E2E tests: 80% coverage
- [ ] Storybook: 50+ stories

**Semaine 9-12**
- [ ] Security audit: Complet
- [ ] Performance: Objectifs atteints
- [ ] Note finale: 9/10

---

## 🎯 PROCHAINES ÉTAPES IMMÉDIATES

### Cette semaine (Semaine 1)

**Lundi**
- [x] ✅ Sauvegarder rapport d'audit
- [x] ✅ Créer ErrorHandler service
- [x] ✅ Créer RiskCalculationService
- [x] ✅ Créer vite.config.performance.ts
- [x] ✅ Créer documentation de base

**Mardi-Mercredi**
- [ ] Éliminer any dans aiService.ts
- [ ] Éliminer any dans useFirestore.ts
- [ ] Éliminer any dans integrationService.ts

**Jeudi-Vendredi**
- [ ] Nettoyer console.log (script auto)
- [ ] Migrer 5 services vers ErrorHandler
- [ ] Écrire 20 tests unitaires

### Prochaine semaine (Semaine 2)

- [ ] 50 tests unitaires additionnels
- [ ] Documentation architecture
- [ ] Database schema documentation
- [ ] Audit performance initial

---

## 💰 RESSOURCES NÉCESSAIRES

### Équipe
- **1 Dev Senior TypeScript**: Type safety, architecture
- **1 Dev React**: UI/UX, composants
- **1 QA**: Tests unitaires, E2E
- **0.5 DevOps**: CI/CD, monitoring
- **0.5 Tech Writer**: Documentation

### Outils
- [ ] Sentry Pro (monitoring)
- [ ] Snyk (sécurité)
- [ ] Lighthouse CI
- [ ] Axe DevTools

### Formation
- [ ] WCAG AAA training (2j)
- [ ] Firebase advanced (1j)
- [ ] Performance optimization (1j)

---

## 🚀 SUCCESS CRITERIA

À la fin du Q1 2026, Sentinel GRC v2.0 devra avoir:

✅ **Note globale: 9/10**

Critères obligatoires:
- ✅ 0 `any` dans le code de production
- ✅ 0 console.log en production
- ✅ 80%+ test coverage
- ✅ WCAG AAA compliant
- ✅ Bundle < 500KB
- ✅ Lighthouse 90+
- ✅ Documentation complète
- ✅ CI/CD robuste
- ✅ Monitoring & alerting
- ✅ Audit sécurité passé

---

**Chef de projet**: À définir
**Début**: 08 janvier 2026
**Fin prévue**: 31 mars 2026
**Review**: Hebdomadaire chaque vendredi

**Dernière mise à jour**: 08 janvier 2026
