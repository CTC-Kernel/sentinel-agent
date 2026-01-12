# System-Level Test Design

**Project:** Sentinel-GRC v2
**Date:** 2026-01-12
**Mode:** System-Level (Phase 3 - Testability Review)

---

## Testability Assessment

### Controllability: ✅ PASS

| Aspect | Status | Details |
|--------|--------|---------|
| **State Control** | ✅ | Firebase emulators allow full database reset and seeding |
| **External Dependencies** | ✅ | Firebase SDK allows mocking Auth, Firestore, Storage |
| **Error Injection** | ⚠️ | Limited chaos engineering capability - recommend adding |
| **Test Data Factories** | ⚠️ | E2E mode with localStorage bypass exists, needs enhancement |

**Strengths:**
- E2E auth bypass via `E2E_TEST_USER` in localStorage (hardened - requires `VITE_ENABLE_E2E_MODE=true`)
- Firebase emulators for isolated testing
- TypeScript strict mode enables compile-time validation

**Concerns:**
- No dedicated test data factory system
- Missing seed data scripts for consistent test state

### Observability: ✅ PASS

| Aspect | Status | Details |
|--------|--------|---------|
| **Logging** | ✅ | ErrorLogger service with Sentry integration |
| **Performance Metrics** | ✅ | PerformanceMonitor service tracks LCP, FID, CLS |
| **Audit Trail** | ✅ | Full audit logging for all CRUD operations |
| **Test Results** | ✅ | Playwright reporters, Vitest coverage |

**Strengths:**
- Comprehensive error logging with stack traces
- Web Vitals monitoring (LCP, FID, CLS, INP)
- Audit trail for compliance verification

### Reliability: ⚠️ CONCERNS

| Aspect | Status | Details |
|--------|--------|---------|
| **Test Isolation** | ⚠️ | Some shared state concerns in global stores |
| **Reproducibility** | ✅ | Deterministic builds with Vite |
| **Flakiness** | ⚠️ | Some async operations lack explicit waits |
| **Parallel Safety** | ⚠️ | Multi-tenant isolation not verified in tests |

**Concerns:**
- Zustand global store may cause test pollution
- Async Firebase operations need explicit wait handling
- Missing test cleanup hooks for some components

---

## Architecturally Significant Requirements (ASRs)

### High-Priority (Score ≥6)

| ASR ID | Requirement | Category | Prob | Impact | Score | Mitigation |
|--------|-------------|----------|------|--------|-------|------------|
| ASR-001 | Multi-tenant data isolation | SEC | 3 | 3 | **9** | Firestore rules + E2E isolation tests |
| ASR-002 | <2s page load (LCP) | PERF | 2 | 3 | **6** | k6 load tests + Lighthouse CI |
| ASR-003 | RBAC permission enforcement | SEC | 2 | 3 | **6** | Permission matrix E2E coverage |
| ASR-004 | Zero data loss on form abandon | DATA | 2 | 3 | **6** | Auto-save integration tests |
| ASR-005 | 99.9% availability | OPS | 2 | 3 | **6** | Health check monitoring |

### Medium-Priority (Score 3-5)

| ASR ID | Requirement | Category | Prob | Impact | Score |
|--------|-------------|----------|------|--------|-------|
| ASR-006 | <500ms API response | PERF | 2 | 2 | 4 |
| ASR-007 | WCAG 2.1 AA compliance | BUS | 2 | 2 | 4 |
| ASR-008 | FR/EN locale validation | TECH | 2 | 2 | 4 |
| ASR-009 | Concurrent user scaling (10k) | PERF | 1 | 3 | 3 |

---

## Test Levels Strategy

Based on the architecture (React SPA + Firebase Serverless + Mobile Expo):

### Recommended Split

| Level | Percentage | Rationale |
|-------|------------|-----------|
| **E2E (Playwright)** | 30% | UI-heavy GRC workflows, RBAC verification |
| **Integration (API/Firebase)** | 30% | Multi-tenant isolation, Cloud Functions |
| **Component (React Testing)** | 20% | Form validation, UI components |
| **Unit (Vitest)** | 20% | Business logic, utilities, schemas |

### Current State vs Target

| Level | Current | Target | Gap |
|-------|---------|--------|-----|
| E2E | 32 specs | 50 specs | +18 |
| Integration | ~0 | 30 specs | +30 |
| Component | ~0 | 40 specs | +40 |
| Unit | ~5 | 50 specs | +45 |

---

## NFR Testing Approach

### Security Testing

| Test Type | Tool | Target | Priority |
|-----------|------|--------|----------|
| Auth bypass attempts | Playwright | Login flows | P0 |
| RBAC permission matrix | Playwright | All modules | P0 |
| XSS injection | OWASP ZAP | User inputs | P1 |
| Firestore rules audit | Firebase emulator | All collections | P0 |
| Secret exposure | GitLeaks | Repository | P0 |

**Already Fixed:**
- ✅ Hardcoded App Check debug token removed
- ✅ E2E auth bypass hardened (requires explicit env var)
- ✅ react-router XSS vulnerability patched

### Performance Testing

