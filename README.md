# Sentinel GRC Agent

[![CI](https://github.com/CTC-Kernel/sentinel-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/CTC-Kernel/sentinel-agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-2024%20edition-orange.svg)](https://www.rust-lang.org/)
[![Version](https://img.shields.io/badge/version-2.0.113-green.svg)]()

Agent endpoint leger et securise pour la surveillance de conformite, le scan de vulnerabilites, la decouverte reseau et l'application des politiques GRC (Gouvernance, Risques, Conformite) -- avec une interface graphique de bureau optionnelle en temps reel.

**Developpe par [Cyber Threat Consulting](https://cyber-threat-consulting.com)**

## Presentation

Sentinel GRC Agent est un agent multi-plateforme qui :

### Conformite et Securite
- Execute **21 controles de conformite** couvrant les referentiels CIS, NIS2, ISO 27001, DORA et SOC2
- Scanne **151+ paquets Homebrew** a la recherche de vulnerabilites CVE connues
- Surveille les processus en cours d'execution pour detecter les activites suspectes
- Fournit une remediation automatisee pour les controles en echec
- Surveille l'integrite des fichiers critiques

### Reseau
- Collecte la topologie reseau (interfaces, connexions actives, routes)
- Effectue la decouverte reseau via ARP, mDNS et SSDP
- Detecte les anomalies de securite au niveau reseau

### Interface graphique
- Interface de bureau en temps reel construite avec **egui** et une icone dans la barre systeme
- **14 pages** : Tableau de bord, Surveillance (graphiques CPU/RAM/Disque/Reseau), Conformite, Logiciels, Vulnerabilites, Integrite des fichiers, Menaces, Reseau, Synchronisation, Terminal (logs en direct), Decouverte, Cartographie, Notifications, Parametres
- Indicateur de synchronisation premium dans la barre laterale avec point d'etat anime
- Support des themes clair et sombre

### Synchronisation et Stockage
- Remonte les resultats vers la plateforme Sentinel GRC
- Stockage SQLite chiffre (SQLCipher AES-256)
- Authentification par certificat (mTLS) avec fallback par en-tete
- Mode hors-ligne prioritaire avec synchronisation differee (store-and-forward)
- Planification intelligente avec jitter pour eviter les effets de troupeau
- Modulation des scans en fonction de la batterie

## Architecture

L'agent est construit sous forme d'un workspace Rust avec des crates modulaires :

```
sentinel-agent/
├── crates/
│   ├── agent-common/    # Types partages, configuration et utilitaires
│   ├── agent-system/    # Interactions systeme specifiques a chaque plateforme
│   ├── agent-storage/   # Stockage local chiffre base sur SQLite
│   ├── agent-scanner/   # Controles de conformite, scanner de vulnerabilites, moniteur de securite
│   ├── agent-network/   # Collecte reseau, decouverte et detection de securite
│   ├── agent-sync/      # Communication SaaS (mTLS, upload des resultats, synchronisation des regles)
│   ├── agent-gui/       # Interface graphique egui avec barre systeme
│   └── agent-core/      # Point d'entree principal et orchestration
└── xtask/               # Taches d'automatisation de build
```

## Prerequis

- Rust Edition 2024 (1.93.0+)
- Plateformes supportees :
  - macOS 12+ (x86_64 et Apple Silicon/ARM64)
  - Windows 10+ (x64)
  - Linux (Ubuntu 20.04+, RHEL 8+)

## Compilation

```bash
# Compilation avec GUI (bureau)
cargo build --release --package agent-core --features gui

# Compilation headless (serveur)
cargo build --release --package agent-core

# Compilation debug
cargo build

# Lancer les tests
cargo test

# Lancer toutes les verifications
cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

## Developpement

### Prerequis

```bash
# Installer Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Installer les outils de developpement
cargo install cargo-deny cargo-audit
rustup component add rustfmt clippy llvm-tools-preview
```

### Portes de qualite

Toutes les PR doivent passer :
- `cargo fmt --check` - Formatage du code
- `cargo clippy -- -D warnings` - Analyse statique (linting)
- `cargo test` - Tests unitaires
- `cargo deny check` - Verification des licences et de la securite
- `cargo audit` - Scan de vulnerabilites

### Couverture de code

Les rapports de couverture sont generes avec `cargo-llvm-cov` :

```bash
cargo install cargo-llvm-cov
cargo llvm-cov --all-features --workspace
```

Seuil minimum de couverture : **70%**

## Securite

- Toutes les donnees chiffrees au repos (SQLCipher/AES-256)
- TLS 1.3 + mTLS pour toutes les communications
- Authentification par certificat avec fallback par en-tete
- Signature des binaires (Authenticode/GPG)
- Audits de securite reguliers via cargo-audit

## Support

- **Issues** : [GitHub Issues](https://github.com/CTC-Kernel/sentinel-agent/issues)
- **Site web** : [cyber-threat-consulting.com](https://cyber-threat-consulting.com)

## Contribuer

Les contributions sont les bienvenues ! Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour les directives.

## Licence

Licence MIT - Copyright 2024-2026 Cyber Threat Consulting. Voir [LICENSE](LICENSE) pour les details.
