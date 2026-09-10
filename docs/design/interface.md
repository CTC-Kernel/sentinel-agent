# Sentinel — direction d’interface

L’interface privilégie la lecture de la posture de sécurité et l’accès aux actions.
Les informations opérationnelles conservent leurs données et leur navigation.

## Système visuel

- Fond ardoise et surfaces distinctes dans le thème sombre ; fond gris clair et cartes blanches dans le thème clair.
- Bleu profond pour les actions principales, bleu lisible adapté au thème pour les liens.
- Titres de page de 28 points, texte courant de 14 points, légendes de 12 points.
- Cartes à rayon de 12 points, marges de 24 points et contours décoratifs discrets.
- Les contours de champs interactifs restent distincts des contours décoratifs.
- Les cartes statiques ne s’animent pas au survol. Les cartes interactives indiquent le survol et le focus.

## Parcours

La barre supérieure donne accès à la recherche, à l’analyse et aux outils globaux.
Elle abrège ses libellés sous 1 100 points de largeur. Le raccourci de recherche
reflète la plateforme. Les en-têtes de page exposent le domaine, le titre et le contexte.
Les filtres et les actions du tableau de bord peuvent passer à la ligne.

Le panneau de posture expose le score, sa signification et l’accès aux contrôles.
Un score absent affiche « Évaluation en attente », sauf si une alerte connue
justifie déjà un état plus sévère. Les actions indisponibles ou en cours ne
reçoivent ni clic ni focus clavier.

## Vérification

`cargo check -p agent-gui --example gui_demo`

`cargo test -p agent-gui --lib`

Vérification visuelle à effectuer dans les deux thèmes : tableau de bord,
page de données avec filtres, navigation clavier, fenêtre étroite et états sans données.
Ce document ne constitue pas une certification d’accessibilité WCAG AAA.

## Revue visuelle du 10 septembre 2026

La démo native a été inspectée dans les thèmes sombre et clair, sur le tableau
de bord et la page des vulnérabilités. La navigation entre ces pages fonctionne.
La grille répartit huit indicateurs en deux rangées de quatre lorsque la largeur
le permet, et deux cartes utilisent toute leur rangée. Les états de protection
et d’attente sont distincts ; l’icône de bouclier utilise un glyphe présent dans
la police embarquée. Les confirmations statiques ne déclenchent plus de halos animés.

Les cellules du composant DataTable limitent leur peinture à leur colonne et
exposent leur texte complet au survol. Les validations visuelles sur fenêtres
étroites et tableaux alimentés restent à compléter.

## Nouvelle composition du centre de contrôle

La page d’accueil repose désormais sur une synthèse contextuelle, quatre indicateurs,
les prochaines actions et la santé du poste. L’assistant devient un accès à son
espace de travail. Les tendances 30/90 jours et l’activité sont dans un volet
secondaire ; l’export de synthèse reste disponible. Les métriques de démonstration
n’entrent jamais dans les écrans de production.

La navigation garde six destinations principales visibles et regroupe les autres
sous Investigation, Actifs & rapports et Outils système. Un changement de page
ouvre la section correspondante. Les boutons de navigation, les actions prioritaires
et les boutons textuels partagés exposent leurs libellés d’accessibilité.

Le test de mise en page vérifie l’absence de débordement horizontal pour des zones
de contenu de 650, 900 et 1 200 points. Un test d’interaction vérifie l’activation
au clavier du bouton principal. La suite compte 27 tests.

Pour reproduire les revues visuelles de l’application native :

```sh
cargo run -p agent-gui --example visual_review -- /tmp/sentinel-dark.png
cargo run -p agent-gui --example visual_review -- /tmp/sentinel-light.png --light
cargo run -p agent-gui --example visual_review -- /tmp/sentinel-compact.png --compact --empty
```

Ces exemples sont isolés du runtime, n’exécutent pas les commandes de sécurité et
n’enregistrent pas les préférences. Le rendu utilise la véritable application,
avec des événements synthétiques identifiés « DÉMONSTRATION ».

La revue finale confirme le rendu compact à 1 024 × 800 points : les indicateurs
passent sur deux colonnes, les panneaux inférieurs s’empilent et la barre globale
abrège ses commandes. Les aperçus conservés sont dans `previews/overview-dark.png`
et `previews/overview-compact.png`.
