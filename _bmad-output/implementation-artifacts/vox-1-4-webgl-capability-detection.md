# Story VOX-1.4: WebGL Capability Detection

Status: done

## Story

As a **user without WebGL support**,
I want **to see a clear message and alternative**,
So that **I can still access GRC data through another view**.

## Acceptance Criteria

1. **[AC1]** ✅ useWebGLCapability hook detects WebGL 2.0, 1.0, or none
2. **[AC2]** ✅ If WebGL unavailable, VoxelFallback2D component renders
3. **[AC3]** ✅ Fallback message includes link to classic dashboard (/ctc-engine)
4. **[AC4]** ✅ Mobile devices (<768px) automatically get 2D fallback
5. **[AC5]** ✅ Error boundary catches WebGL runtime errors

## Tasks / Subtasks

- [x] **Task 1: Create useWebGLCapability hook** (AC: #1)
  - [x] 1.1 Create `src/hooks/voxel/useWebGLCapability.ts`
  - [x] 1.2 Implement WebGL 2.0 detection
  - [x] 1.3 Implement WebGL 1.0 fallback detection
  - [x] 1.4 Implement 'none' state for no WebGL support
  - [x] 1.5 Add GPU info extraction (renderer, vendor)
  - [x] 1.6 Export from hooks/voxel/index.ts

- [x] **Task 2: Create VoxelFallback2D component** (AC: #2, #3)
  - [x] 2.1 Create `src/components/voxel/fallback/VoxelFallback2D.tsx`
  - [x] 2.2 Implement reason-based messaging (mobile, no-webgl, error)
  - [x] 2.3 Add link to /ctc-engine alternative view
  - [x] 2.4 Add system requirements section for WebGL issues
  - [x] 2.5 Export from components/voxel/index.ts

- [x] **Task 3: Implement mobile detection** (AC: #4)
  - [x] 3.1 Add checkIsMobile function in useWebGLCapability
  - [x] 3.2 Check viewport width (<768px)
  - [x] 3.3 Check touch capability and user agent
  - [x] 3.4 Compute shouldShow3D based on mobile and WebGL status

- [x] **Task 4: Update VoxelViewer integration** (AC: #2, #4, #5)
  - [x] 4.1 Import useWebGLCapability in VoxelViewer
  - [x] 4.2 Show VoxelFallback2D when shouldShow3D is false
  - [x] 4.3 Show loading skeleton during capability checking
  - [x] 4.4 Update ErrorBoundary to use VoxelFallback2D as fallback

- [x] **Task 5: Add i18n translations** (AC: #2, #3)
  - [x] 5.1 Add voxel.fallback.* keys to fr/translation.json
  - [x] 5.2 Add voxel.fallback.* keys to en/translation.json

- [x] **Task 6: Write unit tests** (AC: all)
  - [x] 6.1 Create `src/hooks/voxel/__tests__/useWebGLCapability.test.ts`
  - [x] 6.2 Create `src/components/voxel/__tests__/VoxelFallback2D.test.tsx`
  - [x] 6.3 Test WebGL 2.0/1.0/none detection
  - [x] 6.4 Test mobile detection
  - [x] 6.5 Test fallback reason messaging

## Dev Notes

### Implementation Details

#### useWebGLCapability Hook

The hook provides comprehensive WebGL capability detection:

```typescript
type WebGLCapability = 'webgl2' | 'webgl1' | 'none' | 'checking';

interface WebGLCapabilityInfo {
  capability: WebGLCapability;
  isAvailable: boolean;
  isMobile: boolean;
  shouldShow3D: boolean;  // !isMobile && isAvailable
  renderer?: string;      // GPU info
  vendor?: string;        // GPU vendor
  maxTextureSize?: number;
  maxVertexUniforms?: number;
}
```

Detection order:
1. Try `canvas.getContext('webgl2')` first
2. Fall back to `canvas.getContext('webgl')`
3. Try `canvas.getContext('experimental-webgl')` as last resort
4. Return 'none' if all fail

#### Mobile Detection

Mobile devices are detected by:
- Viewport width < 768px
- Touch capability + mobile user agent patterns
- Forces 2D fallback for better mobile experience

#### VoxelFallback2D Component

Supports multiple fallback reasons:
- `mobile`: Device is a mobile/tablet
- `no-webgl`: Browser doesn't support WebGL
- `webgl1-degraded`: Only WebGL 1.0 available
- `error`: Runtime WebGL error occurred

#### VoxelViewer Integration

```typescript
const { capability, shouldShow3D, isMobile } = useWebGLCapability();

// Show skeleton while checking
if (capability === 'checking') {
  return <VoxelSkeleton />;
}

// Show 2D fallback if needed
if (!shouldShow3D) {
  return <VoxelFallback2D reason={isMobile ? 'mobile' : 'no-webgl'} />;
}

// Render 3D canvas
return <VoxelCanvas />;
```

### Test Coverage

- 8 tests for useWebGLCapability hook
- 15 tests for VoxelFallback2D component
- All tests passing

### References

- [Source: src/hooks/voxel/useWebGLCapability.ts]
- [Source: src/components/voxel/fallback/VoxelFallback2D.tsx]
- [Source: src/components/voxel/VoxelViewer.tsx]
- [Tests: src/hooks/voxel/__tests__/useWebGLCapability.test.ts]
- [Tests: src/components/voxel/__tests__/VoxelFallback2D.test.tsx]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript check passed after removing unused imports
- All 23 tests passing for VOX-1.4 components

### Completion Notes List

1. Created useWebGLCapability hook with WebGL 2.0/1.0/none detection
2. Added GPU info extraction when debug extension available
3. Implemented mobile detection based on viewport and touch capability
4. Created VoxelFallback2D component with reason-based messaging
5. Integrated WebGL detection into VoxelViewer
6. Added i18n translations for both FR and EN locales
7. Wrote comprehensive unit tests (23 tests total)
8. All acceptance criteria verified and passing

### File List

**Files Created:**
- `src/hooks/voxel/useWebGLCapability.ts`
- `src/components/voxel/fallback/VoxelFallback2D.tsx`
- `src/hooks/voxel/__tests__/useWebGLCapability.test.ts`
- `src/components/voxel/__tests__/VoxelFallback2D.test.tsx`

**Files Modified:**
- `src/hooks/voxel/index.ts` (added useWebGLCapability export)
- `src/components/voxel/index.ts` (added VoxelFallback2D export)
- `src/components/voxel/VoxelViewer.tsx` (integrated WebGL detection)
- `public/locales/fr/translation.json` (added voxel.fallback.* keys)
- `public/locales/en/translation.json` (added voxel.fallback.* keys)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-22 | Story implemented with all acceptance criteria met | Claude Opus 4.5 |
