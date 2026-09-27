# Audit fonctionnel et UX — 27 septembre 2026

L'objectif est une interface claire et sombre cohérente, mais aussi des actions fiables, des erreurs compréhensibles et une IA utilisable dans les conditions réelles de la machine. Cette passe combine lecture du code courant et analyse des journaux locaux. Elle ne constitue pas une certification de toutes les fonctions ni une comparaison mesurée avec les produits concurrents.

## Périmètre et preuves

- Journaux quotidiens du 25 au 27 septembre : **16 085 lignes**, dont 1 871 WARN et 2 ERROR. Le 27 est partiel, jusqu'à 08:34:21 UTC. Source : dossier de données `com.sentinel-grc.Sentinel/logs` de l'utilisateur local.
- Agrégats sans adresses réseau ni contenu des conversations : [log-summary.json](functional-audit-2026-09-27/log-summary.json).
- Lecture complémentaire du flux stderr du service historique : 13 tentatives de chargement d'un fichier Whisper absent et 3 refus sandbox concernant le paquet applicatif. Ce flux ne permet pas de dater ces occurrences.
- Code examiné : journalisation, commandes réseau et réponses du moteur, export, moteur IA, voix, mises à jour, structure de navigation, tableaux, rafraîchissement des fenêtres.

Les WARN liés à des alertes de sécurité ne sont pas automatiquement des bugs. Les occurrences ne sont ni un nombre de sessions indépendantes ni une preuve de faux positifs. Les journaux proviennent de plusieurs builds : un incident historique ne prouve pas sa persistance dans le code actuel. L'absence d'incident le 27 ne prouve pas sa résolution si la fonction n'a pas été sollicitée.

## Corrections apportées dans cette passe

| Fonction | Défaut confirmé | Correction |
|---|---|---|
| Ouvrir les logs | Le menu utilisait des chemins différents de ceux du logger, notamment `SentinelGRC` au lieu du répertoire réellement sélectionné sur ce Mac. | Mémorisation du dossier choisi à l'initialisation ; le menu ouvre ce dossier. Avant initialisation, recherche parmi les candidats existants, sans créer de journal supplémentaire. |
| Export réseau | Un échec retournait seulement un booléen et ne produisait pas d'explication visible. | Propagation de l'erreur vers un toast ; succès accompagné du chemin du fichier. |
| Blocage d'une connexion | Message de succès avant exécution, y compris lorsque l'adresse distante était absente. | Bouton désactivé sans adresse distante ; message de demande envoyée. Le résultat réel reste géré par `ResponseActionResult` et l'historique des réponses. |

Fichiers concernés : `crates/agent-core/src/logging.rs`, `crates/agent-core/src/tray.rs`, `crates/agent-gui/src/pages/network.rs`. Les autres modifications déjà présentes dans le dépôt sont conservées.

## Priorités fonctionnelles

| Priorité | Constat et niveau de preuve | Amélioration à réaliser | Critère de validation |
|---|---|---|---|
| Haute — livraison | 6 avertissements de vérification de signature désactivée. Le code `update_manager::verify_signature` accepte encore une clé embarquée absente. | Imposer la clé et la signature sur le canal de production ; rendre explicite le canal de développement non signé. Cette passe ne change pas la politique de livraison. | Paquet altéré, signature absente ou mauvaise clé refusés ; paquet signé accepté ; contrôle de la clé dans le pipeline de release. |
| Haute — IA | 10 expirations initiales et 9 expirations après nouvelle tentative sur les 25–26. Le moteur courant impose au moins 90 s par tentative et peut recharger puis réessayer. | Budget global de requête, annulation, état explicite de chargement/reprise, instrumentation du premier token et du temps total. Choisir le modèle et le contexte selon la mémoire disponible. | Scénarios froid/chaud, hors ligne et saturation ; mesurer p50/p95, mémoire maximale et délai d'annulation. Aucune attente sans état visible. |
| Haute — voix | 11 erreurs de chargement Whisper, 10 échecs de capture et 6 expirations TTS dans les journaux quotidiens. Le stderr confirme un modèle absent. | Vérifier la disponibilité du modèle avant activation, proposer un parcours d'installation avec progression/reprise, distinguer permission micro, modèle absent, transcription et synthèse. | Tests micro refusé, modèle absent/corrompu, interruption, TTS bloquée et nouvelle session après erreur. Le code actuel rejette déjà le modèle absent : il faut valider le parcours complet. |
| Haute — retour des actions | Le moteur émet bien les états pending/success/failed, mais le résultat est principalement conservé dans l'historique des réponses. | Rendre le résultat visible depuis la page qui a initié l'action ; identifiant de corrélation et accès à l'erreur détaillée. | Une erreur du moteur ne laisse jamais un succès affiché ; résultat retrouvable après changement de page. |
| Moyenne — modèles | 2 téléchargements refusés par HTTP 401 le 26. Le catalogue a évolué depuis ces incidents. | Vérifier les entrées encore proposées, différencier authentification, indisponibilité et réseau ; reprise sans état « prêt » prématuré. | Un téléchargement refusé retourne à un état réessayable ; modèle utilisable seulement après validation du fichier. |
| Moyenne — ressources | 13 avertissements de dépassement de ressources et 23 replis PagedAttention GPU/CPU sur les 25–26. | Profiler chargement, inférence et scans simultanés ; limiter concurrence, taille de contexte et cache selon un budget explicite. | Mesures CPU/RAM/IO au repos et en charge. Les logs seuls ne démontrent ni fuite mémoire ni régression de performance. |
| Moyenne — conformité | 37 échecs de contrôle GPO observés sur les 25–26. | Vérifier l'applicabilité OS et distinguer non applicable, erreur de collecte et non conforme. | Une règle non applicable ne dégrade pas le score ; résultat accompagné de la preuve et de sa date. Les logs ne suffisent pas à conclure à un faux positif. |
| Moyenne — exports | Logiciels : exports retournant un booléen ; monitoring : export sans résultat propagé. | Étendre le contrat succès/erreur/chemin des exports réseau et l'approche asynchrone déjà présente pour les actifs. | Destination non inscriptible, fichier occupé, résultat vide et volume important : retour explicite et interface réactive. |
| Moyenne — observabilité | 1 459 lots d'alertes réseau et 274 lots de corrélations comptabilisés. | Séparer événements métier, santé technique et audit des actions ; compter les répétitions sans supprimer la preuve initiale. Vérifier la déduplication avant toute réduction de logs. | Retrouver origine, première/dernière occurrence, fréquence et action associée. Aucun masquage d'alerte sous prétexte de bruit. |

