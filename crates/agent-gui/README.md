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
| **Saisie** | text_input, search_input (`SearchInput`), chat_input (`ChatInput`), form (`row`, `fields`/`field`), checkbox, toggle_switch, slider, dropdown, command_palette |
| **Affichage** | badge, status_badge, avatar, alert, tooltip, skeleton, empty_state |
| **Donnees** | table (cellules et colonnes fluides pour `egui_extras`), data_table, pagination, activity_feed, detail_drawer |
| **Feedback** | toast, loading_state, progress |
| **Specialises** | compliance_gauge, security_hero, tray_radar, resource_bar, org_banner, sparkline |

## Design system

Tous les composants s'appuient sur les jetons de `theme.rs` ; aucun ne code une
taille, une couleur ou un rayon en dur.

| Couche | Ou |
|--------|-----|
| **Typographie** | Inter (interface, 4 graisses) + JetBrains Mono NL (donnees), sous-ensembles embarques. Chiffres tabulaires figes dans les fontes. Echelle semantique `font_display()` -> `font_micro()` |
| **Couleurs** | Six surfaces par theme formant l'echelle d'elevation, huit couleurs semantiques avec variante mode clair calibree, `border()` (contours de controles, >=3:1) et `border_subtle()` (filets decoratifs) |
| **Elevation** | `Elevation::Level1..5`, ombre ambiante + ombre de contact, liseré superieur eclaire |
| **Espacement** | Echelle de 4 px, `SPACE_MICRO` -> `SPACE_3XL` |
| **Rayons** | `ROUNDING_XS` -> `ROUNDING_XL`, un cran par echelle de composant |
| **Mouvement** | `ANIM_FAST/NORMAL/SLOW`, courbes dans `animation.rs`, preference systeme « mouvement reduit » respectee |

### Accessibilite

Le contrat de contraste est verifie par les tests de `theme.rs`
(`cargo test -p agent-gui --lib contrast`) :

- textes primaire et secondaire : >= 7:1 (WCAG AAA) sur chaque surface ;
- texte tertiaire et couleurs semantiques : >= 4.5:1 (WCAG AA) ;
- bordures de controles : >= 3:1 (WCAG 1.4.11) ;
- badges et avatars : lisibles sur leur propre fond ;
- echelle de surfaces monotone en mode sombre.

Ces regles echouent au build si une couleur est modifiee sans les respecter.

### Tableaux

Toutes les listes (`egui_extras::TableBuilder`) passent par `widgets::table` :

- `table::fluid(ui, &[Col])` / `table::fluid_clickable` : colonnes calculées
  sur la largeur disponible (`Col::fluid(min, part)`, `Col::fixed(px)`),
  toujours coupées (`clip`) — un tableau remplit sa carte et ne la déborde
  jamais, quelle que soit la taille de la fenêtre ;
- aucun défilement interne : la page est le seul conteneur qui défile, la
  molette n'est jamais capturée par un tableau (les listes sont paginées) ;
- `header_cell`, `cell`, `cell_mono`, `cell_stack`, `cell_link`… : une cellule
  tient sur une ligne, tronquée avec une ellipse, la valeur complète en
  infobulle ; les cellules à deux lignes imposent `TABLE_DATA_ROW_HEIGHT` ;
- `row_interaction(&row, selected)` : curseur main, barre d'accent sur la
  ligne sélectionnée, clic de ligne.

### Banc de rendu

```bash
cargo run -p agent-gui --all-features --example preview
```

Affiche le chrome applicatif et une galerie de composants sans runtime agent.
Variables d'environnement :

| Variable | Effet |
|----------|-------|
| `PREVIEW_PAGE=<nom>` | Rend une page réelle (`dashboard`, `compliance`, `vulnerabilities`, `threats`, `network`, `monitoring`, `assets`, `software`, `risks`, `reports`, `notifications`, `fim`, `terminal`, `discovery`, `cartography`, `audit`, `sync`, `ai`, `settings`, `about`), ou une surface : `overlays`, `palette`, `splash`, `enrollment` |
| `PREVIEW_DATA=1` | Peuple toutes les pages avec les fixtures déterministes de `examples/preview/fixtures.rs` |
| `PREVIEW_DRAWER=<nom>` | Ouvre un tiroir de détail sur la page qui le porte : `vuln`, `threat`, `asset`, `package`, `connection`, `risk`, `fim`, `notification`, `log` (page `terminal`) ; ou un formulaire de création : `asset-form`, `rule-form` (notifications, onglet 1), `webhook-form` (onglet 2), `playbook-form` (menaces, onglet 4), `detection-form` (onglet 5) |
| `PREVIEW_TAB=<n>` | Onglet secondaire de la page (`threats` 0–6, `notifications` 0–2, `monitoring` 0–1, `reports` 0–3, `ai` 0–2, `compliance` 1 = matrice) |
| `PREVIEW_STEP=<étape>` | Étape de l'assistant d'enrôlement : `welcome`, `token`, `admin`, `progress`, `done`, `failed` |
| `PREVIEW_LIGHT=1` | Thème clair |
| `PREVIEW_RAIL=1` | Barre latérale repliée en rail |
| `PREVIEW_W`, `PREVIEW_H` | Taille de la fenêtre (le rail se replie seul sous 1 120 px) |
| `PREVIEW_SHOT=<n>` | Ferme la fenêtre après `n` frames (captures automatisées) |
| `PREVIEW_OUT=<fichier.png>` | Avec `PREVIEW_SHOT`, écrit la capture de la fenêtre dans ce fichier avant de fermer |

Les pages sont disposées avec la colonne du shell (`app::page_column`), pour
qu'une capture mesure ce que l'application montre.

Sonde de défilement, sans fenêtre :

```bash
cargo run -p agent-gui --all-features --example scroll_probe
PROBE_SWEEP=1 cargo run --release -p agent-gui --all-features --example scroll_probe
```

Rend chaque page avec les fixtures, envoie un cran de molette et vérifie que la
page a défilé (`PROBE_SWEEP=1` balaie une grille de positions du pointeur,
`PROBE_PAGE=<nom>` limite à une page, `PROBE_X`/`PROBE_Y` fixent le pointeur).
Le code de sortie est non nul dès qu'une position bloque le défilement.

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
