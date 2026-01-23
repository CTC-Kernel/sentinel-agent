# Sentinel GRC Agent

Agent de surveillance et de conformité pour la plateforme Sentinel GRC v2.0.

## 🎯 Objectifs

- **Surveillance continue** : Monitoring en temps réel des actifs et vulnérabilités
- **Détection de menaces** : Analyse de sécurité proactive et remédiation
- **Conformité automatisée** : Vérification des contrôles ISO 27001
- **Rapporting** : Génération automatique de preuves d'audit
- **Intégration** : Communication sécurisée avec la plateforme centrale

## 🚀 Démarrage rapide

### Prérequis
- Rust 1.70+
- SQLite 3
- Système d'exploitation supporté (Linux, Windows, macOS)

### Installation

```bash
# Cloner le projet
git clone <repository-url>
cd sentinel-grc-v2-prod

# Installer les dépendances
npm install

# Configurer Firebase
cp .env.example .env.local
# Éditer .env.local avec vos clés Firebase

# Démarrer l'application
npm run dev
```

### Variables d'environnement

```env
VITE_FIREBASE_API_KEY=votre_api_key
VITE_FIREBASE_AUTH_DOMAIN=votre_domaine
VITE_FIREBASE_PROJECT_ID=votre_projet_id
VITE_FIREBASE_STORAGE_BUCKET=votre_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=votre_sender_id
VITE_FIREBASE_APP_ID=votre_app_id
```

## 🧪 Tests

L'application inclut une suite complète de tests unitaires avec Vitest :

```bash
# Lancer tous les tests
npm test

# Tests avec UI
npm run test:ui

# Couverture de code
npm run test:coverage
```

### Tests inclus (63 tests)
- **Permissions** : RBAC, rôles, validation d'accès
- **Notifications** : Service temps réel, persistence Firestore
- **Store** : État global, thème, toasts
- **Logger** : Traçabilité des actions
- **Calendar** : Génération ICS
- **Form Validation** : Validation assets et risques

## 🏗️ Architecture

### Frontend
- **React 18** avec TypeScript
- **Vite** pour le build
- **TailwindCSS** pour le style
- **Zustand** pour l'état global
- **React Router** pour la navigation

### Backend
- **Firebase Firestore** : Base de données
- **Firebase Auth** : Authentification
- **Firebase Storage** : Fichiers
- **Firebase Functions** : Backend serverless

### Sécurité
- **RBAC** : 6 rôles (admin, rssi, auditor, project_manager, direction, user)
- **Permissions granulaires** : Matrice ressource/action
- **Validation stricte** : Types TypeScript, validation formulaire
- **Audit trail** : Journalisation complète des actions

## 📋 Modules fonctionnels

### 1. Gestion des actifs
- **CRUD complet** : Création, lecture, mise à jour, suppression
- **Classification** : Matériel, Logiciel, Données, Service, Humain
- **Criticité** : Confidentialité, Intégrité, Disponibilité
- **Suivi** : Maintenance, amortissement, garantie
- **Import/Export** : CSV avec validation

### 2. Gestion des risques
- **Évaluation ISO 27005** : Menaces, vulnérabilités, probabilité, impact
- **Calcul automatique** : Score de risque (probabilité × impact)
- **Traitement** : Accepter, Atténuer, Transférer, Éviter
- **Historisation** : Suivi des modifications
- **Matrice visuelle** : Heatmap des risques

### 3. Gestion de projet SSI
- **Planning** : Jalons, échéances, responsables
- **Suivi** : Avancement, tâches, commentaires
- **Liens** : Association automatique avec actifs, risques, contrôles
- **Export** : PDF, CSV, calendrier ICS

### 4. Gestion des audits
- **Planification** : Audits internes/externes
- **Checklists** : Grilles conformes ISO 27001
- **Collecte** : Preuves, questionnaires
- **Rapports** : Génération PDF automatique
- **Historique** : Traçabilité complète

### 5. Gestion documentaire
- **Workflow** : Brouillon → Revue → Approbation → Publication
- **Versionning** : Contrôle des versions
- **Signatures** : Validation électronique
- **Liens** : Association avec contrôles, actifs, audits
- **Stockage** : Firebase Storage sécurisé

### 6. Conformité ISO 27001
- **Tableaux de bord** : État par annexe A
- **Contrôles** : Suivi d'implémentation
- **SoA** : Statement of Applicability automatisé
- **Preuves** : Collecte et association
- **Rapports** : Conformité et écarts

## 🔐 Rôles et permissions

