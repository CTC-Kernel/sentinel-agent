# Audit étendu de fonctionnement — 27 septembre 2026

Cette seconde passe étend l’audit aux mises à jour, à la configuration, à la
découverte réseau, à la surveillance des fichiers, au stockage, à la sauvegarde,
aux migrations, aux scans, à la synchronisation, à l’IA locale et à l’interface.
Les modifications concurrentes du dépôt ont été conservées.

## Défauts corrigés pendant cette passe

| Domaine | Défaut constaté | Correction et preuve |
| --- | --- | --- |
| Mise à jour Windows | Les antislashs normaux des chemins MSI étaient rejetés | Validation adaptée à Windows ; test avec chemin natif et tentative d’injection, exécuté sur Mac |
| État de mise à jour | Une demande limitée en fréquence affichait « À jour » sans vérification | Retour à un état neutre avec explication ; plus de faux succès |
| Concurrence des mises à jour | Vérification puis réservation sous deux verrous distincts | Réservation atomique sous verrou ; test des demandes répétées et de la limite de 300 secondes |
| Erreur de client de mise à jour | Échec de construction pouvant laisser l’interface en recherche | Publication explicite de l’état d’échec |
| Découverte réseau | Concurrence zéro : attente indéfinie du sémaphore ; absence de borne externe sur ping | Validation des paramètres, délai externe et destruction du sous-processus à l’abandon |
| Configuration serveur | URL syntaxiquement valide mais incompatible enregistrable, par exemple `file:` ou URL avec fragment | Même validation à l’enregistrement et au chargement ; refus sans écrasement du fichier |
| Cycle de vie FIM | Ancien observateur réactivé par la remise à zéro d’un drapeau partagé | Annulation propre à chaque génération, arrêt à la destruction et suivi réel de la tâche bloquante |
| Suppression de fichier | Canonicalisation impossible après suppression, événement ignoré | Résolution à partir du parent et de la référence connue ; test même dans la fenêtre de regroupement |
| Chemins macOS | `/var` et `/private/var` pouvaient désigner deux références différentes | Normalisation cohérente de la référence et des événements ; test avec alias symbolique et suppression |
| Événements macOS rejoués | Fichier déjà connu annoncé comme nouvellement créé | Comparaison des empreintes ; événement inchangé ignoré sans masquer la modification suivante |

## Vérifications exécutées

| Module | Tests réussis lors de cette passe |
| --- | ---: |
| Configuration et utilitaires communs | 97 |
| Réseau et découverte | 92 |
| Stockage chiffré et réconciliation | 128 |
| Sauvegarde, récupération et migrations | 58 |
| SIEM | 43 |
| Scanner | 348 |
| Synchronisation | 223 |
| Surveillance des fichiers | 28 |
| IA locale | 100 |
| Cœur de l’agent, tests unitaires | 123 |
| Interface, tests unitaires | 96 |
| Cohérence des référentiels, intégration | 3 |

Total : **1 339 tests réussis**, hors contrôles de la sonde d’interface.

Ces nombres incluent les tests d’intégration et de documentation exécutés pour les
modules concernés, sans additionner les exécutions répétées. Un exemple de
documentation SIEM est explicitement ignoré par sa suite. L’inférence avec un
modèle IA chargé n’est pas couverte par les 100 tests du module.

La sonde d’interface passe 42 contrôles en thème clair à 1024 × 700. Elle vérifie
le défilement des pages rendues ; ce n’est pas une preuve du fonctionnement de
tous leurs boutons contre le service installé.

## Conditions réelles

L’exemple `crates/agent-fim/examples/live_file_audit.rs` utilise le véritable
observateur macOS et un dossier temporaire. Il exige la remontée d’une modification
avec l’empreinte attendue, d’une suppression, puis d’une création après redémarrage.
Les premières tentatives ont permis de distinguer les restrictions de la sandbox
du défaut réel d’identité des chemins. Aucun fichier personnel n’est modifié.

Résultat final de la sonde native : `modified=true`, `deleted=true`,
`created_after_restart=true`, `stopped=true`.

Les tests de sauvegarde, récupération et migration utilisent des bases temporaires.
Aucun installateur, ré-enrôlement, blocage réseau ou remplacement de l’application
installée n’a été lancé. La découverte a été testée par ses suites et ses limites ;
aucun balayage du réseau local n’a été déclenché pour cet audit.

## Reproduction

```sh
cargo test -p agent-common -p agent-network --offline
cargo test -p agent-storage -p agent-persistence -p agent-siem --offline
cargo test -p agent-fim --offline
cargo test -p agent-scanner -p agent-sync --tests --offline
cargo test -p agent_llm --lib --offline
cargo test -p agent-core --no-default-features --features gui --lib --offline
cargo test -p agent-gui --lib --offline
PROBE_W=1024 PROBE_H=700 PROBE_LIGHT=1 cargo run -p agent-gui --example scroll_probe --offline
cargo run -p agent-fim --example live_file_audit --offline
```

## Limites restantes

Le mode connecté de bout en bout, l’installation effective d’une mise à jour,
Windows/Linux en exécution native, les remédiations destructrices, l’inférence IA
réelle et un test d’endurance de plusieurs jours restent à valider. Les acquittements
locaux de l’interface ne constituent pas une preuve de persistance ou de
synchronisation serveur. Cette passe ne garantit pas l’absence de tout défaut.
Les corrections sont dans les sources ; le binaire installé n’a pas été remplacé.
