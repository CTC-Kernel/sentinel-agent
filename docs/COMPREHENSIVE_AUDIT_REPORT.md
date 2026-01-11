# AUDIT COMPLET - SENTINEL GRC V2

**Date d'audit:** 12 Janvier 2026
**Branche:** `claude/complete-app-audit-XtXdX`
**Codebase:** 857 fichiers TypeScript, 162,071 lignes de code

---

## RESUME EXECUTIF

| Catégorie | Score | Statut |
|-----------|-------|--------|
| Architecture | 6/10 | Refactoring nécessaire |
| Sécurité | 5/10 | **ATTENTION IMMEDIATE REQUISE** |
| Performance | 6/10 | Améliorations possibles |
| Qualité du Code | 6/10 | Dette technique modérée |
| UI/UX & Accessibilité | 5/10 | Inconsistances majeures |
| Dépendances | 6/10 | 47 packages à mettre à jour |
| **SCORE GLOBAL** | **5.7/10** | **Action requise** |

---

## 1. PROBLEMES CRITIQUES (ACTION IMMEDIATE)

### 1.1 SECURITE - CREDENTIALS EXPOSES

**CRITIQUE - Rotation immédiate requise**

| Fichier | Secret exposé | Risque |
|---------|---------------|--------|
| `functions/.env:9` | SMTP Password: `Al21689a!` | Email spoofing |
| `.env.local:1` | Gemini API Key: `AIzaSyA4JM...` | Abus API Google |
| `.env.local:5` | Shodan API Key: `2W4CIeERQ...` | Accès réseau |
| `.env.local:10` | NVD API Key: `394afc4d-...` | Quotas CVE |
| `src/firebase.ts:43` | App Check Debug Token hardcodé | Bypass sécurité |

**Actions:**
1. Faire tourner TOUS les secrets immédiatement
2. Migrer vers Firebase Secrets Manager
3. Vérifier `.gitignore` pour `.env*`

### 1.2 VULNERABILITES DEPENDANCES

| Package | Version | Sévérité | Fix |
|---------|---------|----------|-----|
| **jspdf** | 2.5.2 | CRITIQUE (DoS, ReDoS) | 4.0.0 |
| **@remix-run/router** | ≤1.23.1 | HAUTE (XSS) | 1.23.2+ |
| **dompurify** (in jspdf) | <3.2.4 | HAUTE (XSS) | Update jspdf |

### 1.3 AUTH BYPASS EN PRODUCTION

**Fichier:** `src/contexts/AuthContext.tsx:183-196`

```typescript
// PROBLEME: Test mode bypass peut être activé en prod
if (isTestMode) {
    const e2eUser = localStorage.getItem('E2E_TEST_USER');
    if (e2eUser) {
        setUser(JSON.parse(e2eUser)); // Bypass complet!
    }
}
```

**Solution:** Supprimer le code de test du build de production.

---

## 2. ARCHITECTURE & STRUCTURE

### 2.1 Problèmes Critiques

| Problème | Location | Impact |
|----------|----------|--------|
| **Dossiers context dupliqués** | `/src/context/` ET `/src/contexts/` | Confusion des imports |
| **Dossiers audit dupliqués** | `/src/components/audit/` ET `/src/components/audits/` | Incohérence |
| **Composants géants** | `RiskForm.tsx` (992 lignes), `VoxelStudio.tsx` (794 lignes) | Maintenabilité |
| **Vues monolithiques** | `Dashboard.tsx` (25,269 lignes!) | Performance |

### 2.2 State Management Fragmenté

L'application utilise 5 approches différentes:
1. Zustand store (`/src/store.ts`)
2. React Context APIs
3. useState local
4. Firebase Firestore direct
5. Hooks custom complexes

**Recommandation:** Standardiser sur Zustand + React Query

### 2.3 Fichiers Services Démesurés

| Service | Lignes | Recommandation |
|---------|--------|----------------|
| `PdfService.ts` | 2,177 | Diviser en modules |
| `notificationService.ts` | 982 | Extraire les handlers |
| `integrationService.ts` | 715 | Séparer par intégration |

