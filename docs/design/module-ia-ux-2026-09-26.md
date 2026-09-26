# Module IA : conversation, menus et voix

26 septembre 2026. Suite de l’[audit transverse](qualite-produit-2026-09-26.md). Modifications du code local, sans déploiement, téléchargement de modèle ou ouverture du microphone réel.

## Parcours livré

L’assistant donne la priorité au travail de l’opérateur : état du modèle, navigation, objectif métier, conversation puis saisie. Le grand bandeau vocal a été remplacé par des commandes proches du champ de texte. La hauteur d’historique s’adapte à la fenêtre ; le reste de la page reste défilable, notamment sur petit écran et lorsque les réglages sont ouverts.

- Trois objectifs, **SOC / RSSI-GRC / MSP-IT**, avec trois questions de départ chacun. Ces choix adaptent les suggestions, sans modifier les permissions ni prétendre créer des rôles de sécurité.
- Suggestions placées dans le brouillon pour relecture ; elles ne déclenchent plus immédiatement une requête. Choisir une suggestion remplace le brouillon courant.
- Angle d’analyse explicite : automatique, général, vulnérabilités, conformité, menaces ou réseau. Il oriente le prompt système ; ce n’est pas un filtre de confidentialité du contexte local joint.
- Éditeur multiligne : **Entrée envoie**, **Maj+Entrée ajoute une ligne**. Le brouillon reste modifiable pendant une réponse ; un second envoi est bloqué.
- Réponses sélectionnables et copiables, durée de traitement affichée lorsqu’elle est fournie. Menu Conversation : copie complète et effacement confirmé de l’historique, en conservant le brouillon.
- Assistant flottant renommé **Sentinel IA**, partageant le même enrichissement de prompt que la page principale. Sa fermeture arrête la voix.
- Les recommandations issues de règles sont explicitement distinguées des réponses générées. Un score de conformité absent est transmis comme « non mesuré ».

## Voix : comportements corrigés

| Situation | Comportement livré |
|---|---|
| Dictée simple | Transcription ajoutée au brouillon, sans envoi automatique. Un texte déjà saisi n’est plus écrasé. |
| Conversation continue | Envoi automatique seulement si le brouillon était vide et l’IA inactive ; réponse lue puis reprise du microphone. Le réglage explique cette reprise. |
| Erreur audio | Événement `VoiceError` distinct ; message visible, brouillon conservé, reprise automatique désarmée. L’erreur ne devient jamais une question au modèle. |
| Microphone inaccessible / Whisper absent | Échec explicite. L’absence de modèle Whisper est détectée avant l’ouverture du périphérique. |
| Lecture volontaire | « Lire la dernière réponse », indépendant de la dictée simple. |
| Arrêter la voix | Annule la capture, interrompt la synthèse et invalide la lecture future d’une réponse encore en calcul. |
| Annuler pendant transcription | Le résultat n’est pas livré après annulation. Un calcul Whisper déjà engagé peut terminer sur son thread : cette modification ne préempte pas le calcul natif. |
| Interrompre la lecture pour dicter | Le passage à l’écoute remet aussi l’état de lecture à zéro. |

Le bouton microphone expose un nom et un état accessibles, un focus visible et un libellé français. La préférence de réduction des animations est conservée. Les transcriptions complètes ne sont plus écrites dans le journal technique : seule leur longueur est journalisée.

## Fiabilité et catalogue

**Les réponses préécrites présentant de faux constats lorsque le modèle était absent ont été supprimées.** Le runtime indique qu’aucune analyse n’a été exécutée et dirige vers « Modèle & diagnostic ». Cela ne garantit pas la justesse d’une réponse produite par un modèle chargé : la validation factuelle reste un chantier distinct.

Le catalogue de la GUI lit désormais le registre du moteur, au lieu de maintenir une seconde liste avec des identités divergentes. Recherche par nom/description, classement par taille, liens source/licence et commande d’actualisation de l’état ont été ajoutés. Le changement et le rechargement depuis cet écran sont désactivés pendant un échange en cours. Les champs de progression sont réinitialisés lors d’une nouvelle sélection.

Les libellés et tailles Q4_K_M ont été rapprochés des fichiers réellement référencés :

