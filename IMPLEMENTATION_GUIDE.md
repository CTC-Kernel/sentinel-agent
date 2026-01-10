# Guide d'Implémentation - Améliorations BMAD

**Date:** 2026-01-09
**Version:** 1.0
**Basé sur:** Analyse BMAD de Sentinel GRC v2.0

---

## 🎯 Vue d'Ensemble

Ce guide détaille l'implémentation des améliorations de sécurité identifiées lors de l'audit BMAD. Les services créés sont prêts à l'emploi et nécessitent seulement une intégration dans l'application existante.

## 📦 Services Créés

### 1. Rate Limiting Service
**Fichier:** `src/services/rateLimitService.ts`

**Description:** Service de limitation de débit côté client utilisant l'algorithme Token Bucket.

**Fonctionnalités:**
- ✅ Rate limiting pour authentification (5 tentatives/minute)
- ✅ Rate limiting pour API (100 requêtes/10 par seconde)
- ✅ Rate limiting pour recherches (30/2 par seconde)
- ✅ Rate limiting pour exports (10/1 par 30 secondes)
- ✅ Rate limiting pour uploads (20/1 par 5 secondes)
- ✅ Calcul du temps d'attente
- ✅ Configuration personnalisable

**Utilisation:**

```typescript
import { RateLimiter, useRateLimit, withRateLimit } from '@/services/rateLimitService';

// Méthode 1: Vérification directe
if (!RateLimiter.checkLimit('auth', userId)) {
  const waitTime = RateLimiter.getWaitTime('auth', userId);
  toast.error(`Trop de tentatives. Attendez ${Math.ceil(waitTime / 1000)}s`);
  return;
}

// Méthode 2: Hook React
const canSearch = useRateLimit('search', user?.uid);
if (!canSearch) {
  toast.error('Trop de recherches, veuillez patienter');
  return;
}

// Méthode 3: Décorateur de fonction
const protectedExport = withRateLimit('export', async () => {
  // Export logic
}, user?.uid);
```

**Intégration recommandée:**
- Appeler au début des fonctions critiques (login, search, export)
- Nettoyer périodiquement: `RateLimiter.cleanup()` au logout
- Configurer selon les besoins avec `RateLimiter.setConfig()`

---

### 2. Input Sanitization Service
**Fichier:** `src/services/inputSanitizationService.ts`

**Description:** Service centralisé de sanitization des inputs pour prévenir XSS, injections et autres attaques.

**Fonctionnalités:**
- ✅ Sanitization de strings avec DOMPurify
- ✅ Validation et sanitization d'emails
- ✅ Validation et sanitization d'URLs (protection SSRF)
- ✅ Sanitization de noms de fichiers
- ✅ Sanitization pour exports CSV/Excel (CSV Injection)
- ✅ Validation de numéros de téléphone
- ✅ Validation de dates
- ✅ Validation de nombres avec min/max
- ✅ Détection de tentatives d'injection SQL (logging)
- ✅ Détection de path traversal

**Utilisation:**

```typescript
import { InputSanitizer, useSanitization } from '@/services/inputSanitizationService';

// Sanitize string
const cleanName = InputSanitizer.sanitizeString(userInput, {
  maxLength: 200,
  allowHTML: false,
  trim: true
});

// Sanitize email
const cleanEmail = InputSanitizer.sanitizeEmail(email);
if (!cleanEmail) {
  toast.error('Email invalide');
  return;
}

// Sanitize URL (protection SSRF)
const cleanURL = InputSanitizer.sanitizeURL(url);
if (!cleanURL) {
  toast.error('URL invalide ou non autorisée');
  return;
}

// Sanitize pour export CSV
const csvData = data.map(row => ({
  name: InputSanitizer.sanitizeForExport(row.name),
  email: InputSanitizer.sanitizeForExport(row.email)
}));

// Sanitize objet complet
const cleanData = InputSanitizer.sanitizeObject(formData, {
  maxLength: 500,
  allowHTML: false
});
```

**Intégration recommandée:**
- Sanitizer TOUS les inputs utilisateur avant traitement
- Utiliser dans les formulaires (onSubmit)
- Utiliser avant les appels API
- Utiliser avant les exports (CSV, Excel, PDF)

---