---

## 3. PERFORMANCE

### 3.1 Fuites Mémoire CRITIQUES

**Fichier:** `src/services/performanceMonitor.ts`

```typescript
// LIGNE 171 - Intervalle jamais nettoyé!
setInterval(updateEngagement, 100);

// LIGNES 167-169 - Event listeners jamais retirés!
['click', 'scroll', 'keydown', 'mousemove'].forEach(event => {
    document.addEventListener(event, updateEngagement, { passive: true });
});
```

**Impact:** 4 event listeners s'accumulent à chaque mount + intervalle permanent

### 3.2 Re-renders Inutiles

| Composant | Problème | Fix |
|-----------|----------|-----|
| `IncidentKanban.tsx` | Pas de React.memo | Wrapper avec memo() |
| `DataTable.tsx:140` | `selectedIds` recalculé à chaque render | useMemo() |
| `VoxelMesh.tsx:92-96` | Calcul distance dans render loop 3D | Memoizer |

### 3.3 Lazy Loading Manquant

Composants lourds non lazy-loaded:
- `GeminiAssistant.tsx` - AI/LLM (~50KB)
- `VoxelStudio.tsx` - Three.js 3D (~500KB)
- `ThreatPlanet.tsx` - Visualisation 3D

---

## 4. QUALITE DU CODE

### 4.1 Type Safety

| Métrique | Count | Sévérité |
|----------|-------|----------|
| Usages de `any` | 246 | HAUTE |
| `@ts-ignore` / `@ts-nocheck` | 28 | HAUTE |
| ESLint disable directives | 64 | MOYENNE |
| `as unknown as T` casts | 10+ | MOYENNE |

**Fichiers les plus problématiques:**
- `src/utils/zodErrorMap.ts` - 8 instances de `as any`
- `src/hooks/useZodForm.ts` - Assertions de type zodResolver
- `src/services/FunctionsService.ts` - Firebase casts

### 4.2 Gestion d'Erreurs

| Pattern | Occurrences | Problème |
|---------|-------------|----------|
| Catch blocks vides | 15+ | Erreurs silencieuses |
| `toast.error()` générique | 20+ | Messages non informatifs |
| Logs seulement en dev | Production aveugle |

### 4.3 TODO/FIXME Non Résolus

| Fichier | TODO |
|---------|------|
| `WarRoomModal.tsx:97` | Link to real documents |
| `WarRoomModal.tsx:120` | Real presence list |
| `DiscussionPanel.tsx:179` | Read tracking |
| `SecurityDashboard.tsx:99` | getRemainingTokens |
| `sessionMonitoringService.ts:380` | Push notifications |

---

## 5. UI/UX & ACCESSIBILITE

### 5.1 Accessibilité CRITIQUE

| Problème | Impact | Fichiers |
|----------|--------|----------|
| **ARIA labels manquants** | Screen readers inutilisables | 50+ boutons icône |
| **Alt text images** | 0 instance trouvée | Tous les composants |
| **Cibles tactiles trop petites** | `h-9` (36px) < 44px min | Boutons, pagination |
| **Focus trap manquant** | Modales accessibles | WarRoomModal, etc. |

### 5.2 Inconsistances UI

| Catégorie | Problème | Count |
|-----------|----------|-------|
| **Couleurs hardcodées** | Hex values directes | 212+ |
| **Spacing arbitraire** | `h-[250px]`, `max-h-[60vh]` | 106+ |
| **Border radius mixtes** | `rounded-xl` vs `rounded-[2rem]` | Nombreux |
| **Tailles d'icônes** | `h-3 w-3` à `h-6 w-6` mixées | 100+ |

### 5.3 UX Manquante

- Confirmations pour actions destructives: **7 instances seulement**
- Tooltips sur boutons icône: **7 instances seulement**
- États de chargement: **Inconsistants** (444 patterns différents)
- États vides: **Partiellement implémentés**

---

## 6. DEPENDANCES & DETTE TECHNIQUE

### 6.1 Packages Critiquement Outdated

