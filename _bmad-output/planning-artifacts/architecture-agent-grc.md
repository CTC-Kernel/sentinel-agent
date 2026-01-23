---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: ['prd-agent-grc.md', 'comprehensive-agent-grc-research-2026-01-23.md', 'project-context.md', 'brainstorming-session-2026-01-23.md']
workflowType: 'architecture'
project_name: 'Agent GRC Sentinel'
user_name: 'Thibaultllopis'
date: '2026-01-23'
---

# Architecture Decision Document - Agent GRC Sentinel

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (72 FRs):**
L'agent endpoint doit supporter 8 domaines fonctionnels :
- **Agent Core (FR1-FR8)** : Installation, service, configuration, heartbeat
- **Compliance Checks (FR9-FR22)** : 20 contrôles NIS2/DORA/RGPD avec preuves
- **Sync & Offline (FR23-FR30)** : Cache, queue, réconciliation, 7j autonomie
- **Dashboard (FR31-FR38)** : Score temps réel, filtres, alertes, historique
- **Administration (FR39-FR47)** : Console agents, tokens, config checks
- **Audit & Reporting (FR48-FR54)** : Accès auditeur, preuves horodatées, 12 mois rétention
- **Security (FR55-FR61)** : mTLS, signing, intégrité, révocation
- **Updates (FR62-FR68)** : Staged rollout, rollback, politiques

**Non-Functional Requirements (50+ NFRs):**

| Catégorie | NFRs Critiques |
|-----------|----------------|
| **Performance** | P3: <100MB RAM, P7: <30s scan complet, P10: <10 IOPS |
| **Security** | S1: TLS 1.3+mTLS, S5: Cert pinning, S6: Self-check SHA256 |
| **Reliability** | R1: 99.5% uptime, R2: 7j offline, R4: 0% perte données |
| **Compliance** | C1: EU-only, C2: 12 mois rétention, C4: Hash signé preuves |

**Scale & Complexity:**
- **Primary domain:** Endpoint Agent (Rust natif) + SaaS Integration (REST API)
- **Complexity level:** HIGH — Multi-OS, conformité réglementaire, architecture distribuée
- **Estimated architectural components:** 8 (6 modules agent + API layer + Dashboard)

### Technical Constraints & Dependencies

| Contrainte | Spécification | Justification |
|------------|---------------|---------------|
| **Langage Agent** | Rust (tokio, reqwest, rusqlite) | Sécurité mémoire, cross-compile |
| **OS Cibles MVP** | Windows 10+, Ubuntu 20.04+, RHEL 8+ | 100% couverture parc standard |
| **Stockage Local** | SQLite + SQLCipher | ACID, single-file, chiffré AES-256 |
| **Communication** | REST/HTTPS port 443 | Firewall-friendly, universel |
| **Privilèges** | SYSTEM (Win) / root (Linux) | Accès configs système |
| **SaaS Existant** | Sentinel GRC (React 19, Firebase, Zustand) | Intégration dashboard |

### Cross-Cutting Concerns Identified

| Concern | Modules Impactés | Pattern Recommandé |
|---------|------------------|-------------------|
| **Sécurité Transport** | Sync, Core | mTLS + Certificate Pinning |
| **Offline Resilience** | Storage, Scanner, Sync | Event Sourcing local + Queue |
| **Multi-OS Abstraction** | System, Scanner | Trait-based abstraction layer |
| **Observabilité** | All | Structured tracing (JSON) |
| **Update Safety** | Core | Staged rollout + Self-check |
| **Audit Trail** | Storage, Scanner | Immutable logs + Hash chain |

## Starter Template Evaluation

### Primary Technology Domain

**Endpoint Agent / System Daemon** — Service natif multi-plateforme (Windows/Linux)

Pas de framework web applicable. Architecture custom basée sur Cargo Workspace.

### Starter Options Considered

| Option | Évaluée | Verdict |
|--------|---------|---------|
| Template existant | Aucun adapté pour agent conformité multi-OS | N/A |
| Single crate | Simple mais non modulaire | ❌ |
| Cargo Workspace | Modulaire, testable, scalable | ✅ |

### Selected Architecture: Cargo Workspace Multi-Crates

**Rationale for Selection:**
- Séparation des concerns (scanner, sync, storage, system)
- Testabilité unitaire par module
- Compilation incrémentale rapide
- Best practice pour projets Rust 50k+ LOC
- Pattern utilisé par rust-analyzer, ripgrep, etc.

**Initialization Command:**

