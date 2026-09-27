# Suite des corrections fonctionnelles — 27 septembre 2026

Cette passe prolonge la [matrice fonctionnelle](all-features-alignment-2026-09-27.md). Elle corrige les problèmes transverses identifiés dans l'audit, dans les sources locales de l'agent et de `sentinel-grc-v2-prod`. Aucun déploiement effectué.

## Corrections réalisées

- **Identifiants opaques** : risques, actifs, règles d'alerte et webhooks utilisent désormais des chaînes dans les DTO GUI, leurs constructeurs et les parcours de chargement. Les identifiants non UUID ne sont plus ignorés ou remplacés au chargement. L'analyse IA d'un risque retrouve aussi son entrée par cet identifiant.
- **Mises à jour des risques** : un événement de chargement modifie l'entrée existante au lieu d'ignorer une modification distante déjà connue par son ID. Les événements incrémentaux de génération locale restent compatibles.
- **Suppression locale persistante** : risques, règles d'alerte et webhooks utilisent maintenant une transaction SQLite pour supprimer l'objet et remplacer ses envois précédents par un marqueur de suppression. L'orchestrateur rejoue ce DELETE et traite un 404 comme une suppression déjà effectuée.
- **Protection des marqueurs** : les marqueurs de suppression sont exclus des évictions de la file et du nettoyage des tentatives épuisées ; leur plafond de tentatives est relevé, y compris pour les marqueurs existants lors de la migration.
- **Téléchargements protégés** : les quatre familles GRC sont fusionnées transactionnellement, sans écraser une édition locale non synchronisée, un envoi encore en file ou une suppression en attente.
- **Snapshots des alertes et webhooks** : les listes complètes sont réconciliées, y compris vides ; l'interface reçoit également les snapshots vides. Les risques et actifs utilisent un contrat opt-in `?snapshot=true` avec `{items, complete}`. Un serveur ancien répondant par un tableau ou un snapshot partiel ne déclenche aucune suppression. Un snapshot explicitement complet permet de supprimer les absents, jusqu’au rafraîchissement GUI ; les sélections sont recalées par identifiant.
- **Acquittements GRC** : les envois de risques, actifs, alertes et webhooks marquent maintenant les données synchronisées dans la même transaction que le retrait de la file, tout en conservant une édition plus récente encore en attente.
- **Équité des files** : chaque famille récupère ses propres éléments prêts à envoyer, pour ne plus être bloquée derrière les cinquante premières entrées d'une autre famille.
- **Résultats de commandes persistants** : enregistrement avant envoi dans une table dédiée, séparée de la file de télémétrie évictable et isolée par identité d'agent. Reprise après reconnexion via heartbeat ; retrait seulement après acquittement explicite. Une issue contradictoire ne remplace pas une issue encore en attente. Les résultats en attente sont ajoutés au compteur du heartbeat.
- **Rejeu côté plateforme** : un résultat terminal identique déjà enregistré est acquitté sans répéter le traitement ; un résultat contradictoire demeure refusé. Cela traite la perte de la réponse HTTP après stockage serveur, sans assimiler tous les 409 à une réussite.
- **Stockage réel des webhooks** : correction d'une incompatibilité préexistante entre le schéma (`token`, absence de `updated_at`, ordre différent des colonnes) et le repository (`secret`, `updated_at`, lecture positionnelle). La migration 10 renomme la colonne en conservant les valeurs, initialise `updated_at` et la lecture utilise une projection explicite.
- **Formats et alias** : le serveur accepte l'ancien format `teams` et le normalise en `msteams`. Le formulaire utilise les valeurs de la plateforme. Le rechargement des alertes accepte aussi les alias `DetectionType` et `Escalation`.

## Preuves ajoutées

`crates/agent-storage/tests/grc_durability.rs` vérifie :

1. Résultat de commande conservé après fermeture/réouverture, isolation par agent, refus d'écrasement contradictoire et acquittement correspondant au contenu.
2. Snapshot d'alertes, édition locale, entrée en attente et protection contre la résurrection après suppression.
3. Suppressions de risques/alertes/webhooks conservées après redémarrage et saturation de file, même face à de la télémétrie de priorité supérieure.
4. Fusion des risques, actifs et webhooks avec conservation des éditions en attente.
5. Lecture d'une file typée malgré une accumulation d'autres types, et conservation d'un envoi plus récent après acquittement.
6. Migration d'une base v9 contenant un webhook : conservation du jeton de test et du format, lecture et nouvelle écriture réussies.
7. Rotation des résultats déjà tentés : un résultat définitivement rejeté est conservé sans bloquer les résultats suivants.

Les tests GUI vérifient les IDs non UUID, la modification d'un risque existant et l'effacement des anciennes listes d'alertes/webhooks. Les tests de la plateforme vérifient le rejeu identique, le conflit et l'alias Teams. Les scripts de contrat croisé restent exécutables :

```sh
cargo test -p agent-storage --offline
cargo test -p agent-sync -p agent-gui -p agent-core --no-default-features --features agent-core/gui --offline
cargo check -p agent-gui --examples --offline
bash scripts/test-platform-contracts.sh ../sentinel-grc-v2-prod
bash scripts/test-platform-edr.sh ../sentinel-grc-v2-prod
```

## Réserves restantes

