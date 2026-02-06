# Guide Utilisateur - Sentinel GRC v2.0

## Table des Matières

1. [Introduction](#introduction)
2. [Premiers Pas](#premiers-pas)
3. [Modules Fonctionnels](#modules-fonctionnels)
4. [Gestion des Rôles et Permissions](#gestion-des-rôles-et-permissions)
5. [Notifications Temps Réel](#notifications-temps-réel)
6. [Exports et Rapports](#exports-et-rapports)
7. [Tests et Qualité](#tests-et-qualité)
8. [Agent de Conformité Endpoint](#agent-de-conformité-endpoint)
9. [Dépannage](#dépannage)

## Introduction

Sentinel GRC v2.0 est une plateforme professionnelle de gestion de la sécurité des systèmes d'information (SSI) conforme aux normes ISO 27001 et ISO 27005.

### Fonctionnalités Principales

- ✅ **Voxel Studio 3D** : Visualisation immersive des risques et actifs avec effets cinématiques
- ✅ **Gestion des Actifs** : Classification, criticité, maintenance, amortissement
- ✅ **Gestion des Risques** : Évaluation ISO 27005, matrice interactive, plans de traitement
- ✅ **Conformité ISO 27001** : 93 contrôles, SoA automatisé, tableaux de bord
- ✅ **Audits** : Planification, grilles de vérification, rapports PDF
- ✅ **Gestion Documentaire** : Workflow de validation, versioning, signatures
- ✅ **Projets SSI** : Planning, jalons, suivi d'avancement
- ✅ **Notifications Temps Réel** : Alertes persistantes avec Firestore
- ✅ **RBAC Avancé** : 6 rôles, permissions granulaires
- ✅ **Tests Unitaires** : 63 tests couvrant tous les modules

## Premiers Pas

### Connexion

1. Accédez à l'application via votre navigateur
2. Connectez-vous avec votre compte organisationnel
3. Votre rôle est automatiquement assigné selon votre profil

### Interface

L'interface est organisée en plusieurs sections :

- **Sidebar** (gauche) : Navigation entre les modules selon vos permissions
- **Header** (haut) : Notifications temps réel, thème, profil utilisateur
- **Zone principale** : Contenu du module actif avec onglets contextuels

### Personnalisation

- **Thème** : Clair/Sombre avec persistance locale
- **Langue** : Français (multilingue prévu)
- **Préférences** : Notifications, affichage par défaut

## Modules Fonctionnels

### 1. Gestion des Actifs

#### Accès
- **Rôles autorisés** : Admin, RSSI, Chef de Projet, Direction (lecture), Utilisateur (limité)

#### Fonctionnalités
- **Inventaire complet** : Matériel, Logiciel, Données, Service, Humain
- **Classification** : Criticité (confidentialité, intégrité, disponibilité)
- **Suivi maintenance** : Planification, historique, coûts
- **Amortissement** : Calcul automatique selon durée de vie
- **Import/Export** : CSV avec validation des données

#### Workflow
1. **Création** : Formulaire avec validation en temps réel
2. **Classification** : Attribution des niveaux de criticité
3. **Association** : Lien avec projets, risques, contrôles
4. **Suivi** : Mise à jour statut, maintenance, valeur

### 2. Gestion des Risques

#### Accès
- **Rôles autorisés** : Admin, RSSI (complet), Chef de Projet (limité), Auditeur (consultation)

#### Méthodologie ISO 27005
- **Identification** : Menaces et vulnérabilités
- **Évaluation** : Probabilité (1-5) × Impact (1-5) = Score de risque
- **Traitement** : Accepter, Atténuer, Transférer, Éviter
- **Surveillance** : Réévaluation périodique

#### Matrice des Risques
- **Visualisation** : Heatmap interactive
- **Filtrage** : Par score, statut, responsable
- **Export** : PDF, Excel pour reporting

### 3. Gestion de Projet SSI

#### Accès
- **Rôles autorisés** : Admin, RSSI, Chef de Projet (complet), Auditeur (consultation)

#### Fonctionnalités
- **Planning** : Jalons, échéances, responsables
- **Suivi** : Tâches, commentaires, documents
- **Liens automatiques** : Association avec actifs, risques, contrôles
- **Calendrier** : Export ICS pour synchronisation

#### Vue Kanban
- **Colonnes** : À faire, En cours, En revue, Terminé
- **Glisser-déposer** : Mise à jour statut rapide
- **Filtres** : Par responsable, priorité, date

### 4. Gestion des Audits

#### Accès
- **Rôles autorisés** : Admin, RSSI, Auditeur (complet), Direction (consultation)

#### Types d'Audits
- **Interne** : Conformité continue
- **Externe** : Certification ISO 27001
- **Spécifique** : Thématique (RGPD, etc.)

#### Workflow
1. **Planification** : Définition périmètre, équipe
2. **Préparation** : Checklists, questionnaires
3. **Exécution** : Collecte preuves, entretiens
4. **Rapport** : Génération PDF automatique
5. **Suivi** : Plan d'action, vérification

### 5. Gestion Documentaire

#### Accès
- **Rôles autorisés** : Admin, RSSI (complet), Auditeur, Chef de Projet (limité)

#### Workflow de Validation
```
Brouillon → En revue → Approuvé → Publié → Obsolète
```

#### Types de Documents
- **Politiques** : Cadre directionnel
- **Procédures** : Instructions opérationnelles
- **Preuves** : Évidences de conformité
- **Rapports** : Audits, analyses

#### Fonctionnalités
- **Versionning** : Traçabilité des modifications
- **Signatures** : Validation électronique
- **Liens** : Association avec contrôles, actifs
- **Stockage** : Firebase Storage sécurisé

### 6. Conformité ISO 27001

#### Accès
- **Rôles autorisés** : Admin, RSSI (complet), Auditeur (consultation), Direction (lecture)

#### Implémentation
- **Annexe A** : 93 contrôles répartis en 4 thèmes
- **Suivi** : Statut d'implémentation par contrôle
- **Preuves** : Association documents
- **SoA** : Statement of Applicability automatisé

#### Tableaux de Bord
- **Vue globale** : Taux d'implémentation
- **Par thématique** : Organisation, Sécurité, Ressources, Technique
- **Écarts** : Contrôles non implémentés avec justification

## Gestion des Rôles et Permissions

### Matrice RBAC

| Rôle | Actifs | Risques | Projets | Audits | Documents | Conformité | Administration |
|------|--------|---------|---------|--------|-----------|------------|----------------|
| **Admin** | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ Tout |
| **RSSI** | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | ✅ CRUD | 📊 Logs |
| **Auditeur** | 👁️ Lecture | 👁️ Lecture | 👁️ Lecture | ✅ CRUD | ✅ CRUD* | 👁️ Lecture | ❌ |
| **Chef de Projet** | 👁️ Lecture | 👁️ Lecture | ✅ CRUD | ❌ | ✅ CRUD* | ❌ | ❌ |
| **Direction** | 👁️ Lecture | 👁️ Lecture | 👁️ Lecture | 👁️ Lecture | 👁️ Lecture | 👁️ Lecture | ❌ |
| **Utilisateur** | 👁️ Limité | ❌ | ❌ | ❌ | 👁️ Lecture | ❌ | ❌ |

*CRUD limité aux documents créés par l'utilisateur

### Permissions Granulaires

Le système utilise une matrice ressource/action :
- **Ressources** : Asset, Risk, Project, Audit, Document, Compliance, SystemLog
- **Actions** : Create, Read, Update, Delete, Manage

Exemple : Un auditeur peut `Create`/`Read`/`Update` des documents mais pas les `Delete`.

## Notifications Temps Réel

### Types de Notifications

| Type | Description | Automatique |
|------|-------------|-------------|
| **Success** | Opération réussie | ✅ |
| **Info** | Information générale | ✅ |
| **Warning** | Attention requise | ✅ |
| **Error** | Erreur système | ✅ |

### Sources Automatisées

- **Audits** : Rappels de planification, échéances
- **Documents** : Revues obligatoires, expirations
- **Maintenance** : Échéances de maintenance
- **Risques** : Risques critiques sans mitigation

### Gestion

- **Centre de notifications** : Icône dans header avec compteur
- **Marquage** : Lu/non lu avec synchronisation Firestore
- **Filtrage** : Par type, date, priorité
- **Persistance** : Stockage durable même après reconnexion

## Exports et Rapports

### Formats Disponibles

- **PDF** : Rapports détaillés avec mise en forme
- **CSV** : Données brutes pour analyse
- **ICS** : Calendrier pour synchronisation
- **Excel** : Tableaux croisés dynamiques

### Rapports Automatisés

- **SoA** : Statement of Applicability ISO 27001
- **Audit** : Rapport complet avec écarts
- **Risques** : Matrice avec plans de traitement
- **Actifs** : Inventaire avec amortissement

## Tests et Qualité

### Suite de Tests

L'application inclut **63 tests unitaires** couvrant :

- **Permissions (14 tests)** : Validation RBAC, rôles, accès
- **Notifications (8 tests)** : Service temps réel, persistence
- **Store (4 tests)** : État global, thème, toasts
- **Logger (5 tests)** : Traçabilité des actions
- **Calendar (5 tests)** : Génération ICS
- **Form Validation (6 tests)** : Validation assets et risques
- **Services (21 tests)** : API, utilitaires

### Lancement des Tests

```bash
# Tous les tests
npm test

# Interface visuelle
npm run test:ui

# Couverture de code
npm run test:coverage
```

### Qualité Code

- **TypeScript** : Typage strict
- **ESLint** : Linting automatique
- **Prettier** : Formatage standardisé
- **Tests** : Couverture > 80%

## Agent de Conformité Endpoint

### Présentation

L'agent Sentinel GRC est un logiciel léger installé sur vos serveurs et postes de travail pour collecter automatiquement des preuves de conformité.

### Fonctionnalités

- **Vérifications automatisées** : Contrôles de sécurité en continu
- **Collecte de preuves** : Screenshots, fichiers de config, logs
- **Mode hors-ligne** : Fonctionne jusqu'à 7 jours sans connexion
- **Faible empreinte** : < 0.5% CPU, < 100 MB RAM

### Installation

#### Accès
Rendez-vous dans **Paramètres → Agents** pour :
1. Générer un token d'enrôlement
2. Télécharger l'installeur pour votre système

#### Windows
```powershell
# Installation silencieuse avec MSI
msiexec /i sentinel-agent.msi /qn ENROLLMENTTOKEN="votre_token"

# Vérification
sc query sentinel-agent
```

#### Linux (Debian/Ubuntu)
```bash
# Installation du package
sudo dpkg -i sentinel-agent_*.deb

# Configuration
sudo nano /etc/sentinel/agent.json
# Ajouter le token d'enrôlement

# Démarrage du service
sudo systemctl enable sentinel-agent
sudo systemctl start sentinel-agent
```

#### Linux (RHEL/CentOS)
```bash
# Installation du package
sudo rpm -i sentinel-agent_*.rpm

# Configuration et démarrage
sudo systemctl enable sentinel-agent
sudo systemctl start sentinel-agent
```

#### macOS
```bash
# Installation manuelle
sudo ./sentinel-agent install

# Configuration
sudo nano /etc/sentinel/agent.json

# Démarrage
sudo ./sentinel-agent start
```

### Configuration

Fichier de configuration (`agent.json`) :
```json
{
  "server_url": "https://app.cyber-threat-consulting.com",
  "enrollment_token": "VOTRE_TOKEN",
  "check_interval_secs": 3600,
  "log_level": "info"
}
```

### Variables d'Environnement

| Variable | Description |
|----------|-------------|
| `SENTINEL_SERVER_URL` | URL du serveur |
| `SENTINEL_ENROLLMENT_TOKEN` | Token d'enrôlement |
| `SENTINEL_CHECK_INTERVAL_SECS` | Intervalle entre vérifications |
| `SENTINEL_LOG_LEVEL` | Niveau de log (debug, info, warn, error) |

### Commandes CLI

```bash
# Statut de l'agent
sentinel-agent status

# Exécution manuelle
sentinel-agent run

# Désinstallation
sentinel-agent uninstall
```

### Dépannage Agent

| Problème | Solution |
|----------|----------|
| Agent hors-ligne | Vérifier connectivité réseau et certificats TLS |
| Token invalide | Générer un nouveau token (expiration 24h) |
| Erreur de démarrage | Consulter les logs dans `/var/log/sentinel-grc/` |

## Dépannage

### Problèmes Courants

#### Connexion
- **Problème** : "Accès refusé"
- **Solution** : Vérifiez votre rôle auprès de l'administrateur

#### Notifications
- **Problème** : Pas de notifications
- **Solution** : Vérifiez les permissions du navigateur pour les notifications

#### Performance
- **Problème** : Application lente
- **Solution** : Videz le cache du navigateur, rechargez la page

#### Erreurs de validation
- **Problème** : Formulaire non valide
- **Solution** : Vérifiez les champs en rouge, suivez les messages d'aide

### Support Technique

Pour toute question technique :

1. **Consultez** : Ce guide et la FAQ
2. **Vérifiez** : Vos permissions et rôle
3. **Contactez** : L'administrateur système
4. **Signalez** : Les bugs via le formulaire de feedback

### Bonnes Pratiques

- **Sauvegardez** : Régulièrement votre travail
- **Documentez** : Vos actions dans les commentaires
- **Respectez** : Les workflows de validation
- **Maintenez** : Vos informations à jour

**Sentinel GRC v2.0** - Votre partenaire pour une sécurité conforme et maîtrisée

Pour plus d'informations, consultez le [README.md](README.md) ou contactez votre administrateur système.
