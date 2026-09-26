# Qualité produit — SOC, RSSI/GRC et MSP/IT

26 septembre 2026. Périmètre effectivement inspecté : GUI Rust native, raccordements de commandes au runtime, analyse et cache du moteur IA. Les trois usages demandés sont conservés. Ce document accompagne des corrections exécutables ; il ne certifie ni la perfection, ni une supériorité concurrentielle, ni l’exhaustivité des besoins métier.

## Résultat vérifié

- **82 tests GUI réussis**, toutes fonctionnalités ; **99 tests IA réussis** ; `cargo check -p agent-core --features gui --locked` réussi. Les avertissements existants concernant `block 0.1.6` et, lors d’une édition de liens, la taille de la table unwind restent visibles dans les journaux.
- **56 rendus natifs** archivés, 20 pages principales dans les deux thèmes. Tiroir de vulnérabilité revérifié après sa conversion en modale.
- **35 configurations page/onglet** sondées pour le défilement en clair compact ; galerie et campagne antérieure sombre décrites dans le [rapport GUI](audit-gui-2026-09-26.md).
- **70 mesures de préparation CPU d’image**, détail ci-dessous. Aucun essai sous charge de production, GPU, consommation énergétique, endurance ou parc distant n’est déclaré réussi.
- Inventaire reproductible : **21 variantes de page déclarées**, dont Orchestration hors catalogue principal, **63 commandes GUI déclarées**, références textuelles vers interface/runtime. Le [registre JSON](audit-2026-09-26/product-surface.json) distingue présence dans le code et preuve d’exécution. Une référence ne prouve pas qu’une commande fonctionne ni qu’elle est autorisée pour un rôle donné.

## Corrections supplémentaires livrées

| Domaine | Défaut | Changement et preuve |
|---|---|---|
| Navigation | Une recherche de sélecteur masquait des options sans les retirer du parcours clavier. | Indices visibles uniquement ; Entrée sur le résultat filtré, flèches sur sous-ensemble, aucun résultat : trois tests. |
| Superpositions | Le tiroir utilisait un voile non interactif. | Modale native ; clic extérieur ferme sans activer le bouton sous-jacent : test d’événements. Restauration du focus prévue ; lecteur d’écran et empilement modal restent à tester. |
| Cache IA | Concaténation ambiguë du système et du prompt ; séquences d’arrêt et métadonnées absentes de la clé. | Encodage versionné avec champs séparés, paramètres binaires et métadonnées ordonnées. Test collision `a/bc` contre `ab/c`, arrêt et contexte d’appel différents. |
| Cache IA | Même cache pour modèles/configurations différents. | Sous-répertoire dérivé de la configuration et de la taille/date du fichier au démarrage. Test d’isolation entre deux modèles. Les métadonnées du fichier ne remplacent pas une empreinte cryptographique du modèle. |
| Cache IA | Écriture directe partielle, double comptage après remplacement, sous-dépassement du compteur lors d’expiration. | Fichier temporaire unique puis renommage ; verrou par instance ; comptage du delta, soustraction saturée, taille projetée bornée. Tests remplacement et entrée trop volumineuse ; assertion d’expiration sans sous-dépassement. |
| Analyse IA | Troncature du journal au 200e octet pouvant couper un caractère UTF-8 et provoquer un panic. | Suppression de l’extrait de réponse du journal ; taille seule journalisée. Test avec 100 caractères euro. |
| Analyse IA | Confiance fixe de 80/40 présentée sans calibration ; octets présentés comme tokens. | Provenance explicite `model_structured` / `heuristic_fallback`, `confidence_calibrated=false`, score historique zéro = inconnu ; tokens issus du moteur, cumulés sur les itérations. Zéro signifie indisponible, jamais une probabilité de sûreté. Test du nombre de tokens fourni par le moteur et de la lecture des anciennes métadonnées. |
| Configuration IA | `NaN` pouvait passer les comparaisons de température/top-p. | Bornes excluant les non-finis ; validation des paramètres de requête avant chargement du modèle. Test prouvant le rejet et le maintien de l’état non chargé. |

Compatibilité : les nouveaux champs de métadonnées utilisent les valeurs par défaut à la désérialisation. Un ancien résultat a une provenance inconnue ; son éventuel score historique ne devient pas calibré. Les consommateurs externes doivent tenir compte du changement de sémantique de confiance. Les anciennes entrées de cache restent sur disque, mais ne sont plus consultées par le nouveau moteur. Aucune suppression automatique n’a été effectuée. Le quota est par espace de modèle ; la gestion globale et interprocessus reste à construire.