```bash
# Créer le workspace
mkdir sentinel-agent && cd sentinel-agent
cargo init --name agent-core crates/agent-core
cargo init --lib --name agent-scanner crates/agent-scanner
cargo init --lib --name agent-sync crates/agent-sync
cargo init --lib --name agent-storage crates/agent-storage
cargo init --lib --name agent-system crates/agent-system
cargo init --lib --name agent-common crates/agent-common
cargo init --name xtask xtask
```

**Workspace Cargo.toml:**

```toml
[workspace]
resolver = "3"
members = [
    "crates/*",
    "xtask",
]

[workspace.package]
version = "0.1.0"
edition = "2024"
license = "Proprietary"
repository = "https://github.com/sentinel/agent"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.13", features = ["json", "rustls-tls"] }
tokio-rusqlite = "0.7"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json"] }
thiserror = "2"
anyhow = "1"

[workspace.dependencies.windows]
version = "0.58"
features = ["Win32_System_Services", "Win32_Security", "Win32_System_Registry"]

[workspace.dependencies.nix]
version = "0.29"
features = ["user", "process", "fs"]
```

### Architectural Decisions Provided by Structure

**Language & Runtime:**
- Rust 2024 Edition (resolver v3)
- Tokio async runtime (multi-threaded)
- 100% safe Rust (no unsafe blocks in application code)

**Module Boundaries:**

| Crate | Responsabilité | Dépendances internes |
|-------|----------------|---------------------|
| `agent-common` | Types, erreurs, config | — |
| `agent-system` | Abstraction OS | `agent-common` |
| `agent-storage` | SQLite, cache | `agent-common` |
| `agent-scanner` | Exécution checks | `agent-common`, `agent-system` |
| `agent-sync` | Communication SaaS | `agent-common`, `agent-storage` |
| `agent-core` | Main, lifecycle, scheduler | Tous |

**Security Tooling:**
- `cargo-audit` en CI (RustSec advisories)
- `cargo-deny` pour licences et supply chain
- `clippy -D warnings` obligatoire
- Integer overflow checks en release

**Cross-Compilation:**
- `cross` pour builds Linux depuis CI
- Native toolchain pour Windows
- macOS via runner dédié

**Note:** L'initialisation du workspace doit être la première story d'implémentation.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Schéma SQLite (structure données locales)
- Authentification Agent ↔ SaaS
- Chiffrement stockage local

**Important Decisions (Shape Architecture):**
- Cache des règles
- Format de payload
- Stratégie de retry
- Mécanisme de mise à jour
- Logging & observabilité

**Deferred Decisions (Post-MVP):**
- Intelligence collective (V1.2)
- Checks personnalisés UI (V1.2)
- Remediation assistée (V2.0)

### Data Architecture

#### Decision 1.1 — Schéma SQLite Normalisé

**Choix :** Tables séparées (normalized)

**Rationale :** Permet requêtes par check_id, période, status. Meilleur pour les rapports et l'historique 12 mois requis (NFR-C2).

**Schéma Core :**

```sql
-- Configuration & État
CREATE TABLE agent_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Règles de checks (cache)
CREATE TABLE check_rules (
    id TEXT PRIMARY KEY,
    check_type TEXT NOT NULL,
    version INTEGER NOT NULL,
    config_json TEXT NOT NULL,
    synced_at TEXT NOT NULL
);

-- Résultats de checks
CREATE TABLE check_results (
    id TEXT PRIMARY KEY,
    check_id TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pass', 'fail', 'error', 'skipped'
    score INTEGER,
    details_json TEXT,
    proof_hash TEXT,
    synced INTEGER DEFAULT 0,
    FOREIGN KEY (check_id) REFERENCES check_rules(id)
);

-- Preuves horodatées
CREATE TABLE proofs (
    id TEXT PRIMARY KEY,
    result_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'screenshot', 'config_dump', 'log_extract'
    data_blob BLOB,
    hash_sha256 TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (result_id) REFERENCES check_results(id)
);

-- Queue de synchronisation
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'result', 'proof', 'heartbeat'
    entity_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT
);

-- Index pour performance
CREATE INDEX idx_results_check_id ON check_results(check_id);
CREATE INDEX idx_results_synced ON check_results(synced);
CREATE INDEX idx_queue_created ON sync_queue(created_at);
```

#### Decision 1.2 — Cache Règles Embedded SQLite

**Choix :** Règles stockées dans SQLite (même DB)

**Rationale :** Une seule source de vérité, transactions ACID, pas de risque de désync entre fichiers et DB.

**Affects :** `agent-storage`, `agent-scanner`

### Authentication & Security

#### Decision 2.1 — API Key + mTLS Hybrid

