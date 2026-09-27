# Radar — identité de la landing CTC

Référence consultée le 27 septembre 2026 : https://cyber-threat-consulting.com/ (page rendue dans le navigateur, lecture des styles des éléments visibles).

Observations : fond bleu nuit, typographie système SF, appel à l’action en dégradé cyan RGB(6,182,212) vers bleu RGB(37,99,235), bordures cyan translucides, accents indigo RGB(99,102,241). L'inspiration porte sur ces éléments graphiques ; aucun contenu commercial ni indicateur marketing n'est repris dans l'application.

Adaptation du radar clair : contour cyan/bleu/indigo à opacité limitée, reflet périphérique de ces couleurs mélangé à 90 % de blanc, balayage bleu et filtres de couches bleus. Les couleurs sémantiques de gravité restent indépendantes du décor et le vert identifie l’état temps réel. La palette n’est pas appliquée globalement à toutes les pages dans cette passe.

Les accents de marque sont centralisés dans theme.rs. L’aperçu utilise des données fictives, sans agent actif. Les captures sont des rendus natifs à 1000 points de largeur ; macOS limite la hauteur à celle disponible sur l’écran.

Validation : 96 tests GUI réussis, compilation preview réussie, deux captures examinées. Légende unique utilisant exactement les couleurs des signaux. L’aperçu photographique repart en haut de page pour éviter de réutiliser un défilement précédent. Avertissement préexistant de compatibilité future de block 0.1.6.
