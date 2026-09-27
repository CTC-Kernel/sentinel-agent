# Audit transversal GUI — 27 septembre 2026

La couverture inclut les **21 pages déclarées et 47 vues/onglets**. Le rendu de toutes ces vues est exercé, mais l'application n'est pas entièrement validée fonctionnellement : des défauts de largeur et plusieurs états métier trompeurs restent présents.

[Galerie claire/sombre](index.html) · [Inventaire pages/commandes](surface.json) · [Résultats du banc](probe-results.json) · [Tests GUI](tests.log) · [Mesures CPU](performance.json)

## Méthode et résultats

- macOS ARM64, build debug, fonctionnalités GUI activées, données fictives. Base Git `35cf1e6468a42ea6e3df15c0cd80c3851e99a049` avec modifications locales préexistantes ; ce n'est pas un audit du seul commit.
- **104 tests GUI réussis**, y compris la validation des délais d'escalade et la visibilité du champ de saisie IA.
- **376 cas** : 47 vues × clair/sombre × largeurs 800/1360 × données fictives/état par défaut. Aucun blocage du défilement extérieur détecté, aucune panique pendant ces cas. Le test exerce aussi le défilement de la palette de commandes.
- Un contrôle supplémentaire de largeur révèle **14 occurrences de débordement**, réparties sur quatre vues : Terminal, Cartographie, Orchestration/Vue d'ensemble et Orchestration/Gouvernance. Les quatre lots à 800 échouent donc au contrôle géométrique ; les quatre lots à 1360 passent.
- **94 captures natives principales** : chaque vue en clair et sombre à 1100 points. Revue visuelle des huit planches comparatives. Captures supplémentaires des vues étroites en défaut et de la partie basse de Conformité. Ce contrôle visuel ne constitue pas une mesure exhaustive des contrastes ou des zones hors écran.
- **64 commandes GUI** inventoriées : chacune possède des références textuelles dans agent-core. Cette présence ne prouve ni l'exécution correcte, ni la persistance, ni la qualité de gestion des erreurs.
- **94 mesures de préparation CPU egui**, 100 images mesurées après 10 images de chauffe. P95 le plus élevé observé : 5,32 ms, Applications/sombre. Mesures debug réalisées sur cet hôte pendant d'autres travaux : elles excluent GPU, scan, réseau, audio et inférence. Elles ne prouvent pas une fréquence d'affichage ni une performance de production.

## Anomalies à traiter

| Priorité | Surface | Constat et preuve | Correction attendue |
|---|---|---|---|
| P1 | Orchestration | `show(ui)` ne reçoit pas l'état métier et les boutons changent des valeurs temporaires egui. Le lancement annonce une exécution signée/auditée avec un identifiant fixe ; les connecteurs sont déclarés actifs dans un tableau constant. Voir `orchestration.rs:652–681` et `1176–1218`. | Identifier explicitement la démonstration et remplacer ces statuts par les réponses vérifiées du moteur avant toute exposition comme fonction opérationnelle. |
| P1 | FIM, état vide | Le texte affirme « La surveillance est active et fonctionnelle » sur la seule absence d'alertes (`fim.rs:182`). | Conditionner la santé affichée à la disponibilité du moteur, à la collecte et à sa fraîcheur. L'absence d'alertes seule ne suffit pas. |
| P2 | Terminal | Largeur mesurée 873,6 pour un viewport 800, avec et sans données, dans les deux thèmes. Barre de filtres sur une ligne (`terminal.rs:159`). | Séparer filtre de niveau et recherche/export, permettre le retour à la ligne. |
| P2 | Cartographie | Largeur mesurée 852,8 pour 800 quand des données existent. La légende est une ligne non adaptable (`cartography.rs:395`). | Faire revenir la légende à la ligne en conservant chaque symbole avec son libellé ; vérifier aussi les contrôles de zoom. |
| P2 | Orchestration | Largeur mesurée 1043,3 pour 800 dans Vue d'ensemble/Gouvernance, dans les deux thèmes et états. | Revoir les lignes/cartes à largeur minimale, notamment les connecteurs et sections communes ; revalider les deux vues. |
| P2 | FIM, export global | Le résultat booléen d'`export_events_csv` est ignoré par le bouton global (`fim.rs:207`). | Donner un retour utilisateur avec chemin de sortie ou erreur, comme dans Réseau et Notifications. |
| P2 | Notifications/Webhooks | Enregistrement autorisé dès que nom et URL sont non vides (`notifications.rs:852`). Le menu présente 3 formats alors que la table de valeurs en comporte 4, dont PagerDuty (`815–816`). | Valider le format d'URL avec un message près du champ ; aligner formats proposés et formats réellement supportés. Ne pas activer PagerDuty sans vérifier sa prise en charge. |
| P2 | Navigation Orchestration | 21 variantes de page, mais catalogue de navigation à 20 entrées sans Orchestration (`app.rs:40–70`). | Décider explicitement du statut du module : prototype masqué ou produit intégré. Ne pas ajouter une entrée de production avant de traiter P1. |
| P3 | Cohérence graphique | Densité différente entre tableaux Inventaire/Shadow IT, grandes zones libres dans Rapports, petits textes secondaires sur fond sombre. Le radar utilise une palette de gravité locale différente de celle des autres modules. | Harmoniser densité, tailles minimales et palette sémantique ; mesurer les contrastes sur les composants réels. |

