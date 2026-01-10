# Story 1.1: Locale Configuration Centralisée

Status: done

## Story

As a **developer**,
I want **a centralized locale configuration file**,
So that **all date and number formats are consistent across the application**.

## Acceptance Criteria

1. **Given** the application is loaded
   **When** the user's locale is detected (FR or EN)
   **Then** all dates display in the correct format (FR: dd/MM/yyyy, EN: MM/dd/yyyy)

2. **Given** a user with FR locale
   **When** viewing any number display
   **Then** numbers use comma as decimal separator and space as thousands separator

3. **Given** a user with EN locale
   **When** viewing any number display
   **Then** numbers use period as decimal separator and comma as thousands separator

4. **Given** a form with date validation
   **When** using Zod schemas
   **Then** date parsing respects the user's locale format

5. **Given** localeConfig is created
   **When** any component needs date/number formatting
   **Then** it imports from `src/config/localeConfig.ts` (single source of truth)

## Tasks / Subtasks

- [x] **Task 1: Create localeConfig.ts** (AC: 1, 2, 3, 5)
  - [x] 1.1 Create `src/config/localeConfig.ts` file
  - [x] 1.2 Define LocaleConfig TypeScript interface
  - [x] 1.3 Implement FR locale configuration (dateFormat, dateTimeFormat, numberFormat)
  - [x] 1.4 Implement EN locale configuration
  - [x] 1.5 Export helper functions: `getLocaleConfig()`, `formatDate()`, `formatNumber()`
  - [x] 1.6 Add JSDoc documentation

- [x] **Task 2: Integrate with date-fns** (AC: 1)
  - [x] 2.1 Import date-fns/locale (fr, enUS)
  - [x] 2.2 Create `getDateFnsLocale()` helper returning correct locale object
  - [x] 2.3 Create `parseLocalizedDate()` function for parsing user input
  - [x] 2.4 Create `formatLocalizedDate()` function for display

- [x] **Task 3: Integrate with Zod validation** (AC: 4)
  - [x] 3.1 Create `createLocalizedDateSchema()` factory function
  - [x] 3.2 Define locale-aware Zod error messages (zodMessages in localeConfig)
  - [x] 3.3 Export `zodDateSchema` that uses locale-aware parsing

- [x] **Task 4: Create useLocale hook** (AC: 1, 2, 3)
  - [x] 4.1 Create `src/hooks/useLocale.ts`
  - [x] 4.2 Hook reads current language from existing i18n context
  - [x] 4.3 Returns localeConfig, formatDate, formatNumber, parseDate functions
  - [x] 4.4 Memoize returned values for performance

- [x] **Task 5: Write unit tests** (AC: all)
  - [x] 5.1 Test FR date formatting (dd/MM/yyyy)
  - [x] 5.2 Test EN date formatting (MM/dd/yyyy)
  - [x] 5.3 Test FR number formatting (1 234,56)
  - [x] 5.4 Test EN number formatting (1,234.56)
  - [x] 5.5 Test Zod schema validates FR dates
  - [x] 5.6 Test Zod schema validates EN dates
  - [x] 5.7 Test edge cases (leap year, invalid dates)

## Dev Notes

### Architecture Compliance (ADR-001)

Cette story implémente **ADR-001: Locale Configuration Centralisée** de `architecture.md`.

**Pattern requis:**
```typescript
// src/config/localeConfig.ts
export const localeConfig = {
  fr: {
    dateFormat: 'dd/MM/yyyy',
    dateTimeFormat: 'dd/MM/yyyy HH:mm',
    numberFormat: { decimal: ',', thousands: ' ' },
    zodMessages: { /* messages FR */ }
  },
  en: {
    dateFormat: 'MM/dd/yyyy',
    dateTimeFormat: 'MM/dd/yyyy HH:mm',
    numberFormat: { decimal: '.', thousands: ',' },
    zodMessages: { /* messages EN */ }
  }
};
```

### Project Structure Notes

**Fichiers à créer:**
- `src/config/localeConfig.ts` - Configuration centrale (nouveau)
- `src/hooks/useLocale.ts` - Hook React (nouveau)
- `src/config/__tests__/localeConfig.test.ts` - Tests unitaires (nouveau)

**Fichiers existants à NE PAS modifier (cette story):**
- `src/i18n/translations.ts` - Contient déjà les traductions FR/EN (sera utilisé par Story 1.2)
- Formulaires existants - Seront migrés dans les stories suivantes

**Dépendances existantes (déjà installées):**
- `date-fns` v4.1.0 - Pour formatage/parsing dates
- `zod` - Via @hookform/resolvers