## Axes UI/UX transversaux

| Axe | Observation dans le code courant | Direction et critère de réussite |
|---|---|---|
| Organisation | `ResponsiveGrid` limite toutes les grilles à deux colonnes ; les onglets à partir de deux entrées utilisent eux aussi une grille. Les cartes de navigation sécurité se répètent sur plusieurs pages. | Séparer navigation et synthèse. Onglets en une ligne lorsqu'ils tiennent, débordement accessible sinon ; grilles adaptées au contenu et à la largeur. Les données et l'action principale doivent apparaître avant de longs blocs de navigation. |
| Thème clair | La palette et les effets ont déjà été retravaillés, mais cela ne démontre pas la parité de tous les états. | Comparer clair/sombre pour sélection, hover, focus, désactivation, chargement, erreur, menus, drawers et tableaux. Utiliser les mêmes niveaux de profondeur avec des ombres et bordures adaptés au fond clair. |
| Tableaux | Certaines cellules tronquées sont non sélectionnables et leur contenu complet dépend du survol. | Détail et copie accessibles au clavier ; tri, filtre et sélection conservés au rafraîchissement. Vérifier les textes longs et les valeurs manquantes. |
| États des données | Des composants génériques ne peuvent pas expliquer à eux seuls pourquoi une liste est vide. | Distinguer pas encore analysé, filtre sans résultat, hors ligne, erreur et résultat réellement vide ; action de reprise adaptée. Afficher la fraîcheur des données et l'état de synchronisation. |
| IA et voix | Les erreurs techniques et les attentes longues dégradent plus l'expérience que le seul aspect visuel. | Regrouper conversation, contexte, sources et actions ; réglages secondaires dans un panneau dédié. États explicites : prêt, chargement, écoute, transcription, génération, lecture, erreur. Annulation accessible pendant les opérations. |
| Fluidité | La fenêtre IA flottante appelle `request_repaint()` en continu. La fenêtre principale possède déjà un mécanisme de réveil sur événement. | Conditionner les rafraîchissements rapides à une animation ou une activité réelle et respecter la réduction des animations. Mesurer le repos de chaque fenêtre avant/après ; ne pas attribuer le comportement flottant à toute l'application. |
| Cohérence métier | Les parcours traversent réseau, menaces, investigation et réponses. | Conserver la cible et les filtres entre modules ; présenter preuve, contexte, action possible et résultat dans un ordre stable. Pour les rapports : période, périmètre et fraîcheur visibles avant export. |

## Couverture restante et validation

Les axes ci-dessus sont un backlog documenté, pas des fonctions annoncées comme terminées. La revue des logs ne remplace pas des parcours exécutés sur chaque OS. Il reste à dérouler une matrice par module : nominal, données absentes, erreur backend, hors ligne, permissions refusées, chargement prolongé, changement de page pendant l'action, clavier, textes longs et fenêtres étroites, dans les deux thèmes.

Aucun blocage IP, téléchargement de modèle, accès micro, installation de mise à jour ou redémarrage de service n'a été exécuté pour cet audit. Les corrections sont validées par les tests GUI et la compilation du cœur ; les logs de validation sont conservés dans le dossier de preuves associé.

- `cargo test -p agent-gui --lib --all-features --locked` : **93 tests réussis**, aucun échec ([sortie](functional-audit-2026-09-27/gui-tests.log)).
- `cargo check -p agent-core --features gui --locked` : réussi ([sortie](functional-audit-2026-09-27/core-check.log)). Avertissement existant de compatibilité future pour la dépendance `block v0.1.6`.
- `git diff --check` sur les fichiers corrigés : réussi.
