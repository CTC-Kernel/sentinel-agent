# Epic 13: Technical Excellence & Quality Improvements

**Epic ID:** epic-13
**Priority:** P1 (Post-MVP - Quality)
**Status:** backlog
**Created:** 2026-01-12
**Source:** Comprehensive Application Audit (2026-01-12)

---

## Epic Overview

### Business Value

Améliorer la qualité technique, la maintenabilité et la performance de Sentinel-GRC pour:
- Réduire la dette technique accumulée
- Améliorer l'expérience développeur
- Renforcer la stabilité et la performance
- Faciliter l'évolution future du produit

### Success Criteria

- Score audit amélioré de 6.8/10 à 8.5/10
- 0 usages de `any` dans les fichiers critiques
- 100% des couleurs utilisant les design tokens
- Couverture de tests >50%
- Build time <2 minutes

### Scope

**In Scope:**
- Refactoring des composants géants (Dashboard, RiskForm, VoxelStudio)
- Élimination des types `any`
- Centralisation des couleurs hardcodées
- Amélioration de la couverture de tests
- Mise à jour des dépendances majeures

**Out of Scope:**
- Nouvelles fonctionnalités métier
- Migration de stack (Firebase reste)
- Redesign UI complet

---

## Stories

### Story 13-1: Refactoring Dashboard Component

**Story ID:** 13-1-refactor-dashboard
**Points:** 8
**Priority:** P0

**User Story:**
En tant que développeur, je veux que le composant Dashboard soit divisé en sous-composants modulaires afin de faciliter la maintenance et améliorer la performance.

**Acceptance Criteria:**
- [ ] Dashboard.tsx divisé en <5000 lignes (actuellement ~25,000)
- [ ] Chaque widget extrait dans son propre composant
- [ ] State management refactorisé avec hooks custom
- [ ] Lazy loading des widgets non-critiques
- [ ] Tests unitaires pour chaque nouveau composant
- [ ] Performance: Time to Interactive maintenu ou amélioré

**Technical Notes:**
- Extraire: StatsSection, ChartsSection, AlertsWidget, RecentActivityWidget
- Utiliser React.lazy() pour les charts
- Migrer le state local vers des hooks dédiés

---

### Story 13-2: Type Safety - Eliminate `any` Types

**Story ID:** 13-2-eliminate-any-types
**Points:** 5
**Priority:** P1

**User Story:**
En tant que développeur, je veux éliminer les usages de `any` dans le code afin d'avoir une meilleure sécurité de type et moins de bugs runtime.

