# Fournisseurs IA de l’assistant

Dans **Intelligence Artificielle → Paramètres IA**, choisir :

- **Modèle local** : fonctionnement existant sur le poste.
- **OpenAI (ChatGPT)** : clé API OpenAI et identifiant d’un modèle compatible Chat Completions.
- **Anthropic (Claude)** : clé API Anthropic et identifiant de modèle compatible Messages.
- **Google Gemini** : clé Gemini API et identifiant de modèle compatible Generate Content.
- **API compatible OpenAI** : URL de base (par exemple `https://serveur/v1`), modèle et clé si le service en exige une. Le service doit implémenter Chat Completions en streaming. HTTP est accepté uniquement sur la boucle locale pour un serveur sur le poste.

Renseigner l’identifiant exact du modèle disponible sur le compte fournisseur. **Tester la connexion** envoie une courte demande sans données Sentinel ; ce test peut être facturé et ne sauvegarde pas les réglages. **Enregistrer et utiliser ce fournisseur** active le choix.

Les profils sont conservés par fournisseur dans la base locale SQLCipher, y compris après un retour au modèle local. Une clé vide conserve la clé enregistrée uniquement pour le même fournisseur et la même URL. Changer l’URL ne réutilise jamais la clé d’un autre serveur. Le bouton de suppression du profil actif efface sa clé et réactive le modèle local.

Les questions, l’historique utile et le contexte Sentinel joint sont envoyés au fournisseur actif. Les échanges vocaux utilisent le même choix pour générer la réponse ; la capture et la transcription Whisper restent locales. Les analyses automatiques de sécurité conservent leur moteur local. Il n’existe aucun basculement automatique vers une API en cas d’échec local.

Les clés sont absentes des préférences GUI, des événements de statut et des exports de configuration synchronisée. Les erreurs fournisseur sont présentées sans leur corps de réponse, afin de ne pas recopier de secrets dans les journaux ou l’interface. Les redirections HTTP ne sont pas suivies.

La compatibilité couvre ces trois protocoles de conversation texte, pas tous les services propriétaires, les endpoints Responses uniquement, Azure avec son authentification spécifique, ni les API d’image/audio. Les abonnements aux interfaces de chat et l’accès API sont distincts selon le fournisseur.

Références des adaptateurs : [OpenAI Chat Completions](https://developers.openai.com/api/reference/resources/chat), [Anthropic Messages et streaming](https://platform.claude.com/docs/en/build-with-claude/streaming), [Gemini Generate Content](https://ai.google.dev/api/generate-content).