- **Serveurs anciens ou données incomplètes** : la suppression distante des risques/actifs exige la nouvelle réponse explicitement complète. Les anciennes réponses et les snapshots incomplets conservent les objets absents. La plateforme et l’agent doivent donc être mis à jour ensemble pour disposer de cette garantie.
- **Exécution de commande** : l'outbox protège le résultat après son enregistrement. Elle ne supprime pas la fenêtre de crash entre l'action OS et cet enregistrement et ne garantit pas l'exécution exactement une fois. Les résultats définitivement rejetés restent à examiner ; aucun abandon silencieux n'est ajouté.
- **Effets secondaires serveur** : l'acquittement des rejeux ne transforme pas les effets MDM/remédiation existants en transaction distribuée. Une recette de panne entre stockage du résultat et effet secondaire reste requise.
- **Fonctions de sécurité privilégiées** : les paramètres des actions destructives, les métadonnées de playbook, le blocage USB physique et la recette Windows/Linux/macOS restent à traiter comme indiqué dans la matrice.
- **Livraison des webhooks/SIEM et IA/voix** : configuration synchronisée et compilation ne prouvent pas la livraison à un destinataire réel, le bon format de chaque message d'exécution ou l'inférence sur matériel réel.
- **Atomicité des sauvegardes locales** : l'enregistrement d'un objet et sa mise en file initiale ne sont pas encore partout une transaction unique. La protection contre l'écrasement conserve l'objet sale, mais la couverture de reprise après panne entre ces deux opérations reste à étendre.

Les tests locaux et corrections ne constituent pas une validation exhaustive de tous les modules en production ni une certification d'équivalence avec des EDR commerciaux.

## Résultats locaux

- Stockage : 102 tests unitaires, 5 régressions EDR, 7 régressions de durabilité, 20 tests d’intégration et 1 doctest réussis.
- Cœur : 123 tests bibliothèque, 2 tests binaire et 3 tests de cohérence réussis.
- GUI : 103 tests réussis sur l’état courant, dont identifiants opaques et snapshots ; un doctest ignoré.
- Synchronisation : 187 tests unitaires réussis après ajout du snapshot ; les 37 tests d’intégration et 2 doctests avaient également réussi dans la passe complète précédente.
- Plateforme : dernière suite `agents` : 210 tests réussis, 3 scénarios ignorés faute de fixtures dans cette invocation ; contrats croisés exécutés séparément.
- Contrat croisé EDR : 9 tests Jest puis relecture Rust réussis. Contrat des 13 familles : 19 tests Jest puis relecture Rust réussis avant l’ajout des deux tests serveur de complétude.
- Compilation du cœur avec toutes ses features et des exemples GUI réussie.

Les travaux graphiques évoluaient parallèlement dans le même arbre : une exécution intermédiaire avait rencontré un ancien libellé dans un test vocal ; la nouvelle exécution sur les sources actualisées réussit. Les modifications graphiques concurrentes n’ont pas été annulées.


## Suite : EDR sans interface et livraison des réponses

Le pipeline de détection, l’évaluation des playbooks et la collecte des événements réseau/FIM sont désormais compilés et exécutés sans la feature `gui`. Les DTO et événements partagés restent dans `agent-gui`, avec son rendu désactivé ; l’arbre des dépendances sans features ne contient ni egui ni eframe. Les remontées de résultats empruntent le même parcours de synchronisation.

Un playbook peut se déclencher sur ses propres conditions sans dépendre d’une règle de détection distincte. La condition de sévérité compare les niveaux ordonnés ; son ancien score indicatif de 0,2 ne bloque plus une condition satisfaite. L’IA annote l’analyse sans autoriser ni interdire les actions déterministes. Une sévérité réseau ne produit plus de score CVSS fictif : cette condition reste non satisfaite en l’absence de données CVSS dans le contexte.

Les notifications de réponse sont envoyées au canal de notification, avec échec explicite si le canal est absent ou fermé. Les alertes SIEM automatiques utilisent le forwarder configuré ; destination désactivée, configuration par défaut, filtrage ou erreur de transport produisent un échec. Un playbook sans action exécutable échoue également. Le succès signifie acceptation par le canal local ou le transport, pas affichage par un utilisateur ni stockage confirmé chez le destinataire.

Limites restantes de ce parcours : pas de canal de notification desktop en service sans GUI ; le lancement manuel fournit le canal de notification mais pas encore le forwarder SIEM ; paramètres des actions destructives et métadonnées de déclenchement restent à compléter. Aucune action destructive réelle ni livraison à un SIEM externe n’a été exécutée pour ces tests.

Validation de cette suite : 123 tests bibliothèque du cœur sans features, 36 tests unitaires et 8 tests d’intégration SIEM réussis (1 doctest ignoré). Le nouveau test de pipeline vérifie le déclenchement sans règle de détection, la notification effectivement reçue, le seuil de sévérité et l’absence de CVSS inventé. Un transport SIEM de test vérifie que les refus n’envoient rien et que le cas autorisé atteint le transport. Compilation du cœur avec toutes les features réussie.

Les envois immédiats de matches et journaux de playbooks dans la boucle du pipeline ne disposent pas encore de la même outbox persistante que les résultats de commandes : une panne réseau à cet endroit reste un risque de perte de télémétrie à corriger.

Validation complémentaire terminée : 125 tests bibliothèque du cœur avec GUI réussis ; contrat croisé EDR, 9 tests Jest puis relecture Rust des données renvoyées par les handlers réussis. `git diff --check` réussi. Ces tests utilisent des handlers réels avec stockage serveur de test, sans déploiement en production.
