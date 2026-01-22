# Story VOX-1.1: R3F Canvas Integration

Status: done

## Story

As a **user**,
I want **to see a 3D canvas when I navigate to the Voxel module**,
so that **I can visualize my organization's GRC data spatially**.

## Acceptance Criteria

1. **[AC1]** ✅ Lazy-loaded route `/voxel` exists in AnimatedRoutes.tsx
2. **[AC2]** ✅ VoxelCanvas component renders React Three Fiber Canvas
3. **[AC3]** ✅ Canvas occupies full viewport minus toolbar (48px)
4. **[AC4]** ✅ Basic lighting setup (ambient + directional) is configured
5. **[AC5]** ✅ OrbitControls from @react-three/drei is integrated
6. **[AC6]** ✅ Canvas has dark background (#0F172A) per Digital Galaxy theme
7. **[AC7]** ✅ ErrorBoundary wraps Canvas with fallback to VoxelErrorFallback
8. **[AC8]** ✅ Suspense fallback shows VoxelSkeleton during canvas initialization

## Tasks / Subtasks

- [x] **Task 1: Create VoxelPage route entry point** (AC: #1, #8)
  - [x] 1.1 Create `src/pages/VoxelPage.tsx` with lazy-loaded VoxelViewer
  - [x] 1.2 Add `/voxel` route to `src/components/layout/AnimatedRoutes.tsx` with Suspense wrapper
  - [x] 1.3 Add i18n keys `voxel.loading`, `voxel.title` to both locales

- [x] **Task 2: Create VoxelCanvas component** (AC: #2, #3, #6)
  - [x] 2.1 Create `src/components/voxel/VoxelCanvas.tsx` with R3F Canvas
  - [x] 2.2 Configure Canvas props: `shadows`, `dpr`, `gl` settings
  - [x] 2.3 Set canvas styling to fill viewport minus 48px toolbar
  - [x] 2.4 Set dark background color (#0F172A)

- [x] **Task 3: Create VoxelScene component** (AC: #4, #5)
  - [x] 3.1 Create `src/components/voxel/VoxelScene.tsx` with scene setup
  - [x] 3.2 Add ambient light (intensity 0.4)
  - [x] 3.3 Add directional light (position [10, 10, 10], intensity 0.6)
  - [x] 3.4 Integrate OrbitControls from @react-three/drei
  - [x] 3.5 Configure OrbitControls with damping and limits

- [x] **Task 4: Create VoxelViewer wrapper** (AC: #7, #8)
  - [x] 4.1 Create `src/components/voxel/VoxelViewer.tsx` with ErrorBoundary
  - [x] 4.2 Create `src/components/voxel/fallback/VoxelSkeleton.tsx`
  - [x] 4.3 Create `src/components/voxel/fallback/VoxelErrorBoundary.tsx`
  - [x] 4.4 Ensure graceful degradation on WebGL errors

- [x] **Task 5: Write unit tests** (AC: all)
  - [x] 5.1 Create `src/components/voxel/__tests__/VoxelCanvas.test.tsx`
  - [x] 5.2 Create `src/components/voxel/__tests__/VoxelViewer.test.tsx`
  - [x] 5.3 Test route renders correctly
  - [x] 5.4 Test ErrorBoundary catches canvas errors
  - [x] 5.5 Achieve >70% coverage for new files

- [x] **Task 6: Update module exports** (AC: all)
  - [x] 6.1 Update `src/components/voxel/index.ts` with new exports
  - [x] 6.2 Verify TypeScript strict mode passes
  - [x] 6.3 Verify ESLint passes

## Dev Notes

### Architecture Constraints

- **Voxel prefix required**: All new components must use `Voxel` prefix
- **Store communication**: 3D components communicate with HTML via `voxelStore` only
- **No direct imports**: 3D components (Canvas children) never import HTML overlays
- **ErrorBoundary mandatory**: Always wrap `<Canvas>` in ErrorBoundary
- **Reduced motion support**: Check `prefers-reduced-motion` for all animations

### Existing Infrastructure

The project already has substantial Voxel infrastructure:

| Component | Status | Path |
|-----------|--------|------|
| Zustand Store | ✅ Complete | `src/stores/voxel/` |
| Types | ✅ Complete | `src/types/voxel.ts` |
| VoxelNode type | ✅ Defined | position: `{x, y, z}` format |
| VoxelEdge type | ✅ Defined | source/target with type/weight |
| Selectors | ✅ Complete | `src/stores/voxel/selectors.ts` |

### R3F Specific Rules

```typescript
// ✅ Correct: Use useFrame for animations
useFrame((state, delta) => {
  if (!prefersReduced && meshRef.current) {
    meshRef.current.rotation.y += delta * 0.5;
  }
});

// ❌ Wrong: Never use setInterval in R3F
setInterval(() => { /* animation */ }, 16);
```

```typescript
// ✅ Correct: Typed mesh refs
const meshRef = useRef<THREE.Mesh>(null);

// ❌ Wrong: Untyped refs
const meshRef = useRef(null);
```

### Canvas Configuration Reference

```typescript
// Per Architecture doc
<Canvas
  shadows
  dpr={[1, 2]}
  gl={{
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  }}
  style={{ background: '#0F172A' }}
>
  <VoxelScene />
</Canvas>
```

### OrbitControls Configuration Reference

```typescript
// Per Architecture doc
<OrbitControls
  enableDamping
  dampingFactor={0.05}
  rotateSpeed={0.5}
  maxPolarAngle={Math.PI * 0.9}
  minPolarAngle={Math.PI * 0.1}
  minDistance={50}
  maxDistance={2000}
/>
```

### Project Structure Notes

**Files to Create:**
```
src/
├── pages/
│   └── VoxelPage.tsx                    # NEW
├── components/voxel/
│   ├── VoxelCanvas.tsx                  # NEW
│   ├── VoxelScene.tsx                   # NEW
│   ├── VoxelViewer.tsx                  # NEW
│   ├── fallback/
│   │   ├── VoxelSkeleton.tsx            # NEW
│   │   └── VoxelErrorBoundary.tsx       # NEW
│   └── __tests__/
│       ├── VoxelCanvas.test.tsx         # NEW
│       └── VoxelViewer.test.tsx         # NEW
```

**Files to Modify:**
```
src/
├── App.tsx                              # Add /voxel route
├── components/voxel/index.ts            # Add exports
├── locales/en.json                      # Add voxel.* keys
└── locales/fr.json                      # Add voxel.* keys
```

### i18n Keys Required

```json
// locales/en.json
{
  "voxel": {
    "title": "3D Visualization",
    "loading": "Loading 3D environment...",
    "error": "Unable to load 3D visualization",
    "fallback": "Your browser doesn't support WebGL. Showing 2D view."
  }
}

// locales/fr.json
{
  "voxel": {
    "title": "Visualisation 3D",
    "loading": "Chargement de l'environnement 3D...",
    "error": "Impossible de charger la visualisation 3D",
    "fallback": "Votre navigateur ne supporte pas WebGL. Affichage en 2D."
  }
}
```

### Testing Strategy

**Unit Tests Required:**
- VoxelCanvas renders without crashing
- VoxelScene contains expected lights and controls
- VoxelViewer displays skeleton during load
- ErrorBoundary catches WebGL errors and shows fallback
- Route `/voxel` is accessible and renders VoxelPage

**Mock Pattern for R3F:**
```typescript
// Mock R3F Canvas for testing
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
  useFrame: vi.fn(),
  useThree: () => ({
    gl: { domElement: document.createElement('canvas') },
    camera: {},
    scene: {},
  }),
}));
```

### Performance Targets

- Canvas initialization: <2s
- First contentful render: <1s
- Memory footprint: <100MB for empty scene

### Dependencies Check

**Already installed** (per package.json):
- `@react-three/fiber: ^9.0.0-rc.3`
- `three: ^0.170.0`
- `@react-three/drei: ^9.120.0`
- `@react-three/postprocessing: ^2.16.3`

### References

- [Source: _bmad-output/planning-artifacts/architecture-voxel-module-2026-01-22.md#VoxelCanvas]
- [Source: _bmad-output/planning-artifacts/epics-voxel-module-2026-01-22.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/prd-voxel-module-2026-01-22.md#FR1]
- [Source: _bmad-output/project-context.md#3D/Voxel Module Rules]
- [Source: src/stores/voxel/index.ts - Existing Zustand store]
- [Source: src/types/voxel.ts - Existing type definitions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript errors fixed: Removed unused imports (THREE), unused parameters (delta, onError, props)
- Added window.matchMedia mock for JSDOM testing environment
- All 118 tests passing in src/components/voxel/

### Completion Notes List

1. Created VoxelPage as entry point with SEO, PageHeader, and lazy-loaded VoxelViewer
2. Added route to AnimatedRoutes.tsx (not App.tsx - project uses AnimatedRoutes for routing)
3. Implemented VoxelCanvas with R3F Canvas, proper GL configuration, and Digital Galaxy theme background
4. Implemented VoxelScene with ambient + directional + point lights, OrbitControls, Grid, and Stars
5. Added prefers-reduced-motion support for accessibility
6. Created VoxelErrorBoundary with WebGL-specific error messaging and retry functionality
7. Created VoxelSkeleton with animated loading cube
8. All components follow Voxel prefix naming convention per architecture
9. i18n keys added to both en and fr translation files

### File List

**Files Created:**
- `src/pages/VoxelPage.tsx`
- `src/components/voxel/VoxelCanvas.tsx`
- `src/components/voxel/VoxelScene.tsx`
- `src/components/voxel/VoxelViewer.tsx`
- `src/components/voxel/fallback/VoxelSkeleton.tsx`
- `src/components/voxel/fallback/VoxelErrorBoundary.tsx`
- `src/components/voxel/__tests__/VoxelCanvas.test.tsx`
- `src/components/voxel/__tests__/VoxelViewer.test.tsx`

**Files Modified:**
- `src/components/layout/AnimatedRoutes.tsx` (added VoxelPage lazy import and /voxel route)
- `src/components/voxel/index.ts` (added new component exports)
- `public/locales/en/translation.json` (added voxel.* i18n keys)
- `public/locales/fr/translation.json` (added voxel.* i18n keys)
