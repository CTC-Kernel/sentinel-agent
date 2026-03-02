# Configuration SignPath Gratuit pour Sentinel Agent

## 🎯 Problème
Vous voyez encore l'écran SmartScreen bien que le workflow devrait utiliser SignPath gratuit.

## 🔍 Diagnostic

Le workflow `.github/workflows/release.yml` est configuré pour SignPath mais nécessite des variables et secrets :

### Variables GitHub (Repository Settings)
- `SIGNPATH_ORGANIZATION_ID` : ID de votre organisation SignPath
- `SIGNPATH_PROJECT_SLUG` : Slug du projet SignPath

### Secrets GitHub (Repository Settings)
- `SIGNPATH_API_TOKEN` : Token API SignPath

## 🛠️ Solution Complète

### 1. Créer un compte SignPath Gratuit
1. Allez sur [signpath.io](https://signpath.io)
2. Créez un compte gratuit (GitHub login)
3. Créez une organisation

### 2. Configurer le projet SignPath
1. Créez un nouveau projet : "sentinel-agent"
2. Configurez la politique de signature : "release-signing"
3. Configurez l'artefact : "msi"

### 3. Obtenir les IDs
```bash
# Via l'interface SignPath :
# Organization ID : Dans Settings → Organization
# Project Slug : Dans URL du projet
# Policy Slug : Dans Signing Policies
# Artifact Config : Dans Artifact Configurations
```

### 4. Configurer GitHub
1. Allez dans votre repository GitHub
2. Settings → Secrets and variables → Actions
3. **Variables** :
   - `SIGNPATH_ORGANIZATION_ID` : Votre ID organisation
   - `SIGNPATH_PROJECT_SLUG` : `sentinel-agent`
4. **Secrets** :
   - `SIGNPATH_API_TOKEN` : Token API SignPath

### 5. Alternative : Signature Gratuite Intégrée

Si SignPath est trop complexe, utilisez la solution gratuite intégrée :

```powershell
# Exécuter ce script pour générer certificat gratuit
.\scripts\generate-free-signing.ps1
```

Le workflow va alors utiliser :
- Certificat auto-généré de 10 ans
- Ajout automatique aux Trusted Publishers
- Stockage dans GitHub Secrets

## 📋 Vérification

Après configuration, vérifiez dans les logs GitHub Actions :

```yaml
# Devrait voir :
- "SignPath not configured" → Configuré
- "MSI signed successfully with SignPath" → Succès
```

## 🎯 Résultat Attendu

Une fois configuré :
- ✅ Plus d'écran SmartScreen
- ✅ MSI signé professionnellement
- ✅ Installation silencieuse possible
- ✅ Déploiement enterprise ready

## 🔧 Dépannage

Si SmartScreen persiste :
1. Vérifiez que les variables sont bien configurées
2. Vérifiez le token API SignPath
3. Utilisez la solution gratuite intégrée en fallback
