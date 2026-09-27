# Radar HUD professionnel — 27 septembre 2026

Références recherchées et consultées :
- [Radar FUI — Nawaz Alamgir](https://www.behance.net/gallery/98358697/Radar-FUI) : référence de cadran futuriste animé.
- [Tactical Strike — Ofspace](https://dribbble.com/shots/27170169-Tactical-Strike-Futuristic-Fighter-Jet-UI-Concept) : hiérarchie entre radar, cible et télémétrie périphérique.
- [Landing CTC](https://cyber-threat-consulting.com/) : continuité de marque cyan, bleu et indigo.

Direction originale implémentée dans egui, sans importer d’asset ni de kit : cadran agrandi, couronne extérieure en six segments, angles de cadrage fins, balayage cyan en sombre et bleu en clair. Le cartouche de marque quitte le centre pour ne plus couvrir les alertes critiques. Les couleurs de gravité restent distinctes de la structure.

À partir de 820 points disponibles, une colonne latérale présente les six sources et leurs nombres de signaux après filtrage. Sur largeur inférieure, le cadran conserve la priorité. Le total de sources est calculé sur les signaux visibles, au lieu d’être toujours égal à six. Aucun azimut, taux de détection ou score fictif n'est ajouté pour décorer l’interface.

Pause, réduction des animations, filtrage, sélection et détails des signaux utilisent les mécanismes existants. Les bordures segmentées sont statiques ; elles n’ajoutent pas d’animation permanente. Le rendu clair conserve son fond clair.

Validation : 96 tests GUI réussis, build preview réussi, quatre dispositions examinées à 1100/800 points en clair/sombre. Chevauchement du cartouche FIM/NEXUS corrigé après inspection ; nouvelles captures à défilement 190 points. Contrôle du diff réussi. Avertissement préexistant block 0.1.6. Aucun benchmark de performance ni test de toutes les interactions métier effectué dans cette passe.

Les commandes temporelles passent sur une nouvelle ligne lorsque la largeur disponible est inférieure à 820 points ; cela évite le chevauchement avec le badge temps réel en fenêtre étroite. Compilation et captures renouvelées après cette correction.
