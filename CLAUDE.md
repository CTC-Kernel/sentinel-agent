# Sentinel GRC v2 - Project Context

> **Note:** Ce fichier contient les regles essentielles pour Claude Code.
> Pour les regles detaillees d'implementation, voir `_bmad-output/project-context.md`

---

## Hierarchy des Documents de Contexte

| Document | Usage | Localisation |
|----------|-------|--------------|
| **CLAUDE.md** (ce fichier) | Regles essentielles, quick reference | Racine projet |
| **project-context.md** | Regles detaillees AI, patterns complets | `_bmad-output/` |
| **Architecture docs** | ADRs, decisions techniques | `_bmad-output/planning-artifacts/` |

---

## Design System

### Typography - Apple Style

**Primary Design Principle:** This application follows Apple's design language for typography and visual aesthetics.

**Font Stack Priority:**
1. **SF Pro Display** - Headers and large text
2. **SF Pro Text** - Body text and UI elements
3. **SF Mono** - Code and monospace content

**Tailwind Classes:**
- `font-apple` - Apple system fonts (SF Pro)
- `font-display` - Display/heading fonts
- `font-mono` - SF Mono for code

**Usage Guidelines:**
- Use `-apple-system, BlinkMacSystemFont` for cross-platform Apple font support
- Prefer system fonts over web fonts for performance
- Apply Apple-style shadows: `shadow-apple`, `shadow-apple-md`, `shadow-apple-xl`

### Visual Language

- **Glass Morphism:** `glass-panel`, `glass-premium` classes for frosted glass effects
- **Rounded Corners:** Large border-radius (2xl-5xl) for Apple aesthetic
- **Shadows:** Soft, subtle shadows mimicking iOS/macOS
- **Animations:** Smooth, spring-based transitions (cubic-bezier 0.16, 1, 0.3, 1)

---

## Architecture Decisions

| ADR | Decision | Fichier |
|-----|----------|---------|
| ADR-001 | Locale Configuration - Centralized i18n with `useLocale()` hook | architecture.md |
| ADR-002 | Draft/Auto-save Pattern - `useDraftMode()` and `useAutoSave()` hooks | architecture.md |
| ADR-003 | Compliance Score - Apple Health-style gauge visualization | architecture.md |
| ADR-004 | Dashboard widgets configurables | architecture.md |
| ADR-005 | Multi-Framework Mapping | architecture.md |
| ADR-006 | SMSI Wizard | architecture.md |
| ADR-007 | Notifications | architecture.md |
| ADR-008 | DORA ICT Register | architecture.md |

---

## Code Patterns (Quick Reference)

### Hooks
- Use `useRef` for synchronous guards (double-click prevention)
- Use `useState` for UI state updates
- Use `useMemo` for expensive calculations

### Services
- Static methods in service classes: `ServiceName.methodName()`
- Error handling with `ErrorLogger` pattern

### Cloud Functions
- Use firebase-functions/v2 APIs
- Debounce triggers to avoid excessive recalculations

---

## Critical Rules (DO NOT SKIP)

| Rule | Details |
|------|---------|
| **TypeScript Strict** | `tsconfig.json` has `strict: true` - NO `any` types |
| **organizationId** | ALL Firestore queries MUST filter by `organizationId` |
| **Path aliases** | Use `@/*` for imports from `src/` |
| **Error handling** | Always use `ErrorLogger.handleErrorWithToast()` |
| **i18n** | Never hardcode user-facing strings |

---

## Testing

- **Framework:** Vitest (frontend), Jest (Cloud Functions)
- **Minimum Coverage:** 70% (NFR-M1)
- **Location:** `__tests__/` subdirectory
- Prefer synchronous `safeParse` over `parseAsync` for easier testing

---

## Project Structure

```
sentinel-grc-v2-prod/
├── _bmad/                    # BMAD configuration
├── _bmad-output/             # BMAD artifacts
│   ├── planning-artifacts/   # PRDs, Architecture, Epics
│   ├── implementation-artifacts/ # Stories
│   └── project-context.md    # Detailed AI rules
├── src/                      # Frontend source
├── functions/                # Cloud Functions
├── mobile/                   # Expo mobile app
└── CLAUDE.md                 # This file
```

---

## For Detailed Implementation Rules

See `_bmad-output/project-context.md` for:
- Complete TypeScript/React/Zustand rules
- 3D/Voxel module specific patterns
- Testing patterns and mocks
- Design system detailed rules
- i18n rules
- Critical anti-patterns
- Development workflow

---

*Last Updated: 2026-01-23*
