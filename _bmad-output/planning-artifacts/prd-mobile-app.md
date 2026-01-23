# PRD - Application Mobile Sentinel GRC

**Version:** 1.0
**Date:** 2026-01-23
**Statut:** DRAFT (base sur reverse-engineering code existant)
**Auteur:** Audit automatise

---

## 1. Resume Executif

### Contexte

Une application mobile React Native (Expo) existe dans le repository mais n'etait pas documentee. Ce PRD documente l'etat actuel et propose une roadmap d'evolution.

### Decouverte

| Attribut | Valeur |
|----------|--------|
| Framework | React Native + Expo SDK 54 |
| Localisation | `/mobile/` |
| Etat | Fonctionnel (partiel) |
| Documentation | **AUCUNE** (ce document la cree) |

### Fonctionnalites Decouvertes

1. **Dashboard Mobile** - Vue tableau de bord
2. **Scanner QR/Code-barres** - Scan assets
3. **Authentification** - Login Firebase

---

## 2. Analyse du Code Existant

### Structure du Projet

```
mobile/
├── app/
│   ├── _layout.tsx      # Navigation layout (expo-router)
│   ├── index.tsx        # Ecran principal / Login
│   ├── dashboard.tsx    # Dashboard mobile
│   └── scanner.tsx      # Scanner camera
├── components/          # Composants reutilisables
├── services/            # Services partages
├── firebaseConfig.ts    # Configuration Firebase
├── App.tsx              # Point d'entree legacy
└── package.json         # Dependencies Expo
```

### Dependencies Principales

```json
{
  "expo": "~54.0.27",
  "firebase": "^12.6.0",
  "expo-camera": "~16.0.17",
  "expo-router": "~4.0.22",
  "react-native": "0.76.9"
}
```

### Ecrans Identifies

| Ecran | Fichier | Fonctionnalite |
|-------|---------|----------------|
| Login | `index.tsx` | Authentification Firebase |
| Dashboard | `dashboard.tsx` | KPIs et stats resumees |
| Scanner | `scanner.tsx` | Scan QR pour identifier assets |

---

## 3. Personas Utilisateurs Mobile

### Persona 1: Auditeur Terrain

| Attribut | Description |
|----------|-------------|
| Role | Auditeur interne/externe |
| Contexte | Verification sur site, datacenter, bureaux |
| Besoins | Scanner assets, verifier controles, prendre photos preuves |
| Device | Smartphone Android/iOS |

### Persona 2: RSSI en Deplacement

| Attribut | Description |
|----------|-------------|
| Role | Responsable Securite |
| Contexte | Reunions, conferences, transport |
| Besoins | Dashboard KPIs, alertes critiques, approbations |
| Device | iPhone principalement |

### Persona 3: Responsable Conformite

| Attribut | Description |
|----------|-------------|
| Role | Compliance Officer |
| Contexte | Revues periodiques, reunions direction |
| Besoins | Scores compliance, progression projets, deadlines |
| Device | Tablet iPad / Android |

---

## 4. Fonctionnalites Existantes (v1.0)

### 4.1 Authentification

**Statut:** IMPLEMENTE

- Login email/password Firebase
- Persistance session
- Logout

**Manquant:**
- SSO/SAML
- Biometrie (Face ID, Touch ID)
- MFA mobile

### 4.2 Dashboard Mobile

**Statut:** IMPLEMENTE (basique)

- Score compliance global
- Nombre d'alertes
- Progression projets

**Manquant:**
- Widgets configurables
- Drill-down details
- Graphiques tendance
- Pull-to-refresh

### 4.3 Scanner Assets

**Statut:** IMPLEMENTE

- Scan QR code
- Scan code-barres
- Recherche asset par code

**Manquant:**
- Creation asset depuis scan
- Photo evidence attachee
- Historique scans
- Mode offline

---

## 5. Fonctionnalites Proposees (v2.0)

### 5.1 Epic Mobile 1: Authentification Avancee

