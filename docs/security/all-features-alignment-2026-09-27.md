# Vérification de l'ensemble des fonctionnalités agent ↔ Sentinel GRC v2

Date : 27 septembre 2026. Dépôts locaux : `sentinel-agent` et `sentinel-grc-v2-prod`.

Suite de cet audit : [corrections des identifiants, files, commandes et webhooks](grc-reliability-followup-2026-09-27.md). Les réserves ci-dessous décrivent l’état initial ; le document de suivi précise celles corrigées.

## Verdict

**Alignement partiel, pas de validation globale « tout fonctionne dans les deux sens ».** L'audit a été étendu à toutes les familles fonctionnelles des modules de l'agent et à leur représentation dans la plateforme. Les tests locaux exécutés passent après correction des incompatibilités décrites ci-dessous. Les scénarios non couverts, les fonctionnalités uniquement locales et les défauts encore présents sont explicitement distingués.

Il s'agit de tests de code, de contrats, de bases temporaires et de composants. Aucun déploiement, enrôlement de production, isolement réseau, installation ou suppression de logiciel sur un poste réel n'a été réalisé. Les handlers serveur sont réels mais Firestore est simulé dans les contrats ; les tests du pont auto-hébergé ne constituent pas une recette PostgreSQL/Firebase en production. Cette vérification n'établit aucune équivalence d'efficacité ou de fiabilité avec Wazuh, Falcon ou Defender.

## Correctifs de cette extension

| Défaut constaté | Correction et preuve |
| --- | --- |
| L'agent transmet `AssetPayload.software: Vec<String>` ; le serveur exigeait des objets. | Acceptation des noms et anciens objets, stockage normalisé `{name, version?}`, retour de noms conforme au contrat des actifs. Test upload → stockage → édition simulée de console → download → désérialisation Rust. Les versions restent dans les données riches côté serveur ; le contrat des actifs côté agent ne transporte que des noms. L'inventaire logiciel séparé transporte les versions. |
| Validation d'une connexion d'alerte réseau avec la mauvaise signature de `z.record` pour Zod 4. | Utilisation de `z.record(z.string(), z.unknown())`, test avec adresse, port et processus renseignés. |
| Les règles d'alerte de sévérité `info`, proposées par le modèle GUI, étaient rejetées. | Schéma compatible avec ce niveau, test de régression. |
| Un délai d'escalade ou SLA égal à zéro revenait comme absent. | Remplacement de `|| null` par `?? null` dans les réponses concernées ; conservation contrôlée après relecture Rust. |
| La réponse de lecture des risques omettait leur date de modification. | Retour de `updated_at` depuis le timestamp serveur, vérification du champ au retour. |
| Le module GUI compilé sans `render` référençait egui, le thème et les widgets. | Fonction de rendu de `human_transcript.rs` protégée par la feature `render`. `cargo check -p agent-gui --no-default-features --offline` réussi. |

