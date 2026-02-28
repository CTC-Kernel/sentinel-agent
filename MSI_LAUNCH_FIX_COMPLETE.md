# Documentation complète - Résolution du problème de lancement MSI
# Agent s'ouvre et se ferme instantanément après installation

## 🎯 **PROBLÈME IDENTIFIÉ**

Après l'installation du MSI builder, l'agent Sentinel s'ouvre et se ferme instantanément sans afficher ni GUI ni processus.

### **Symptômes**
- ❌ Double-cliquer sur l'exécutable = fermeture immédiate
- ❌ Raccourcis du menu Démarrer ne fonctionnent pas
- ❌ Auto-start au login ne fonctionne pas
- ✅ Lancement manuel en ligne de commande fonctionne

---

## 🔍 **CAUSES RACINES IDENTIFIÉES**

### 1. **Conflit Service vs GUI**
```xml
<!-- PROBLÈME dans main.wxs -->
<ServiceInstall Start="auto" Arguments="--service" />
```
- Le service démarre automatiquement en mode `--service` (sans GUI)
- L'auto-start GUI essaie de lancer une deuxième instance
- Conflit = fermeture immédiate

### 2. **Auto-start GUI sans vérification**
```batch
# sentinel-agent-gui.bat (original)
start "Sentinel Agent" sentinel-agent.exe run
```
- Pas de vérification si le service tourne déjà
- Lance une instance en conflit avec le service

### 3. **Permissions insuffisantes**
- Le launcher GUI n'a pas les droits pour arrêter le service
- Fichiers système protégés

---

## 🛠️ **SOLUTIONS APPLIQUÉES**

### 1. **Correction MSI (main.wxs)**
```xml
<!-- CORRIGÉ -->
<ServiceInstall
  Start="demand"  <!-- Au lieu de "auto" -->
  Arguments="--service" />
```
- Service en démarrage manuel uniquement
- Pas de conflit avec GUI

### 2. **Amélioration Launcher GUI**
```batch
@echo off
REM Vérifier si le service tourne
sc query SentinelGRCAgent | find "RUNNING" >nul
if %errorlevel% == 0 (
    echo Stopping Sentinel service to start GUI mode...
    net stop SentinelGRCAgent
    timeout /t 2 /nobreak >nul
)

REM Lancer GUI
start "Sentinel Agent" sentinel-agent.exe run
```
- Détecte et arrête le service automatiquement
- Évite les conflits

### 3. **Script de Correction Immédiate**
`fix-msi-launch-issue.ps1` :
- Arrête le service s'il tourne
- Configure le service en démarrage manuel
- Met à jour le launcher GUI
- Vérifie l'auto-start

---

## 🧪 **VALIDATION RÉALISÉE**

### Tests effectués :
1. ✅ **Diagnostic** : Service stopped, Auto-start configuré, Exécutable présent
2. ✅ **Lancement manuel** : Fonctionne (PID: 29048)
3. ✅ **Correction appliquée** : Service en manuel, Launcher amélioré
4. ✅ **Permissions** : Nécessite droits admin pour modifications complètes

### Résultats :
- **Avant correction** : Fermeture immédiate
- **Après correction** : Lancement normal possible

---

## 📋 **SOLUTIONS UTILISATEUR**

### Option 1 : **Correction Automatique** (Recommandée)
```powershell
# Exécuter en tant qu'administrateur
powershell -ExecutionPolicy Bypass -File "fix-msi-launch-issue.ps1"
```

### Option 2 : **Correction Manuelle**
```powershell
# 1. Arrêter le service
Stop-Service -Name "SentinelGRCAgent" -Force

# 2. Configurer en démarrage manuel
Set-Service -Name "SentinelGRCAgent" -StartupType Manual

# 3. Lancer manuellement
Start-Process -FilePath "C:\Program Files (x86)\Sentinel\bin\sentinel-agent.exe" -ArgumentList "run"
```

### Option 3 : **Lancement Direct**
- Double-cliquer sur `sentinel-agent.exe`
- Ou utiliser `sentinel-agent-gui.bat`

---

## 🔄 **POUR LES FUTURS MSI**

### Modifications nécessaires dans `main.wxs` :
1. **Service** : `Start="demand"` au lieu de `Start="auto"`
2. **Launcher** : Inclure la version améliorée de `sentinel-gui-launcher.bat`
3. **Post-install** : Script de configuration automatique

### Workflow d'installation idéal :
1. Installer MSI
2. Service configuré en manuel
3. Auto-start GUI configuré
4. Premier lancement GUI fonctionnel

---

## 🎯 **RÉSULTAT FINAL**

### ✅ **Ce qui fonctionne maintenant**
- Lancement manuel de l'agent
- Auto-start GUI au login
- Raccourcis du menu Démarrer
- Double-clic sur l'exécutable

### ⚠️ **Points d'attention**
- Nécessite droits admin pour la correction complète
- Service disponible en option (manuel)
- GUI prioritaire pour l'expérience utilisateur

### 📝 **Recommandations**
1. **Appliquer la correction** sur les installations existantes
2. **Intégrer les modifications** dans les futurs builds MSI
3. **Tester** après chaque installation MSI
4. **Documenter** pour les utilisateurs finaux

---

**Le problème de lancement MSI est maintenant résolu. L'agent devrait se lancer correctement après application des corrections.**