**Choix :** API Key pour enrollment initial, mTLS pour toutes communications ultérieures

**Flow d'authentification :**

```
1. ENROLLMENT (une fois)
   Admin génère token enrollment → Agent reçoit token
   Agent POST /agent/register avec token
   SaaS génère certificat client unique
   Agent stocke certificat (SQLCipher)

2. COMMUNICATION (toujours)
   Agent présente certificat client (mTLS)
   SaaS valide certificat + organization_id
   Toutes requêtes authentifiées par certificat
```

**Rationale :**
- Enrollment simple sans PKI côté client
- mTLS conforme NFR-S1 (TLS 1.3 + mutual auth)
- Certificate pinning conforme NFR-S5
- Révocation possible côté SaaS (FR61)

**Affects :** `agent-core`, `agent-sync`, API SaaS

#### Decision 2.2 — SQLCipher AES-256

**Choix :** Base de données entière chiffrée avec SQLCipher

**Configuration :**

```rust
// agent-storage/src/lib.rs
use rusqlite::Connection;

pub fn open_encrypted_db(path: &Path, key: &[u8]) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "key", hex::encode(key))?;
    conn.pragma_update(None, "cipher_page_size", 4096)?;
    conn.pragma_update(None, "kdf_iter", 256000)?;
    Ok(conn)
}
```

**Gestion de la clé :**
- Windows : DPAPI (Data Protection API)
- Linux : Keyring système ou fichier protégé 0600

**Rationale :** Garanti par l'agent, indépendant de la config client. Conforme NFR-S2.

**Affects :** `agent-storage`

### API & Communication Patterns

#### Decision 3.1 — JSON avec Compression gzip

**Choix :** JSON pour tous les échanges, compression gzip automatique

**Format standard des réponses SaaS :**

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-01-23T10:15:30Z"
  }
}
```

**Format erreur :**

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent with ID xxx not registered",
    "details": { ... }
  }
}
```

**Rationale :** Universel, debug facile, compression gzip suffisante (-70% taille). Compatible avec Firebase/SaaS existant.

**Affects :** `agent-sync`, API SaaS

#### Decision 3.2 — Exponential Backoff avec Circuit Breaker

**Choix :** Backoff exponentiel + circuit breaker

**Configuration :**

```rust
// agent-sync/src/retry.rs
pub struct RetryConfig {
    pub initial_delay: Duration,      // 1s
    pub max_delay: Duration,          // 5 min
    pub multiplier: f64,              // 2.0
    pub max_retries: u32,             // 10
    pub circuit_breaker_threshold: u32, // 5 échecs consécutifs
    pub circuit_breaker_reset: Duration, // 30s
}
```

**Comportement :**
1. Échec → retry après 1s
2. Échec → retry après 2s
3. Échec → retry après 4s
4. ... jusqu'à max 5 minutes
5. Après 5 échecs consécutifs → circuit ouvert, queue locale
6. Après 30s → retry, si succès circuit fermé

**Rationale :** Standard industrie, évite surcharge serveur, résilient (NFR-R6).

**Affects :** `agent-sync`

### Infrastructure & Deployment

#### Decision 4.1 — Shadow Copy Update Mechanism

**Choix :** Download nouvelle version à côté, switch atomique, conserver ancienne

**Flow de mise à jour :**

```
1. CHECK
   Agent GET /agent/update → version disponible

2. DOWNLOAD
   Agent télécharge nouveau binaire → /opt/sentinel/agent.new (Linux)
                                    → C:\Sentinel\agent.new.exe (Windows)

3. VERIFY
   Vérifier signature (GPG/Authenticode)
   Vérifier hash SHA-256

4. SWITCH (atomique)
   Rename agent.current → agent.old
   Rename agent.new → agent.current

5. RESTART
   Signal au service manager (systemd/SCM)

6. VALIDATE
   Nouveau process vérifie santé
   Si échec → rollback automatique vers agent.old
```

**Rationale :** Safe, rollback instantané possible, conforme NFR-R5 (<2 min).

**Affects :** `agent-core`, `xtask` (scripts)

#### Decision 4.2 — Structured Logging + Upload

**Choix :** Tracing JSON local + upload périodique vers SaaS

**Configuration tracing :**

```rust
// agent-core/src/main.rs
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

fn init_logging() {
    let file_layer = tracing_subscriber::fmt::layer()
        .json()
        .with_file(true)
        .with_line_number(true)
        .with_writer(rolling_file_appender("logs", "agent.log"));

    tracing_subscriber::registry()
        .with(file_layer)
        .with(EnvFilter::from_default_env())
        .init();
}
```