| Story | Description | Priorite |
|-------|-------------|----------|
| M1.1 | Biometrie Face ID / Touch ID | P0 |
| M1.2 | MFA push notification | P1 |
| M1.3 | SSO enterprise mobile | P2 |
| M1.4 | Session timeout configurable | P1 |

### 5.2 Epic Mobile 2: Dashboard Enrichi

| Story | Description | Priorite |
|-------|-------------|----------|
| M2.1 | Widgets drag-and-drop | P1 |
| M2.2 | Graphiques interactifs (Recharts) | P1 |
| M2.3 | Drill-down vers details | P0 |
| M2.4 | Notifications badge temps reel | P0 |
| M2.5 | Dark mode | P2 |

### 5.3 Epic Mobile 3: Audit Terrain

| Story | Description | Priorite |
|-------|-------------|----------|
| M3.1 | Checklist audit mobile | P0 |
| M3.2 | Photo evidence avec metadata | P0 |
| M3.3 | Signature digitale | P1 |
| M3.4 | Mode offline avec sync | P0 |
| M3.5 | GPS location evidence | P1 |

### 5.4 Epic Mobile 4: Gestion Assets

| Story | Description | Priorite |
|-------|-------------|----------|
| M4.1 | Liste assets avec filtres | P0 |
| M4.2 | Detail asset complet | P0 |
| M4.3 | Creation asset rapide | P1 |
| M4.4 | Edition asset inline | P1 |
| M4.5 | Historique asset | P2 |

### 5.5 Epic Mobile 5: Notifications & Alertes

| Story | Description | Priorite |
|-------|-------------|----------|
| M5.1 | Push notifications | P0 |
| M5.2 | Centre notifications in-app | P0 |
| M5.3 | Actions rapides depuis notif | P1 |
| M5.4 | Configuration preferences | P1 |
| M5.5 | Escalade alertes critiques | P1 |

### 5.6 Epic Mobile 6: Approbations Workflow

| Story | Description | Priorite |
|-------|-------------|----------|
| M6.1 | Liste approbations en attente | P0 |
| M6.2 | Detail demande | P0 |
| M6.3 | Approuver/Rejeter avec commentaire | P0 |
| M6.4 | Delegation temporaire | P2 |

---

## 6. Architecture Technique

### Stack Technologique

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Framework | React Native | Partage code avec web |
| Toolkit | Expo SDK 54 | Simplicite deploiement |
| Navigation | expo-router | File-based routing |
| State | Zustand | Coherence avec web |
| Backend | Firebase | Meme backend que web |
| Camera | expo-camera | Scan natif |
| Storage | expo-secure-store | Donnees sensibles |
| Offline | WatermelonDB | Sync offline |

### Architecture Proposee

```
┌─────────────────────────────────────────────────┐
│                   App Mobile                     │
├─────────────────────────────────────────────────┤
│  UI Layer (React Native + NativeWind)           │
├─────────────────────────────────────────────────┤
│  State (Zustand) │ Navigation (expo-router)     │
├─────────────────────────────────────────────────┤
│  Services Layer (partage avec web)              │
│  - authService                                  │
│  - assetService                                 │
│  - auditService                                 │
│  - notificationService                          │
├─────────────────────────────────────────────────┤
│  Offline Layer (WatermelonDB)                   │
├─────────────────────────────────────────────────┤
│  Firebase SDK (Auth, Firestore, Storage, FCM)   │
└─────────────────────────────────────────────────┘
```

### Mode Offline

```
Online                          Offline
   │                               │
   ▼                               ▼
┌──────────┐                 ┌──────────┐
│ Firestore │◄──────────────►│WatermelonDB│
│  (cloud)  │     sync       │  (local)   │
└──────────┘                 └──────────┘
                                   │
                                   ▼
                            Queue operations
                            (create, update)
                                   │
                                   ▼
                            Sync on reconnect
```

---

## 7. Securite Mobile

### Exigences

