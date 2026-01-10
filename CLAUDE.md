# Sentinel GRC v2 - Project Context

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

## Architecture Decisions

- **ADR-001:** Locale Configuration - Centralized i18n with `useLocale()` hook
- **ADR-002:** Draft/Auto-save Pattern - `useDraftMode()` and `useAutoSave()` hooks
- **ADR-003:** Compliance Score - Apple Health-style gauge visualization

## Code Patterns

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

## Testing

- **Framework:** Vitest (frontend), Jest (Cloud Functions)
- **Minimum Coverage:** 70% (NFR-M1)
- Prefer synchronous `safeParse` over `parseAsync` for easier testing
