# Contribuer au Sentinel GRC Agent

Merci de votre interet pour Sentinel GRC Agent ! Ce guide explique comment contribuer au projet.

## Prerequis

- **Rust Edition 2024** (1.93.0+)
- `rustfmt`, `clippy`, `llvm-tools-preview` (via `rustup component add`)
- `cargo-deny`, `cargo-audit` (via `cargo install`)

## Demarrage

```bash
# Cloner le depot
git clone https://github.com/CTC-Kernel/sentinel-agent.git
cd sentinel-agent

# Compiler
cargo build

# Lancer les tests
cargo test

# Lancer toutes les verifications de qualite
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test && cargo deny check
```

## Portes de qualite

Toutes les pull requests doivent passer :

| Verification | Commande |
|--------------|----------|
| Formatage | `cargo fmt --check` |
| Analyse statique | `cargo clippy --all-targets -- -D warnings` |
| Tests | `cargo test` |
| Licences et securite | `cargo deny check` |
| Vulnerabilites | `cargo audit` |

## Style de code

- **Pas de types `any`** -- equivalent TypeScript strict : tous les types doivent etre explicites
- **Pas de `unwrap()`** sur les donnees utilisateur -- utiliser une gestion d'erreur appropriee
- **Pas de `let _ =`** pour ignorer des valeurs `Result` importantes
- Utiliser `saturating_*()` / `.clamp()` pour l'arithmetique afin d'eviter les depassements
- Utiliser `chars()` / `char_indices()` au lieu de l'indexation par octets pour la securite UTF-8
- Toutes les requetes SQL doivent utiliser des parametres (pas d'interpolation de chaines)

## Architecture

Le projet est un workspace Rust avec des crates modulaires :

| Crate | Role |
|-------|------|
| `agent-common` | Types partages, configuration, constantes |
| `agent-core` | Orchestration principale, point d'entree |
| `agent-gui` | Interface graphique egui + barre systeme |
| `agent-scanner` | Controles de conformite, scan CVE |
| `agent-network` | Topologie reseau, decouverte |
| `agent-storage` | Stockage SQLite chiffre |
| `agent-sync` | Communication serveur (mTLS) |
| `agent-fim` | Surveillance de l'integrite des fichiers |
| `agent-siem` | Transfert de logs SIEM |
| `agent-persistence` | Gestion de l'etat persistant |
| `agent_llm` | Analyse LLM locale (experimental) |
| `xtask` | Automatisation de build |

## Processus de Pull Request

1. Forkez le depot et creez une branche de fonctionnalite
2. Effectuez vos modifications avec des tests
3. Assurez-vous que toutes les portes de qualite passent en local
4. Soumettez une pull request avec une description claire
5. Traitez les retours de la revue de code

## Signaler des problemes

- Utilisez les GitHub Issues pour les rapports de bugs et les demandes de fonctionnalites
- Pour les vulnerabilites de securite, consultez [SECURITY.md](SECURITY.md)

## Licence

En contribuant, vous acceptez que vos contributions soient placees sous la licence MIT.
