# Sentinel GRC v2 - Technical Architecture Overview

**Date:** 2026-01-22
**Version:** 2.0
**Status:** Production-Ready

---

## Executive Summary

Sentinel GRC v2 is a comprehensive Governance, Risk, and Compliance (GRC) platform built with React 19, Firebase, and Zustand state management. The codebase spans **1,556 TypeScript/TSX files** with approximately **384,000 lines of code** and **8,420+ tests**, following Apple's design language.

---

## 1. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.1 | UI framework |
| TypeScript | 5.7 | Type safety |
| Vite | 6.0 | Build tool |
| Tailwind CSS | 3.4 | Styling |
| Zustand | 5.0 | State management |
| React Query | 5.90 | Server state |
| React Hook Form | 7.66 | Form handling |
| Zod | 4.1 | Schema validation |

### Backend (Firebase)
| Service | Purpose |
|---------|---------|
| Firestore | Real-time NoSQL database |
| Authentication | User management, SSO, MFA |
| Cloud Functions | Serverless backend |
| Cloud Storage | File storage |
| App Check | Bot prevention |

### Visualization
| Library | Purpose |
|---------|---------|
| React Three Fiber | 3D WebGL rendering |
| Recharts | Charts and graphs |
| D3.js | Data visualization |
| Framer Motion | Animations |

---

## 2. Project Structure

```
src/
├── components/     # 62 feature directories (800+ components)
├── hooks/          # 205+ custom React hooks
├── services/       # 80+ service classes
├── stores/         # Zustand stores (main + voxel)
├── types/          # 27 domain type files
├── contexts/       # React contexts (auth, theme, crisis)
├── schemas/        # Zod validation schemas
├── i18n/           # Internationalization (fr/en)
├── views/          # Page components
├── config/         # App configuration
├── data/           # Static data & frameworks
├── middleware/     # Security middleware
└── workers/        # Web Workers
```

---

## 3. Core Modules

### GRC Domains
| Module | Location | Key Features |
|--------|----------|--------------|
| **Risk Management** | `components/risks/` | Assessment, matrix, treatments |
| **Control Management** | `components/controls/` | Framework mapping, maturity |
| **Audit Management** | `components/audits/` | Planning, questionnaires, evidence |
| **Asset Management** | `components/assets/` | Inventory, classification, dependencies |
| **Document Management** | `components/documents/` | Versioning, workflows, signatures |
| **Incident Management** | `components/incidents/` | Tracking, playbooks, timeline |
| **Project Management** | `components/projects/` | Gantt, milestones, tasks |
| **Supplier Management** | `components/suppliers/` | Assessments, scoring, portal |

### Compliance Frameworks
- ISO 27001, ISO 22301, ISO 27002
- NIST, CIS Controls
- GDPR, CCPA, HIPAA
- SOC 2, ITGC
- EBIOS RM (French methodology)
- DORA (EU financial regulation)
- ANSSI Homologation (French public sector)

### Advanced Features
| Module | Location | Purpose |
|--------|----------|---------|
| **Voxel 3D** | `components/voxel/` | Interactive 3D visualization |
| **FAIR** | `components/fair/` | Financial risk quantification |
| **Threat Intel** | `components/threat-intel/` | NVD, threat feeds |
| **Privacy** | `components/privacy/` | GDPR data mapping |
| **Continuity** | `components/continuity/` | BCP/DRP planning |

---

## 4. State Management

### Zustand Stores

**useStore (Main)** - `src/store.ts`
```typescript
interface AppState {
  user: UserProfile | null;
  organization: Organization | null;
  theme: 'light' | 'dark';
  language: 'fr' | 'en';
  demoMode: boolean;
  // Actions
  setUser, setTheme, setLanguage, addToast
}
```

**useVoxelStore** - `src/stores/voxelStore.ts`
- Nodes (entities)
- Edges (relationships)
- Anomalies (issues)
- UI state (filters, selection)
- Sync status

### Context Providers
- **AuthProvider** - Authentication state
- **ThemeProvider** - Light/dark mode
- **CrisisProvider** - Incident mode
- **NotificationProvider** - Notifications

---

## 5. Data Flow

### Authentication Flow
```
Login → Firebase Auth → Custom Claims → AuthContext → Protected Routes
```

### CRUD Pattern
```
Component → Hook → Service → Firestore/Cloud Function → Response → UI Update
```

### Form Validation
```
Form (React Hook Form) → Zod safeParse → Service → Firestore → Toast
```

---

