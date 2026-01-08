# 📚 Documentation Technique - Sentinel GRC v2.0

Bienvenue dans la documentation technique de Sentinel GRC v2.0, la plateforme complète de Gouvernance, Risque et Conformité.

## 📖 Table des matières

### 🏗️ Architecture
- [Vue d'ensemble de l'architecture](./architecture/overview.md)
- [Schéma de base de données](./architecture/database-schema.md)
- [Règles de sécurité Firestore](./architecture/security-rules.md)
- [API de référence](./architecture/api-reference.md)
- [Gestion d'état](./architecture/state-management.md)

### ⚙️ Fonctionnalités
- [Gestion des risques](./features/risk-management.md)
- [Conformité multi-frameworks](./features/compliance.md)
- [Workflow d'audit](./features/audit-workflow.md)
- [Gestion documentaire](./features/document-management.md)
- [Privacy & RGPD](./features/privacy-gdpr.md)

### 🚀 Déploiement
- [Configuration Firebase](./deployment/firebase-setup.md)
- [Variables d'environnement](./deployment/environment-variables.md)
- [CI/CD avec GitHub Actions](./deployment/ci-cd.md)
- [Monitoring & Alerting](./deployment/monitoring.md)

### 💻 Développement
- [Guide de contribution](./development/contributing.md)
- [Standards de code](./development/code-standards.md)
- [Tests](./development/testing.md)
- [Debugging](./development/debugging.md)

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+
- npm 9+
- Compte Firebase
- Git

### Installation

```bash
# Cloner le repository
git clone https://github.com/CTC-Kernel/sentinel-grc-v2-prod.git
cd sentinel-grc-v2-prod

# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos credentials Firebase

# Lancer en mode développement
npm run dev
```

### Build de production

```bash
# Build optimisé
npm run build

# Build avec analyse du bundle
npm run build:analyze

# Preview du build
npm run start
```

## 🏛️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React 19)                     │
│  ┌────────────┬──────────────┬───────────────┬───────────┐ │
│  │   Views    │  Components  │    Hooks      │  Services │ │
│  │  (Pages)   │   (UI/UX)    │  (Business)   │  (API)    │ │
│  └────────────┴──────────────┴───────────────┴───────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   State Management                          │
│  ┌───────────┬──────────────┬──────────────┐               │
│  │  Zustand  │ TanStack     │  React       │               │
│  │  (Global) │  Query       │  Context     │               │
│  └───────────┴──────────────┴──────────────┘               │
└─────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────┐
│                   Firebase Backend                          │
│  ┌────────────┬──────────────┬───────────────────────────┐ │
│  │ Firestore  │     Auth     │  Cloud Functions          │ │
│  │ (Database) │ (Multi-MFA)  │  (Serverless)             │ │
│  └────────────┴──────────────┴───────────────────────────┘ │
│  ┌────────────┬──────────────┬───────────────────────────┐ │
│  │  Storage   │  Analytics   │  Messaging                │ │
│  │  (Files)   │  (Tracking)  │  (Push Notif)             │ │
│  └────────────┴──────────────┴───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ Stack Technique

| Catégorie | Technologies |
|-----------|-------------|
| **Frontend** | React 19, TypeScript 5.7, Vite 6.0 |
| **Styling** | Tailwind CSS, Framer Motion |
| **State** | Zustand, TanStack Query, React Context |
| **Backend** | Firebase (Firestore, Auth, Functions, Storage) |
| **UI Components** | Radix UI, Headless UI |
| **Visualisation** | Recharts, D3.js, Three.js |
| **Forms** | React Hook Form, Zod |
| **Testing** | Vitest, Playwright, Testing Library |
| **CI/CD** | GitHub Actions, Firebase Hosting |

## 📊 Modules Métier

- **Assets Management**: Inventaire complet des actifs (matériel, logiciel, données, services, humains)
- **Risk Management**: Gestion des risques selon ISO 27005 avec matrice de risques
- **Compliance**: Conformité multi-frameworks (ISO 27001, NIS2, DORA, GDPR, SOC2)
- **Audit Management**: Audits internes/externes avec checklists et rapports
- **Incident Response**: Gestion des incidents avec playbooks et timeline
- **Document Management**: Workflow documentaire avec versioning et approbation
- **Project Management**: Gestion de projets avec Gantt et milestones
- **Supplier Management**: Évaluation et suivi des fournisseurs
- **Privacy/GDPR**: Registre des traitements (ROPA) et DPIA
- **Business Continuity**: Plans de continuité (BIA, stratégies de récupération)
- **Vulnerability Management**: Suivi des CVE et intégration NVD
- **Threat Intelligence**: Veille cyber et MITRE ATT&CK

## 🔐 Sécurité

- **Multi-tenant**: Isolation stricte par `organizationId`
- **RBAC**: 6 rôles + rôles personnalisés
- **Authentication**: Firebase Auth avec MFA
- **Authorization**: Custom claims + Firestore Security Rules
- **Encryption**: Chiffrement des données sensibles
- **XSS Protection**: DOMPurify
- **HTTPS**: Forcé partout
- **CSP**: Content Security Policy

## 📈 Métriques & Monitoring

- **Sentry**: Error tracking
- **Firebase Analytics**: Usage tracking
- **Performance Monitoring**: Web Vitals
- **Uptime Monitoring**: En cours d'implémentation

## 🤝 Contribution

Consultez le [guide de contribution](./development/contributing.md) pour les standards de code, les conventions de commits et le processus de pull request.

## 📝 License

Propriétaire - CTC Kernel

## 🆘 Support

- **Email**: support@sentinel-grc.com
- **Documentation**: https://docs.sentinel-grc.com
- **Issues**: https://github.com/CTC-Kernel/sentinel-grc-v2-prod/issues

---

**Dernière mise à jour**: 08 janvier 2026
