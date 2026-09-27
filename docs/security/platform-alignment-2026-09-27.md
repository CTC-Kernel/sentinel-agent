# Vérification agent ↔ Sentinel GRC v2

Audit du 27 septembre 2026, sur les sources locales de `sentinel-agent` et du dépôt voisin `sentinel-grc-v2-prod`. Les modifications de la plateforme sont dans ce second dépôt. Aucun déploiement effectué.

Extension ultérieure : [matrice de toutes les familles fonctionnelles et nouveaux résultats](all-features-alignment-2026-09-27.md).

## Conclusion

L'alignement n'était pas complet. Plusieurs incompatibilités EDR ont été reproduites et corrigées dans les deux projets. Les échanges de configuration EDR sont maintenant couverts par un test de contrat utilisant les sérialiseurs Rust réels, les handlers JavaScript réels avec un Firestore simulé, puis la relecture Rust. Cela valide les parcours testés localement ; ce n'est pas une certification de l'ensemble du produit ni une recette des versions déployées.

## Correctifs

| Échange / problème | Correction |
| --- | --- |
| Console → agent : identifiants Firestore non UUID ignorés ou remplacés | Les identifiants de règles et playbooks restent des chaînes, y compris dans les DTO et journaux GUI. Les identifiants UUID existants restent compatibles. |
| Agent → console → agent : noms de champs imbriqués incompatibles | Compatibilité `condition_type` / `conditionType`, `action_type` / `actionType` et variantes PascalCase / snake_case des enums. Stockage console normalisé en camelCase. |
| Règles avec actions rejetées par l'API | Le schéma accepte les noms d'actions sous forme de chaînes, conformément aux types Rust et TypeScript. Les objets imbriqués utilisent la signature correcte de `z.record` pour Zod 4. |
| Sévérité informative et valeurs nulles | `info`, `last_match: null` et `last_triggered: null` acceptés ; une détection informative reste informative. |
| Types d'alertes divergents | Schéma compatible avec les noms agent et console ; import des alias DetectionType et Escalation côté agent. |
| Perte des actions, compteur et date des règles au chargement SQLite | Conservation de ces champs dans le DTO de détection et les réémissions. |
| Définitions incompatibles silencieusement vidées | Une règle ou un playbook dont les conditions/actions sont indécodables est désactivé dans le moteur avec avertissement. |
| Changements EDR de la console non repris au bon signal | Rafraîchissement EDR sur `config_changed` et `rules_changed` ; les callables de la console incrémentent la version de configuration. |
| Heartbeat écrasant la console avec des copies locales déjà synchronisées | Seules les définitions locales non synchronisées sont réémises ; limites API respectées. |
| Suppression console non reflétée localement | Réconciliation transactionnelle des snapshots complets, y compris vides ; publication de snapshots GUI remplaçant les anciennes listes. Les modifications locales non envoyées sont conservées. |
| Suppression locale perdue hors ligne | Suppression et marqueur d'envoi persistés dans une même transaction ; reprise après redémarrage ; protection contre la réapparition depuis une ancienne copie distante. DELETE rejoué avec 404 traité comme déjà supprimé. |
| File purgée malgré accusé de réception partiel | Vérification du nombre reçu, propagation des erreurs et acquittement transactionnel EDR ; conservation d'une modification plus récente encore en file. |
| Synchronisation partiellement échouée annoncée réussie | Agrégation et remontée des erreurs au statut de synchronisation. |
| Playbook de notification générant une action destructive à partir de sa condition | Les actions destructrices candidates nécessitent désormais un type d'action explicitement configuré. Test de non-régression sans exécution destructive. |

## Vérifications