Les autres modifications déjà présentes dans les deux arbres de travail ne sont pas attribuées à cette extension. Les corrections EDR précédentes sont documentées dans [l'audit EDR](platform-alignment-2026-09-27.md).

## Matrice fonctionnelle

« Testé localement » signifie uniquement que les scénarios concernés passent. Une remontée de télémétrie n'exige pas une commande inverse identique ; le retour pertinent est la configuration, la politique, la remédiation ou l'accusé de réception.

| Fonctionnalité | Sens agent → plateforme | Sens plateforme → agent / local | Couverture et limites |
| --- | --- | --- | --- |
| Enrôlement, identité, authentification | Requêtes d'enrôlement, signatures | Identifiants, configuration initiale, renouvellement | Tests sync/API et HMAC croisé. Secrets, certificats déployés, proxy et révocation réelle à recetter. |
| Heartbeat, état, ressources | Santé, processus, connexions, versions | Versions de configuration, commandes | Tests Rust et handlers ; pas de mesure de latence d'un parc réel. |
| Configuration et politiques | Accusés et résultats de commandes | Intervalles, frameworks, FIM, USB, SIEM, threat intel, surveillance réseau | Tests du plan de configuration. Ne pas assimiler les paramètres reconnus à une gestion MDM arbitraire. |
| Contrôles de conformité / CIS | Résultats, scores, catégories, preuves | Règles et demande de scan | Tests scanner, cohérence des frameworks, mapping des preuves côté plateforme ; contrat Rust des résultats. Contrôles Windows/AD/GPO et Linux à exécuter sur ces OS. |
| Preuves et journal d'audit | Résultats et journal signé / intégrité | Consultation et conservation côté plateforme | Tests stockage, audit, mapping des preuves ; contrat d'entrée d'audit. Export/restauration en infrastructure déployée non recettés. |
| Inventaire logiciel | Nom, version, éditeur | Lecture de l'inventaire ; commandes MDM distinctes | Schéma alimenté par le type Rust et tests de collecte. Exhaustivité réelle dépendante de l'OS. |
| Vulnérabilités | CVE, sévérité, pages de scan | Demande de scan, remédiation | Tests de pagination, reprise, CVE et mapping UI. Les flux OSV et correctifs sur postes réels ne sont pas validés par ces tests. |
| Réseau / découverte / cartographie | Interfaces, actifs découverts, connexions, alertes | Paramètres de surveillance et gestion des actifs | Tests réseau et régressions des détecteurs ; contrats snapshot et découverte ; correction des connexions d'alerte. Découverte sur sous-réseau réel non exécutée pour cet audit. |
| Actifs gérés | Création / inventaire / changements | Modifications du risque et cycle de vie | Aller-retour Rust/handlers réussi avec logiciels non vides et identifiant non UUID. **Le chargement GUI reste incompatible avec certains IDs non UUID**, voir P1 ci-dessous. |
| Risques | Création, impact, probabilité, mitigation | Modification, SLA, lecture | Aller-retour Rust/handlers, SLA zéro et date vérifiés. IDs GUI et suppressions restent incomplets. |
| KPI, tableaux de bord, suivi | Snapshots et agrégats | Lecture des historiques et indicateurs | Contrat Rust KPI, tests backend historiques et composants frontend. Cohérence sous ingestion réelle et charge à recetter. |
| FIM | Changements, anciens/nouveaux hashes, metadata | Configuration de surveillance | Tests FIM unitaires/intégration et contrat d'upload. Couverture des événements OS et protections contre altération à recetter sur chaque OS. |
| USB | Connexions, déconnexions et violations de politique | Politique et suivi | Contrat testé avec `policy_violation` et `enforcement: monitor_only`. **La politique ne réalise pas de blocage physique** ; `action: allowed` reste honnête. |
| Détection EDR / investigations / MITRE | Détections, incidents, preuves, correspondances | Règles et désactivation / suppression | Tests du pipeline et contrat croisé EDR, réconciliation SQLite. Pas de preuve de couverture de toutes les techniques MITRE ni de taux de faux positifs. |
| Playbooks / orchestration | Définitions, actions, journaux | Édition, désactivation, suppression | Aller-retour EDR et garde-fou sur actions destructrices. Pipeline disponible sans GUI ; compteurs, paramètres destructifs et livraison manuelle SIEM encore limités. |
| Réponse EDR | Résultats d'actions locales | Remédiation générique et commandes autorisées | Tests de code seulement ; pas de commandes serveur dédiées kill/quarantaine/blocage IP validées de bout en bout. Aucun test destructeur sur ce poste. |
| Règles d'alerte / notifications | Définitions et état | Édition distante | Contrat retour testé pour activation, niveau info et délai zéro. IDs GUI, snapshots vides et réconciliation des suppressions non garantis hors EDR. |
| Webhooks | Configuration et statut | Édition distante de la configuration | Aller-retour Rust/handlers testé. Livraison à un véritable destinataire et reprise après panne non testées ; ne pas confondre configuration et livraison. |
| SIEM | Événements, format, transport et statistiques | Configuration du forwarder | Tests du crate SIEM et contrat Rust avec validation événement par événement. Recette nécessaire avec un collecteur TLS réel, coupure et saturation. |
| Diagnostics / logs | Logs et résultat de diagnostic | Commande `diagnostics` | Le chemin actif renvoie le diagnostic dans le résultat de commande. Le type utilitaire `DiagnosticResult` n'est pas la preuve que la route `/diagnostics` est appelée. Fiabilité du résultat sous panne non garantie. |
| Remédiation / installation / désinstallation | Statut de commande | Demandes signées, paramètres MDM | Tests Rust et handlers dédiés. Compatibilité des installateurs et privilèges OS à recetter ; formats non pris en charge restent non pris en charge. |
| Mise à jour et auto-protection | Progression, erreurs, état | Version cible et mises à jour | Tests de signatures, états et protection. Installation, redémarrage, rollback et attaque contre le service non exercés sur poste réel. |
| Mode hors ligne / persistance | Files locales, reprise | Réconciliation au retour du réseau | Tests SQLite et persistance. Garanties renforcées EDR uniquement ; résultats de commandes et suppressions des autres objets restent des lacunes. |
| Rapports / export HTML | Export local ; rapports plateforme distincts | Lecture et génération locale | Le bouton d'export écrit dans `pages/reports.rs` ; un handler historique journalisant seulement n'est pas la preuve que le bouton est inactif. Rapport généré via le cœur encore fondé sur un résumé/template, pas une recette exhaustive des données/export. |
| Assistant IA / terminal / voix / sons / tray | Fonctions essentiellement locales | Actions locales et interactions | 100 tests LLM ; tests GUI. Ils ne prouvent pas l'inférence d'un modèle réel, la reconnaissance vocale, les permissions micro, le terminal interactif ou les interactions tray. |
| Interface plateforme et pont auto-hébergé | Affichage, liens et mappings | Consultation et pilotage | 299 tests frontend agent/vulnérabilités et 59 tests du pont réussis. Navigation navigateur complète et déploiement réel non testés. |

## Défauts et validations restantes par priorité

### P1 — données invisibles ou recréées dans l'interface agent

`crates/agent-core/src/asset_sync.rs` utilise toujours `Uuid::parse_str(...).ok()?` pour charger actifs, alertes, webhooks et risques (lignes 34, 149, 184, 213 au moment de l'audit). Un identifiant Firestore valide mais non UUID est donc écarté. Le convertisseur d'actif plus bas remplace même un ID invalide par un UUID neuf. Les types réseau acceptent pourtant les chaînes : **l'aller-retour API testé ne valide pas ce dernier passage vers l'interface**. La correction EDR ne s'étend pas encore à ces familles.

Critère de clôture : identifiants opaques conservés dans DTO, événements et commandes ; test console → API → SQLite → GUI → modification → même document pour chaque famille, sans duplication.

### P1 — suppression et modifications concurrentes hors EDR

Risques, actifs, alertes et webhooks ne bénéficient pas tous des snapshots complets, marqueurs de suppression persistants et acquittements transactionnels ajoutés aux règles EDR/playbooks. Des chargements GUI n'émettent rien lorsque la liste devient vide. Une suppression distante ou une suppression locale hors ligne ne peut donc pas être annoncée fiable pour toutes ces fonctions.

Critère de clôture : scénarios suppression distante du dernier élément, suppression locale hors ligne, redémarrage, édition concurrente et reprise sans résurrection, sur SQLite et handlers réels.

### P1 — résultat de commande non durable

`crates/agent-sync/src/command_results.rs` envoie les résultats via le client sans outbox persistante. Une commande peut avoir été exécutée sans résultat durablement reçu par la console.

Critère de clôture : interruption réseau après exécution, redémarrage, restitution du résultat sans réexécution destructive et acquittement idempotent côté serveur.

### P1 — moteur EDR en mode service et réponse réelle

Le pipeline personnalisé est désormais commun aux modes service et desktop ; ses évaluateurs et réponses sont testés sans rendu. Voir `grc-reliability-followup-2026-09-27.md` pour les preuves et limites de livraison. Les réserves sur paramètres destructifs et commandes distantes restent ouvertes.

Critère de clôture : mêmes détections et décisions avec/sans GUI, tests de réponse sur machines isolées, conservation de la connectivité de gestion et rollback vérifié.

### P2 — portée fonctionnelle et recette d'exploitation

USB en observation uniquement ; métadonnées de playbook partiellement conservées ; livraison réelle SIEM/webhook/notification non prouvée ; IA/voix non validées avec matériels et modèles réels. Recette Windows/macOS/Linux, Firebase et auto-hébergé, proxy, perte réseau, charge et redémarrage requise avant validation globale.

## Résultats exécutés

| Exécution | Résultat |
| --- | --- |
| Rust : common, core sans features par défaut, FIM, network, persistence, scanner, SIEM, storage, sync (unitaires + intégration + doctests) | **1 164 réussis**, 0 échec, 2 doctests ignorés. |
| Cœur avec GUI/LLM, tests de bibliothèque | **123 réussis**, 0 échec. Variante recouvrant une partie des tests précédents. |
| GUI | **96 réussis**, 0 échec, 1 doctest ignoré. |
| LLM | **100 réussis**, 0 échec ; pas d'inférence réelle requise par ces tests. |
| Backend `agents` avec fixtures des 13 familles | **215 réussis**, 0 échec ; 1 scénario EDR ignoré dans cette commande faute de ses fixtures spécifiques. |
| Contrat EDR dédié avec ses fixtures | **8 tests Jest réussis** et relecture Rust ; recoupe 7 tests backend. |
| Contrat étendu dédié | **18 tests Jest réussis** et relecture Rust des quatre familles ; inclus dans les 215 ci-dessus. |
| Frontend plateforme agent / mapping vulnérabilités | **299 réussis**, 22 fichiers. |
| Pont auto-hébergé | **59 réussis**, 2 fichiers. |
| GUI sans rendu | `cargo check` réussi après correction. |
| Cœur avec toutes les features (GUI, LLM, voix, tray) | `cargo check -p agent-core --all-features --offline` réussi ; compilation uniquement. |

Les nombres sont des résultats d'exécutions et ne doivent pas être additionnés comme des tests uniques ou transformés en pourcentage de couverture. Le premier essai global `--no-default-features` avait échoué sur le rendu GUI ; le défaut a été corrigé et la configuration concernée revérifiée. Les suites n'attestent pas l'exhaustivité des comportements.

## Reproduction

Depuis le dépôt agent :

```sh
bash scripts/test-platform-contracts.sh ../sentinel-grc-v2-prod
bash scripts/test-platform-edr.sh ../sentinel-grc-v2-prod
cargo test -p agent-common -p agent-storage -p agent-sync -p agent-fim -p agent-network -p agent-scanner -p agent-siem -p agent-persistence -p agent-core --no-default-features --offline
cargo test -p agent-gui --offline
cargo test -p agent_llm --lib --offline
cargo test -p agent-core --lib --no-default-features --features gui --offline
cargo check -p agent-gui --no-default-features --offline
cargo check -p agent-core --all-features --offline
```

Depuis la plateforme :

```sh
# Les contrats croisés nécessitent les scripts ci-dessus ; sans fixture ils sont ignorés.
(cd functions && ./node_modules/.bin/jest --runInBand --testPathPatterns=agents)
./node_modules/.bin/vitest run src/hooks/agentDetail src/components/agents src/services/vulnerabilities/__tests__/agentVulnerabilityMapper.test.ts
(cd server && ../node_modules/.bin/vitest run --config vitest.config.ts bridge/__tests__/bridge.test.ts bridge/__tests__/bridge-consistency.test.ts)
```

Objectif de couverture suivant : un scénario positif, un rejet de permission/organisation, une donnée invalide, une coupure réseau et un retour complet jusqu'à la GUI pour chaque objet modifiable ; cas OS réels pour les fonctions privilégiées. Aucun pourcentage de couverture de code n'a été mesuré dans cette vérification.
