# agent-gui

Interface graphique de bureau pour le Sentinel GRC Agent.

## Presentation

Cette crate fournit un tableau de bord interactif complet construit avec **egui/eframe**, offrant une visibilite totale sur la posture de securite de l'endpoint :

- **19 pages specialisees** : Du dashboard global a l'investigation forensique
- **40+ widgets reutilisables** : Composants UI de qualite entreprise
- **Mode sombre dynamique** : Detection automatique du theme OS
- **Cross-platform** : Windows 10+, macOS 12+ (Universal), Linux (GTK3)
- **Integration LLM** : Chat IA local pour l'analyse assistee (optionnel)

## Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Vue holistique avec score de securite global |
| **Monitoring** | Telemetrie temps reel (CPU, RAM, disque) |
| **Compliance** | Statut de conformite par referentiel |
| **Software** | Inventaire des logiciels installes |
| **Vulnerabilities** | CVE detectees avec prioritisation |
| **File Integrity** | Alertes FIM et historique des modifications |
| **Threats** | Centre d'analyse multi-niveaux (6 sous-pages) |
| **Audit Trail** | Journal d'audit complet |
| **Network** | Topologie reseau et connexions actives |
| **Discovery** | Decouverte passive d'appareils |
| **Cartography** | Visualisation de la cartographie reseau |
| **Assets** | Inventaire CMDB des endpoints |
| **Risks** | Scoring et priorisation des risques |
| **Reports** | Generation de rapports |
| **Notifications** | Centre de notifications et alertes |
| **Sync** | Statut de synchronisation serveur |
| **Terminal** | Console de logs et diagnostics |
| **Settings** | Configuration de l'agent |
| **About** | Version et informations systeme |

### Module Threats (6 sous-pages)

- **Overview** : Vue d'ensemble des menaces actives
- **Events** : Flux d'evenements de securite
- **Timeline** : Timeline forensique des incidents
- **MITRE ATT&CK** : Mapping sur le referentiel MITRE
- **Detection Rules** : Regles de detection configurees
- **Playbooks** : Reponses automatiques aux menaces

## Widgets

40+ composants reutilisables organises par categorie :

| Categorie | Composants |
|-----------|------------|
| **Layout** | card, modal, sidebar, layout, breadcrumb, divider, tabs |
| **Saisie** | text_input, checkbox, toggle_switch, slider, dropdown, command_palette |
| **Affichage** | badge, status_badge, avatar, alert, tooltip, skeleton, empty_state |
| **Donnees** | data_table, pagination, activity_feed, detail_drawer |
| **Feedback** | toast, loading_state, progress |
| **Specialises** | compliance_gauge, security_hero, tray_radar, resource_bar, org_banner, sparkline |

## Feature flags

| Feature | Description |
|---------|-------------|
| `render` (defaut) | Active le rendu egui/eframe avec toutes les pages et widgets |
| `llm` | Integration complete du panneau LLM |

Sans le flag `render`, seuls les DTOs et types d'evenements sont disponibles.

## Architecture

```
SentinelApp (eframe::App)
  |-- AppState        : Etat global de l'application
  |-- Pages (19)      : Composants de page independants
  |-- Widgets (40+)   : Composants UI reutilisables
  |-- Events/Commands : Canaux de communication avec le runtime
  |-- TrayBridge      : Integration barre systeme
  `-- LLM Panel       : Interface chat IA (optionnel)
```

## Utilisation

```rust
use agent_gui::{run_gui, run_tray_popup};

// Lancer l'interface complete
run_gui(app_state, event_rx, command_tx).await?;

// Ou lancer uniquement le popup tray
run_tray_popup(app_state).await?;
```

## Integration OS

| Plateforme | Specificites |
|------------|-------------|
| **Windows** | APIs Windows natives, icone tray, menu contextuel, theme sombre auto |
| **macOS** | Integration NSApplication, menu natif, mode sombre auto |
| **Linux** | GTK3, detection du theme systeme |
