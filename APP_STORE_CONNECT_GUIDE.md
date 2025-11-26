# 📱 Guide App Store Connect - Sentinel GRC

## 🚀 Après l'Upload Xcode Réussi

Une fois l'upload terminé depuis Xcode, suivez ce guide pour finaliser la soumission.

---

## 1️⃣ Créer l'Application (si première fois)

### Accéder à App Store Connect

1. Allez sur : **https://appstoreconnect.apple.com**
2. Connectez-vous avec votre compte Apple Developer
3. Cliquez sur **"My Apps"**

### Créer la Nouvelle App

1. Cliquez sur le bouton **"+"** (en haut à gauche)
2. Sélectionnez **"New App"**

### Remplir les Informations de Base

**Platforms** : ✅ iOS

**Name** : `Sentinel GRC`

**Primary Language** : `French (France)` ou `English (U.S.)`

**Bundle ID** : Sélectionnez `com.sentinel.grc` dans le menu déroulant

**SKU** : `sentinel-grc-2024` (identifiant unique interne)

**User Access** : `Full Access`

Cliquez sur **"Create"**

---

## 2️⃣ Remplir les Métadonnées

### Section "App Information"

**Name** : `Sentinel GRC`

**Subtitle** (optionnel) : `Gouvernance, Risques & Conformité`

**Category** :
- **Primary** : `Business`
- **Secondary** : `Productivity`

**Content Rights** : Cochez si vous possédez les droits

---

### Section "Pricing and Availability"

**Price** : 
- Si gratuit : Sélectionnez `0 (Free)`
- Si payant : Définissez votre prix

**Availability** : 
- Sélectionnez les pays (recommandé : tous les pays)

---

### Section "App Privacy"

**Privacy Policy URL** : `https://sentinel-grc.com/privacy`

⚠️ **IMPORTANT** : Cette URL doit être accessible publiquement !

**Privacy Practices** :
1. Cliquez sur **"Set Up Your Privacy Practices"**
2. Répondez au questionnaire :

**Do you collect data from this app?** : `Yes`

**Data Types Collected** :
- ✅ **Contact Info** : Email Address, Name
- ✅ **User Content** : Documents, Files
- ✅ **Identifiers** : User ID
- ✅ **Usage Data** : Product Interaction, Crash Data

**How is this data used?** :
- ✅ App Functionality
- ✅ Analytics
- ✅ Product Personalization

**Is this data linked to the user?** : `Yes`

**Do you track users?** : `No`

Sauvegardez.

---

## 3️⃣ Préparer la Version (iOS App)

### Accéder à la Version

1. Dans votre app, cliquez sur **"iOS App"**
2. Sous "App Store", cliquez sur **"+ Version"** ou sélectionnez `2.0.0`

### Screenshots (CRITIQUE - 15 fichiers requis)

Vous devez fournir des screenshots pour 3 tailles :

#### iPhone 6.7" (iPhone 14 Pro Max - 1290x2796)
- 📸 Minimum 1, maximum 10 screenshots
- Recommandé : 5 screenshots

#### iPhone 6.5" (iPhone 11 Pro Max - 1242x2688)
- 📸 Minimum 1, maximum 10 screenshots
- Recommandé : 5 screenshots

#### iPad Pro 12.9" (2048x2732)
- 📸 Minimum 1, maximum 10 screenshots
- Recommandé : 5 screenshots

**Comment les créer ?**
- Suivez le guide : `scripts/capture-screenshots.md`
- Ou utilisez des simulateurs Xcode
- Ou utilisez des outils comme Fastlane Snapshot