### Technical Requirements

**TypeScript strict:**
- Utiliser `as const` pour les objets de config
- Définir interfaces explicites: `LocaleConfig`, `NumberFormatConfig`
- Exporter les types pour réutilisation

**Pattern de formatage des nombres:**
```typescript
export function formatNumber(value: number, locale: 'fr' | 'en'): string {
  const config = localeConfig[locale].numberFormat;
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US').format(value);
}
```

**Pattern de parsing des dates:**
```typescript
import { parse, format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

export function parseLocalizedDate(dateString: string, locale: 'fr' | 'en'): Date | null {
  const formatStr = localeConfig[locale].dateFormat;
  const localeObj = locale === 'fr' ? fr : enUS;
  try {
    return parse(dateString, formatStr, new Date(), { locale: localeObj });
  } catch {
    return null;
  }
}
```

### Testing Standards

**Framework:** Vitest (déjà configuré)

**Test file location:** `src/config/__tests__/localeConfig.test.ts`

**Minimum coverage:** 70% (NFR-M1)

**Test patterns:**
```typescript
describe('localeConfig', () => {
  describe('formatDate', () => {
    it('formats FR dates as dd/MM/yyyy', () => {
      const date = new Date(2026, 0, 15); // 15 Jan 2026
      expect(formatDate(date, 'fr')).toBe('15/01/2026');
    });

    it('formats EN dates as MM/dd/yyyy', () => {
      const date = new Date(2026, 0, 15);
      expect(formatDate(date, 'en')).toBe('01/15/2026');
    });
  });
});
```

### References

- [Source: architecture.md#ADR-001] - Locale Configuration Centralisée decision
- [Source: epics.md#Story-1.1] - Story requirements
- [Source: prd.md#FR1-FR2] - Functional requirements for locale handling
- [Source: ux-design-specification.md#Design-System] - Font: Inter, formats FR/EN

### Integration Points

**Cette story établit les fondations pour:**
- Story 1.2: Humanized Error Messages (utilisera zodMessages)
- Story 1.3: Draft Mode (validation relaxée)
- Story 1.4: Auto-save (indicateurs visuels)
- Story 1.5: Live Validation (utilisera le hook useLocale)

**NE PAS implémenter dans cette story:**
- Migration des formulaires existants (stories futures)
- Messages d'erreur humanisés (Story 1.2)
- Composants UI (pas de changements visuels)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Completion Notes List

- [x] localeConfig.ts créé et exporté
- [x] Intégration date-fns fonctionnelle
- [x] Zod schemas locale-aware créés
- [x] Hook useLocale créé
- [x] Tests unitaires passent (97.77% coverage - exceeds 70% requirement)
- [x] TypeScript strict mode validé (build successful)
- [x] Aucune régression introduite

### Implementation Summary

**ADR-001 Implementation Complete:**
- Created centralized locale configuration following the exact pattern specified in architecture.md
- Added bonus features: `formatCurrency()`, `formatPercentage()`, `createLocalizedNumberSchema()`
- Full TypeScript strict mode compliance with `as const satisfies` pattern
- Comprehensive JSDoc documentation for all exports

**Test Coverage:**
- 63 unit tests, all passing
- 97.77% line coverage for localeConfig.ts
- Tests cover FR/EN locales, edge cases (leap year, invalid dates), and Zod validation

### File List

**Files Created:**
- `src/config/localeConfig.ts` (429 lines) - Central locale configuration with all formatting functions
- `src/hooks/useLocale.ts` (127 lines) - React hook for accessing locale utilities
- `src/config/__tests__/localeConfig.test.ts` (338 lines) - Comprehensive unit tests

**Files Modified:**
- None (greenfield implementation as specified)

### Acceptance Criteria Verification

| AC | Status | Verification |
|----|--------|--------------|
| AC1: FR date format dd/MM/yyyy | ✅ | `formatDate(date, 'fr')` returns '15/01/2026' |
| AC2: FR numbers comma/space | ✅ | `formatNumber(1234.56, 'fr')` returns '1 234,56' |
| AC3: EN numbers period/comma | ✅ | `formatNumber(1234.56, 'en')` returns '1,234.56' |
| AC4: Zod locale-aware | ✅ | `createLocalizedDateSchema('fr')` validates FR format |
| AC5: Single source of truth | ✅ | All imports from `src/config/localeConfig.ts` |

### Integration Ready

This story establishes the foundation for:
- Story 1.2: Humanized Error Messages (zodMessages already exported)
- Story 1.5: Live Validation (useLocale hook ready)
