# Contrôles et filtres — 27 septembre 2026

Le composant partagé `chip_button` réserve la largeur du marqueur dans les deux états, indique la sélection par une coche et expose sa sémantique de sélection. Le focus clavier reste distinct. La hauteur minimale est de 30 points. Les boutons inactifs ont un contour neutre ; les actifs utilisent les couleurs de badges adaptées au thème.

Le radar utilise ce composant pour les couches, le filtre de priorité et la période. Les couleurs des périodes sont celles de navigation (accent) ; le vert reste associé aux couches de télémétrie. Les onglets Pills peuvent maintenant revenir à la ligne et exposent leur état sélectionné.

Validation : 95 tests GUI réussis, compilation de preview réussie, quatre captures examinées dans les deux thèmes, contrôle du diff réussi. Les sorties et images sont dans ce dossier. Les captures utilisent des données fictives, sans action sur le service. Les autres pages qui utilisent ce composant héritent du style, mais leurs parcours n’ont pas tous été rejoués.