| Package | Actuel | Latest | Urgence |
|---------|--------|--------|---------|
| **@capacitor/core** | 7.4.4 | 8.0.0 | HAUTE (iOS) |
| **firebase** | 11.0.2 | 12.7.0 | HAUTE |
| **react-router-dom** | 6.29.0 | 7.12.0 | MOYENNE |
| **tailwindcss** | 3.4.1 | 4.1.18 | MOYENNE |
| **vite** | 6.0.3 | 7.3.1 | MOYENNE |
| **vitest** | 2.1.8 | 3.2.4 | BASSE |

### 6.2 Dépendances Redondantes

| Package | Usage | Recommandation |
|---------|-------|----------------|
| `lodash` | 1 seul import | Supprimer, utiliser natif |
| `crypto-js` | Crypto legacy | Migrer vers Web Crypto API |

### 6.3 Couverture de Tests

```
Fichiers TypeScript: 857
Fichiers de Tests:   89 (10.4%)
Couverture estimée: ~10%
Tests skippés:       4 fichiers critiques
```

---

## 7. PLAN D'ACTION PRIORITAIRE

### Semaine 1-2: CRITIQUE

| Action | Effort | Impact |
|--------|--------|--------|
| Faire tourner tous les secrets exposés | 2h | Sécurité |
| Mettre à jour jspdf → 4.0.0 | 4h | CVE |
| Supprimer auth bypass test en prod | 2h | Sécurité |
| Fixer fuite mémoire performanceMonitor | 2h | Performance |
| Ajouter aria-labels boutons icône | 8h | A11y |

### Semaine 3-4: HAUTE

| Action | Effort | Impact |
|--------|--------|--------|
| Mettre à jour Capacitor → v8 | 3j | Mobile |
| Mettre à jour Firebase → v12 | 2j | Sécurité |
| Merger dossiers context dupliqués | 4h | Architecture |
| Ajouter React.memo aux composants listes | 8h | Performance |
| Activer tests skippés | 2j | Qualité |

### Mois 2: MOYENNE

| Action | Effort | Impact |
|--------|--------|--------|
| Refactorer composants >500 lignes | 1 semaine | Maintenabilité |
| Standardiser state management | 1 semaine | Architecture |
| Remplacer couleurs hardcodées | 3j | UI/UX |
| Augmenter couverture tests à 50% | 2 semaines | Qualité |
| Implémenter focus traps modales | 2j | A11y |

### Mois 3: BASSE

| Action | Effort | Impact |
|--------|--------|--------|
| Moderniser patterns React.FC | 3j | Best practices |
| Ajouter JSDoc aux APIs publiques | 1 semaine | Documentation |
| Consolider configs Vite | 4h | DX |
| Supprimer lodash | 2h | Bundle size |

---

## 8. METRIQUES A SURVEILLER

| Métrique | Actuel | Cible |
|----------|--------|-------|
| Score Lighthouse Performance | N/A | >90 |
| Couverture tests | ~10% | >70% |
| Usages de `any` | 246 | <20 |
| ESLint warnings | 64+ | 0 |
| Packages outdated | 47 | 0 |
| Vulnérabilités npm audit | 3+ | 0 |
| Taille bundle JS | N/A | <500KB initial |
| Core Web Vitals LCP | N/A | <2.5s |

---

## 9. ANNEXES

### A. Fichiers Critiques à Refactorer

1. `src/views/Dashboard.tsx` - 25,269 lignes
2. `src/views/Documents.tsx` - 37,998 lignes
3. `src/views/Assets.tsx` - 30,896 lignes
4. `src/components/risks/RiskForm.tsx` - 992 lignes
5. `src/services/PdfService.ts` - 2,177 lignes

### B. Composants Sans Tests

- Services Firebase
- Hooks de formulaires
- Intégrations API externes
- Composants de visualisation 3D

### C. Configuration Recommandée TSConfig

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitOverride": true
  }
}
```

---

**Rapport généré automatiquement par Claude Code**
**Pour questions: Contacter l'équipe développement**
