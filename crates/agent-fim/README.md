# agent-fim

Surveillance d'integrite des fichiers (FIM) pour le Sentinel GRC Agent.

## Presentation

Cette crate fournit un moteur de File Integrity Monitoring (FIM) haute performance base sur des primitives cryptographiques fortes :

- **Surveillance temps reel** : Detection instantanee des modifications via les APIs OS natives (inotify, FSEvents, ReadDirectoryChanges)
- **Hachage BLAKE3/SHA2** : Baselines d'integrite ultra-rapides avec BLAKE3, SHA-256 optionnel pour conformite
- **Politiques flexibles** : Configuration des chemins surveilles, patterns d'exclusion, profondeur maximale
- **Generation d'alertes** : Alertes categorisees par severite avec contexte complet

## Architecture

```
FimEngine (coordinateur)
  |-- Watcher      : Surveillance OS des evenements fichier (notify)
  |-- BaselineManager : Calcul et comparaison des hashs BLAKE3
  |-- Alerts       : Generation d'alertes FIM
  `-- Policy       : Configuration des politiques de surveillance
```

## Modules

| Module | Description |
|--------|-------------|
| `watcher` | Boucle async de surveillance via la crate `notify` |
| `baseline` | Gestion des snapshots d'integrite (HashMap + RwLock) |
| `alerts` | Logique de generation et categorisation des alertes |
| `policy` | Configuration des politiques FIM |

## Capacites

### Surveillance

- Surveillance recursive ou non-recursive des repertoires
- Profondeur maximale configurable (defaut : 5 niveaux)
- Patterns d'exclusion via glob matching
- Deduplication des evenements rapides (debounce)

### Plateformes supportees

| Plateforme | Backend |
|------------|---------|
| Linux | inotify |
| macOS | FSEvents |
| Windows | ReadDirectoryChanges |

### Types de changements detectes

- Creation de fichier
- Modification de contenu
- Suppression de fichier
- Renommage
- Changement de permissions

## Utilisation

```rust
use agent_fim::{FimEngine, FimPolicy};

// Definir une politique de surveillance
let policy = FimPolicy {
    watched_paths: vec!["/etc".into(), "/usr/bin".into()],
    recursive: true,
    ignore_patterns: vec!["*.tmp".into(), "*.log".into()],
    // ...
};

// Demarrer le moteur FIM
let engine = FimEngine::new(policy)?;
engine.create_baseline().await?;
engine.start_watching().await?;
```

## Securite

- **BLAKE3** pour le hachage rapide des baselines (3x plus rapide que SHA-256)
- **SHA-256** optionnel pour conformite reglementaire
- Les alertes FIM alimentent le pipeline de menaces (`threat_pipeline`) pour correlation
- Integre avec les referentiels NIS2 et ISO 27001 (controle d'integrite des actifs)
