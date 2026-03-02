# agent-storage

Stockage local chiffre pour le Sentinel GRC Agent.

## Presentation

Cette crate fournit la persistance securisee des donnees locales :

- **Chiffrement SQLCipher** : Chiffrement de base de donnees AES-256-CBC
- **Gestion des cles** : Protection des cles specifique a chaque plateforme
- **Repositories** : Patterns d'acces aux donnees type-safe
- **Migrations** : Versionnage et mise a niveau du schema

## Securite

### Gestion des cles

Les cles sont protegees par des mecanismes specifiques a chaque plateforme :

| Plateforme | Protection |
|------------|------------|
| Windows | DPAPI (Data Protection API) |
| Linux | Permissions fichier (0600) + liaison machine-id |
| macOS | Permissions fichier (0600) + liaison IOPlatformUUID |

Les cles sont effacees de la memoire a la destruction (zeroize).

### Chiffrement de la base de donnees

Toutes les donnees sont chiffrees au repos avec SQLCipher :

- Chiffrement AES-256-CBC
- Cle derivee du fichier de cle protege
- Chiffrement/dechiffrement transparent

## Repositories

| Repository | Donnees |
|------------|---------|
| `CheckResultsRepository` | Resultats des controles de conformite |
| `CheckRulesRepository` | Regles fournies par le serveur |
| `CredentialsRepository` | Identifiants d'authentification |
| `ProofsRepository` | Preuves de conformite |
| `AuditTrailRepository` | Journaux d'audit locaux |
| `SyncQueueRepository` | File d'attente de synchronisation hors-ligne |

## Utilisation

```rust
use agent_storage::{Database, DatabaseConfig, KeyManager};

// Initialiser le gestionnaire de cles
let key_manager = KeyManager::new()?;

// Ouvrir la base de donnees chiffree
let config = DatabaseConfig::default();
let db = Database::open(config, &key_manager)?;

// Utiliser les repositories
let repo = CheckResultsRepository::new(&db);
let results = repo.get_pending_sync().await?;
```

## Migrations

Les migrations de schema sont versionnees et appliquees automatiquement :

```rust
use agent_storage::migrations;

migrations::run_migrations(&mut conn)?;
let version = migrations::get_schema_version(&conn)?;
```