| Exigence | Implementation |
|----------|----------------|
| Stockage credentials | expo-secure-store (Keychain iOS, Keystore Android) |
| Certificate pinning | expo-updates SSL pinning |
| Jailbreak detection | expo-device + custom check |
| App Transport Security | HTTPS only, TLS 1.3 |
| Code obfuscation | Hermes bytecode |
| Session management | Token refresh automatique |

### Authentification Biometrique

```typescript
import * as LocalAuthentication from 'expo-local-authentication';

const authenticateWithBiometrics = async () => {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (hasHardware && isEnrolled) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authentification Sentinel GRC',
      fallbackLabel: 'Utiliser le mot de passe',
    });
    return result.success;
  }
  return false;
};
```

---

## 8. UX/UI Guidelines

### Design System

- Reutiliser composants web via React Native Web compatible
- NativeWind (TailwindCSS pour RN) pour styling coherent
- Animations natives (Reanimated 3)
- Haptic feedback sur actions importantes

### Ecrans Prioritaires

1. **Login** - Simple, biometrie en premier
2. **Dashboard** - KPIs above the fold, scroll pour details
3. **Assets** - Liste searchable, scan button flottant
4. **Audit Checklist** - Steps verticaux, progression visible
5. **Notifications** - Groupees par type, swipe actions

### Accessibilite

- Support VoiceOver (iOS) et TalkBack (Android)
- Tailles texte dynamiques
- Contraste WCAG AA minimum
- Labels sur tous les boutons

---

## 9. Roadmap Implementation

### Phase 1: Stabilisation (Sprint 1-2)

- [ ] Documenter code existant
- [ ] Ajouter tests unitaires
- [ ] Corriger bugs connus
- [ ] Upgrade Expo SDK si necessaire

### Phase 2: Core Features (Sprint 3-5)

- [ ] Epic M1: Auth avancee (biometrie)
- [ ] Epic M2: Dashboard enrichi
- [ ] Epic M5: Push notifications

### Phase 3: Audit Terrain (Sprint 6-8)

- [ ] Epic M3: Audit terrain complet
- [ ] Epic M4: Gestion assets
- [ ] Mode offline

### Phase 4: Workflow (Sprint 9-10)

- [ ] Epic M6: Approbations
- [ ] Integration complete workflows web

---

## 10. Metriques Succes

### Adoption

| Metrique | Objectif |
|----------|----------|
| Downloads | 500+ dans 3 mois |
| DAU/MAU | > 30% |
| Sessions/user/week | > 3 |

### Performance

| Metrique | Objectif |
|----------|----------|
| Time to interactive | < 3s |
| Crash-free rate | > 99.5% |
| API latency P95 | < 500ms |

### Satisfaction

| Metrique | Objectif |
|----------|----------|
| App Store rating | > 4.5 |
| NPS Mobile | > 40 |
| Support tickets mobile | < 5% total |

---

## 11. Risques

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Fragmentation Android | Elevee | Moyen | Tests sur device farm |
| App Store rejection | Faible | Eleve | Guidelines review pre-submit |
| Performance offline | Moyenne | Eleve | Limiter data sync, pagination |
| Adoption utilisateurs | Moyenne | Eleve | Onboarding guide, quick wins |

---

## 12. Annexes

### A. Dependencies Actuelles

```json
{
  "dependencies": {
    "expo": "~54.0.27",
    "expo-camera": "~16.0.17",
    "expo-router": "~4.0.22",
    "firebase": "^12.6.0",
    "react": "18.3.1",
    "react-native": "0.76.9"
  }
}
```

### B. Commandes Utiles

```bash
# Demarrer en dev
cd mobile && npx expo start

# Build iOS
npx expo build:ios

# Build Android
npx expo build:android

# Preview avec Expo Go
# Scanner QR code affiche dans terminal
```

### C. Configuration Firebase

Le fichier `mobile/firebaseConfig.ts` contient la configuration Firebase.
S'assurer que les apps iOS et Android sont enregistrees dans Firebase Console.

---

*PRD genere le 2026-01-23 lors de l'audit de coherence*
*Base sur reverse-engineering du code existant*
*A valider et completer par Product Owner*
