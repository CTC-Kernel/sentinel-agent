# Sentinel GRC Agent - macOS Security Installation Guide

## 🛡️ Gestion de l'avertissement de sécurité macOS (Gatekeeper)

Lors de l'installation du package `SentinelAgent.pkg`, macOS peut afficher l'avertissement :
> "Apple n'a pas pu confirmer que « SentinelAgent.pkg » ne contenait pas de logiciel malveillant"

Ceci est normal pour les logiciels d'entreprise qui ne sont pas signés par Apple.

## 🔧 Solutions disponibles

### 1. Installation Sécurisée (Recommandé)

Utilisez le script d'installation sécurisée qui inclut des vérifications :

```bash
./install-macos-secure.sh
```

Ce script effectue :
- ✅ Vérification d'intégrité du package (SHA256)
- ✅ Scan de sécurité basique
- ✅ Dialogue de confirmation utilisateur
- ✅ Journalisation de l'installation

### 2. Assistant Gatekeeper

Pour gérer manuellement l'avertissement Gatekeeper :

```bash
osascript handle-gatekeeper.applescript
```

Ou double-cliquez sur le fichier `.applescript`.

### 3. Installation Manuelle

Si vous faites confiance à la source :

1. **Clic-droit** sur `SentinelAgent.pkg`
2. **Sélectionner "Ouvrir"**
3. **Confirmer avec "Ouvrir"** dans le dialogue de sécurité
4. **Suivre les instructions d'installation**

## 🔍 Vérifications de Sécurité

### Vérification manuelle de l'intégrité :

```bash
# Calculer le hash SHA256
shasum -a 256 SentinelAgent-2.0.0.pkg

# Vérifier la structure du package
pkgutil --expand SentinelAgent-2.0.0.pkg /tmp/verify_pkg
ls -la /tmp/verify_pkg/
rm -rf /tmp/verify_pkg
```

### Informations de sécurité attendues :

- **Développeur** : Cyber Threat Consulting
- **Identifiant** : com.sentinel.agent
- **Version** : 2.0.0
- **Type** : Logiciel de sécurité d'entreprise
- **Source** : Open source, code auditable

## 🚀 Processus d'Installation Recommandé

1. **Télécharger** le package depuis la source officielle
2. **Exécuter** le script de vérification sécurisée
3. **Confirmer** l'installation dans le dialogue de sécurité
4. **Vérifier** l'installation post-installation

## 📋 Journal d'Installation

Un journal détaillé est créé dans :
```
~/Library/Logs/SentinelAgent_Install.log
```

Ce journal contient :
- Date et heure d'installation
- Hash du package vérifié
- Résultats des vérifications de sécurité
- Confirmation utilisateur

## ⚠️  Notes Importantes

- L'avertissement Gatekeeper est **normal** pour les logiciels non-notarisés
- Le code source est **auditable** et disponible publiquement
- Aucune donnée personnelle n'est collectée au-delà des besoins de conformité
- Le logiciel est conçu pour la **sécurité d'entreprise**

## 🔐 Mesures de Sécurité Implémentées

1. **Vérification d'intégrité** : Hash SHA256 du package
2. **Scan de sécurité** : Détection de patterns suspects
3. **Validation structure** : Vérification du format .pkg
4. **Journalisation** : Traçabilité complète de l'installation
5. **Confirmation utilisateur** : Choix explicite d'installation

## 🆘 Support

En cas de problème :
1. Vérifiez le journal d'installation
2. Contactez votre administrateur système
3. Consultez la documentation : https://docs.sentinel-grc.com

---

**Version** : 2.0.0  
**Dernière mise à jour** : 2026-02-01  
**Développeur** : Cyber Threat Consulting
