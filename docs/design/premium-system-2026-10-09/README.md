# Sentinel — langage visuel commun

La carte Detection & Response sert de référence à la finition de l’application native egui. Les pages conservent leurs données et leurs actions métier ; les composants partagés portent la cohérence visuelle.

## Composants

| Composant | Usage et comportement |
| --- | --- |
| `instrument_glyph` | Emblème circulaire statique pour les en-têtes, les états vides et les détails. Aucun score ni activité implicite. |
| `surface_light` | Éclairage diffus opaque, adapté au thème, placé derrière le contenu des cartes. Aucune animation continue. |
| `metric_card` | Icône sémantique, valeur, libellé, flèche de consultation. L’action reste définie par la page (filtre ou navigation). |
| `page_header_nav` | Rubrique, identité du module, titre, explication et aide contextuelle. L’emblème disparaît sous 540 points. |
| `data_card` | Surface analytique avec accès explicite à la vue détaillée ; les contrôles enfants restent prioritaires. |
| Jauge | Graduation périphérique fondée sur le score réel. Les données absentes restent inconnues. |
| Badges | Point sémantique, texte contrasté, padding explicite, ellipse dans les espaces restreints et texte complet au survol. |
| Navigation et tableaux | État sélectionné indiqué par couleur, contour et marqueur ; focus clavier conservé. |

Les cartes métriques sont communes à Conformité, Vulnérabilités, Menaces, Réseau, FIM, Inventaire, Logiciels, Shadow IT, Risques et Surveillance. Les autres vues héritent des surfaces, des en-têtes, de la navigation, des badges et des fenêtres de détail.

## Règles de composition

- Utiliser les couleurs et polices sémantiques du thème. Le violet exprime l’identité et l’interaction, les couleurs d’état expriment les données.
- Garder les graphiques spécifiques au métier : radar pour les menaces, matrice pour les risques, topologie pour le réseau, courbes pour les ressources.
- Réserver les grandes représentations à la synthèse. Les listes et formulaires restent denses et lisibles.
- Une carte métrique ouvre toujours les données qu’elle résume. Le texte et la valeur sont exposés aux technologies d’assistance.
- Les surfaces et emblèmes décoratifs sont statiques. Les interactions existantes respectent la préférence de mouvement réduit.
- Une valeur zéro ne signifie pas qu’une collecte a eu lieu ; les libellés d’attente et les données manquantes restent explicites.

## Validation

- Compilation de l’interface et du harnais `preview`.
- 176 tests de l’interface réussis : navigation, filtres, clavier, grilles, contraste, vues détaillées et états de conformité.
- Captures locales de 20 pages avec les fixtures de démonstration : dashboard, compliance, vulnerabilities, threats, network, assets, monitoring, notifications, reports, risks, discovery, cartography, terminal, audit, fim, software, sync, settings, about, ai.
- Vérification complémentaire des thèmes clairs, fenêtres compactes, états vides et détails. Les captures utilisent exclusivement des données synthétiques, sans connexion au runtime de l’agent.

Exemple de reproduction :

```sh
PREVIEW_PAGE=vulnerabilities PREVIEW_DATA=1 PREVIEW_SHOT=12 PREVIEW_OUT=/tmp/vulnerabilities.png cargo run -p agent-gui --example preview
```

Ajouter `PREVIEW_LIGHT=1`, `PREVIEW_W=960` ou `PREVIEW_DRAWER=vuln` pour les variantes. Retirer `PREVIEW_DATA` pour l’état vide.
