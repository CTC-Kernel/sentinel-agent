# Radar Menaces — thème clair

Palette claire dédiée : surface #F2F6FC, dégradé du disque du blanc au #E4ECF9, structure #4468AE. Signaux critiques #B82F4F, élevés #B85727, moyens #966E23 et faibles #6858A7. Les signaux restent répartis par secteur et gravité ; les interactions de filtrage et de sélection ne sont pas modifiées.

En clair, transparences RGBA explicites, un seul halo doux et contour blanc autour du noyau. La légende de gravité est déplacée sous le disque pour éviter les superpositions avec les signaux ; elle est masquée lorsqu’un panneau de sélection occupe cet espace. La palette et les halos sombres restent conservés. La légende est sous le bas des captures à cette hauteur de fenêtre et nécessite un défilement.

Comparaison visuelle avec le widget réel TrayRadar, affiché par le nouveau mode d’aperçu `radar-reference`. Ce widget représente une posture polygonale, le radar Menaces des événements : leurs données et géométries ne sont pas assimilées.

Validation : 96 tests GUI réussis, build preview réussi, trois captures examinées (clair, sombre, référence), diff sans erreur de whitespace. Avertissement existant pour block 0.1.6. Aucun service, microphone ou action de sécurité déclenché.
