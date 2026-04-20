# agent-persistence

Sauvegarde, restauration, migration et rotation de cles pour le Sentinel GRC Agent.

## Presentation

Cette crate gere le cycle de vie complet des donnees persistantes de l'agent :

- **Sauvegarde** : Backups chiffres de la base de donnees avec metadonnees et verification d'integrite
- **Restauration** : Verification d'integrite et reparation automatique de la base
- **Migration** : Export/import d'identite pour le transfert entre machines
- **Rotation de cles** : Renouvellement atomique des cles de chiffrement SQLCipher
- **Nettoyage** : Desinstallation propre avec preservation optionnelle de l'historique
- **Repositories** : Persistance des evenements, notifications et snapshots de politiques

## Modules

| Module | Description |
|--------|-------------|
| `backup` | `BackupManager` : creation et restauration de backups chiffres |
| `recovery` | `RecoveryManager` : verification d'integrite et reparation |
| `migration` | `MigrationManager` : export/import d'identite entre machines |
| `key_rotation` | `KeyRotationManager` : rotation atomique des cles de chiffrement |
| `cleanup` | `CleanupManager` : desinstallation propre |
| `repositories/events` | Persistance des evenements runtime de l'agent |
| `repositories/notifications` | Notifications GUI avec statut lu/non-lu |
| `repositories/policy_snapshots` | Historique des changements de politique |

## Architecture

### Sauvegarde

Le `BackupManager` cree des backups chiffres avec verification d'integrite :

```rust
use agent_persistence::{BackupManager, BackupReason};

let manager = BackupManager::new(&db)?;

// Backup planifie
manager.create_backup(path, BackupReason::Schedule).await?;

// Backup avant mise a jour
manager.create_backup(path, BackupReason::PreUpdate).await?;

// Restauration
manager.restore_backup(path).await?;
```

Raisons de backup : `Schedule`, `PreUpdate`, `PreMigration`, `Manual`

### Restauration et integrite

Le `RecoveryManager` verifie et repare la base de donnees :

```rust
use agent_persistence::{RecoveryManager, RecoveryAction};

let manager = RecoveryManager::new(&db)?;

// Verification d'integrite
let report = manager.check_integrity().await?;

// Reparation si necessaire
if report.needs_repair() {
    manager.repair(RecoveryAction::Vacuum).await?;
}
```

Types de verification : `Pragma`, `TableStructure`, `Constraints`, `Indices`

### Migration entre machines

Le `MigrationManager` permet le transfert securise d'identite :

```rust
use agent_persistence::MigrationManager;

let manager = MigrationManager::new(&db)?;

// Export de l'identite (machine source)
let export = manager.export_identity().await?;

// Import de l'identite (machine cible)
manager.import_identity(export).await?;
```

### Rotation de cles

Le `KeyRotationManager` effectue un renouvellement atomique avec fallback :

```rust
use agent_persistence::KeyRotationManager;

let manager = KeyRotationManager::new(&db)?;
let result = manager.rotate_keys(new_key).await?;
```

## Securite

- Les backups sont chiffres avec la meme cle SQLCipher que la base source
- La verification d'integrite couvre la structure, les contraintes et les index
- La rotation de cles est atomique avec support de rollback
- Le nettoyage (`CleanupManager`) zeroize les donnees sensibles avant suppression
- Les exports d'identite sont chiffres pour le transfert
