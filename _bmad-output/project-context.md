---
project_name: 'sentinel-grc-v2-prod'
user_name: 'Thibaultllopis'
date: '2026-01-22'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 45
optimized_for_llm: true
---

# Project Context for AI Agents

_Règles critiques et patterns que les agents AI doivent suivre lors de l'implémentation. Focus sur les détails non-évidents._

---

## Technology Stack & Versions

### Core Stack

| Technology | Version | Notes |
|------------|---------|-------|
| React | ^19.2.1 | Concurrent features enabled |
| TypeScript | ^5.7.2 | **Strict mode obligatoire** |
| Vite | ^6.0.3 | HMR + tree-shaking |
| Zustand | ^5.0.1 | State management |
| @tanstack/react-query | ^5.90.12 | Data fetching + cache |
| Firebase | ^12.8.0 | Auth + Firestore |
| Tailwind CSS | ^3.4.1 | Utility-first |

### 3D Stack (Module Voxel)

| Technology | Version | Notes |
|------------|---------|-------|
| @react-three/fiber | ^9.0.0-rc.3 | React renderer for Three.js |
| three | ^0.170.0 | WebGL library |
| @react-three/drei | ^9.120.0 | R3F helpers |
| @react-three/postprocessing | ^2.16.3 | Effects (Bloom) |

### Testing Stack

| Technology | Version | Notes |
|------------|---------|-------|
| Vitest | ^2.1.8 | Unit + integration |
| @testing-library/react | ^16.3.0 | Component testing |
| Playwright | ^1.57.0 | E2E testing |

---

## Critical Implementation Rules

### TypeScript Rules

- ✅ **Strict mode obligatoire** — `tsconfig.json` has `strict: true`
- ✅ **Path aliases** — Use `@/*` for imports from `src/`
- ✅ **No `any`** — Use `unknown` + type guards instead
- ✅ **Zod validation** — Use `safeParse` (sync) over `parseAsync`
- ❌ **Never** use `// @ts-ignore` — Fix the type instead

```typescript
// ✅ Correct
import { ErrorLogger } from '@/services/errorLogger';

// ❌ Wrong
import { ErrorLogger } from '../../services/errorLogger';
```

### React Rules

- ✅ **Hooks order** — `useRef` → `useState` → `useMemo` → `useEffect`
- ✅ **Double-click prevention** — Use `useRef` for synchronous guards
- ✅ **Expensive calculations** — Always wrap in `useMemo`
- ✅ **Event handlers** — Use `useCallback` when passed to children
- ❌ **Never** update state in render — Use effects or callbacks

```typescript
// ✅ Double-click prevention pattern
const isSubmittingRef = useRef(false);
const handleSubmit = async () => {
  if (isSubmittingRef.current) return;
  isSubmittingRef.current = true;
  try {
    await submitData();
  } finally {
    isSubmittingRef.current = false;
  }
};
```

### Zustand Rules

- ✅ **Fine-grained selectors** — Never destructure entire store
- ✅ **Shallow comparison** — Use `shallow` for object/array selectors
- ✅ **Actions naming** — `verb` + `Noun` (e.g., `selectNode`, `setFilters`)
- ❌ **Never** direct mutation — Always use immutable updates

```typescript
// ✅ Correct - fine-grained selector
const selectedId = useVoxelStore(state => state.selectedNodeId);

// ❌ Wrong - over-subscription
const { selectedNodeId, nodes, edges } = useVoxelStore();
```

### Firebase/Firestore Rules

- ✅ **organizationId filtering** — ALL queries must include `where('organizationId', '==', orgId)`
- ✅ **serverTimestamp()** — Use for `createdAt`/`updatedAt` fields
- ✅ **Auto-generated IDs** — Let Firestore generate document IDs
- ❌ **Never** cache sensitive data in localStorage
- ❌ **Never** expose Firebase config in client-side logs

```typescript
// ✅ Correct - always filter by org
const q = query(
  collection(db, 'assets'),
  where('organizationId', '==', user.organizationId)
);
```

### Service Pattern Rules

- ✅ **Static methods** — Services use `ServiceName.methodName()` pattern
- ✅ **Error handling** — Always use `ErrorLogger.handleErrorWithToast()`
- ✅ **PascalCase files** — `ImportService.ts`, `ErrorLogger.ts`
- ✅ **Logging** — Use `logAction()` for audit trail

```typescript
// ✅ Correct service pattern
export class ComplianceService {
  static async getScore(orgId: string): Promise<number> {
    try {
      return await fetchScore(orgId);
    } catch (error) {
      ErrorLogger.handleErrorWithToast(error, 'compliance.fetchError', addToast);
      throw error;
    }
  }
}
```

---