### 3. Security Headers Middleware
**Fichier:** `src/middleware/securityHeaders.ts`

**Description:** Configuration des headers de sécurité HTTP (CSP, HSTS, X-Frame-Options, etc.)

**Fonctionnalités:**
- ✅ Content Security Policy (CSP) strict
- ✅ HTTP Strict Transport Security (HSTS)
- ✅ X-Frame-Options (protection clickjacking)
- ✅ X-Content-Type-Options (protection MIME sniffing)
- ✅ Referrer-Policy
- ✅ Permissions-Policy (désactivation APIs sensibles)
- ✅ Configuration Vite
- ✅ Configuration Firebase Hosting
- ✅ Configuration Nginx

**Intégration dans Vite:**

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { configureViteSecurityHeaders } from './src/middleware/securityHeaders';

export default defineConfig({
  plugins: [
    react(),
    configureViteSecurityHeaders()
  ]
});
```

**Intégration dans Firebase Hosting:**

Ajouter dans `firebase.json`:

```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com..."
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=63072000; includeSubDomains; preload"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          }
        ]
      }
    ]
  }
}
```

Voir le fichier pour la configuration complète.

---

### 4. Session Monitoring Service
**Fichier:** `src/services/sessionMonitoringService.ts`

**Description:** Service de monitoring des sessions pour détecter les activités suspectes et anomalies.

**Fonctionnalités:**
- ✅ Détection de sessions concurrentes
- ✅ Détection de changements de localisation suspects
- ✅ Timeout d'inactivité configurable (défaut: 15 minutes)
- ✅ Monitoring d'activité utilisateur
- ✅ Détection de changements de rôle
- ✅ Validation d'intégrité de session
- ✅ Déconnexion forcée en cas d'anomalie
- ✅ Logging des anomalies critiques
- ✅ Métriques de session

**Utilisation:**

```typescript
import { SessionMonitor, useSessionMonitoring } from '@/services/sessionMonitoringService';

// Dans AuthContext ou App.tsx
useEffect(() => {
  if (user) {
    SessionMonitor.initSession(user);

    // Configurer le timeout d'inactivité selon le rôle
    const timeout = user.role === 'admin' ? 15 * 60 * 1000 : 60 * 60 * 1000;
    SessionMonitor.setIdleTimeout(timeout);
  } else {
    SessionMonitor.clearSession();
  }
}, [user]);

// Enregistrer l'activité sur les actions utilisateur
const handleAction = () => {
  SessionMonitor.recordActivity();
  // Action logic
};

// Vérifier les anomalies critiques
const criticalAnomalies = SessionMonitor.getCriticalAnomaliesCount();
if (criticalAnomalies > 0) {
  // Afficher une alerte
}

// Obtenir les métriques de session
const metrics = SessionMonitor.getMetrics();
console.log(`Session active depuis ${metrics?.sessionDuration}ms`);

// Détecter changement de localisation
SessionMonitor.checkLocationChange(newCountry);

// Détecter changement de rôle
SessionMonitor.onRoleChange(newRole);
```

**Intégration recommandée:**
- Initialiser dans AuthContext après login
- Nettoyer au logout
- Configurer timeout selon rôle (Admin: 15min, User: 1h)
- Afficher un composant d'alerte si anomalies critiques
- Logger les anomalies vers Sentry/Firebase Analytics

---

## 🔧 Intégration Step-by-Step

### Étape 1: Rate Limiting

**Dans les composants d'authentification:**

```typescript
// LoginForm.tsx
import { RateLimiter } from '@/services/rateLimitService';

const handleLogin = async (email: string, password: string) => {
  // Rate limiting
  if (!RateLimiter.checkLimit('auth')) {
    const waitTime = RateLimiter.getWaitTime('auth');
    toast.error(`Trop de tentatives. Attendez ${Math.ceil(waitTime / 1000)} secondes.`);
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    // Handle error
  }
};
```

**Dans les fonctions de recherche:**

```typescript
// SearchBar.tsx
const handleSearch = async (query: string) => {
  if (!RateLimiter.checkLimit('search', user?.uid)) {
    toast.error('Trop de recherches, veuillez patienter');
    return;
  }

  // Search logic
};
```

**Dans les exports:**

```typescript
// ExportButton.tsx
const handleExport = async () => {
  if (!RateLimiter.checkLimit('export', user?.uid)) {
    const waitTime = RateLimiter.getWaitTime('export', user?.uid);
    toast.error(`Export limité. Attendez ${Math.ceil(waitTime / 1000)}s.`);
    return;
  }

  // Export logic
};
```

### Étape 2: Input Sanitization

**Dans les formulaires:**

```typescript
// AssetForm.tsx
import { InputSanitizer } from '@/services/inputSanitizationService';

