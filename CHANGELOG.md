<h1 align="center">JOURNAL DES MODIFICATIONS</h1>

<p align="center">
  <strong>Registre Historique d'Évolution du Sentinel GRC Agent</strong>
</p>

---

Tous les changements notables apportés au projet **Sentinel GRC Agent** sont consignés dans ce document, conformément aux standards du [Versionnage Sémantique](https://semver.org/).

## 🚀 [Non publié]

### 🏠 Mode autonome (standalone), choisi à l'installation

- **Un agent sans plateforme** : `"standalone": true` (ou `SENTINEL_STANDALONE`,
  ou `sentinel-agent standalone`) coupe tout ce qui parle à la plateforme —
  enrôlement, heartbeat, envoi des résultats de conformité, des vulnérabilités,
  des logiciels, des incidents et des instantanés réseau, commandes distantes,
  renouvellement de certificat et mise à jour distante. Aucun client HTTP n'est
  créé. EDR, intégrité des fichiers, conformité, analyse de vulnérabilités,
  inventaire et surveillance réseau tournent en local et les données restent
  sur le poste. Destiné aux particuliers et aux postes qui n'ont besoin que
  d'une protection locale, gratuitement.
- **Choix à l'installation** : le MSI Windows ajoute un dialogue « Comment
  protéger ce poste ? » (plateforme / protection locale), la propriété
  `INSTALLMODE=STANDALONE` en silencieux, un `agent.json` autonome et un
  raccourci « Tableau de bord » réservé au mode plateforme. Le `.deb` honore
  `SENTINEL_STANDALONE=1` au `dpkg -i`, le `.pkg` macOS se construit avec
  `SENTINEL_STANDALONE=1`.
- **Assistant de premier lancement** : deux cartes, « Rejoindre une
  plateforme » ou « Protection locale ». Le parcours autonome ne demande qu'un
  mot de passe administrateur optionnel, en quatre étapes, et se termine par
  « Protection activée ».
- **Interface en mode autonome** : bandeau « Mode autonome · Protection locale
  active », pastille et pied de barre latérale dédiés, page Synchronisation et
  bouton « Synchroniser » retirés, carte « Plateforme » dans les réglages.
  Partout, un bouton « Connecter à une plateforme » rouvre l'assistant ;
  l'enrôlement réussi désactive le mode autonome, la synchronisation démarre
  au redémarrage suivant et une notification le dit.
- **Ligne de commande** : `sentinel-agent standalone` / `--disable` ;
  `sentinel-agent enroll` réussi désactive lui aussi le mode autonome.
- **Documentation** : `config/README.md` (section et variable
  `SENTINEL_STANDALONE`), exemples JSON, README, guide utilisateur, README du
  preview (`PREVIEW_STANDALONE=1`, étapes `standalone-*`).

### 🔌 Communication avec la plateforme on-premise

- **Variables d'environnement `SENTINEL_*` réellement prises en compte** :
  `SENTINEL_SERVER_URL`, `SENTINEL_ENROLLMENT_TOKEN`, `SENTINEL_CA_CERT_PATH`,
  etc. étaient silencieusement ignorées (le séparateur `_` les transformait en
  clés imbriquées `server.url`). Les champs de premier niveau sont désormais
  mappés à plat, les champs imbriqués (`proxy.*`, `llm.*`) explicitement, et
  les listes acceptent des valeurs séparées par des virgules. Tests ajoutés
  avec environnement injecté.
- **`sentinel-agent enroll --server <URL>` persiste l'URL** dans `agent.json`
  (en conservant les autres clés et les permissions du fichier). Auparavant le
  service redémarrait sur l'URL SaaS compilée par défaut après un enrôlement
  réussi sur une instance on-premise.
- **macOS** : le `postinstall` écrivait `agent.json` dans `SentinelGRC/config/`
  alors que l'agent le lit dans `SentinelGRC/` ; l'URL serveur intégrée au
  paquet n'était donc jamais appliquée. De plus, `SENTINEL_SERVER_URL` était
  évaluée sur le poste cible (heredoc non interpolé) et non au build : elle est
  maintenant injectée dans le `.pkg` au moment de la construction.
- **Documentation** : section on-premise dans `config/README.md` (URL
  `https://<domaine>/fn/agentApi`, `ca_cert_path`, TLS 1.3, commande de
  vérification) et rappel dans le guide utilisateur.

### 🧱 Tableaux, champs de recherche et défilement

- **La page défile à nouveau partout** : chaque tableau `egui_extras` créait
  son propre conteneur défilant, borné à la place restante dans la fenêtre ;
  la molette était capturée dès que le pointeur survolait une liste (registre
  des paquets, journal SIEM, inventaire…) et la page semblait bloquée. Les
  tableaux ne défilent plus par eux-mêmes (`vscroll(false)`) — la page est le
  seul conteneur qui défile, les listes restant paginées. Le journal SIEM perd
  son puits de 450 px au profit de la pagination (`AUTO` suit la dernière
  page). Une sonde headless (`examples/scroll_probe.rs`) rend chaque page,
  envoie un cran de molette sur une grille de positions et échoue si une
  position ne défile pas.
- **Module `widgets::table`** : colonnes fluides (`Col::fluid(min, part)`,
  `Col::fixed`) calculées sur la largeur disponible et toujours coupées, en-têtes
  et cellules partagés (`header_cell`, `cell`, `cell_mono`, `cell_stack`,
  `cell_link`, `cell_number`, `cell_empty`…), `row_interaction` pour le curseur,
  la barre d'accent et le clic de ligne. Les 18 tableaux des 14 pages
  (vulnérabilités, logiciels ×2, FIM, journal d'audit, réseau ×2, Shadow IT,
  synchronisation, inventaire, risques, rapports, conformité ×2, notifications
  ×2, terminal, assistant IA, journal SIEM) y sont passés.
- **Plus de débordement** : les colonnes non coupées poussaient les tableaux
  au-delà de leur carte (10 à 30 px à 1360 px de large) et les valeurs longues
  peignaient sur la colonne voisine. Une cellule tient sur une ligne, tronquée
  avec une ellipse et la valeur complète en infobulle ; les cellules à deux
  lignes (paquet + date d'installation, chemin + empreinte, CVE + date de
  découverte) imposent une hauteur de ligne de 44 px au lieu de 36 px, où
  elles se chevauchaient. Les colonnes sont dimensionnées pour tenir dans la
  fenêtre minimale (960 px) ; les lignes de redimensionnement ont disparu.
- **Vulnérabilités** : la colonne « Analyse et correctifs » (description
  repliée sur plusieurs lignes + badges + date, coupée par la ligne) est
  éclatée en colonnes CORRECTIF (version cible) et DESCRIPTION ; la date de
  découverte passe sous l'identifiant, le faux positif en badge « FP ».
  Shadow IT : IP et MAC empilées, statut dans sa colonne, export CSV sur la
  ligne de recherche. Conformité : date d'exécution dans sa colonne,
  référentiels au-delà du troisième repliés en « +N ».
- **Un seul champ de recherche** (`widgets::SearchInput`) : cadre, loupe, anneau
  de focus, bouton d'effacement à emplacement réservé, Échap pour vider sans
  quitter le champ, texte qui défile sous la loupe. Il remplace le champ de la
  barre de filtres (désormais fluide : 42 % de la ligne entre 240 et 460 px,
  au lieu de 260 px fixes qui coupaient l'indication), les `TextEdit` nus du
  journal SIEM et du terminal, et le champ de la palette de commandes.
- **Un seul champ de conversation** (`widgets::ChatInput`) pour Jarvis sur le
  tableau de bord et l'assistant : cadre, icône, bouton d'envoi rond
  (inactif tant qu'il n'y a rien à envoyer, curseur « interdit »), rotor pendant
  le traitement, Entrée envoie sans perdre le focus.
- **Curseur main sur tout ce qui se clique** : `Visuals::interact_cursor`
  fixé au niveau du thème, au lieu d'appels dispersés que la moitié des
  contrôles oubliaient. Les rayures des tableaux `egui_extras` utilisent le
  même mélange opaque que `DataTable` (fini la bande grise translucide).
- **Banc de rendu** : `PREVIEW_OUT=<png>` écrit la capture de la fenêtre ;
  la taille demandée (`PREVIEW_W`/`PREVIEW_H`) n'est plus écrasée par la
  géométrie mémorisée de la session précédente.
- **Gel à l'ouverture d'une modale** : la boîte de confirmation (mise en
  quarantaine, arrêt de processus, blocage d'IP, suppression) relisait le
  numéro de passe egui *pendant* qu'elle tenait le verrou mémoire du
  contexte — verrou non réentrant, application figée dès le premier clic
  sur « Confirmer ». Le numéro est lu avant la prise du verrou ; test de
  non-régression qui rend une modale ouverte sur plusieurs frames.
- Recherche d'IOC (Menaces › Investigation) sur le champ de recherche
  partagé ; historique de synchronisation dans les fixtures du banc de rendu
  (la table de la page Synchronisation est enfin rendue) ; fondu du bas de la
  barre latérale allongé pour que la dernière entrée ne semble plus coupée par
  le pied ; le banc capture aussi le splash et l'assistant d'enrôlement.
- **Barre d'onglets étroite** : quand les libellés ne tiennent plus (sept
  onglets Menaces à 960 px), les onglets non sélectionnés se replient sur
  leur icône (libellé en infobulle, badge conservé) avant de recourir à la
  bande défilante qui coupait « Règles » et « Chronologie ». Un badge à zéro
  n'est plus affiché.
- **Squelettes de chargement** : les lignes fantômes des tableaux se
  répartissent sur la largeur réelle de la carte (proportions conservées) au
  lieu de déborder de 50 px à droite sur Vulnérabilités et Risques.
- **Formulaires de création** (`widgets::form`) : une colonne de libellés
  commune (`form::row`) aligne les champs des formulaires Nouvel actif,
  Nouveau playbook et Nouvelle règle de détection, dont chaque contrôle
  partait d'un x différent ; les formulaires Règle d'alerte et Webhook
  passent en champs empilés qui se replient (`form::fields`/`form::field`)
  au lieu de déborder de la carte à 1360 px avec « Activé » plié lettre par
  lettre, et leurs listes déroulantes natives egui sont remplacées par le
  menu du produit. Le banc de rendu ouvre ces formulaires
  (`PREVIEW_DRAWER=asset-form|rule-form|webhook-form|playbook-form|detection-form`)
  et accepte un pointeur (`POINTER="x y"`) pour capturer les états au survol.
- **Cartographie** : chaque cran de molette sur la page zoomait aussi la carte
  qu'il faisait défiler. Le zoom passe sur Ctrl/⌘ + molette (et le pincement)
  avec le pointeur sur la carte, la molette seule fait défiler la page ; le
  raccourci est indiqué sous l'indicateur de zoom.
- **Champ secret** (`widgets::PasswordInput`) : cadre, cadenas, valeur masquée,
  œil pour la révéler, anneau de focus, Entrée pour valider. Il remplace les
  `TextEdit` nus (une ligne soulignée à côté d'un bouton flottant) du jeton
  d'enrôlement, du mot de passe administrateur de l'assistant et du dialogue
  de déverrouillage des paramètres, lequel perd sa barre de titre egui pour
  la surface de dialogue du produit.
- **Listes déroulantes** : le menu s'ouvrait vers le haut dès que le contrôle
  était dans la moitié basse de la fenêtre, recouvrant les champs au-dessus ;
  il s'ouvre vers le bas tant qu'il y tient, et ne bascule que faute de place.
- Correctif au passage : la liste des paquets appelait deux fois la navigation
  clavier, faisant sauter deux lignes par flèche et déréglant la pagination
  de l'onglet Applications.

### 🎨 Refonte complète de l'interface (GUI / UI / UX)

#### Fondations du design system
- **Typographie embarquée** : Inter (interface, 4 graisses) et JetBrains Mono NL
  (données techniques, 2 graisses), sous-ensemblées à 312 Ko au total — moins que
  le seul fichier Font Awesome déjà présent. Chiffres tabulaires figés dans les
  fontes : les cartes de métriques et les colonnes de tableaux ne « sautent »
  plus quand les valeurs changent.
- **Échelle typographique sémantique** (`font_display` → `font_micro`) : la taille
  et la graisse voyagent ensemble, à la place des `FontId::proportional()` posés
  au cas par cas.
- **Palette recalibrée** : six surfaces régulièrement espacées par thème formant
  une véritable échelle d'élévation ; chaque couleur sémantique dispose d'une
  variante mode clair calibrée à la main. `border()` porte les contours de
  contrôles (≥3:1), `border_subtle()` les filets décoratifs.
- **Élévation à deux couches** (ombre ambiante + ombre de contact) avec liseré
  supérieur éclairé.
- **Contrat d'accessibilité vérifié par tests** : AAA pour les textes primaire et
  secondaire, AA pour le tertiaire et toutes les couleurs sémantiques, 3:1 pour
  les bordures de contrôles, lisibilité des badges et des avatars, monotonie de
  l'échelle de surfaces. Deux affirmations des anciens commentaires ne tenaient
  pas et ont été corrigées.

#### Chrome applicatif
- **Barre supérieure** reconstruite : marque, bascule de la navigation, fil
  d'Ariane, recherche globale (raccourci propre à la plateforme), santé de
  l'agent, contexte du workspace et action principale.
- **Barre latérale** reconstruite : suppression du bloc de marque redondant qui
  consommait ~190 px avant la première entrée, rail d'icônes repliable et
  persistant, lignes plus denses, sections déclarées en données, pied de page
  unifié (synchronisation, analyse, workspace).
- **Largeur de contenu bornée** puis centrée au-delà, pour préserver une longueur
  de ligne lisible sur écran large.

#### Composants
- Cartes : élévation correcte (l'ombre était peinte par-dessus le contenu),
  empilement vertical garanti, variantes plate / danger / accentuée ; suppression
  du miroitement d'angle dessiné à la main.
- Tableaux : texte de cellule tronqué proprement (il débordait sur les colonnes
  voisines), survol neutre et sélection accentuée distincts, filets discrets.
- Champs de saisie : posés une marche au-dessus de leur surface au lieu du fond
  du terminal, dans lequel ils devenaient invisibles.
- Onglets, badges, curseurs, tiroirs de détail, modales, palette de commandes,
  info-bulles : alignés sur les nouveaux jetons ; ordre de dessin des ombres
  corrigé sur le tiroir et les onglets encadrés.
- État « rien à signaler » redessiné : médaillon sobre à la place de douze
  cercles empilés qui s'accumulaient en tache verte pulsant deux fois par seconde.
- En-têtes de page : suppression du filet dégradé animé qui forçait un
  rafraîchissement toutes les 100 ms sur chaque page.

#### Langue et cohérence
- Casse de phrase pour tout ce qui est cliquable ou lu (libellés d'action,
  intitulés d'onglets, filtres, états vides, lignes d'introduction des pages) ;
  les intitulés de section en petites capitales sont conservés.
- Points de suspension typographiques dans les textes d'interface.

#### Corrections
- Correction d'un plantage au démarrage : le thème nommait des familles de
  graisses dans la même frame que leur enregistrement, alors que `set_fonts`
  ne prend effet qu'à la frame suivante.
- L'écran de démarrage teintait son logo avec la couleur de texte, ce qui le
  noircissait en thème clair au lieu de le faire apparaître en fondu.
- Les grilles responsives plafonnent leur nombre de colonnes au nombre
  d'éléments, au lieu de laisser des colonnes vides.

#### Surfaces superposées
- Modale : suppression de la barre colorée supérieure qui s'arrêtait avant le
  bord droit (allouée à la largeur nominale alors que le cadre débordait) ;
  largeur du message bornée explicitement ; médaillon et titre sur les jetons.
- Palette de commandes : ligne sélectionnée en lavis opaque au lieu d'un accent
  translucide qui rendait en bleu plein ; raccourcis épelés selon la plateforme
  (`⌘R` sur macOS, `Ctrl R` ailleurs).
- Toasts : contour neutre — la barre latérale et l'icône portent déjà le niveau,
  quatre toasts empilés à contour coloré faisaient un feu tricolore.
- Alertes : le bouton de fermeture (32 px) débordait de 8 px de la colonne et
  élargissait tout ce qui suivait.

#### Clavier
- Les raccourcis de page (`⌘1`…`⌘8`) apparaissent dans les info-bulles de la
  barre latérale ; un raccourci qu'on ne peut pas découvrir n'existe pas.

#### Consommation au repos
- L'interface se rafraîchissait dix fois par seconde en permanence pour
  scruter les canaux d'événements. Des threads relais réveillent désormais le
  contexte à l'arrivée d'un message ; le filet de sécurité passe à 1 s. Un agent
  d'endpoint qui repeint à 10 Hz sans raison chauffe le portable qu'il protège.
  Comportement couvert par deux tests.

#### Outillage
- `cargo run -p agent-gui --all-features --example preview` : banc de rendu du
  chrome, de la galerie de composants et des pages réelles, sans runtime agent.
  `PREVIEW_PAGE=overlays` rend modale, toasts, alertes, progression, squelettes
  et états vides ; `PREVIEW_PAGE=palette` ouvre la palette de commandes.
  `PREVIEW_DATA=1` peuple toutes les pages de données réalistes et
  déterministes (`examples/preview/fixtures.rs`) ; `PREVIEW_DRAWER=vuln|threat|
  asset|package|connection|risk|fim|notification|log` ouvre le tiroir de détail ;
  `PREVIEW_LIGHT`, `PREVIEW_RAIL`, `PREVIEW_W`/`PREVIEW_H` pilotent thème,
  rail et taille de fenêtre ; `PREVIEW_PAGE=splash|enrollment` et
  `PREVIEW_STEP=welcome|token|admin|progress|done|failed` rendent le premier
  lancement. Le banc dispose les pages avec la colonne du shell
  (`app::page_column`), pour que la capture mesure ce que l'application montre.

#### Vues peuplées — revue de 44 rendus
- Notifications : les lignes non lues posaient un fond plein jaune, brun ou
  bleu (accent translucide composité en linéaire). Elles reposent désormais sur
  un lavis opaque de leur sévérité avec une barre d'accent sur le bord d'attaque,
  colonne de badge à largeur fixe pour aligner les titres, survol visible.
- Journal SIEM : cellules qui se rétractaient sur leur contenu, si bien que les
  messages flottaient d'une ligne à l'autre ; colonnes texte alignées à gauche
  et largeurs garanties.
- Alertes réseau : types en français lisible (« SORTIE TOR », « DHCP PIRATE »)
  à la place des clés brutes ; lavis opaque sur les lignes d'alerte.
- Tableau de bord : les huit cartes d'indicateurs partagent une hauteur et les
  graphes CPU / mémoire remplissent la leur ; jauge SLA corrigée (la fraction
  était divisée deux fois, l'arc affichait 1 %) ; score et delta du héros
  centrés sous le titre (« 87 % ▲ 4,3 ») ; la tendance des KPI se termine sur
  le score de la carte de synthèse.
- Grilles : dernière ligne équilibrée — 4 cartes à 3 colonnes donnent 2 + 2,
  7 à 5 donnent 4 + 3 — au lieu d'un orphelin.
- Barres de progression : suppression du reflet qui balayait les barres
  déterminées ; une mesure qui scintille se lit comme une activité en cours.
- Matrice des risques : cases vides en teinte discrète, cases occupées en
  couleur pleine avec le compte en texte primaire ; libellé d'axe dégagé.
- Séparateurs entre cartes supprimés (risques, intégrité des fichiers) ; journal
  d'audit dimensionné par ses lignes plutôt qu'à la hauteur de la fenêtre ;
  export CSV posé sur la ligne de recherche (logiciels) ou à droite (audit),
  comme sur les autres pages ; le bouton de découverte Shadow IT n'est plus
  seul dans une carte.
- L'icône ▶ précède le libellé des boutons d'analyse sur toutes les pages ;
  elle le suivait sur six d'entre elles.
- Modale : voile bleu nuit en thème sombre, neutre en clair. Un flou
  d'arrière-plan réel n'est pas à la portée du peintre immédiat d'egui sans
  passe de rendu dédiée ; le voile et l'élévation à deux couches jouent ce rôle.

#### Formatage français
- Nouveau module `format` : milliers groupés par espace fine insécable
  (« 1 284 »), virgule décimale (« 87,4 »), « % » précédé d'une espace fine,
  unités d'octets (« 1,2 Mo »), durées compactes (« 3 j 05 h »), temps relatifs
  (« il y a 5 min ») et pluriels accordés (« 3 échecs », « 1 résultat ») à la
  place des « (s) ». Appliqué aux cartes, tableaux, tiroirs et rapports ; les
  exports CSV gardent le format machine. Couvert par tests.

#### Réactivité
- Sous 1 120 px de large, la barre latérale se replie en rail d'icônes ; le
  bouton de menu la déploie le temps d'une navigation sans toucher à la
  préférence enregistrée.

#### Premier lancement
- Assistant d'enrôlement : colonne unique de 520 px centrée (la carte s'étirait
  sur toute la largeur de la fenêtre et son stepper collait au bord gauche),
  stepper numéroté avec coches, sélecteur Jeton / QR code en pilules, actions
  alignées à droite comme dans toute boîte de dialogue, états de fin sur le
  médaillon commun aux états vides ; vocabulaire unifié sur « jeton
  d'enrôlement ».
- Écran de démarrage extrait en widget (`widgets::splash_screen`) et rendu
  dans le banc.

#### Onglets secondaires — revue de 16 rendus supplémentaires
- Le banc accepte `PREVIEW_TAB=<n>` et les fixtures couvrent désormais la
  réponse (file d'actions, quarantaine, journal), les playbooks, les règles de
  détection, les règles d'alerte, les webhooks et l'historique de l'assistant :
  six onglets Menaces, deux onglets Notifications, les statistiques SIEM, les
  quatre onglets Rapports, les trois onglets IA et la matrice de conformité
  ont été rendus peuplés pour la première fois.
- Zébrures de tableau : le blanc à 4 % composité en linéaire donnait une
  dalle de gris moyen sur une ligne sur deux (événements, chronologie,
  playbooks, règles). Remplacé par un pas opaque de l'échelle de surfaces.
- Événements : colonnes « SÉVÉRI… », « PROCESS… », « 10/09/2026 … » tronquées
  → largeurs à la mesure des mots ; recherche et menu déroulant remplacés par
  la barre de recherche à puces du design system.
- Règles d'alerte et webhooks : un bouton rouge plein par ligne pour supprimer
  faisait un mur de danger ; icône discrète en couleur d'erreur, avec
  info-bulle.
- Cartes de modèles de playbook à hauteur commune ; jauge de l'assistant
  légendée « SCORE IA » (elle disait « CONFORMITÉ » sous 57 %) ; tailles de
  modèles et mémoire en français (« 5,2 Go », « 4 210 Mo »).

#### Graphes
- Sparklines repeintes directement : polyligne 1,5 px, aire en dégradé qui
  s'éteint vers la ligne de base, point sur la dernière valeur, axe à zéro.
  La version `egui_plot` posait un remplissage translucide qui, composité en
  linéaire, formait une dalle bleue sous la courbe — et embarquait axes,
  zoom et glisser pour 32 pixels de hauteur.
- Cartes CPU / mémoire du tableau de bord : le graphe remplit la carte.

#### Matrice des risques
- La matrice occupait seule une carte pleine largeur. Elle est désormais
  accompagnée de la légende des niveaux avec le nombre de risques ouverts par
  bande, et des trois risques ouverts au score le plus élevé.

#### Détails
- Sélecteur Jeton / QR code centré dans l'assistant d'enrôlement
  (`TabBar::centered`) ; badge de risque centré sur la carte IA du tableau de
  bord ; la page Logiciels n'affiche plus une barre à un seul onglet sur
  Linux ; export CSV du terminal posé sur la ligne de filtres ; l'état vide
  des rapports porte le bouton « Générer le rapport » au lieu d'y renvoyer.

#### Tiroirs de détail
- Les actions sont épinglées au bas du tiroir, sur leur propre surface avec
  filet et ombre : elles restent à portée quelle que soit la longueur du
  détail, au lieu d'attendre en fin de défilement (sur une fenêtre de 700 px,
  « Appliquer le correctif » n'était pas visible sans faire défiler).
- Les blocs de prose (description, instructions, analyse) passent de `bg_deep`
  — un puits de terminal autour d'une phrase — à un pas de l'échelle de
  surfaces ; les valeurs mono (hash, IP) gardent leur puits.

#### Petites fenêtres
- Barre supérieure : à 800 px, le titre de page se tronquait en « Men » ou
  « Vuln » pendant que la puce d'organisation gardait sa place. Le titre ne se
  tronque plus : le parent du fil d'Ariane s'efface d'abord, puis la puce
  d'organisation cède si le titre et l'icône de recherche en ont besoin.
- Barres d'onglets : sept onglets sur 800 px se superposaient (largeur
  répartie à parts égales) ; quand ils ne tiennent pas, la barre devient une
  bande défilante à largeur naturelle.

#### Mouvement
- Le soulignement de l'onglet actif glisse d'un onglet à l'autre ; le
  marqueur de la page active glisse le long de la barre latérale. Les deux
  respectent la préférence de mouvement réduit. (Les cartes cliquables
  s'élevaient déjà au survol et les boutons ont un état enfoncé.)

#### Clavier
- Sur les listes (vulnérabilités, inventaire, logiciels, connexions
  réseau, risques), ↑ / ↓ déplacent la sélection dans l'ordre affiché et
  changent de page avec elle, Entrée ouvre le tiroir, Échap le ferme.
  Inactif tant qu'un champ de texte a le clavier, qu'un menu est ouvert ou
  qu'une modale est affichée, pour que la recherche ne fasse jamais défiler
  le tableau derrière elle.

#### Palette de commandes
- `⌘K` / `Ctrl K` cherche aussi dans les données : une CVE, un actif (nom
  d'hôte ou IP), un paquet, un processus suspect, un risque. Le résultat
  ouvre la page et le tiroir de l'enregistrement (le processus arrive par la
  recherche de l'onglet Événements, dont la liste est reconstruite à chaque
  image). Plafonné à 200 entrées par famille : une recherche, pas un
  inventaire.

#### Détails qui comptent
- Les valeurs mono des tiroirs (hash, adresse IP, MAC, identifiant CVE) ont
  un bouton de copie à côté du puits — une empreinte est faite pour être
  collée ailleurs, pas sélectionnée à la souris.
- Une cellule de tableau tronquée montre son texte complet au survol, sans
  voler le survol à sa ligne.
- Les dates relatives (« il y a 15 min ») affichent l'horodatage complet au
  survol.
- Navigation clavier étendue aux listes restantes : intégrité des fichiers,
  journal d'audit, Shadow IT, événements et chronologie des menaces,
  notifications.

#### Thème clair
- Revue des 20 pages et de 11 onglets secondaires en thème clair, données
  peuplées : aucune régression relevée après les corrections des phases
  précédentes.

---

## 📦 [2.0.219] - 2026-04-13

### 🔧 Modifié
- Centralisation des constantes de configuration Firebase dans `agent-common`.
- Implémentation de l'utilitaire `silent_command()` pour la suppression des terminaux fantômes sous Windows.

### 🛡️ Sécurité
- Élimination des vecteurs d'authentification statiques dans le code source.
- Migration des secrets de certificats vers un stockage cryptographique d'environnement.
- Nettoyage profond de l'historique Git des données sensibles.
- Transition stratégique vers la licence **MIT**.

### 🛡️ Audit de Sécurité (~20 corrections sur 10 fichiers)

#### Fuites d'information et logging
- Correction de la fuite d'URL serveur dans les logs d'incident (`api_client.rs`) — utilisation de `safe_log_url()`.
- Passage de `warn!` à `error!` pour les échecs d'upload de vulnérabilités et d'incidents (`scanning.rs`).
- Passage de `warn!` à `error!` pour les échecs de lecture DB playbooks/règles (`heartbeat.rs`).
- Passage de `warn!` à `error!` pour le poisonnement de mutex avec message explicite sur la corruption (`heartbeat.rs`).
- Ajout d'un `warn!` quand le fichier config existe mais n'a pas de hash baseline (`self_protection.rs`).

#### Débordements d'entiers
- Protection du cast `i64 → u32` pour `get_pending_sync_count()` avec clamping sécurisé (`heartbeat.rs`).
- Protection du cast `i32 → u32` pour `match_count` (`heartbeat.rs`).
- Protection des casts `u32 → i32` pour `match_count` et `escalation_minutes` (`sync_init.rs`, `orchestrator.rs`).

#### Erreurs silencieuses
- Remplacement de `unwrap_or_default()` par `unwrap_or_else` avec logging pour les erreurs JSON playbooks/règles (`heartbeat.rs`).
- Remplacement de 5 occurrences de `unwrap_or_default()` par `unwrap_or_else` avec logging pour les erreurs de sérialisation JSON (`sync_init.rs`).

#### Corrections de robustesse
- Métrique `disk_kbps` : remplacement de `unwrap_or(u32::MAX)` par `unwrap_or(0)` (`resources.rs`).
- Introduction de l'enum `DirectoryRemoveError` pour une détection d'erreur indépendante de la locale (`cleanup.rs`).

#### Dead code
- Correction des gardes `#[cfg]` pour les fonctions GUI-only : ajout de `feature = "gui"` sur 8 fonctions/constantes (`main.rs`).
- Suppression d'un import `std::process::Command` inutilisé.

### 📖 Documentation
- Ajout des README pour 6 crates manquants (agent-common, agent-fim, agent-gui, agent-siem, agent-persistence, agent_llm).
- Mise à jour du README principal avec index de documentation des crates.
- Mise à jour du CHANGELOG, USER_GUIDE et CONTRIBUTING.

---

## 📦 [2.0.218] - 2026-04-12

### 🩹 Corrigé
- Corrections mineures de stabilité.

---

## 📦 [2.0.217] - 2026-03-29

### ✨ Ajouté
- **CMDB & Asset Sync** : Synchronisation automatique des managed assets vers la plateforme GRC (`asset_sync.rs`).
- **Réconciliation CMDB** : Normalisation criticality (snake_case → PascalCase), device_type → ciType/hardwareType.
- **Promotion d'assets** : Trigger `onManagedAssetSync` pour promouvoir les assets agent vers `cmdb_cis`.
- **Pipeline de menaces autonome** (`threat_pipeline.rs`) : Détection → Classification IA → Réponse automatique.
- **Moteur de Playbooks** (`playbook_engine.rs`) : Évaluation de conditions, déclenchement d'actions avec scoring de confiance IA.
- **Actions EDR** (`edr_actions.rs`) : `kill_process`, `quarantine_file`, `block_ip` avec protection anti-tamper (Anti-Draper).
- **Self-Protection** (`self_protection.rs`) : Vérification intégrité binaire SHA-256, détection debugger, monitoring services.
- **Self-Update** (`self_update.rs`) : Mise à jour automatique avec reporting de statut vers la plateforme.
- **Remédiation GUI** (`remediation_ops.rs`) : Exécution d'actions correctives depuis l'interface avec timeout 5 min.
- 9 tests de sécurité EDR (path traversal, symlinks, system path rejection, loopback IP, shell metacharacters).

### 🔧 Modifié
- **Enrollment** : Credentials migrés du document principal vers sous-collection `credentials/main` (enrollment, re-enrollment, cert renewal).
- **Heartbeat** : Ajout du statut `degraded` dans le schema Zod de la plateforme.
- **Severity enum** : Ajout `#[serde(rename_all = "lowercase")]` pour alignement PascalCase→lowercase avec la plateforme.
- **SelfCheckResult** : Ajout des champs agent dans le schema + normalisation dans le heartbeat handler.
- **SecureConfig** : RAII wrapper pour `AgentConfig` avec auto-zeroize on drop, intégré dans `AgentRuntime`.
- **panic="unwind"** dans Cargo.toml (remplace "abort") pour permettre ZeroizeOnDrop.

### 🛡️ Sécurité
- Correction de la capture `hmac_secret` dans `EnrollmentResponse`.
- Documentation mTLS no-op sur Firebase dans `client.rs` et `api.js`.

---

## 📦 [2.0.169] - 2026-03-14

### ✨ Ajouté
- **Heartbeat avancé** (`heartbeat.rs`) : Communication périodique avec métriques, statut et traitement des commandes serveur.
- **Enrollment automatique** (`enrollment.rs`) : Authentification par token JWT avec extraction `organizationId`.
- **Asset Discovery** : Inventaire automatique des endpoints (IP, hostname, MAC, vendor, device_type, criticality).
- **Audit Trail** (`audit_trail.rs`) : Journalisation complète des actions agent.
- **Risk Generation** (`risk_generation.rs`) : Calcul automatique de score de risque.
- **GUI Bridge** (`gui_bridge.rs`) : Pont de communication entre le runtime et l'interface egui.
- **SIEM Enrichment** (`siem_enrichment.rs`) : Enrichissement des données avant export SIEM.
- **Tracing Layer** (`tracing_layer.rs`) : Observabilité structurée avec tracing-appender.
- **Update Manager** (`update_manager.rs`) : Gestion du cycle de mise à jour logicielle.

### 🔧 Modifié
- Migration vers Rust Edition 2024 avec `rust-version = "1.85"`.
- Optimisation des requêtes réseau avec reqwest 0.13 + rustls.
- Amélioration de la persistence GUI (`agent-persistence`).

---

## 📦 [2.0.113] - 2026-02-09

### ✨ Ajouté
- **Core Orchestration** : Workspace Rust modulaire de 12 crates majeures.
- **Premium GUI** : Interface 19 modules (egui) avec monitoring temps réel.
- **Compliance Engine** : 21 contrôles natifs (ISO 27001, NIS2, DORA).
- **Security Suite** : FIM (BLAKE3), Scan CVE, Détection de menaces (processus/réseau).
- **Interopérabilité** : Moteur SIEM pour Splunk, Sentinel et ELK.
- **Scan de vulnérabilités** : Analyse des paquets système contre les bases CVE.
- **Découverte réseau** : Cartographie L2/L3, mDNS, SSDP, ARP.

---

## 📦 [2.0.112] - 2026-02-08

### 🩹 Corrigé
- Optimisation de la capture d'erreurs `notarytool` lors des cycles de signature macOS.

---

## 📦 [2.0.111] - 2026-02-07

### ✨ Ajouté (Version Initiale)
- Redéfinition des raccourcis Windows vers le binaire natif (`.exe`).
- Déploiement automatisé du certificat Root auto-signé via `install-with-cert.bat`.

---

<p align="center">
  <em>Traçabilité et Transparence.</em>
</p>
