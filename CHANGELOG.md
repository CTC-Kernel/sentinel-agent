# Journal des modifications

Tous les changements notables du Sentinel GRC Agent sont documentes dans ce fichier.

Ce projet respecte le [Versionnage Semantique](https://semver.org/).

## [Non publie]

### Modifie
- Centralisation des constantes de configuration Firebase dans `agent-common`
- Ajout de l'utilitaire `silent_command()` pour eviter le flash de fenetre console sous Windows

### Securite
- Suppression de toutes les donnees d'authentification codees en dur dans le code source
- Externalisation des mots de passe de certificats vers des variables d'environnement
- Purge des donnees sensibles de l'historique git
- Passage sous licence MIT pour la publication open-source

## [2.0.112] - 2026-02-28

### Corrige
- Prevention de l'ecrasement de la sortie d'erreur de `notarytool` par `set -e` lors de la signature macOS

## [2.0.111] - 2026-02-27

### Corrige
- Redirection des raccourcis Windows directement vers le `.exe` au lieu du lanceur `.bat`
- Installation du certificat auto-signe dans le magasin Root et correction de `install-with-cert.bat`

## [2.0.110] - 2026-02-26

### Corrige
- Limitation du fallback du repertoire de donnees dev aux builds `debug_assertions` uniquement

## [2.0.109] - 2026-02-25

### Corrige
- Repertoire de logs de secours lorsque l'agent s'execute sans privileges root

## [2.0.108] - 2026-02-24

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.107] - 2026-02-23

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.105] - 2026-02-21

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.104] - 2026-02-20

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.103] - 2026-02-19

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.102] - 2026-02-18

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.101] - 2026-02-17

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.100] - 2026-02-16

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.99] - 2026-02-15

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.98] - 2026-02-14

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.97] - 2026-02-13

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.96] - 2026-02-12

### Corrige
- Suppression d'un fichier invalide commencant par NUL qui cassait le build Windows

## [2.0.95] - 2026-02-11

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.94] - 2026-02-10

### Modifie
- Ameliorations internes et corrections de stabilite

## [2.0.93] - 2026-02-09

### Ajoute
- Publication open-source initiale du Sentinel GRC Agent
- Workspace Rust de 12 crates : `agent-core`, `agent-gui`, `agent-common`, `agent-scanner`, `agent-network`, `agent-storage`, `agent-sync`, `agent-siem`, `agent-fim`, `agent-persistence`, `agent_llm`, `xtask`
- Interface graphique de bureau native avec egui/eframe (14 pages)
- 21 controles de conformite (CIS, NIS2, ISO 27001, DORA, SOC2)
- Scan de vulnerabilites CVE
- Surveillance de l'integrite des fichiers (FIM)
- Detection des menaces en temps reel (USB, processus, reseau)
- Decouverte reseau (ARP, mDNS, SSDP)
- Moteur de remediation automatisee
- Mecanisme de mise a jour automatique avec verification SHA-256
- Support multi-plateforme : macOS, Windows, Linux (DEB/RPM)
- Integration dans la barre systeme
- Stockage local chiffre avec SQLite
- Synchronisation avec le backend Firebase

[Non publie]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.112...HEAD
[2.0.112]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.111...v2.0.112
[2.0.111]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.110...v2.0.111
[2.0.110]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.109...v2.0.110
[2.0.109]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.108...v2.0.109
[2.0.108]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.107...v2.0.108
[2.0.107]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.105...v2.0.107
[2.0.105]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.104...v2.0.105
[2.0.104]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.103...v2.0.104
[2.0.103]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.102...v2.0.103
[2.0.102]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.101...v2.0.102
[2.0.101]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.100...v2.0.101
[2.0.100]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.99...v2.0.100
[2.0.99]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.98...v2.0.99
[2.0.98]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.97...v2.0.98
[2.0.97]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.96...v2.0.97
[2.0.96]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.95...v2.0.96
[2.0.95]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.94...v2.0.95
[2.0.94]: https://github.com/CTC-Kernel/sentinel-agent/compare/v2.0.93...v2.0.94
[2.0.93]: https://github.com/CTC-Kernel/sentinel-agent/releases/tag/v2.0.93