## 6. Service Layer

### Design Pattern
```typescript
export const ServiceName = {
  async methodName(params): Promise<ReturnType> {
    try {
      // Firestore/Cloud Function call
    } catch (error) {
      ErrorLogger.error(error, 'ServiceName.methodName');
      throw error;
    }
  }
}
```

### Core Services
| Service | Purpose |
|---------|---------|
| `assetService` | Asset CRUD |
| `riskService` | Risk management |
| `auditService` | Audit operations |
| `documentService` | Document management |
| `projectService` | Project management |
| `incidentService` | Incident tracking |
| `ComplianceService` | Framework mapping |
| `ErrorLogger` | Error logging + Sentry |

---

## 7. Security Architecture

### Authentication
- Email/password, Google SSO, Apple SSO
- Multi-factor authentication (TOTP)
- Role-based access control (RBAC)
- Custom claims for permissions

### Data Protection
- Firestore security rules with tenant isolation
- Document classification (public/internal/confidential/secret)
- ACL-based document permissions
- Legal hold protection
- Encryption at rest (Cloud KMS)

### Input Validation
- DOMPurify for XSS prevention
- Zod schemas for data validation
- Server-side Firestore rules validation

---

## 8. Testing

### Framework
| Tool | Purpose | Coverage |
|------|---------|----------|
| Vitest | Unit testing | 49.62% statements |
| Testing Library | Component testing | 88.07% branches |
| Playwright | E2E testing | Critical paths |

### Test Organization
```
src/
├── services/__tests__/     # 85 service tests
├── hooks/__tests__/        # Hook tests
├── components/**/__tests__/ # 210 component tests
└── types/__tests__/        # Type validation tests
```

**Total: 8,420+ tests passing**

---

## 9. Design System

### Apple Design Language
- **Typography:** SF Pro Display, SF Pro Text, SF Mono
- **Colors:** Custom Tailwind palette
- **Effects:** Glass morphism, soft shadows
- **Animations:** Spring-based (cubic-bezier 0.16, 1, 0.3, 1)

### Tailwind Classes
```css
.font-apple    /* Apple system fonts */
.glass-panel   /* Frosted glass effect */
.shadow-apple  /* Soft shadows */
```

---

## 10. Build & Deployment

### Scripts
```bash
npm run dev          # Development server (port 8080)
npm run build        # Production build
npm run test         # Run tests
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

### Deployment Targets
- **Web:** Firebase Hosting / Vercel
- **Mobile:** iOS via Capacitor
- **Functions:** Firebase Cloud Functions

---

## 11. Key Patterns

### Hook + Service Pattern
```typescript
// Hook consumes service
const useRisks = () => {
  const [risks, setRisks] = useState([]);
  useEffect(() => {
    riskService.getRisks(orgId).then(setRisks);
  }, [orgId]);
  return { risks, updateRisk: riskService.updateRisk };
};
```

### Form Validation Pattern
```typescript
const schema = z.object({ name: z.string().min(2) });
const { handleSubmit } = useForm({ resolver: zodResolver(schema) });
```

### Error Handling Pattern
```typescript
try {
  await service.action();
} catch (error) {
  ErrorLogger.error(error, 'Context.action');
  addToast({ type: 'error', message: t('error.generic') });
}
```

---

## 12. Architectural Decision Records

| ADR | Decision |
|-----|----------|
| ADR-001 | Centralized i18n with `useLocale()` hook |
| ADR-002 | Draft/Auto-save with `useDraftMode()` and `useAutoSave()` |
| ADR-003 | Apple Health-style compliance gauge |

---

## 13. Onboarding Checklist

1. Read `CLAUDE.md` for coding standards
2. Study `src/types/` for domain models
3. Review `src/store.ts` for state patterns
4. Trace a feature: Component → Hook → Service → Firestore
5. Run tests: `npm test`
6. Build locally: `npm run build`

---

## Summary

Sentinel GRC v2 is an enterprise-grade GRC platform featuring:

- **1,556 files** / **384K+ lines** / **8,420+ tests**
- **React 19** + **TypeScript 5.7** + **Zustand 5.0**
- **Firebase** backend with comprehensive security
- **Multi-framework** compliance (ISO, NIST, GDPR, DORA, EBIOS)
- **3D visualization** with React Three Fiber
- **AI integration** with Google Gemini
- **Mobile support** via Capacitor
- **Multi-tenant** architecture with RBAC

The architecture prioritizes maintainability, scalability, and developer experience through consistent patterns and strong typing.