| Test Type | Tool | SLA | Priority |
|-----------|------|-----|----------|
| Page load (LCP) | Lighthouse CI | <2s | P0 |
| API response time | k6 | <500ms p95 | P1 |
| Bundle size | Vite analyzer | <500KB initial | P1 |
| Memory leaks | Playwright + DevTools | No growth over time | P2 |

**Already Fixed:**
- ✅ Memory leak in performanceMonitor.ts fixed
- ✅ GeminiAssistant lazy loaded (~50KB saved)
- ✅ VoxelStudio lazy loaded (~500KB saved)

### Reliability Testing

| Test Type | Tool | Target | Priority |
|-----------|------|--------|----------|
| Error boundary coverage | Playwright | All routes | P1 |
| Offline mode | Playwright | Critical paths | P2 |
| Auto-save verification | Playwright | All forms | P1 |
| Draft mode recovery | Playwright | Form abandonment | P1 |

### Maintainability Testing

| Test Type | Tool | Target | Priority |
|-----------|------|--------|----------|
| Code coverage | Vitest/Istanbul | >80% critical paths | P1 |
| Type safety | TypeScript strict | 0 any types | P2 |
| Linting | ESLint | 0 errors | P0 |
| Bundle analysis | Vite analyzer | Monitor growth | P2 |

**Known Debt:**
- ⚠️ ~246 `any` type usages to fix
- ⚠️ ~60 files with hardcoded colors

---

## Test Environment Requirements

### Local Development

```yaml
Environment: Local
Tools:
  - Vite dev server (localhost:5173)
  - Firebase emulators (Auth, Firestore, Functions, Storage)
  - Playwright for E2E
  - Vitest for unit/component

Setup:
  - npm run dev
  - firebase emulators:start
  - VITE_ENABLE_E2E_MODE=true for test auth bypass
```

### CI/CD (GitHub Actions)

```yaml
Environment: CI
Tools:
  - GitHub Actions runners
  - Firebase emulators in CI
  - Playwright containers
  - Lighthouse CI

Pipeline:
  1. Lint check (ESLint)
  2. Type check (TypeScript)
  3. Unit tests (Vitest)
  4. Build verification
  5. E2E tests (Playwright)
  6. Lighthouse audit
  7. Security scan (npm audit)
```

### Staging

```yaml
Environment: Firebase Preview
Tools:
  - Firebase Preview channels
  - Production-like data (anonymized)
  - Performance monitoring

Purpose:
  - Manual QA validation
  - UAT with stakeholders
  - Performance baseline
```

---

## Testability Concerns

### Blockers: None

### Concerns (Non-blocking)

| Concern | Impact | Recommendation |
|---------|--------|----------------|
| Global Zustand store pollution | Medium | Add store reset in test setup |
| Async Firebase operations | Medium | Implement explicit waitFor utilities |
| Multi-tenant test isolation | High | Add per-test tenant creation |
| Missing test data factories | Medium | Create factory pattern for entities |

---

## Recommendations for Sprint 0

### Immediate Actions (Before next Epic)

1. **Test Data Factories**
   - Create factory functions for Risk, Control, Audit, Document entities
   - Integrate with Firebase emulator seeding

2. **E2E Test Utilities**
   - Add explicit wait helpers for Firebase operations
   - Create reusable login/logout fixtures
   - Add multi-tenant test isolation

3. **CI Pipeline Enhancement**
   - Add Lighthouse CI for performance regression
   - Add npm audit to CI for security
   - Configure parallel E2E test execution

### Future Improvements

1. **Component Testing**
   - Add React Testing Library for component isolation
   - Target 40 component tests for critical UI

2. **Integration Testing**
   - Add Firebase Functions unit tests
   - Test Firestore rules exhaustively

3. **Performance Testing**
   - Set up k6 for load testing
   - Create baseline performance benchmarks

---

## Quality Gate Criteria

### Pre-Release Gate

| Criterion | Threshold | Current |
|-----------|-----------|---------|
| E2E tests pass | 100% | ✅ |
| Unit tests pass | 100% | ✅ |
| Lint errors | 0 | ✅ |
| TypeScript errors | 0 | ✅ |
| npm audit (high/critical) | 0 | ✅ |
| LCP (p75) | <2s | TBD |
| Bundle size | <2MB | ✅ |

### Definition of Done (Per Story)

- [ ] Unit tests for business logic
- [ ] E2E tests for user flows
- [ ] RBAC permissions verified
- [ ] No lint errors
- [ ] No TypeScript errors
- [ ] Accessibility checked (axe-core)
- [ ] Performance impact assessed

---

## Summary

**Testability Status:** ✅ PASS (with concerns)

**Overall Assessment:**
The Sentinel-GRC architecture is fundamentally testable with good observability and controllability through Firebase emulators. The main concerns are around test isolation and missing test infrastructure components (factories, fixtures).

**Key Strengths:**
- 32+ E2E specs already exist
- Firebase emulators enable isolated testing
- Error logging and monitoring in place
- Recent security hardening completed

**Priority Actions:**
1. Create test data factories
2. Add component testing layer
3. Enhance CI with Lighthouse and security scanning
4. Fix test isolation concerns

**Next Steps:**
- Run `/bmad:bmm:workflows:testarch-framework` to set up enhanced test infrastructure
- Run `/bmad:bmm:workflows:testarch-ci` to configure CI pipeline