**Écrans recommandés à capturer** :
1. Dashboard principal (vue d'ensemble)
2. Gestion des actifs
3. Évaluation des risques
4. Rapport d'audit
5. Conformité ISO 27001

---

### Description

Copiez depuis **`APP_STORE_METADATA.md`** :

```
Sentinel GRC est la plateforme professionnelle de référence pour la gestion de la Gouvernance, des Risques et de la Conformité (GRC), spécialement conçue pour les RSSI, équipes GRC, consultants en sécurité et auditeurs.

🛡️ GESTION COMPLÈTE DE LA SÉCURITÉ

• Gestion des Actifs : Inventaire complet et classification des actifs IT, humains et documentaires
• Évaluation des Risques : Méthodologie ISO 27005 avec calcul automatique et plans de traitement
• Gestion de Projet SSI : Suivi des projets de mise en conformité et amélioration continue
• Audits Internes/Externes : Grilles de vérification ISO 27001, collecte de preuves, rapports PDF automatiques

📊 CONFORMITÉ ISO 27001

• Tableau de bord de conformité en temps réel
• Suivi des 114 contrôles de l'Annexe A
• Génération automatique du Statement of Applicability (SoA)
• Plans d'action et recommandations

🔐 SÉCURITÉ MAXIMALE

• Chiffrement AES-256 des données au repos
• TLS 1.3 pour les communications
• Authentification multi-facteurs (MFA)
• Contrôle d'accès basé sur les rôles (RBAC)
• Hébergement sécurisé en Europe (RGPD)
• Journalisation complète et traçabilité

📈 TABLEAUX DE BORD & ANALYTICS

• Visualisation en temps réel des indicateurs clés
• Graphiques interactifs et matrices de risques
• Rapports personnalisables et exportables
• Alertes et notifications intelligentes

✅ FONCTIONNALITÉS PROFESSIONNELLES

• Gestion documentaire avec versioning
• Calendrier partagé et rappels automatiques
• Collaboration multi-utilisateurs
• Import/Export Excel et PDF
• Mode hors ligne
• Synchronisation cloud sécurisée

🎯 POUR QUI ?

• RSSI et Responsables Sécurité
• Équipes GRC et Compliance
• Consultants en Cybersécurité
• Auditeurs Internes/Externes
• DPO et Responsables RGPD
• Directions et Comités de Direction

💼 CONFORMITÉ RÉGLEMENTAIRE

• ISO 27001 / ISO 27005
• RGPD (Règlement Général sur la Protection des Données)
• NIS 2
• SOC 2
• Standards sectoriels (Santé, Finance, etc.)

📱 EXPÉRIENCE MOBILE OPTIMALE

Interface moderne et intuitive conçue pour iOS, avec support complet de l'iPad et du mode sombre.

🌍 SUPPORT & FORMATION

• Documentation complète
• Support technique réactif
• Formations et webinaires
• Communauté d'utilisateurs

Sentinel GRC transforme la complexité de la conformité en processus simples et efficaces.

Téléchargez maintenant et sécurisez votre organisation !
```

---

### Keywords (mots-clés)

Copiez depuis **`APP_STORE_METADATA.md`** :

```
GRC,ISO 27001,sécurité,conformité,risques,audit,RSSI,cybersécurité,RGPD,gouvernance,SSI,ISO 27005,gestion risques,compliance,sécurité information,actifs,vulnérabilités,menaces,contrôles,SMSI,protection données,DPO,audit sécurité,NIS2,SOC2,business,productivité
```

---

### Promotional Text (optionnel)

```
🚀 Nouvelle version 2.0 ! Interface repensée, tableaux de bord améliorés, conformité ISO 27001 renforcée. La solution GRC de référence pour les professionnels de la sécurité.
```

---

### Support URL

`https://sentinel-grc.com/support`

---

### Marketing URL (optionnel)

`https://sentinel-grc.com`

---

### What's New in This Version

```
Version 2.0.0 - Édition Enterprise

🎨 NOUVELLE INTERFACE
• Design moderne et intuitif
• Mode sombre optimisé
• Navigation repensée pour plus d'efficacité

🚀 PERFORMANCES
• Temps de chargement réduits de 60%
• Synchronisation optimisée
• Meilleure gestion de la mémoire

🔐 SÉCURITÉ RENFORCÉE
• Chiffrement AES-256 au repos
• TLS 1.3 pour les communications
• Authentification biométrique (Face ID / Touch ID)

📊 NOUVELLES FONCTIONNALITÉS
• Tableaux de bord interactifs améliorés
• Génération automatique de rapports PDF
• Export Excel avancé
• Graphiques 3D pour la visualisation des risques

✅ CONFORMITÉ
• Mise à jour ISO 27001:2022
• Support complet RGPD
• Templates d'audit enrichis

🐛 CORRECTIONS
• Amélioration de la stabilité générale
• Corrections de bugs mineurs
• Optimisations diverses

Merci d'utiliser Sentinel GRC !
```

---

## 4️⃣ Build Selection

### Sélectionner le Build

1. Dans la section **"Build"**
2. Cliquez sur **"+ Select a build before you submit your app"**
3. Attendez que votre build apparaisse (peut prendre 10-30 min après l'upload)
4. Sélectionnez le build **`2.0.0 (1)`**

⚠️ **Si le build n'apparaît pas** :
- Attendez 10-30 minutes (traitement Apple)
- Vérifiez vos emails pour d'éventuelles erreurs
- Vérifiez dans TestFlight > iOS Builds

---

## 5️⃣ App Review Information

### Contact Information

**First Name** : [Votre prénom]
**Last Name** : [Votre nom]
**Phone Number** : [Votre numéro avec indicatif international]
**Email** : [Votre email professionnel]

### Demo Account (CRITIQUE)

⚠️ **Apple DOIT pouvoir tester votre app !**

**Username** : `demo@sentinel-grc.com`
**Password** : `SentinelDemo2024!`

**Notes** :
```
Compte de démonstration avec données pré-remplies pour tester toutes les fonctionnalités.

INSTRUCTIONS DE TEST :
1. Connectez-vous avec les identifiants fournis
2. Le dashboard affiche des données de démonstration
3. Toutes les fonctionnalités sont accessibles :
   - Gestion des actifs (onglet Assets)
   - Évaluation des risques (onglet Risks)
   - Audits (onglet Audits)
   - Conformité ISO 27001 (onglet Compliance)
   - Génération de rapports PDF (bouton Export)

DONNÉES DE TEST :
- 50+ actifs pré-configurés
- 20+ risques évalués
- 3 audits en cours
- Tableaux de bord conformité ISO 27001

L'application ne collecte aucune donnée personnelle sans consentement explicite.
Politique de confidentialité : https://sentinel-grc.com/privacy

Pour toute question : support@sentinel-grc.com
```

### Notes (optionnel mais recommandé)

```
Cette application est destinée aux professionnels de la sécurité informatique (RSSI, auditeurs, consultants GRC).

FONCTIONNALITÉS PRINCIPALES :
- Gestion de la conformité ISO 27001
- Évaluation et traitement des risques cyber
- Gestion des audits de sécurité
- Génération de rapports et documentation

SÉCURITÉ :
- Toutes les données sont chiffrées (AES-256)
- Communications sécurisées (TLS 1.3)
- Hébergement en Europe (RGPD)
- Aucun tracking tiers

COMPTE DE DÉMO :
Un compte de démonstration complet est fourni pour tester toutes les fonctionnalités sans restriction.

Merci pour votre révision !
```

---

## 6️⃣ Export Compliance

**Is your app exempt from encryption export compliance?**

Sélectionnez : **`Yes`**

**Raison** : L'app utilise uniquement HTTPS standard (exempt selon les régulations US)

---

## 7️⃣ Content Rights

**Does your app contain, display, or access third-party content?**

Sélectionnez selon votre cas (probablement `No`)

---

## 8️⃣ Advertising Identifier

**Does this app use the Advertising Identifier (IDFA)?**

Sélectionnez : **`No`**

---

## 9️⃣ Version Release

**Automatically release this version** : Cochez si vous voulez une publication automatique après approbation

OU

**Manually release this version** : Cochez si vous voulez contrôler la date de publication

---

## 🔟 Soumettre pour Révision

### Vérification Finale

Assurez-vous que tout est ✅ :
- [ ] Screenshots uploadés (15 fichiers minimum)
- [ ] Description complète
- [ ] Mots-clés remplis
- [ ] URLs de support et privacy accessibles
- [ ] Build sélectionné
- [ ] Compte de démo fourni et testé
- [ ] Informations de contact correctes
- [ ] Export compliance répondu

### Soumettre

1. Cliquez sur **"Add for Review"** (en haut à droite)
2. Répondez aux dernières questions si demandé
3. Cliquez sur **"Submit for Review"**

---

## ✅ Après la Soumission

### Emails que vous recevrez

1. **"Your submission was received"** - Immédiat
2. **"Your app status is In Review"** - 1-3 jours
3. **"Your app status is Ready for Sale"** - 1-2 jours après révision
   OU
   **"Your app has been rejected"** - Avec raisons détaillées

### Statuts Possibles

- **Waiting for Review** : En attente dans la file
- **In Review** : En cours de révision par Apple
- **Pending Developer Release** : Approuvé, en attente de votre publication manuelle
- **Ready for Sale** : Publié sur l'App Store !
- **Rejected** : Refusé (lisez les raisons et corrigez)

### Timeline Typique

- Soumission → En révision : 1-3 jours
- En révision → Décision : 1-2 jours
- **Total** : 2-5 jours en moyenne

---

## 🆘 En Cas de Rejet

### Raisons Courantes

1. **Screenshots manquants ou incorrects**
   - Solution : Ajoutez les tailles manquantes

2. **Compte de démo ne fonctionne pas**
   - Solution : Testez le compte avant soumission

3. **Privacy Policy inaccessible**
   - Solution : Vérifiez que l'URL est publique

4. **Fonctionnalités manquantes**
   - Solution : Assurez-vous que toutes les fonctionnalités décrites sont présentes

5. **Crash au lancement**
   - Solution : Testez sur device réel avant soumission

### Comment Répondre

1. Lisez attentivement le message de rejet
2. Corrigez les problèmes mentionnés
3. Répondez dans Resolution Center si nécessaire
4. Resoumettez une nouvelle version ou le même build corrigé

---

## 🎉 Après Approbation

### Publication

- Si **automatique** : L'app apparaît sur l'App Store dans les 24h
- Si **manuelle** : Cliquez sur "Release this version" quand vous êtes prêt

### Promotion

- Partagez le lien App Store : `https://apps.apple.com/app/sentinel-grc/[ID]`
- Ajoutez le badge "Download on the App Store" sur votre site
- Annoncez sur vos réseaux sociaux

---

## 📞 Support

**App Store Connect Help** : https://developer.apple.com/support/app-store-connect/

**Documentation Apple** : https://developer.apple.com/app-store/review/guidelines/

**Contact Support Apple** : Dans App Store Connect > "?" > Contact Us

---

**Bonne chance pour votre soumission ! 🚀**
