# agent-core

Runtime principal et orchestrateur du Sentinel GRC Agent.

## Presentation

Cette crate est le coeur de l'agent. Elle orchestre l'ensemble des sous-systemes :

- **Gestion de service** : Integration Windows Service et Linux systemd
- **Cycle de vie** : Demarrage, arret, pause/reprise avec terminaison gracieuse
- **Enrollment** : Authentification JWT avec extraction `organizationId`
- **Heartbeat** : Communication periodique avec la plateforme (statut, metriques, commandes)
- **Client API** : Communication HTTP securisee avec le serveur Sentinel GRC
- **Pipeline de menaces** : Detection → Classification IA → Reponse automatique
- **Moteur de playbooks** : Evaluation de conditions et declenchement de reponses avec scoring IA
- **Actions EDR** : `kill_process`, `quarantine_file`, `block_ip` avec protection Anti-Draper
- **Auto-protection** : Verification d'integrite binaire SHA-256, detection debugger, monitoring services
- **Self-update** : Mise a jour automatique avec reporting de statut
- **Surveillance des ressources** : Suivi CPU, memoire, disque avec modulation
- **Remediation** : Execution d'actions correctives avec timeout de 5 minutes
- **CMDB & Asset Sync** : Synchronisation des assets decouverts vers la plateforme GRC
- **Enrichissement SIEM** : Enrichissement des donnees avant export SIEM

## Feature flags

| Feature | Description |
|---------|-------------|
| `tray` (defaut) | Icone barre systeme (tray-icon + muda + tao) |
| `gui` | Interface graphique v2 (agent-gui + agent-persistence + agent_llm) |
| `llm` | Inference LLM locale (MistralRS) |

## Modules

| Module | Description |
|--------|-------------|
| `api_client` | Client HTTP pour la communication serveur |
| `enrollment` | Enrollment JWT + gestion des credentials |
| `heartbeat` | Communication periodique (statut, metriques, commandes) |
| `compliance` | Orchestration des scans de conformite |
| `scanning` | Scan de vulnerabilites et securite |
| `threat_pipeline` | Pipeline autonome detection → classification → reponse |
| `playbook_engine` | Evaluation de conditions et actions automatiques |
| `edr_actions` | Actions EDR (kill, quarantine, block) avec Anti-Draper |
| `self_protection` | Verification integrite binaire, config, debugger, services |
| `self_update` | Mise a jour automatique avec reporting |
| `update_manager` | Gestion du cycle de mise a jour |
| `remediation_ops` | Execution d'actions correctives (timeout 5 min) |
| `asset_sync` | Synchronisation assets vers la plateforme GRC |
| `risk_generation` | Calcul automatique du score de risque |
| `network_ops` | Operations de decouverte et surveillance reseau |
| `siem_enrichment` | Enrichissement des donnees SIEM |
| `audit_trail` | Journalisation d'audit locale avec persistance |
| `gui_bridge` | Pont de communication avec l'interface egui |
| `llm_service` | Integration LLM locale |
| `resources` | Surveillance et modulation des ressources |
| `events` | Gestion des evenements et notifications |
| `cleanup` | Desinstallation et nettoyage des donnees |
| `logging` | Configuration des logs structures |
| `tracing_layer` | Observabilite OpenTelemetry/tracing |
| `state` | Etat d'execution et drapeaux |
| `sync_converters` | Conversion de donnees pour synchronisation |
| `sync_init` | Initialisation de la synchronisation |
| `service` | Gestion de service Windows/Linux |
| `tray` | Icone barre systeme (conditionne par feature flag) |
| `system_utils` | Utilitaires cross-platform |

## Utilisation

```rust
use agent_core::{AgentRuntime, AgentConfig};

let config = AgentConfig::load()?;
let runtime = AgentRuntime::new(config);
runtime.run().await?;
```

## Architecture

La structure `AgentRuntime` est le point d'entree principal. Elle coordonne :

1. **Initialisation** : Chargement de la configuration (`SecureConfig`), base de donnees SQLCipher, client API
2. **Enrollment** : Enregistrement par JWT ou restauration des credentials existants
3. **Boucle principale** : Heartbeat, controles de conformite, synchronisation, pipeline de menaces
4. **Arret** : Terminaison gracieuse avec nettoyage et zeroize des secrets

## Securite

- Toutes les communications utilisent TLS 1.3 avec epinglage de certificat (mTLS)
- Les credentials sont chiffres au repos (DPAPI sous Windows, permissions fichier sous Unix)
- `SecureConfig` efface automatiquement les secrets en memoire (ZeroizeOnDrop)
- L'auto-protection empeche la modification des binaires et de la configuration
- Les actions EDR ne peuvent pas cibler le processus agent lui-meme (Anti-Draper)
- L'integrite binaire est verifiee par SHA-256 au demarrage