## Mesure de performance

[Résultats bruts](audit-2026-09-26/performance.json). macOS aarch64, binaire **debug**, fixtures synthétiques de l’exemple `preview`, fenêtre 1360 × 820, 10 images d’échauffement puis 100 images par configuration. Chronométrage de `egui::Context::run`, sans tessellation/GPU, rendu de la fenêtre native, services, réseau, stockage ou inférence. Modèle exact du CPU indisponible dans le bac à sable ; résultats locaux indicatifs, non comparables à un autre produit sans protocole commun.

| Configuration | Médiane | P95 |
|---|---:|---:|
| Conformité, onglet 0, sombre | 3,68 ms | 4,04 ms |
| Conformité, onglet 0, clair | 3,63 ms | 3,97 ms |
| Menaces, onglet 0, clair | 3,05 ms | 3,67 ms |
| Menaces, onglet 0, sombre | 3,03 ms | 3,31 ms |

Le P95 est ≤ 4,04 ms pour les 70 configurations mesurées. Cela ne prouve pas 60 images/s dans l’application complète. Pas de gain avant/après revendiqué : cette campagne établit une base de mesure, pas une comparaison.

## Contrat métier commun et parcours par rôle

Les éléments suivants sont des exigences de validation, **pas des fonctionnalités nouvellement implémentées**. Le catalogue de 20 pages a sa revue détaillée dans le rapport GUI ; les 35 couples page/onglet et les 63 commandes ont leur registre.

| Usage | Parcours à accepter de bout en bout | Pages concernées | Preuve exigée |
|---|---|---|---|
| SOC | Détection → triage → enquête → confinement → vérification → clôture | Accueil, Menaces et ses 7 onglets, Réseau, FIM, Cartographie, Vulnérabilités, Audit, IA | Cas bénin/malveillant connu, sources horodatées, chronologie, acteur, autorisation, résultat de chaque action et retour arrière vérifié. |
| RSSI/GRC | Contrôle → preuve → risque → responsable → échéance → exception → rapport | Conformité et ses 2 onglets, Risques, Inventaire, Rapports et ses 4 onglets, Audit, IA | Preuve versionnée, fraîcheur, périmètre, justificatif d’exception, calcul explicable, export rapproché des données sources. |
| MSP/IT | Enrôlement → inventaire → supervision → correctif → reprise → compte rendu client | Enrôlement, Surveillance et ses 2 onglets, Logiciels & MDM, Shadow IT, Inventaire, Sync, Paramètres, Terminal | Cloisonnement organisationnel, perte réseau, reprise idempotente, mises à jour échelonnées, droits minimaux et vérification de l’état après correctif. |
| Tous | Recherche → navigation → détails → annulation/confirmation → historique | Palette, Notifications et ses 3 onglets, tiroirs, modales, IA et ses 3 onglets, À propos | Même résultat clair/sombre, petit écran/zoom, clavier/lecteur d’écran, données absentes/périmées/erreur/chargement. |

Aucun test unitaire local ne remplace ces parcours. L’existence d’un agent endpoint ne démontre pas à elle seule l’administration multi-client, un centre SOC complet ou une gestion intégrée des risques.

## Écarts prioritaires restant à traiter