const handleSubmit = async (data: AssetFormData) => {
  // Sanitize tous les inputs
  const sanitizedData = {
    name: InputSanitizer.sanitizeString(data.name, { maxLength: 200 }),
    description: InputSanitizer.sanitizeString(data.description, { maxLength: 5000 }),
    owner: InputSanitizer.sanitizeEmail(data.owner),
    // ...
  };

  // Vérifier les champs requis
  if (!sanitizedData.name || !sanitizedData.owner) {
    toast.error('Champs invalides');
    return;
  }

  // Sauvegarder
  await createAsset(sanitizedData);
};
```

**Dans les exports CSV:**

```typescript
// csvExportService.ts
import { InputSanitizer } from '@/services/inputSanitizationService';

export const exportToCSV = (data: Asset[]) => {
  const csvRows = data.map(asset => [
    InputSanitizer.sanitizeForExport(asset.name),
    InputSanitizer.sanitizeForExport(asset.type),
    InputSanitizer.sanitizeForExport(asset.owner)
  ]);

  // Generate CSV...
};
```

### Étape 3: Security Headers

**Intégration dans vite.config.ts:**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { configureViteSecurityHeaders } from './src/middleware/securityHeaders';

export default defineConfig({
  plugins: [
    react(),
    configureViteSecurityHeaders()
  ],
  // ... rest of config
});
```

**Intégration dans firebase.json:**

Copier la configuration depuis `src/middleware/securityHeaders.ts` (section `firebaseHostingHeaders`) dans `firebase.json`.

### Étape 4: Session Monitoring

**Intégration dans AuthContext:**

```typescript
// AuthContext.tsx
import { SessionMonitor } from '@/services/sessionMonitoringService';

useEffect(() => {
  const unsubscribe = auth.onAuthStateChanged((user) => {
    if (user) {
      // Initialiser le monitoring
      SessionMonitor.initSession(user);

      // Configurer timeout selon rôle
      const timeouts = {
        admin: 15 * 60 * 1000,    // 15 min
        rssi: 30 * 60 * 1000,      // 30 min
        auditor: 60 * 60 * 1000,   // 1h
        user: 60 * 60 * 1000       // 1h
      };
      const timeout = timeouts[user.role as keyof typeof timeouts] || 60 * 60 * 1000;
      SessionMonitor.setIdleTimeout(timeout);
    } else {
      SessionMonitor.clearSession();
    }
  });

  return () => {
    unsubscribe();
    SessionMonitor.clearSession();
  };
}, []);
```

**Composant d'alerte anomalies:**

```typescript
// SecurityAlertBanner.tsx
import { SessionMonitor } from '@/services/sessionMonitoringService';
import { useEffect, useState } from 'react';

export const SecurityAlertBanner = () => {
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    const checkAnomalies = () => {
      const count = SessionMonitor.getCriticalAnomaliesCount();
      setCriticalCount(count);
    };

    checkAnomalies();
    const interval = setInterval(checkAnomalies, 60000); // Vérifier chaque minute

    return () => clearInterval(interval);
  }, []);

  if (criticalCount === 0) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2 text-center">
      ⚠️ {criticalCount} anomalie(s) de sécurité détectée(s). Veuillez contacter votre administrateur.
    </div>
  );
};
```

---

## 📊 Tests Recommandés

### Test 1: Rate Limiting