Les références de lignes correspondent au code lu pendant cette passe ; le dépôt comporte d'autres travaux locaux. Les corrections produit ci-dessus **ne sont pas présentées comme réalisées** par cet audit.

## Couverture par module

Chaque ligne ci-dessous dispose d'un rendu headless dans les huit configurations et de captures natives dans les deux thèmes. « Aucun défaut bloquant observé » signifie uniquement dans ces scénarios de présentation.

| Module | Vues couvertes | Observations |
|---|---|---|
| Tableau de bord | Vue principale | Rendu et défilement ; contenu inférieur couvert par le banc, pas intégralement par la capture initiale. |
| Surveillance | Journal SIEM, Statistiques | Rendu des journaux, indicateurs et commandes ; connexion SIEM réelle non testée. |
| Conformité | Liste, Matrice | Deux modes préparés, contrôles et scores ; captures complémentaires sous le premier écran. |
| Logiciels & MDM | Dépendances/paquets, Applications | Onglet Applications ajouté au banc ; validation locale macOS uniquement. |
| Vulnérabilités | Liste principale | Filtres, indicateurs et tableau. |
| Intégrité des fichiers | Vue principale | Deux défauts fonctionnels décrits ci-dessus. |
| Menaces | Vue d'ensemble, Événements, Investigation, Réponse, Playbooks, Règles, Chronologie, Autorisations | Huit onglets rendus ; aucune isolation, terminaison, quarantaine ou règle réelle exécutée. |
| Journal d'audit | Vue principale | Tableau et filtre visibles. |
| Réseau | Connexions, Alertes de sécurité, Interfaces | Trois onglets rendus ; pas de scan réel déclenché. |
| Shadow IT | Découverte | Tableau et indicateurs ; pas de découverte active. |
| Cartographie | Graphe local | Débordement étroit ; lien vers vue 3D externe non ouvert. |
| Inventaire | Vue principale | Registre et contrôles visibles. |
| Risques | Vue principale | Registre et contrôles visibles ; matrice repliée non examinée visuellement dans cette passe. |
| Rapports | Synthèse exécutive, Audit de conformité, Incidents, Historique | Quatre onglets ; génération/export de fichier réel non déclenché. |
| Notifications | Notifications, Règles d'alerte, Webhooks | Trois onglets ; anomalies du formulaire webhook relevées par lecture de code. |
| Synchronisation | Vue principale | Historique et état affichés ; pas de requête de synchronisation réelle. |
| Terminal | Vue principale | Débordement étroit. |
| Paramètres | Agent, Apparence, Connexions & SIEM, Administration | Quatre onglets ; configuration réelle non modifiée. |
| Orchestration | Vue d'ensemble, Workflows, Marketplace, Exécutions, Gouvernance | Cinq vues ajoutées au banc ; module à considérer comme démonstration locale en l'état. |
| À propos | Vue principale | Informations et liens visibles ; liens externes non ouverts. |
| Assistant IA | Assistant, Recommandations, Modèle & diagnostic | Trois onglets ; aucune inférence ni capture/lecture audio réelle pendant cette passe. |

## Changements apportés au banc

1. Ajout d'Applications et des cinq vues d'Orchestration aux sélecteurs et routes de l'aperçu/probe.
2. Ajout d'un mode sans fixtures (`PROBE_EMPTY`) et d'un contrôle de largeur du contenu au probe. Le journal distingue `OVERFLOW` de `STUCK` ; un code de sortie non nul doit être lu avec ces diagnostics.
3. Synchronisation du réglage d'apparence fictif avec le thème de l'aperçu ; recapture d'Apparence après correction. La divergence initiale était propre au banc.

## Limites et ordre de suite

Priorité : fiabilité des statuts Orchestration/FIM, débordements étroits, retours d'export, validation des formulaires, puis cohérence graphique.

Restent à valider en environnement d'intégration : interactions clavier et lecteur d'écran, contrastes chiffrés, chaque formulaire ouvert, chaque menu/drawer et état d'erreur, services réellement déconnectés, données volumineuses, persistance après redémarrage, Linux/Windows, audio/inférence, génération et ouverture des exports, autorisations/RBAC et actions EDR. Aucun score de perfection, certification d'accessibilité ou succès métier global ne peut être déduit des captures et tests locaux.
