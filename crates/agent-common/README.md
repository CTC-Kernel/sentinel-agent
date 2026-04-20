# agent-common

Types partages et utilitaires pour le Sentinel GRC Agent.

## Presentation

Cette crate constitue la fondation du workspace. Elle fournit les types, erreurs, configurations et utilitaires partages par toutes les autres crates :

- **Configuration** : Chargement, validation et wrapper securise (`SecureConfig` avec ZeroizeOnDrop)
- **Types metier** : Statuts, resultats de controles, evenements, preuves, severites
- **Gestion d'erreurs** : Types d'erreurs communs via `thiserror`
- **Frameworks de conformite** : Definitions pour CIS, NIS2, DORA, ISO 27001, SOC2
- **Utilitaires** : Filtrage de donnees sensibles, manipulation JWT, gestion de processus

## Modules

| Module | Description |
|--------|-------------|
| `config` | `AgentConfig` et `SecureConfig` (RAII avec auto-zeroize) |
| `constants` | Constantes globales (endpoints, timeouts, Firebase) |
| `error` | `CommonError` et type `Result` |
| `jwt` | Parsing et validation des tokens JWT |
| `process` | Utilitaires de gestion de processus (cross-platform) |
| `sensitive_filter` | Masquage de donnees sensibles dans les logs |
| `macos` | Utilitaires specifiques macOS |
| `frameworks/` | Definitions des referentiels de conformite |
| `types/` | Hierarchie de types metier |

## Types principaux

### Agent et configuration

- `AgentConfig` : Configuration complete de l'agent
- `SecureConfig` : Wrapper RAII qui zeroize les secrets en memoire au drop
- `AgentStatus` : Etats de l'agent (online, degraded, offline)

### Controles et conformite

- `CheckResult` : Resultat d'un controle de conformite
- `CheckStatus` : Pass, Fail, Unknown
- `Severity` : Critical, High, Medium, Low, Info
- `Proof` : Preuve de conformite horodatee avec hash d'integrite

### Evenements et securite

- `RuntimeEvent` / `RuntimeEventKind` : Evenements internes de l'agent
- `FimBaseline`, `FimAlert`, `FimChangeType` : Types FIM
- `RemediationPlan`, `RemediationAction` : Types de remediation

## Utilisation

```rust
use agent_common::{AgentConfig, SecureConfig};
use agent_common::types::{CheckResult, CheckStatus, Severity};

// Chargement securise de la configuration
let config = AgentConfig::load()?;
let secure = SecureConfig::new(config); // Auto-zeroize on drop

// Creation d'un resultat de controle
let result = CheckResult {
    check_id: "ENC-001".to_string(),
    status: CheckStatus::Pass,
    severity: Severity::Critical,
    // ...
};
```

## Securite

- `SecureConfig` efface automatiquement les secrets de la memoire (`zeroize`)
- `sensitive_filter` masque les tokens, cles et URLs dans les logs
- Les types utilisent `#[derive(Zeroize, ZeroizeOnDrop)]` pour les champs sensibles
- `panic = "unwind"` requis dans Cargo.toml pour garantir l'execution du Drop