```typescript
// rateLimitService.test.ts
import { RateLimiter } from '@/services/rateLimitService';

describe('RateLimitService', () => {
  beforeEach(() => {
    RateLimiter.reset('auth');
  });

  it('devrait autoriser les requêtes dans la limite', () => {
    expect(RateLimiter.checkLimit('auth')).toBe(true);
    expect(RateLimiter.checkLimit('auth')).toBe(true);
  });

  it('devrait bloquer après la limite atteinte', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.checkLimit('auth');
    }
    expect(RateLimiter.checkLimit('auth')).toBe(false);
  });

  it('devrait calculer le temps d\'attente', () => {
    for (let i = 0; i < 5; i++) {
      RateLimiter.checkLimit('auth');
    }
    const waitTime = RateLimiter.getWaitTime('auth');
    expect(waitTime).toBeGreaterThan(0);
  });
});
```

### Test 2: Input Sanitization

```typescript
// inputSanitizationService.test.ts
import { InputSanitizer } from '@/services/inputSanitizationService';

describe('InputSanitizationService', () => {
  it('devrait supprimer les tags HTML', () => {
    const input = '<script>alert("xss")</script>Hello';
    const result = InputSanitizer.sanitizeString(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  it('devrait valider les emails', () => {
    expect(InputSanitizer.sanitizeEmail('test@example.com')).toBe('test@example.com');
    expect(InputSanitizer.sanitizeEmail('invalid')).toBe('');
  });

  it('devrait bloquer les URLs locales (SSRF)', () => {
    expect(InputSanitizer.sanitizeURL('http://localhost/admin')).toBe('');
    expect(InputSanitizer.sanitizeURL('http://127.0.0.1/secrets')).toBe('');
    expect(InputSanitizer.sanitizeURL('https://example.com')).not.toBe('');
  });

  it('devrait détecter les injections SQL', () => {
    const malicious = "'; DROP TABLE users; --";
    const detected = InputSanitizer.detectSQLInjection(malicious);
    expect(detected).toBe(true);
  });
});
```

---

## 🚀 Déploiement

### 1. Tests Locaux

```bash
# Lancer les tests
npm test

# Vérifier le build
npm run build

# Preview en local
npm run preview
```

### 2. Déploiement sur Firebase

```bash
# Build production
npm run build

# Déployer (hosting + functions si modifiées)
firebase deploy

# Vérifier les headers
curl -I https://app.cyber-threat-consulting.com
```

### 3. Monitoring Post-Déploiement

- Vérifier les logs Firebase Functions
- Surveiller Sentry pour les erreurs
- Vérifier Firebase Analytics pour les anomalies
- Tester le rate limiting en production
- Vérifier les CSP errors dans la console

---

## 📈 Métriques de Succès

### KPIs à Surveiller

| Métrique | Avant | Cible | Outils |
|----------|-------|-------|--------|
| Tentatives de XSS bloquées | N/A | 0/mois | Sentry + ErrorLogger |
| Rate limit déclenchés | N/A | <100/jour | ErrorLogger |
| Sessions forcées à déconnecter | N/A | <10/mois | SessionMonitor |
| Anomalies critiques | N/A | 0 | SessionMonitor |
| CSP violations | N/A | <50/mois | Browser Console + Sentry |

---

## 🔄 Prochaines Étapes

### Court Terme (1-2 semaines)

1. ✅ Intégrer les 4 services créés
2. ⬜ Tester en environnement de développement
3. ⬜ Déployer en staging
4. ⬜ Tests de charge et validation
5. ⬜ Déployer en production

### Moyen Terme (1-3 mois)

1. ⬜ Implémenter MFA obligatoire pour Admin/RSSI
2. ⬜ Migrer chiffrement vers server-side (Cloud Functions)
3. ⬜ Ajouter CSRF protection avec tokens
4. ⬜ Implémenter politique de rétention des données
5. ⬜ Ajouter alerting temps réel (Slack/PagerDuty)

### Long Terme (3-6 mois)

1. ⬜ Implémenter détection d'anomalies ML
2. ⬜ Ajouter WAF (Cloudflare ou Cloud Armor)
3. ⬜ Chiffrement end-to-end pour documents sensibles
4. ⬜ Audit de sécurité externe (pentest)
5. ⬜ Certification SOC 2 Type II

---

## 📞 Support

Pour toute question sur l'implémentation:
- Documentation BMAD: `BMAD_ANALYSIS.md`
- Code source: `src/services/` et `src/middleware/`
- Tests: `src/services/__tests__/`

---

**Document créé le:** 2026-01-09
**Dernière mise à jour:** 2026-01-09
**Version:** 1.0