- Tests de la plateforme : enrollment, heartbeat, schémas, API, cycle de vie, remédiation et MDM, plus régressions EDR.
- Tests Rust : agent-core avec GUI, agent-gui, agent-sync et tests de réconciliation SQLite.
- Test croisé : upload règle/playbook depuis les DTO Rust, formats de la console, désactivation distante, download, conversion SQLite/GUI et resérialisation avec conservation des identifiants, conditions et actions.
- Commandes : noms des commandes autorisées exportés directement par `commandSigning.js` et validés par `AgentCommand` ; résultat Rust accepté par le handler et état serveur passé à `completed`. Cette vérification de contrat n'exécute pas une installation, révocation ou remédiation sur le poste.
- HMAC : requête signée par Rust, recomposition indépendante par Node avec `JSON.stringify`, nonce et préfixe de route ; clé publique de test uniquement. Le middleware réseau réel et les secrets déployés ne sont pas utilisés.
- Stockage : mises à jour/désactivations, suppressions, protection des éditions hors ligne, accusés successifs et suppression persistante après réouverture d'une base chiffrée temporaire.
- Inspection des chemins : 36 chemins API agent normalisés retrouvés dans le routeur plateforme ; les autres chaînes relevées concernent des tests et OSV. La présence d'une route ne prouve pas son fonctionnement en production.

Reproduction du contrat croisé depuis `sentinel-agent` :

```sh
bash scripts/test-platform-edr.sh ../sentinel-grc-v2-prod
cargo test -p agent-storage --test edr_reconciliation --offline
cargo test -p agent-sync --offline
cargo test -p agent-core -p agent-sync -p agent-gui --lib --no-default-features --features agent-core/gui --offline
```

Le test Jest croisé est ignoré dans la suite standard si les fixtures Rust ne sont pas fournies. Le script les génère, exécute le test puis vérifie les réponses dans Rust. Les fixtures et données de test sont temporaires, aucune donnée de production n'est requise.

## Réserves restantes

- **Mode service sans GUI** : pipeline commun aux modes service et desktop ; voir la suite de fiabilité pour les tests et limites de livraison.
- **Métadonnées d'exécution des playbooks** : `last_triggered` et `trigger_count` ne sont pas stockés dans `StoredPlaybook` et reviennent actuellement à leurs valeurs par défaut dans les DTO. Le test croisé utilise ces valeurs par défaut ; il ne couvre pas la conservation de compteurs non nuls.
- **Commandes sous panne réseau** : `CommandResultsService` n'a pas de file durable pour les résultats de commandes. Une panne au retour doit encore être validée et traitée ; conformité des noms et des JSON ne signifie pas exécution exactement une fois.
- **Réponse EDR distante** : la liste de commandes serveur expose synchronisation, scans, diagnostics, mises à jour, révocation, MDM et remédiation. Elle n'expose pas de commandes dédiées `kill_process`, `quarantine_file` ou `block_ip` ; ne pas présenter ces actions locales comme un contrôle distant dédié déjà testé.
- **Paramètres et livraison des actions** : le garde-fou de type ne valide pas tous les paramètres de playbook ni la livraison effective SIEM/notification. Une recette fonctionnelle sur poste isolé reste nécessaire.
- **Autres objets GRC** : la réconciliation des suppressions et les marqueurs hors ligne ajoutés ici concernent les règles de détection et les playbooks. Ne pas extrapoler cette garantie à tous les risques, assets, webhooks ou règles composites.
- **Production et systèmes** : TLS, proxy, secrets, permissions OS, capteurs, véritables services SIEM, Firebase déployé et pont PostgreSQL self-hosted ne sont pas validés par les doubles de test. Recette requise avec un agent de test inscrit et les deux versions corrigées déployées.

Ces réserves empêchent de conclure « tout fonctionne dans les deux sens » sans qualification.

## Résultats des exécutions locales

| Suite | Résultat |
| --- | --- |
| Plateforme `agents/__tests__` | 197 tests réussis ; le scénario croisé nécessitant les fixtures Rust est ignoré dans cette commande seule. |
| Contrat croisé avec fixtures Rust et anciens objets d'action | 8 tests Jest réussis, puis vérification Rust réussie. |
| `agent-sync` | 186 tests unitaires, 37 tests d'intégration et 2 doctests réussis. |
| Réconciliation EDR SQLite | 5 tests réussis, dont suppression hors ligne et réouverture de la base. |
| Passage global agent-core / GUI | 121 tests du cœur et 96 tests GUI réussis. |
| Nouvelle vérification ciblée du pipeline | 4 tests réussis après les changements de conversion. |
| Exemples GUI | Compilation vérifiée. |

Avertissements observés pendant les compilations : fonction de journalisation inutilisée, avertissement d'édition de liens macOS sur les tables de déroulement et dépendance `block` signalée pour une future incompatibilité Rust. Aucun de ces avertissements ne constitue une validation des scénarios de production laissés en réserve.