| Ancienne présentation | Fichier référencé / identité corrigée | Taille publiée indicative |
|---|---|---:|
| Llama 4 8B | [Llama 3.1 8B Instruct](https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF) | 4,92 Go |
| Qwen3-Coder 7B / Kimi Autonomous Operator | [Qwen2.5-Coder-7B-Instruct](https://huggingface.co/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF) | 4,68 Go |
| Kimi Deep Reasoner | [DeepSeek-R1-Distill-Qwen-14B](https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF) | 8,99 Go |
| DeepSeek Distill 8B | [DeepSeek-R1-Distill-Qwen-7B](https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-7B-GGUF) | 4,68 Go |
| Gemma 3 4B | [Gemma 2 2B Instruct](https://huggingface.co/bartowski/gemma-2-2b-it-GGUF) | 1,71 Go |

Ces pages ont été consultées le 26 septembre 2026 ; les tailles ne sont pas des budgets mémoire. L’entrée Kimi dont la source n’a pas été vérifiée n’est plus proposée dans le catalogue ni recommandée automatiquement. Les clés et noms de fichiers historiques restent compatibles avec les configurations existantes ; aucun fichier installé ni configuration utilisateur n’a été renommé. Une URL explicitement enregistrée dans une ancienne configuration n’est pas migrée par cette livraison. Aucun des modèles du catalogue n’a été téléchargé ou exécuté pour cette vérification.

## Vérification

- **87 tests GUI réussis**, dont nouveaux scénarios dictée/brouillon, conversation continue, erreur vocale, contexte partagé et gestion précise Entrée/Maj+Entrée.
- **100 tests IA réussis**, dont contrôle de l’identité réelle des modèles derrière les clés historiques et exclusion de la source non vérifiée des recommandations.
- **2 tests ciblés du service vocal réussis**, sans matériel audio : invalidation d’une lecture future après arrêt ; échec Whisper avant ouverture du microphone.
- Compilation de l’agent avec GUI et fonctionnalités vocales réussie ; [compilation sans voix](ai-ux-2026-09-26/no-voice-check.log) réussie également ; construction des exemples avec toutes les fonctionnalités réussie.
- Défilement des trois onglets IA vérifié en clair à 960 × 640.
- **10 captures natives finales** : conversation, écran compact vide, écoute simulée, erreur audio et catalogue, dans les deux thèmes. Les données et états audio des rendus sont synthétiques.

[Galerie des captures](ai-ux-2026-09-26/index.html) · [Tests GUI](ai-ux-2026-09-26/gui-tests.log) · [Tests IA](ai-ux-2026-09-26/llm-tests.log) · [Tests voix](ai-ux-2026-09-26/voice-tests.log) · [Compilation](ai-ux-2026-09-26/core-check.log).

Une sonde CPU a également été exécutée pendant des compilations/rendus concurrents. Ses mesures sont perturbées et ne démontrent aucun gain de performance. Le [résultat brut](ai-ux-2026-09-26/performance-contended.json) est conservé comme diagnostic, distinct de la campagne de référence de l’audit initial. Une comparaison exige une machine au repos, le même profil de build et les mêmes scénarios.

## Limites restantes

La qualité acoustique, les permissions microphone, la prononciation et la latence audio réelles restent à éprouver sur macOS/Windows/Linux. Les tests automatisés couvrent les transitions logiques ; ils ne remplacent pas ces essais matériels ni un parcours VoiceOver/NVDA. La conversation n’a pas encore de streaming ni d’annulation du calcul LLM. Les modifications de ce lot n’achèvent pas la refonte du cycle de vie concurrent du moteur, la gestion des budgets d’outils ou l’évaluation factuelle des modèles identifiées dans l’audit précédent.

## Reproduire

```sh
cargo test -p agent-gui --lib --all-features --locked
cargo test -p agent_llm --lib --locked
cargo test -p agent-core --lib --features gui --locked voice::workflow_tests
cargo check -p agent-core --features gui --locked
cargo build -p agent-gui --examples --all-features --locked
PROBE_PAGE=ai PROBE_LIGHT=1 PROBE_W=960 PROBE_H=640 target/debug/examples/scroll_probe
PREVIEW_PAGE=ai PREVIEW_DATA=1 PREVIEW_AI_STATE=listening PREVIEW_SHOT=25 PREVIEW_OUT=/tmp/ai-voice.png target/debug/examples/preview
```

Le banc `preview` accepte `PREVIEW_AI_STATE=empty|busy|listening|error`, `PREVIEW_AI_MODE=0|1|2`, `PREVIEW_TAB=0|1|2`, `PREVIEW_LIGHT=1`, `PREVIEW_W` et `PREVIEW_H`. Les états audio de ce banc n’appellent jamais le service vocal.


## Révision de la composition

Suite au retour sur les blocs empilés, l’assistant utilise désormais un espace de travail borné par la fenêtre. Le panneau inférieur mesure la hauteur effective du compositeur ; le transcript occupe le reste, avec défilement indépendant. Le champ multiligne passe à 72 px dans cette page. Le rôle métier, le contexte et les commandes de conversation sont regroupés dans une barre compacte. Les suggestions sont centrées au démarrage et disponibles dans un menu pendant les échanges ; les réglages vocaux ne déploient plus de contenu dans la page.

Validation : 88 tests GUI passent, dont un contrôle géométrique du champ et des commandes à 960 × 640 et 1360 × 820, avec historique long, dictée simulée et erreur vocale. Compilation des exemples réussie. Dix captures natives supplémentaires : [galerie de la composition révisée](ai-layout-2026-09-26/index.html). Les très petites fenêtres gardent le défilement de page pour préserver une hauteur minimale de travail. Cette révision porte sur l’assistant IA, pas sur une refonte de toutes les pages.