| Rôle | Description | Permissions principales |
|------|-------------|------------------------|
| **Admin** | Administrateur système | Accès complet à tout |
| **RSSI** | Responsable sécurité | Gestion risques, actifs, projets, audits, documents |
| **Auditeur** | Auditeur interne/externe | Gestion audits, documents (lecture/écriture), consultation |
| **Chef de Projet** | Project Manager | Gestion projets, documents (lecture/écriture), consultation |
| **Direction** | Direction | Lecture seule sur tous les modules |
| **Utilisateur** | Utilisateur métier | Lecture limitée (documents, actifs) |

## 📊 Notifications temps réel

- **Persistence** : Stockage Firestore
- **Types** : Success, Error, Info, Warning
- **Automatisation** : Checks périodiques (audits, documents, maintenance, risques)
- **Marquage** : Lu/non lu avec synchronisation
- **Filtrage** : Par utilisateur, organisation, type

## 🎨 Personnalisation

- **Thème** : Clair/Sombre avec persistance
- **Langue** : Français (prévu multilingue)
- **Préférences** : Notifications, affichage
- **Export** : Formats personnalisables

## 📈 Monitoring et logs

- **Actions utilisateur** : Traçabilité complète
- **Erreurs** : Capture et logging
- **Performance** : Monitoring des temps de réponse
- **Sécurité** : Journalisation des accès

## 🔧 Déploiement

### Build de production

```bash
# Build optimisé
npm run build

# Preview local
npm run preview

# Déploiement (exemple Firebase Hosting)
firebase deploy --only hosting
```

### Configuration CI/CD

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: votre-projet-id
```

## 🤝 Contribuer

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Commiter les changements (`git commit -m 'Add amazing feature'`)
4. Pusher la branche (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier [LICENSE](LICENSE) pour les détails.

## 🆘 Support

Pour toute question ou support :
- Documentation complète : [USER_GUIDE.md](USER_GUIDE.md)
- Issues GitHub : [Issues](https://github.com/votre-repo/issues)
- Contact : [votre-email@exemple.com]

---

**Sentinel GRC v2.0** - La sécurité au cœur de votre transformation digitale
=======
# Sentinel GRC Agent

[![CI](https://github.com/sentinel/agent/actions/workflows/ci.yml/badge.svg)](https://github.com/sentinel/agent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Proprietary-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-2024%20edition-orange.svg)](https://www.rust-lang.org/)

A lightweight, secure compliance agent for endpoint monitoring and GRC (Governance, Risk, Compliance) enforcement.

## Overview

Sentinel GRC Agent is a cross-platform agent that:
- Monitors endpoint compliance with security policies
- Executes configurable compliance checks
- Reports results to the Sentinel GRC SaaS platform
- Works offline with local caching and sync

## Architecture

The agent is built as a Rust workspace with modular crates:

```
sentinel-agent/
├── crates/
│   ├── agent-common/    # Shared types and utilities
│   ├── agent-system/    # Platform-specific system interactions
│   ├── agent-storage/   # SQLite-based encrypted local storage
│   ├── agent-scanner/   # Compliance check engine
│   ├── agent-sync/      # SaaS communication and synchronization
│   └── agent-core/      # Main entry point and orchestration
└── xtask/               # Build automation tasks
```

## Requirements

- Rust 2024 Edition (1.93.0+)
- Supported platforms:
  - Windows 10+ (x64)
  - Linux (Ubuntu 20.04+, RHEL 8+)

## Building

```bash
# Debug build
cargo build

# Release build
cargo build --release

# Run tests
cargo test

# Run with all checks
cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

## Development

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install development tools
cargo install cargo-deny cargo-audit
rustup component add rustfmt clippy llvm-tools-preview
```

### Quality Gates

All PRs must pass:
- `cargo fmt --check` - Code formatting
- `cargo clippy -- -D warnings` - Linting
- `cargo test` - Unit tests
- `cargo deny check` - License and security checks
- `cargo audit` - Vulnerability scanning

### Code Coverage

Coverage reports are generated using `cargo-llvm-cov`:

```bash
cargo install cargo-llvm-cov
cargo llvm-cov --all-features --workspace
```

Minimum coverage threshold: **70%**

## Security

- All data encrypted at rest (SQLCipher/AES-256)
- TLS 1.3 + mTLS for all communications
- Binary signing (Authenticode/GPG)
- Regular security audits via cargo-audit

## License

Proprietary - All rights reserved.
>>>>>>> 9c7e4d1a7 (feat: Sentinel GRC Agent with vulnerability detection and incident reporting)
