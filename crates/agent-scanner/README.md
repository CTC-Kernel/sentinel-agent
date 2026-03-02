# agent-scanner

Moteur d'analyse de conformite pour le Sentinel GRC Agent.

## Presentation

Cette crate fournit les capacites d'analyse de conformite et de securite :

- **Controles de conformite** : 21 controles integres pour NIS2, DORA et d'autres referentiels
- **Scan de vulnerabilites** : Detection de vulnerabilites sur les paquets (apt, brew, Windows)
- **Surveillance de securite** : Surveillance des processus, USB et evenements systeme
- **Generation de preuves** : Preuves de conformite horodatees avec verification d'integrite
- **Calcul de scores** : Notation de conformite ponderee avec ventilation par referentiel
- **Remediation** : Suggestions de correction automatisees et execution

## Controles integres

| Controle | Categorie | Referentiels |
|----------|-----------|--------------|
| Chiffrement du disque | Chiffrement | NIS2, DORA |
| Etat du pare-feu | Reseau | NIS2, DORA |
| Etat de l'antivirus | Endpoint | NIS2 |
| Application du MFA | Authentification | NIS2, DORA |
| Politique de mot de passe | Authentification | NIS2, DORA |
| Mises a jour systeme | Correctifs | NIS2, DORA |
| Verrouillage de session | Controle d'acces | NIS2 |
| Acces distant | Reseau | NIS2 |
| Etat des sauvegardes | Resilience | DORA |
| Comptes administrateur | Controle d'acces | NIS2 |
| Protocoles obsoletes | Reseau | NIS2 |
| Journalisation d'audit | Surveillance | NIS2, DORA |
| Connexion automatique | Controle d'acces | NIS2 |
| Bluetooth | Reseau | NIS2 |
| Securite du navigateur | Endpoint | NIS2 |
| Compte invite | Controle d'acces | NIS2 |
| Configuration IPv6 | Reseau | NIS2 |
| Durcissement du noyau | Systeme | NIS2 |
| Rotation des logs | Surveillance | NIS2 |
| Synchronisation horaire | Systeme | NIS2 |
| Stockage USB | Endpoint | NIS2 |

## Utilisation

```rust
use agent_scanner::{CheckRegistry, CheckRunner, DiskEncryptionCheck};

// Creer le registre et enregistrer les controles
let mut registry = CheckRegistry::new();
registry.register(Arc::new(DiskEncryptionCheck::new()));

// Executer les controles
let runner = CheckRunner::new(registry);
let results = runner.run_all().await?;
```

## Notation

Le `ScoreCalculator` calcule les scores de conformite ponderes :

- **Critique** : poids 4x
- **Eleve** : poids 3x
- **Moyen** : poids 2x
- **Faible** : poids 1x
- **Info** : poids 0.5x

Les scores sont calcules par categorie et par referentiel.

## Generation de preuves

Les preuves incluent :

- Donnees du resultat du controle
- Horodatage d'execution
- Hash d'integrite SHA-256
- Signature HMAC-SHA256 optionnelle
- Retention par defaut de 12 mois