## 3D/Voxel Module Rules

### Component Naming

- ✅ **Voxel prefix** — All 3D components: `VoxelCanvas`, `VoxelNode`, `VoxelEdge`
- ✅ **Centralized types** — All types in `types/voxel.ts`
- ❌ **Never** inline complex types in components

### R3F Rules

- ✅ **useFrame** — Use for animations, never `setInterval`
- ✅ **Vector3 class** — Use `new Vector3()`, not arrays for calculations
- ✅ **Refs with types** — `useRef<THREE.Mesh>(null)`
- ✅ **prefers-reduced-motion** — Check and respect user preference

```typescript
// ✅ Correct R3F animation
const prefersReduced = usePrefersReducedMotion();
useFrame((_, delta) => {
  if (!prefersReduced && meshRef.current) {
    meshRef.current.rotation.y += delta * 0.5;
  }
});
```

### 3D/HTML Boundary

- ✅ **No direct imports** — 3D components never import HTML overlays
- ✅ **Communication via store** — Use `voxelStore` for 3D↔HTML communication
- ✅ **ErrorBoundary required** — Wrap `<Canvas>` in ErrorBoundary

```typescript
// ✅ Correct boundary
<ErrorBoundary fallback={<VoxelFallback2D />}>
  <Canvas>
    <VoxelScene />
  </Canvas>
</ErrorBoundary>
```

---

## Testing Rules

### Test Organization

- ✅ **Location** — Tests in `__tests__/` subdirectory of module
- ✅ **Naming** — `*.test.tsx` for components, `*.test.ts` for services
- ❌ **Never** use `*.spec.ts` — Use `.test.ts` for consistency

### Mock Patterns

```typescript
// ✅ Firebase mock pattern
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: () => 'server-timestamp'
}));

// ✅ Store mock pattern
vi.mock('@/stores/voxelStore', () => ({
  useVoxelStore: vi.fn()
}));
```

### Coverage Requirements

- ✅ **Minimum** — 70% coverage (NFR-M1)
- ✅ **Critical paths** — 100% coverage for auth, RBAC, data mutations

---

## Design System Rules

### Apple Style Typography

- ✅ **Font classes** — `font-apple`, `font-display`, `font-mono`
- ✅ **Shadows** — `shadow-apple`, `shadow-apple-md`, `shadow-apple-xl`
- ✅ **Glass effects** — `glass-panel`, `glass-premium`
- ✅ **Rounded corners** — Large radius (`rounded-2xl` to `rounded-5xl`)

### Animation

- ✅ **Spring-based** — Use `cubic-bezier(0.16, 1, 0.3, 1)`
- ✅ **Framer Motion** — Preferred for complex animations
- ✅ **Respect reduced motion** — Check `prefers-reduced-motion`

---

## i18n Rules

- ✅ **Hook usage** — Use `useStore().t()` for translations
- ✅ **Key format** — `module.action` (e.g., `voxel.loading`, `compliance.score`)
- ✅ **Files** — Add keys to both `locales/en.json` and `locales/fr.json`
- ❌ **Never** hardcode user-facing strings

---

## Critical Anti-Patterns

### DO NOT

| Anti-Pattern | Why | Instead Do |
|--------------|-----|------------|
| `any` type | Loses type safety | Use `unknown` + guards |
| Direct store destructure | Over-subscription | Fine-grained selectors |
| `localStorage` for sensitive data | Security risk | Use Firestore only |
| `setInterval` in R3F | Frame sync issues | Use `useFrame` |
| Skip `organizationId` filter | Data leak | Always filter by org |
| Inline complex types | Maintenance hell | Centralize in `types/` |
| `// @ts-ignore` | Hides real issues | Fix the type |
| Push to main without PR | No review | Use feature branches |

### Edge Cases to Handle

- ✅ **WebGL unavailable** — Fallback to 2D view
- ✅ **Mobile devices** — No 3D, show alternative UI
- ✅ **Empty data** — Show meaningful empty states
- ✅ **Network errors** — Use `ErrorLogger` + toast
- ✅ **Session timeout** — Redirect to login

---

## Development Workflow

### Branch Naming

```
feature/VOX-123-description
bugfix/VOX-456-fix-description
hotfix/critical-issue
```

### Commit Format

```
type(scope): description

feat(voxel): add node selection
fix(auth): handle session timeout
test(compliance): add score calculation tests
```

### PR Checklist

- [ ] TypeScript strict mode passes
- [ ] Tests pass with >70% coverage
- [ ] No `any` types
- [ ] i18n keys in both locales
- [ ] Accessibility checked (WCAG 2.1 AA)

---

**Document Status:** READY FOR AI AGENTS ✅

**Last Updated:** 2026-01-22
