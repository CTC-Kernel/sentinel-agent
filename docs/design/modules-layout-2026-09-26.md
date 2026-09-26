# Réorganisation des modules — 26 septembre 2026

La révision étend les améliorations de composition aux 19 modules du catalogue natif hors assistant IA. Elle concerne la présentation et la navigation ; elle ne démontre pas une supériorité fonctionnelle sur des produits concurrents.

## Changements

- En-têtes : suppression de la marge ajoutée deux fois entre le texte d’introduction et le contenu. La page conserve la maîtrise de son espacement.
- Cartes partagées : marge intérieure de 16 points au lieu de 24 ; hauteur minimale intérieure des synthèses de 56 au lieu de 72. Les contenus longs peuvent toujours agrandir la carte.
- Tableau de bord : identité de l’organisation, connexion, synchronisation et liens rassemblés dans une seule ligne qui se replie si nécessaire.
- Paramètres : quatre sections explicites — Agent, Apparence, Connexions & SIEM, Administration. Les commandes, validations et protections existantes sont conservées ; seule leur répartition change.
- Réseau : trois onglets — Connexions, Alertes de sécurité, Interfaces. Les répartitions des flux deviennent un détail dépliable sous la vue sélectionnée.
- Risques : compteurs et registre accessibles sans traverser une grande matrice. La matrice probabilité × impact reste disponible dans un volet dépliable.
- Navigation générale : chaque module conserve sa propre position de défilement, au lieu de transmettre son décalage à la page suivante.

Les améliorations partagées s’appliquent aussi à la surveillance, la conformité, les logiciels, les vulnérabilités, l’intégrité des fichiers, les menaces, l’audit, Shadow IT, la cartographie, l’inventaire, les rapports, les notifications, la synchronisation, le terminal et la page À propos. Ces modules n’ont pas chacun fait l’objet d’une réécriture complète de leurs tableaux ou fonctions métier.

## Validation

- 89 tests GUI réussis avec toutes les fonctionnalités. Nouveau test de navigation : défilement dans Réseau, arrivée en haut des Paramètres, puis restauration de la position Réseau.
- Sonde des 40 configurations page/onglet, plus palette : sombre 1360 × 820 et clair 960 × 640. Aucun défilement bloqué détecté. Les cinq nouvelles routes des paramètres et du réseau sont incluses.
- 60 captures natives : 19 modules × 2 thèmes, six pages compactes × 2 thèmes, cinq nouveaux onglets × 2 thèmes.
- [Galerie comparative avant/après](modules-layout-2026-09-26/index.html), manifeste et journaux de validation dans le même dossier.

Les captures utilisent des données synthétiques. Les exports, scans, modifications de paramètres du service et autres opérations métier n’ont pas été exécutés. La vérification de rendu porte sur le premier écran des vues capturées ; elle ne constitue pas un test de chaque interaction, ni une validation Windows/Linux ou lecteur d’écran. Le prototype Orchestration hors catalogue et l’application web ne font pas partie de cette passe native.
