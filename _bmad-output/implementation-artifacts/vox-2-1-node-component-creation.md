# Story VOX-2.1: Node Component Creation

Status: done

## Story

As a **user**,
I want **to see my assets, risks, and controls as distinct 3D nodes**,
so that **I can identify them visually in the scene based on type, severity, and criticality**.

## Acceptance Criteria

1. **[AC1]** ✅ VoxelNode base component renders type-appropriate geometry
2. **[AC2]** ✅ Assets render as blue spheres (#3B82F6) with 16 segments
3. **[AC3]** ✅ Risks render as icosahedron geometry with severity-based colors
4. **[AC4]** ✅ Controls render as purple boxes (#8B5CF6)
5. **[AC5]** ✅ Node size scales with criticality (1-5) or severity (low-critical)
6. **[AC6]** ✅ Hover state: emissive +0.1, scale 1.05
7. **[AC7]** ✅ Selection state: emissive +0.15, scale 1.1
8. **[AC8]** ✅ NodeStyleResolver service provides centralized styling logic
9. **[AC9]** ✅ Inactive nodes show reduced opacity (0.5)
10. **[AC10]** ✅ Reduced motion support via prefers-reduced-motion

## Tasks / Subtasks

- [x] **Task 1: Create NodeStyleResolver service** (AC: #8, #5, #9)
  - [x] 1.1 Create `src/services/voxel/NodeStyleResolver.ts`
  - [x] 1.2 Implement NODE_TYPE_COLORS constants for all entity types
  - [x] 1.3 Implement RISK_SEVERITY_COLORS with daltonism-safe palette
  - [x] 1.4 Implement NODE_TYPE_GEOMETRIES mapping
  - [x] 1.5 Implement `getSizeFromCriticality()` function (1-5 → 0.5-2.0 multiplier)
  - [x] 1.6 Implement `getSizeFromSeverity()` function
  - [x] 1.7 Implement `resolveNodeStyle()` main style resolver
  - [x] 1.8 Implement `getHoverStyle()` and `getSelectionStyle()`
  - [x] 1.9 Export utility functions for type color/geometry lookup

- [x] **Task 2: Create VoxelNode base component** (AC: #1, #6, #7, #10)
  - [x] 2.1 Create `src/components/voxel/nodes/VoxelNode.tsx`
  - [x] 2.2 Create geometry sub-components (Sphere, Icosahedron, Box, etc.)
  - [x] 2.3 Integrate voxelStore for selection/hover state
  - [x] 2.4 Implement useFrame animation for smooth transitions
  - [x] 2.5 Implement usePrefersReducedMotion hook
  - [x] 2.6 Add userData to mesh for raycasting identification
  - [x] 2.7 Configure MeshStandardMaterial with PBR properties

- [x] **Task 3: Create type-specific node wrappers** (AC: #2, #3, #4)
  - [x] 3.1 Create `src/components/voxel/nodes/AssetNode.tsx`
  - [x] 3.2 Create `src/components/voxel/nodes/RiskNode.tsx`
  - [x] 3.3 Create `src/components/voxel/nodes/ControlNode.tsx`
  - [x] 3.4 Each wrapper enforces correct node type

- [x] **Task 4: Create VoxelNodeRenderer batch component**
  - [x] 4.1 Create `src/components/voxel/nodes/VoxelNodeRenderer.tsx`
  - [x] 4.2 Support rendering multiple nodes with type switching

- [x] **Task 5: Update module exports**
  - [x] 5.1 Create `src/components/voxel/nodes/index.ts`
  - [x] 5.2 Create `src/services/voxel/index.ts`
  - [x] 5.3 Update `src/components/voxel/index.ts` with node exports

- [x] **Task 6: Write unit tests** (AC: all)
  - [x] 6.1 Create `src/services/voxel/__tests__/NodeStyleResolver.test.ts`
  - [x] 6.2 Create `src/components/voxel/nodes/__tests__/VoxelNode.test.tsx`
  - [x] 6.3 Test all color constants
  - [x] 6.4 Test geometry mappings
  - [x] 6.5 Test size calculations
  - [x] 6.6 Test status modifications
  - [x] 6.7 Achieve >70% coverage for new files

## Dev Notes

### Architecture Constraints

- **Voxel prefix required**: All new components must use `Voxel` prefix
- **Store communication**: 3D components communicate with HTML via `voxelStore` only
- **Style centralization**: All styling logic in NodeStyleResolver, not scattered
- **Type safety**: Strict typing for VoxelNode, geometry types, and style interfaces

### Color Palette

| Entity Type | Color | Hex |
|-------------|-------|-----|
| Asset | Blue | #3B82F6 |
| Risk | Red (varies by severity) | #EF4444 |
| Control | Purple | #8B5CF6 |
| Incident | Orange | #F97316 |
| Supplier | Cyan | #06B6D4 |
| Project | Emerald | #10B981 |
| Audit | Indigo | #6366F1 |

### Risk Severity Colors (Daltonism-Safe)

| Severity | Color | Hex |
|----------|-------|-----|
| Critical | Red | #EF4444 |
| High | Orange | #F97316 |
| Medium | Yellow | #EAB308 |
| Low | Green | #22C55E |

### Geometry Mapping

| Entity Type | Geometry |
|-------------|----------|
| Asset | Sphere |
| Risk | Icosahedron |
| Control | Box |
| Incident | Octahedron |
| Supplier | Cylinder |
| Project | Sphere |
| Audit | Box |

### Size Calculation

```typescript
// Criticality 1-5 maps to 0.5x-2.0x base size multiplier
const getSizeFromCriticality = (criticality: number): number => {
  const normalized = Math.max(1, Math.min(5, criticality)) / 5;
  const multiplier = 0.5 + normalized * (2.0 - 0.5);
  return BASE_SIZE * multiplier;
};
```

### References

- [Source: _bmad-output/planning-artifacts/architecture-voxel-module-2026-01-22.md#VoxelNode]
- [Source: _bmad-output/planning-artifacts/epics-voxel-module-2026-01-22.md#Epic 2]
- [Source: _bmad-output/planning-artifacts/prd-voxel-module-2026-01-22.md#FR5-FR10]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed TypeScript errors: Removed unused `Vector3` import, changed `THREE.MeshStandardMaterial` to direct import
- Renamed `DEFAULT_STYLE` to `DEFAULT_NODE_STYLE` and exported it
- All 68 tests passing for new code

### Completion Notes List

1. Created NodeStyleResolver as centralized styling service with:
   - Type colors, severity colors, status colors
   - Geometry type mappings
   - Size calculation functions
   - Style resolution function with status modifications
   - PBR material properties (metalness 0.3, roughness 0.7)

2. Created VoxelNode base component with:
   - Dynamic geometry selection based on node type
   - Integration with voxelStore for selection/hover
   - useFrame animation for smooth scale/emissive transitions
   - usePrefersReducedMotion for accessibility
   - userData on mesh for raycasting identification

3. Created type-specific wrappers (AssetNode, RiskNode, ControlNode) for type safety

4. Created VoxelNodeRenderer for batch rendering with automatic type switching

5. 68 unit tests covering all functionality

### File List

**Files Created (VOX-2.1-2.3, 2.5):**
- `src/services/voxel/NodeStyleResolver.ts`
- `src/services/voxel/index.ts`
- `src/components/voxel/nodes/VoxelNode.tsx`
- `src/components/voxel/nodes/AssetNode.tsx`
- `src/components/voxel/nodes/RiskNode.tsx`
- `src/components/voxel/nodes/ControlNode.tsx`
- `src/components/voxel/nodes/VoxelNodeRenderer.tsx`
- `src/components/voxel/nodes/index.ts`
- `src/services/voxel/__tests__/NodeStyleResolver.test.ts`
- `src/components/voxel/nodes/__tests__/VoxelNode.test.tsx`

**Files Created (VOX-2.4 - Node Labels):**
- `src/components/voxel/nodes/VoxelNodeLabel.tsx`
- `src/components/voxel/nodes/__tests__/VoxelNodeLabel.test.tsx`

**Files Created (VOX-2.6 - LOD System):**
- `src/components/voxel/nodes/VoxelNodeLOD.tsx`
- `src/components/voxel/nodes/NodeHighDetail.tsx`
- `src/components/voxel/nodes/NodeMediumDetail.tsx`
- `src/components/voxel/nodes/NodeLowDetail.tsx`
- `src/components/voxel/nodes/__tests__/VoxelNodeLOD.test.tsx`

**Files Modified:**
- `src/components/voxel/nodes/VoxelNode.tsx` (added label support)
- `src/components/voxel/nodes/index.ts` (added all exports)
- `src/components/voxel/index.ts` (added node exports)

---

## VOX-2.4: Node Labels with HTML Overlay

### Acceptance Criteria (VOX-2.4)
- ✅ VoxelNodeLabel uses Html from @react-three/drei
- ✅ Labels always face camera (billboard effect)
- ✅ Distance-based visibility (fade at 70% threshold, hide beyond)
- ✅ Type badge support with entity-specific colors
- ✅ Selected/hovered nodes always show labels
- ✅ Apple-style typography with text shadows

### Implementation Details (VOX-2.4)
- `VoxelNodeLabel.tsx`: Html overlay component with distance-based opacity
- Integrated into `VoxelNode.tsx` with `showLabel` and `showTypeBadge` props
- French type labels: Asset, Risque, Contrôle, Incident, Fournisseur, Projet, Audit

---

## VOX-2.6: Node LOD System

### Acceptance Criteria (VOX-2.6)
- ✅ Three LOD levels: High (<50u), Medium (50-200u), Low (>200u)
- ✅ High detail: 32 segments, full PBR, labels with badge
- ✅ Medium detail: 16 segments, simplified PBR, no labels
- ✅ Low detail: 8 segments, basic material, no labels
- ✅ Smooth transitions via @react-three/drei Detailed component
- ✅ Custom LOD distances configurable

### LOD Configuration Table (VOX-2.6)

| Distance | Detail | Segments | Features |
|----------|--------|----------|----------|
| < 50u | High | 32 | Labels, glow, full PBR |
| 50-200u | Medium | 16 | Simplified PBR, no labels |
| > 200u | Low | 8 | Basic material, no labels |

### Implementation Details (VOX-2.6)
- `VoxelNodeLOD.tsx`: Wrapper using `Detailed` for automatic LOD switching
- `NodeHighDetail.tsx`: Full-fidelity rendering with labels and effects
- `NodeMediumDetail.tsx`: Balanced performance with simplified materials
- `NodeLowDetail.tsx`: Maximum performance with basic materials
