# Epic 37 Retrospective: Third-Party Risk Management (TPRM)

## Summary

Epic 37 implemented a comprehensive Third-Party Risk Management module for Sentinel GRC v2, enabling RSSIs to assess, monitor, and manage vendor risks in compliance with DORA Article 28 requirements.

## Stories Completed

| Story | Title | Status | Key Deliverables |
|-------|-------|--------|------------------|
| 37-1 | Vendor Assessment Creation | Dev Complete | Assessment builder, questionnaire templates, risk scoring |
| 37-2 | Vendor Self-Service Portal | Dev Complete | Portal UI, token-based access, submission workflow |
| 37-3 | Automated Vendor Scoring | Dev Complete | Scoring algorithm, risk indicators, periodic recalculation |
| 37-4 | Vendor Concentration Dashboard | Dev Complete | HHI analysis, SPOF detection, diversification recommendations |

## What Went Well

1. **Type System Integration**
   - Strong TypeScript typing throughout the TPRM module
   - Proper Zod schemas for validation
   - Clean separation between form types and Firestore types

2. **Component Architecture**
   - Reusable components (CategoryChart, DependencyMatrix, SPOFAlerts)
   - Consistent Apple-style design language
   - Full i18n support (FR/EN)

3. **Test Coverage**
   - 54 unit tests for VendorConcentrationService
   - Utility function coverage for HHI calculation, SPOF detection

4. **Feature Richness**
   - HHI (Herfindahl-Hirschman Index) for concentration measurement
   - SPOF detection with multiple criteria
   - Interactive drill-down visualizations
   - Actionable diversification recommendations

## Challenges Encountered

1. **Firebase Timestamp Types**
   - `FirestoreTimestampLike` vs `string` type mismatches between form data and Firestore models
   - Required careful type handling in form components

2. **Icon Import Paths**
   - Inconsistent icon imports (lucide-react vs ../ui/Icons wrapper)
   - Resolved by standardizing on project's Icons.tsx wrapper

3. **UI Component Casing**
   - File casing inconsistencies (button.tsx vs Button.tsx)
   - Need for consistent naming convention

## Recommendations for Future Epics

1. **Type Consistency**
   - Create dedicated form types separate from Firestore entity types
   - Use `z.infer<typeof schema>` for form types

2. **Icon Management**
   - Always use the project's Icons.tsx wrapper
   - Add missing icons to Icons.tsx before use

3. **Toast API**
   - Use `toast.success()/toast.error()` pattern consistently
   - Avoid useToast hook pattern that doesn't exist

4. **UI Component Imports**
   - Use lowercase for UI primitives: `../ui/button`, `../ui/card`
   - Use PascalCase for complex components: `../ui/Badge`

## Metrics

- **Files Created**: ~15 new files
- **Lines of Code**: ~3,500 lines
- **Test Count**: 54 tests
- **i18n Keys Added**: ~80 translations (FR/EN)

## Next Steps

Epic 38 (ANSSI Homologation) and Epic 39 (Financial Risk Quantification) can proceed with lessons learned applied:
- Consistent type patterns
- Standardized import paths
- Toast API consistency

---

*Retrospective completed: 2026-01-21*
