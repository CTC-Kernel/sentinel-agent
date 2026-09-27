# Navigation et thèmes — 27 septembre 2026

Cette passe réduit la place prise par les contrôles de navigation et renforce la sélection dans les thèmes clair et sombre.

- Les quatre destinations de sécurité deviennent des raccourcis compacts, avec description au survol. Les destinations, filtres et réinitialisations de sélection restent identiques.
- Les onglets utilisent une ligne lorsqu'ils tiennent et passent naturellement à la ligne sinon. Les libellés et compteurs restent visibles ; ils ne deviennent plus des cartes sur deux colonnes.
- L'onglet actif reçoit un fond teinté issu des couleurs du thème, en plus du soulignement et du texte renforcé. Le focus clavier et la sémantique de sélection sont conservés.
- Les grilles adaptatives permettent jusqu'à quatre colonnes, selon la largeur minimale demandée par le contenu. Trois indicateurs peuvent donc tenir ensemble sur un écran large ; une seule carte utilise toute la ligne.

## Validation

`cargo test -p agent-gui --lib --all-features --locked` : 95 tests réussis. Le test des onglets vérifie une ligne à 960 points et le retour à la ligne à 420 points dans les deux thèmes. Les tests de grille contrôlent les limites des cellules et l'absence de chevauchement entre 640 et 1920 points, avec vérification des trois et quatre colonnes.

Compilation de l'exemple `preview` réussie. Six captures natives examinées : Réseau et Paramètres en clair/sombre à 1360 points de largeur, Menaces en clair/sombre à 900 points. macOS réduit la hauteur demandée à celle disponible à l'écran. Les données sont fictives ; aucun scan ni changement de configuration de l'agent n'a été exécuté.

[Galerie et captures](navigation-refinement-2026-09-27/index.html). Les sorties des tests, de compilation et les empreintes des images sont conservées dans ce même dossier.

Cette validation couvre les composants partagés et ces trois pages, pas l'ensemble des parcours métier. Les contrôles de couches du radar et les autres variantes d'onglets restent à harmoniser dans une prochaine passe.