| Priorité | Constat ou validation manquante | Travail concret / seuil d’acceptation |
|---|---|---|
| P1 | `engine.rs` peut charger le modèle sur un état non Ready sans coordination globale de son cycle de vie. Le timeout est relevé à au moins 90 s et la reprise peut recharger puis réessayer. | Machine d’états et file bornée ; une échéance totale incluant chargement/reprise ; annulation ; tests requêtes simultanées, déchargement pendant inférence et panne. |
| P1 | `InferenceRequest.stop_sequences` est dans la clé mais `stop_toks: None` demeure dans l’appel au backend. | Transmettre les arrêts au backend avec la sémantique attendue et prouver qu’ils sont appliqués sur le modèle réel. |
| P1 | Outils IA : trois itérations bornent le nombre d’appels, mais pas leur durée ni la taille des résultats. | Timeout global et par outil, budget de contexte, validation de schéma, provenance, tests outil suspendu, résultat excessif et réponse malformée. |
| P1 | Les réponses structurées ne sont pas pour autant factuellement vérifiées. Le repli heuristique peut interpréter des mots sans comprendre la négation. | Références à preuves valides, abstention explicite, séparation faits/inférences, jeu français/anglais avec cas contradictoires, périmés, inconnus et injections de prompt. Aucun déclenchement d’action fondé sur une prose non validée. |
| P1 | Aucun parcours de réponse/remédiation réel exécuté pendant cet audit. | Laboratoire isolé Windows/Linux/macOS ; contrôle des permissions, cible, aperçu, exécution, résultat, audit et récupération. |
| P1 | Isolation des organisations et rôles non démontrée de bout en bout. | Tests négatifs d’accès croisé aux données, caches, exports, outils IA et commandes, sur la console et l’agent. |
| P1 | VoiceOver/NVDA, zoom 200 %, graphe au clavier et focus modal imbriqué non validés. | Parcours critiques terminables sans souris dans les deux thèmes ; états et erreurs annoncés ; retour du focus testable. |
| P2 | Endurance et volumétrie non mesurées ; cache disque synchrone, sans politique d’éviction globale. | Bench release avec 1k/10k/100k événements, mémoire suivie pendant 24 h, coupures répétées ; budgets CPU/RAM par classe de machine ; cache borné globalement et hors chemin asynchrone sensible. |
| P2 | Accueil compact trop haut, densité et vocabulaire hétérogènes. | Priorité, justification et action accessibles avant défilement ; modes de densité ; lexique français unique ; essais chronométrés avec les trois rôles. |
| P2 | `Orchestration` est déclaré hors catalogue principal ; interface web hors campagne. | Décision explicite de périmètre, puis mêmes preuves pour chaque surface publiée. |

Les limites du cache nouvellement corrigé doivent rester explicites : verrou par instance, identité de fichier prise au démarrage, pas de nettoyage des espaces anciens. Une substitution de modèle en cours de processus ou plusieurs processus partageant le même répertoire nécessitent une gestion supplémentaire.

## Comparaison aux références du marché

Comparer des tâches identiques avec les mêmes données, matériels, permissions et versions. Les axes proposés s’appuient sur les documentations publiques, pas sur un classement :

- SOC : lien entre investigation et réponse, traitement d’incidents et vérification des actions ; [Microsoft Defender XDR — investigation/réponse](https://learn.microsoft.com/en-us/defender-xdr/pilot-deploy-investigate-respond).
- GRC : continuité risques, conformité et opérations ; [ServiceNow Integrated Risk Management](https://www.servicenow.com/products/integrated-risk-management.html).
- Détection/protection : cas adversariaux reproductibles et résultat observé ; [MITRE ATT&CK Evaluations](https://attackevals.mitre.org/).

Critères communs : taux de tâches correctement terminées, temps médian/P95, erreurs opérateur, faux positifs/négatifs sur corpus étiqueté, coût CPU/RAM, qualité des preuves et reprise après panne. Les cibles doivent être fixées avant les essais ; aucune supériorité sur ces produits n’a été mesurée ici.

## Reproduction et pièces jointes

```sh
cargo test -p agent-gui --lib --all-features --locked
cargo test -p agent_llm --lib --locked
cargo check -p agent-core --features gui --locked
cargo build -p agent-gui --examples --locked
PROBE_LIGHT=1 PROBE_W=960 PROBE_H=640 target/debug/examples/scroll_probe
PROBE_PERF=1 target/debug/examples/scroll_probe > /tmp/sentinel-performance.json
python3 scripts/audit_product_surface.py > /tmp/sentinel-product-surface.json
```

Journaux : [GUI](audit-2026-09-26/tests.log), [IA](audit-2026-09-26/llm-tests.log), [compilation intégrée](audit-2026-09-26/core-check.log), [construction](audit-2026-09-26/build.log), [défilement](audit-2026-09-26/scroll-light-compact.log). Le script d’inventaire analyse les déclarations et références textuelles, pas l’AST ni les conditions de compilation ; commentaires/tests peuvent figurer parmi les références.

## Suite : module IA et voix

Le [lot conversation, menus et voix](module-ia-ux-2026-09-26.md) documente les corrections suivantes, les nouveaux tests et les captures actualisées. Les résultats ci-dessus restent ceux de la campagne initiale.
