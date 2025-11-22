# Guide Utilisateur - Sentinel GRC v2

## Table des Matières

1. [Introduction](#introduction)
2. [Premiers Pas](#premiers-pas)
3. [Modules Principaux](#modules-principaux)
4. [Gestion des Rôles et Permissions](#gestion-des-rôles-et-permissions)
5. [Notifications](#notifications)
6. [Exports et Rapports](#exports-et-rapports)
7. [FAQ](#faq)

## Introduction

Sentinel GRC v2 est une plateforme complète de gestion de la gouvernance, des risques et de la conformité (GRC) conforme à la norme ISO 27001:2022.

### Fonctionnalités Principales

- ✅ **Gestion des Actifs** : Inventaire complet avec amortissement automatique
- ✅ **Gestion des Risques** : Évaluation ISO 27005 avec matrice interactive
- ✅ **Conformité ISO 27001** : 93 contrôles avec suivi détaillé
- ✅ **Audits** : Planification, exécution et rapports
- ✅ **Gestion Documentaire** : Versioning et workflow de validation
- ✅ **Incidents** : Suivi et résolution avec playbooks
- ✅ **Projets** : Gestion avec Kanban
- ✅ **Notifications** : Rappels automatiques en temps réel

## Premiers Pas

### Connexion

1. Accédez à l'application via votre navigateur
2. Connectez-vous avec votre compte Google
3. Complétez l'onboarding si c'est votre première connexion

### Interface

L'interface est organisée en plusieurs sections :

- **Sidebar** (gauche) : Navigation entre les modules
- **Header** (haut) : Notifications, thème, profil
- **Zone principale** : Contenu du module actif

### Thèmes

Basculez entre les thèmes clair et sombre via l'icône lune/soleil dans le header.

## Modules Principaux

### Dashboard

Le tableau de bord affiche une vue d'ensemble de votre posture de sécurité :

- **KPIs** : Risques actifs, actifs critiques, conformité, incidents
- **Graphiques** : Évolution de la conformité, répartition des risques
- **Insights** : Recommandations intelligentes
- **Activités récentes** : Dernières actions

**Actions disponibles** :
- Exporter le rapport exécutif (PDF)
- Exporter le calendrier (iCal)

### Actifs

Gérez votre inventaire d'actifs informationnels.

**Fonctionnalités** :
- Créer, modifier, supprimer des actifs
- Classification DIC (Disponibilité, Intégrité, Confidentialité)
- Calcul automatique de l'amortissement (5 ans)
- Historique de maintenance
- Génération d'étiquettes QR Code
- Import/Export CSV

**Champs principaux** :
- Nom, type, propriétaire
- Prix d'achat, date d'acquisition
- Criticité, localisation
- Prochaine maintenance

### Risques

Évaluez et gérez vos risques selon ISO 27005.

**Fonctionnalités** :
- Matrice de risques interactive (5×5)
- Calcul automatique du score (probabilité × impact)
- Risque brut vs résiduel
- Liaison avec contrôles d'atténuation
- Plans de traitement (RTP) en PDF
- Historique des revues

**Statuts** :
- Identifié, En traitement, Atténué, Accepté, Fermé

### Conformité ISO 27001

Suivez votre conformité aux 93 contrôles ISO 27001:2022.

**Fonctionnalités** :
- Vue par domaine (A.5, A.6, A.7, A.8)
- Statuts : Non applicable, Non conforme, Partiellement conforme, Conforme
- Liaison avec documents de preuve
- Génération automatique du SoA (Statement of Applicability)

**Workflow** :
1. Sélectionner un contrôle
2. Définir le statut
3. Ajouter une justification
4. Lier des documents
5. Enregistrer

### Audits

Planifiez et exécutez vos audits de sécurité.

**Fonctionnalités** :
- Création d'audits (interne/externe)
- Grilles de vérification ISO 27001
- Collecte de preuves
- Gestion des constats (findings)
- Rapports PDF automatiques

**Statuts** :
- Planifié, En cours, Terminé, Validé

**Checklists disponibles** :
- A.5 : Contrôles Organisationnels
- A.6 : Contrôles Liés aux Personnes
- A.7 : Contrôles Physiques
- A.8 : Contrôles Technologiques

### Documents

Gérez vos politiques, procédures et documents de sécurité.

**Fonctionnalités** :
- Versioning (v1.0, v1.1, v2.0)
- Workflow : Brouillon → Révision → Approuvé → Publié
- Signature électronique
- Suivi de lecture
- Rappels de révision automatiques

**Types de documents** :
- Politique, Procédure, Instruction, Formulaire, Rapport

### Incidents

Signalez et gérez les incidents de sécurité.

**Fonctionnalités** :
- Création d'incidents
- Playbooks de réponse
- Liaison avec actifs et risques
- Suivi de résolution
- Chronologie des actions

**Sévérités** :
- Faible, Moyenne, Élevée, Critique

### Projets

Gérez vos projets de sécurité avec un tableau Kanban.

**Fonctionnalités** :
- Création de projets
- Tâches avec statuts (À faire, En cours, Terminé)
- Liaison avec risques et contrôles
- Suivi d'avancement
- Rapports PDF

## Gestion des Rôles et Permissions

### Rôles Disponibles

1. **Administrateur** : Accès complet à toutes les fonctionnalités
2. **RSSI** : Gestion complète de la sécurité de l'information
3. **Auditeur** : Gestion des audits et de la conformité
4. **Chef de Projet** : Gestion des projets de sécurité
5. **Direction** : Consultation et approbation des documents
6. **Utilisateur** : Accès en lecture et signalement d'incidents

### Matrice de Permissions

| Rôle | Actifs | Risques | Audits | Documents | Projets |
|------|--------|---------|--------|-----------|---------|
| Admin | CRUD + Export | CRUD + Export | CRUD + Export | CRUD + Approve | CRUD + Export |
| RSSI | CRU + Export | CRUD + Export | R + Export | CRU + Approve | R + Export |
| Auditeur | R + Export | R + Export | CRUD + Export | R + Export | R + Export |
| Chef de Projet | R | R | R | R | CRUD + Export |
| Direction | R + Export | R + Export | R + Export | R + Approve | R + Export |
| Utilisateur | R | R | R | R | R |

*CRUD = Create, Read, Update, Delete*

### Modifier les Rôles (Admin uniquement)

1. Aller dans **Paramètres** > **Gestion des Rôles**
2. Cliquer sur l'icône d'édition à côté de l'utilisateur
3. Sélectionner le nouveau rôle
4. Cliquer sur **Enregistrer**

## Notifications

### Types de Notifications

- 🔴 **Danger** : Incidents critiques, risques élevés sans atténuation
- 🟠 **Warning** : Audits en retard, documents expirés
- 🔵 **Info** : Rappels généraux, évaluations fournisseurs
- 🟢 **Success** : Confirmations d'actions

### Notifications Automatiques

Le système génère automatiquement des notifications pour :

- **Audits à venir** (7 jours avant, alerte 3 jours avant)
- **Documents à réviser** (date de révision dépassée)
- **Maintenances à prévoir** (30 jours avant, alerte 7 jours avant)
- **Risques critiques** sans contrôles d'atténuation

### Gérer les Notifications

1. Cliquer sur l'icône 🔔 dans le header
2. Consulter les notifications
3. Cliquer sur une notification pour accéder à la ressource
4. Marquer comme lu ou tout marquer comme lu

## Exports et Rapports

### Formats Disponibles

- **PDF** : Rapports exécutifs, RTP, SoA, audits
- **CSV** : Actifs, risques, incidents, projets
- **iCal** : Calendrier des audits et maintenances

### Générer un Rapport

1. Accéder au module concerné
2. Cliquer sur le bouton **Export** ou **Générer le rapport**
3. Sélectionner le format
4. Le fichier se télécharge automatiquement

### Rapports Disponibles

- **Dashboard** : Rapport exécutif (PDF), Calendrier (iCal)
- **Actifs** : Export CSV, Étiquettes QR Code (PDF)
- **Risques** : Plan de Traitement (PDF), Export CSV
- **Conformité** : Statement of Applicability (PDF)
- **Audits** : Rapport d'audit (PDF), Export CSV
- **Projets** : Rapport de projet (PDF), Export CSV

## FAQ

### Comment réinitialiser mon mot de passe ?

L'authentification se fait via Google. Utilisez la récupération de compte Google si nécessaire.

### Puis-je importer des données existantes ?

Oui, les modules Actifs, Risques et Incidents supportent l'import CSV. Utilisez le bouton **Import CSV** dans chaque module.

### Comment inviter un nouvel utilisateur ?

1. Aller dans **Équipe**
2. Cliquer sur **Inviter un membre**
3. Saisir l'email et le rôle
4. Envoyer l'invitation

### Les données sont-elles sauvegardées automatiquement ?

Oui, toutes les modifications sont sauvegardées automatiquement dans Firebase. L'application fonctionne également hors ligne grâce au cache local.

### Comment générer un rapport d'audit complet ?

1. Aller dans **Audits**
2. Sélectionner l'audit
3. Cliquer sur **Générer le rapport**
4. Le PDF inclut automatiquement les constats, preuves et recommandations

### Puis-je personnaliser les contrôles ISO 27001 ?

Les 93 contrôles ISO 27001:2022 sont prédéfinis. Vous pouvez cependant :
- Marquer certains contrôles comme "Non applicable"
- Ajouter des justifications personnalisées
- Lier vos propres documents de preuve

### Comment fonctionne le calcul de l'amortissement ?

L'amortissement est calculé linéairement sur 5 ans :
- Valeur actuelle = Prix d'achat - (Prix d'achat × Années écoulées / 5)
- Exemple : Actif de 10 000€ acheté il y a 2 ans = 10 000 - (10 000 × 2 / 5) = 6 000€

### Les notifications fonctionnent-elles hors ligne ?

Les notifications en temps réel nécessitent une connexion internet. Cependant, l'application conserve les notifications en cache pour consultation hors ligne.

---

**Support** : Pour toute question, contactez votre administrateur système ou Cyber Threat Consulting.

**Version** : 2.0.0  
**Dernière mise à jour** : 22 novembre 2025