**Acceptance Criteria:**
- [ ] 0 usages de `any` dans src/services/*.ts
- [ ] 0 usages de `any` dans src/hooks/*.ts
- [ ] 0 usages de `any` dans src/utils/*.ts
- [ ] Types génériques créés pour les patterns récurrents
- [ ] ESLint rule `@typescript-eslint/no-explicit-any` activée en warning
- [ ] Documentation des types complexes ajoutée

**Technical Notes:**
- Fichiers prioritaires: errorLogger.ts, performanceMonitor.ts, notificationService.ts
- Créer types pour Firebase responses
- Utiliser `unknown` + type guards au lieu de `any`

---

### Story 13-3: Design Tokens - Centralize Colors

**Story ID:** 13-3-centralize-colors
**Points:** 5
**Priority:** P1

**User Story:**
En tant que développeur, je veux que toutes les couleurs utilisent les design tokens afin d'assurer la cohérence visuelle et faciliter le theming.

**Acceptance Criteria:**
- [ ] 0 couleurs hardcodées dans src/components/charts/*.tsx
- [ ] 0 couleurs hardcodées dans src/components/dashboard/*.tsx
- [ ] 0 couleurs hardcodées dans src/components/ui/*.tsx
- [ ] Fichier design-tokens.css complété avec toutes les variantes
- [ ] Utilitaire Tailwind pour les couleurs sémantiques
- [ ] Migration documentée pour les autres fichiers

**Technical Notes:**
- ~60 fichiers concernés (prioritiser UI critique)
- Utiliser les variables CSS existantes dans design-tokens.css
- Créer helper: `getChartColor(index)` pour les charts

---

### Story 13-4: Test Coverage Improvement

**Story ID:** 13-4-test-coverage
**Points:** 8
**Priority:** P1

**User Story:**
En tant que développeur, je veux améliorer la couverture de tests afin de détecter les régressions plus tôt et avoir confiance dans les déploiements.

**Acceptance Criteria:**
- [ ] Couverture globale >50% (actuellement ~10%)
- [ ] 100% des services critiques testés (authService, riskService, auditService)
- [ ] Component tests pour les 10 composants les plus utilisés
- [ ] Test factories créées pour Risk, Control, Audit, Document
- [ ] CI configuré pour bloquer si couverture <50%
- [ ] README testing guidelines mis à jour

**Technical Notes:**
- Priorité: services > hooks > utils > components
- Utiliser Vitest + React Testing Library
- Créer `tests/factories/` pour les données de test

---

### Story 13-5: Refactoring RiskForm Component

**Story ID:** 13-5-refactor-riskform
**Points:** 5
**Priority:** P2

**User Story:**
En tant que développeur, je veux que le composant RiskForm soit modulaire afin de faciliter l'ajout de nouveaux champs et la maintenance.

**Acceptance Criteria:**
- [ ] RiskForm.tsx divisé en <500 lignes (actuellement ~992)
- [ ] Sections extraites: BasicInfo, Assessment, Mitigation, Relations
- [ ] Validation Zod centralisée
- [ ] Form state géré avec React Hook Form
- [ ] Tests unitaires pour chaque section
- [ ] Storybook stories pour chaque variante

**Technical Notes:**
- Pattern: FormSection component wrapper
- Utiliser useFormContext pour le state partagé
- Extraire les schémas Zod dans un fichier dédié

---

### Story 13-6: Dependency Updates (Major Versions)

**Story ID:** 13-6-dependency-updates
**Points:** 3
**Priority:** P2

**User Story:**
En tant que développeur, je veux mettre à jour les dépendances majeures afin de bénéficier des nouvelles fonctionnalités et corrections de sécurité.

**Acceptance Criteria:**
- [ ] @capacitor/* mis à jour vers v8.x (actuellement v7.x)
- [ ] @google/generative-ai mis à jour vers v0.24.x (actuellement v0.14.x)
- [ ] vitest mis à jour vers v4.x (actuellement v2.x)
- [ ] Tests de non-régression passent
- [ ] Build et lint passent
- [ ] CHANGELOG mis à jour

**Technical Notes:**
- Capacitor 8 breaking changes: vérifier migration guide
- Google AI SDK: nouvelles API à exploiter (streaming, embeddings)
- Vitest 4: nouveau reporter, performance améliorée

---

### Story 13-7: Component Performance Optimization

**Story ID:** 13-7-component-performance
**Points:** 5
**Priority:** P2

**User Story:**
En tant qu'utilisateur, je veux que l'application soit plus réactive afin d'avoir une meilleure expérience d'utilisation.

**Acceptance Criteria:**
- [ ] React.memo appliqué à 20 composants de liste supplémentaires
- [ ] useMemo/useCallback optimisés dans les composants critiques
- [ ] Virtualization ajoutée pour les listes >100 items
- [ ] Lazy loading étendu aux composants lourds restants
- [ ] Bundle analyzer report généré et analysé
- [ ] LCP <2s vérifié sur toutes les pages principales

**Technical Notes:**
- Composants prioritaires: RiskList, ControlList, AuditList, DocumentList
- Utiliser @tanstack/react-virtual pour virtualization
- Identifier les re-renders avec React DevTools Profiler

---

### Story 13-8: Accessibility Improvements

**Story ID:** 13-8-accessibility
**Points:** 5
**Priority:** P2

**User Story:**
En tant qu'utilisateur avec des besoins d'accessibilité, je veux que l'application soit conforme WCAG 2.1 AA afin de pouvoir l'utiliser efficacement.

**Acceptance Criteria:**
- [ ] Audit axe-core: 0 erreurs critiques
- [ ] aria-labels sur tous les boutons interactifs
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Skip links fonctionnels sur toutes les pages
- [ ] Contraste couleurs vérifié (ratio 4.5:1 minimum)
- [ ] Navigation au clavier testée sur tous les formulaires

**Technical Notes:**
- Utiliser eslint-plugin-jsx-a11y
- Intégrer @axe-core/playwright dans les E2E tests
- Créer composant AccessibleButton wrapper

---

## Dependencies

| Story | Depends On | Blocks |
|-------|------------|--------|
| 13-1 | - | 13-7 |
| 13-2 | - | - |
| 13-3 | - | - |
| 13-4 | - | - |
| 13-5 | - | - |
| 13-6 | 13-4 (tests for validation) | - |
| 13-7 | 13-1 | - |
| 13-8 | - | - |

---

## Estimation Summary

| Story | Points | Priority |
|-------|--------|----------|
| 13-1 Refactor Dashboard | 8 | P0 |
| 13-2 Eliminate any types | 5 | P1 |
| 13-3 Centralize colors | 5 | P1 |
| 13-4 Test coverage | 8 | P1 |
| 13-5 Refactor RiskForm | 5 | P2 |
| 13-6 Dependency updates | 3 | P2 |
| 13-7 Performance optimization | 5 | P2 |
| 13-8 Accessibility | 5 | P2 |
| **Total** | **44 points** | - |

---

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Dashboard refactoring introduces regressions | Medium | High | Extensive E2E coverage first |
| Type fixes break existing functionality | Low | Medium | Incremental migration + tests |
| Major dependency updates cause incompatibilities | Medium | Medium | Test in isolation branch |

---

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Code reviewed and approved
- [ ] Unit tests passing (>80% coverage for changed files)
- [ ] E2E tests passing
- [ ] No new lint errors
- [ ] Performance metrics maintained or improved
- [ ] Documentation updated
