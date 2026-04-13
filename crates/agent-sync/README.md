# agent-sync

Synchronisation serveur pour le Sentinel GRC Agent.

## Presentation

Cette crate gere toutes les communications avec le serveur Sentinel GRC :

- **Authentification** : mTLS avec epinglage de certificat
- **Synchronisation de la configuration** : Telechargement de la configuration serveur
- **Synchronisation des regles** : Mises a jour des regles de conformite
- **Upload des resultats** : Resultats des controles et preuves
- **Mode hors-ligne** : Autonomie hors-ligne de 7 jours

## Modules

| Module | Description |
|--------|-------------|
| `authenticated_client` | Client HTTP mTLS avec rafraichissement automatique |
| `config_sync` | Synchronisation de la configuration serveur |
| `credentials` | Stockage securise des identifiants |
| `diagnostics` | Etat de connexion et journalisation |
| `integrity` | Verification d'integrite des binaires et de la configuration |
| `offline` | Mode hors-ligne et file d'attente de synchronisation |
| `pinning` | Epinglage de certificat avec TOFU |
| `result_upload` | Upload par lots des resultats de controles |
| `rollout` | Support du deploiement canary |
| `rules` | Synchronisation des regles avec cache ETag |
| `security` | Signature des logs et verification des signatures |
| `update` / `updater` | Orchestration et execution de la mise a jour automatique |
| `orchestrator` | Coordination globale de toutes les synchronisations |
| `enrollment` | Flux d'enrollment JWT |
| `heartbeat` | Communication periodique avec metriques |
| `audit_sync` | Synchronisation du journal d'audit |
| `command_results` | Retour d'execution des commandes serveur |
| `client` | Client HTTP de base |

## Fonctionnalites de securite

### Epinglage de certificat

Trust-on-first-use (TOFU) avec support de pin de secours :

```rust
use agent_sync::CertificatePinning;

let pinning = CertificatePinning::from_fingerprints(vec![
    "sha256:ABC123...",
    "sha256:DEF456...", // Pin de secours
]);
```

### Signature des logs

Chaine de logs HMAC-SHA256 pour la detection de falsification :

```rust
use agent_sync::LogSigner;

let signer = LogSigner::new(&key);
let entry = signer.sign("INFO", "core", "Agent demarre").await?;
```

### Verification de signature

Validation de la signature des binaires :

- Windows : Authenticode via PowerShell
- Linux/macOS : Signatures detachees GPG

## Mode hors-ligne

L'agent fonctionne de maniere autonome pendant 7 jours maximum hors-ligne :

- Resultats mis en file d'attente localement avec backoff exponentiel
- Disjoncteur (circuit breaker) pour eviter de surcharger le serveur
- Resynchronisation automatique a la reconnexion
