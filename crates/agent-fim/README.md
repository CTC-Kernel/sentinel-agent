# agent-fim

Surveillance d'integrite des fichiers (FIM) pour le Sentinel GRC Agent.

## Presentation

Trois mecanismes trouvent un changement, et chaque alerte dit lequel :

- **Temps reel** : les evenements du systeme (inotify, FSEvents, ReadDirectoryChanges).
- **Au demarrage** : la base de reference est conservee sur disque entre deux
  executions ; les fichiers lui sont compares au lancement, ce qui revele ce
  qui a ete change pendant que l'agent etait arrete.
- **Analyse complete periodique** (6 h par defaut) : ce que le systeme n'a pas
  signale (file d'evenements saturee, limite de surveillance, dossier remplace).

Un changement est une difference de contenu, de permissions, de proprietaire ou
de groupe ; l'alerte porte les valeurs avant et apres, et le SHA-256 du fichier
cree ou modifie.

## Architecture

```
FimEngine (coordinateur)
  |-- Watcher         : evenements du systeme, lectures differees (notify)
  |-- BaselineManager : lecture, comparaison et enregistrement d'un fichier en une etape
  |-- Store           : base de reference conservee entre deux executions
  |-- Canary          : fichiers leurres anti-ransomware
  `-- Policy          : chemins surveilles et exclusions
```

## Modules

| Module | Description |
|--------|-------------|
| `watcher` | Boucle d'evenements : anti-rebond, relecture en fin de rafale, liens symboliques |
| `baseline` | Base de reference, `observe` (un fichier) et `scan` (tous les chemins) |
| `store` | Sauvegarde et relecture de la base, couverture (chemins et exclusions) |
| `alerts` | File bornee des alertes |
| `policy` | Construction et validation de la politique |
| `canary` | Fichiers leurres |

## Ce qui est detecte

| Changement | Detail dans l'alerte |
|------------|----------------------|
| Creation | BLAKE3, SHA-256, taille |
| Modification du contenu | BLAKE3 avant/apres, SHA-256, taille |
| Permissions | bits avant/apres ; gravite haute si l'acces est elargi |
| Proprietaire, groupe | uid:gid avant/apres |
| Suppression, renommage | BLAKE3 du fichier disparu |
| Fichier remplace par un lien symbolique | signale comme suppression du fichier surveille |

Un fichier que l'agent n'a pas le droit de lire reste suivi par sa taille, sa
date de modification, ses permissions et son proprietaire.

## Limites

- Qui a fait le changement (utilisateur, processus) n'est pas connu : les
  evenements du systeme ne le disent pas.
- Le registre Windows n'est pas surveille.
- La base conservee n'est pas signee : elle est protegee par les droits du
  dossier de donnees. Elle protege des changements faits agent arrete, pas d'un
  compte capable de la reecrire (qui peut aussi arreter l'agent).
- 100 000 fichiers suivis au plus, 32 niveaux sous chaque chemin surveille.

## Utilisation

```rust
use agent_fim::{FimEngine, policy::build_policy};

let (alert_tx, mut alert_rx) = tokio::sync::mpsc::channel(1000);
let engine = FimEngine::new(build_policy(None, None), alert_tx)
    .with_state_file("/var/lib/sentinel-grc/fim/baseline.json".into());
engine.start().await?;               // compare le disque a la base conservee
while let Some(alert) = alert_rx.recv().await {
    println!("{} ({})", alert.description(), alert.detection);
}
```

## Plateformes

| Plateforme | Evenements | Verifie |
|------------|------------|---------|
| macOS | FSEvents | tests et essai reel (`cargo run -p agent-fim --example live_file_audit`) |
| Linux | inotify | non exerce sur ce systeme |
| Windows | ReadDirectoryChanges | non exerce sur ce systeme ; permissions et proprietaire non suivis |