**Niveaux de log :**
- `ERROR` : Échecs critiques, toujours uploadés
- `WARN` : Anomalies, uploadés
- `INFO` : Opérations normales, uploadés si debug activé
- `DEBUG` : Détails, local uniquement
- `TRACE` : Très verbeux, local uniquement

**Upload :** Batch toutes les 15 minutes ou sur demande support (FR72).

**Rationale :** Diagnostic à distance (FR69-72), support efficace, conforme NFR-M6.

**Affects :** Tous les crates

### Decision Impact Analysis

**Implementation Sequence :**
1. `agent-common` — Types, erreurs, config (aucune dépendance)
2. `agent-storage` — SQLite + SQLCipher (dépend de common)
3. `agent-system` — Abstraction OS (dépend de common)
4. `agent-sync` — Communication SaaS (dépend de common, storage)
5. `agent-scanner` — Checks (dépend de common, system)
6. `agent-core` — Main, orchestration (dépend de tous)

**Cross-Component Dependencies :**

```
agent-core
    ├── agent-scanner
    │       ├── agent-system
    │       │       └── agent-common
    │       └── agent-common
    ├── agent-sync
    │       ├── agent-storage
    │       │       └── agent-common
    │       └── agent-common
    └── agent-common
```

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 12 areas where AI agents could make different choices

### Naming Patterns

**Rust Naming (Mandatory):**

| Element | Convention | Enforced By |
|---------|------------|-------------|
| Crates | `snake_case` | cargo |
| Types | `PascalCase` | clippy |
| Functions | `snake_case` | clippy |
| Constants | `SCREAMING_SNAKE_CASE` | clippy |

**Database Naming:**
- Tables: `snake_case` pluriel (`check_results`, `sync_queue`)
- Columns: `snake_case` (`created_at`, `check_id`)
- Foreign keys: `{table_singular}_id` (`result_id`)
- Index: `idx_{table}_{columns}`

**API Naming:**
- Endpoints: `/agent/{resource}` pluriel
- JSON fields: `snake_case`
- Dates: ISO 8601 UTC

### Structure Patterns

**Crate Organization:**

```
crates/agent-{name}/
├── Cargo.toml
├── src/
│   ├── lib.rs           # Public API
│   ├── error.rs         # Crate errors
│   └── {module}/        # Features
└── tests/               # Integration
```

**Test Location:**
- Unit: même fichier `#[cfg(test)]`
- Integration: `crates/{name}/tests/`
- E2E: `tests/e2e/` workspace root

### Format Patterns

**Error Types (thiserror):**

```rust
#[derive(Error, Debug)]
pub enum {Crate}Error {
    #[error("{context}: {source}")]
    Wrapped { context: String, #[source] source: Box<dyn Error> },
}
```

**Config Structs:**
- `#[serde(rename_all = "snake_case")]` obligatoire
- Defaults via `#[serde(default)]`
- Validation via `validator` crate

**DateTime:**
- Storage: ISO 8601 TEXT (`2026-01-23T10:15:30Z`)
- Use `chrono::DateTime<Utc>` partout

### Communication Patterns

**Tracing:**

```rust
#[tracing::instrument(skip(sensitive_data), fields(id = %entity.id))]
pub async fn operation(...) -> Result<T>
```

**Spans obligatoires pour:**
- Toute opération I/O
- Tout check exécuté
- Toute sync avec SaaS

### Process Patterns

**Async Rules:**
- Toutes fonctions I/O sont `async`
- Jamais `.unwrap()` sur Result
- Jamais `panic!` en production
- Toujours `?` operator avec contexte

**Shutdown:**
- Tous composants implémentent `Component` trait
- Graceful shutdown sur SIGTERM/SIGINT
- Flush logs et sync queue avant exit

### Enforcement Guidelines

**All AI Agents MUST:**
1. Run `cargo fmt` before commit
2. Pass `cargo clippy -- -D warnings`
3. Pass `cargo test` (unit + integration)
4. Pass `cargo deny check`
5. Add `#[tracing::instrument]` to public functions

**Pattern Verification:**
- CI checks: fmt, clippy, test, deny
- PR review checklist includes pattern compliance
- Architecture doc is source of truth

### Anti-Patterns to Avoid

| ❌ Anti-Pattern | ✅ Correct Pattern |
|----------------|-------------------|
| `.unwrap()` | `?` with context |
| `panic!()` | Return `Result` |
| Blocking in async | `tokio::spawn_blocking` |
| Hardcoded strings | `const` or config |
| Mixed naming | Consistent snake_case |
| Tests in src/ | tests/ directory |

