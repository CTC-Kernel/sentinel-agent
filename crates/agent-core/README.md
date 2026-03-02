# agent-core

Runtime principal du Sentinel GRC Agent.

## Presentation

Cette crate fournit le runtime principal de l'agent, incluant :

- **Gestion de service** : Integration Windows Service et Linux systemd
- **Cycle de vie de l'agent** : Demarrage, arret, pause/reprise
- **Client API** : Communication HTTP avec le serveur Sentinel GRC
- **Surveillance des ressources** : Suivi de l'utilisation CPU, memoire et disque
- **Barre systeme** : Icone de bureau avec menu de statut (macOS/Windows)
- **Auto-protection** : Anti-tampering et verification d'integrite
- **Gestionnaire de mises a jour** : Mises a jour automatiques de l'agent

## Feature flags

- `tray` (par defaut) : Active l'icone dans la barre systeme (tray-icon + muda + tao)
- `gui` : Active le support de l'interface graphique v2 (agent-gui + agent-persistence)

## Modules

| Module | Description |
|--------|-------------|
| `api_client` | Client HTTP pour la communication serveur |
| `audit_trail` | Journalisation d'audit locale avec persistance |
| `cleanup` | Desinstallation et nettoyage des donnees |
| `events` | Gestion des evenements et notifications |
| `resources` | Surveillance et modulation des ressources |
| `self_protection` | Protection anti-tampering |
| `service` | Gestion de service Windows/Linux |
| `state` | Etat d'execution et drapeaux |
| `tray` | Icone de la barre systeme (conditionne par feature flag) |
| `update_manager` | Gestion des mises a jour automatiques |

## Utilisation

```rust
use agent_core::{AgentRuntime, AgentConfig};

let config = AgentConfig::load()?;
let runtime = AgentRuntime::new(config);
runtime.run().await?;
```

## Architecture

La structure `AgentRuntime` est le point d'entree principal. Elle coordonne :

1. **Initialisation** : Chargement de la configuration, initialisation de la base de donnees, creation du client API
2. **Enrolement** : Enregistrement aupres du serveur ou restauration des identifiants existants
3. **Boucle principale** : Heartbeat, controles de conformite, operations de synchronisation
4. **Arret** : Terminaison gracieuse avec nettoyage

## Securite

- Toutes les communications serveur utilisent TLS avec epinglage de certificat
- Les identifiants sont chiffres au repos (DPAPI sous Windows, permissions fichier sous Unix)
- L'auto-protection empeche la modification des binaires et de la configuration de l'agent
