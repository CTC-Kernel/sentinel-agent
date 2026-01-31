const fs = require('fs');

const fr = JSON.parse(fs.readFileSync('public/locales/fr/translation.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('public/locales/en/translation.json', 'utf8'));

// Deep merge: add keys from FR to EN (only if missing in EN), translating values
function deepMerge(frObj, enObj, path) {
  const result = { ...enObj };

  for (const key of Object.keys(frObj)) {
    const fullPath = path ? path + '.' + key : key;
    const frVal = frObj[key];

    if (typeof frVal === 'object' && frVal !== null && !Array.isArray(frVal)) {
      if (result[key] !== undefined && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = deepMerge(frVal, result[key], fullPath);
      } else if (result[key] === undefined) {
        // Entire sub-object missing - translate all values
        result[key] = translateObject(frVal, fullPath);
      }
    } else if (result[key] === undefined) {
      // Missing leaf key - translate value
      result[key] = translateValue(frVal, fullPath);
    }
  }

  return result;
}

function translateObject(frObj, path) {
  const result = {};
  for (const key of Object.keys(frObj)) {
    const fullPath = path + '.' + key;
    const frVal = frObj[key];
    if (typeof frVal === 'object' && frVal !== null && !Array.isArray(frVal)) {
      result[key] = translateObject(frVal, fullPath);
    } else {
      result[key] = translateValue(frVal, fullPath);
    }
  }
  return result;
}

// Translation dictionary for known French -> English phrases/terms
const dict = {
  // common section
  "Importer CSV": "Import CSV",
  "Documentation": "Documentation",
  "Santé Système": "System Health",
  "Équipe": "Team",
  "Conformité": "Compliance",
  "SMSI": "ISMS",
  "Continuité": "Continuity",
  "Formation & Sensibilisation": "Training & Awareness",
  "Fermer": "Close",
  "Agents": "Agents",
  "Threat Intelligence": "Threat Intelligence",
  "Contrôles": "Controls",
  "Vulnérabilité": "Vulnerability",
  "Actif": "Active",
  "Planification & Tarifs": "Plans & Pricing",

  // common.settings
  "Site Web": "Website",
  "Mon Profil": "My Profile",
  "Journal d'Activité": "Activity Log",
  "Sécurité & Connexion": "Security & Login",
  "Gérez vos méthodes d'authentification et sessions sécurisées.": "Manage your authentication methods and secure sessions.",
  "Référentiels": "Frameworks",
  "Partenaires": "Partners",
  "Intégrations": "Integrations",
  "Adresse": "Address",
  "Authentification d'entreprise (SAML/OIDC)": "Enterprise Authentication (SAML/OIDC)",
  "Centralisez vos accès": "Centralize your access",
  "Connectez Sentinel GRC à votre fournisseur d'identité existant pour simplifier la connexion.": "Connect Sentinel GRC to your existing identity provider to simplify login.",
  "Activer le SSO": "Enable SSO",
  "Mot de passe modifié avec succès": "Password changed successfully",
  "Veuillez vous reconnecter": "Please log in again",
  "Double authentification activée": "Two-factor authentication enabled",
  "Double authentification désactivée": "Two-factor authentication disabled",
  "Changer le mot de passe": "Change password",
  "Nouveau mot de passe": "New password",
  "Confirmer le mot de passe": "Confirm password",
  "Double Authentification (MFA)": "Two-Factor Authentication (MFA)",
  "Sécurisez votre compte avec une deuxième méthode d'authentification.": "Secure your account with a second authentication method.",
  "Activer MFA": "Enable MFA",
  "Désactiver MFA": "Disable MFA",
  "Scannez ce QR Code": "Scan this QR Code",
  "Code de vérification": "Verification code",
  "Annuler": "Cancel",
  "Vérifier": "Verify",
  "Photo de profil mise à jour": "Profile photo updated",
  "Clé API HIBP requise": "HIBP API Key required",
  "Aucune fuite de données détectée": "No data breaches detected",
  "{count} fuites de données détectées": "{count} data breaches detected",
  "Erreur lors de la vérification des fuites": "Error checking for breaches",
  "Profil mis à jour": "Profile updated",
  "Compte supprimé": "Account deleted",
  "Photo de Profil": "Profile Photo",
  "JPG, PNG ou GIF. Max 5MB.": "JPG, PNG or GIF. Max 5MB.",
  "Informations Personnelles": "Personal Information",
  "Gérez vos informations d'identité.": "Manage your identity information.",
  "Nom d'affichage": "Display name",
  "Email": "Email",
  "Département": "Department",
  "Notifications": "Notifications",
  "Choisissez comment vous souhaitez être notifié.": "Choose how you want to be notified.",
  "Push Mobile": "Push Mobile",
  "Dans l'App": "In-App",
  "Clés API": "API Keys",
  "Privé": "Private",
  "Référentiels de Conformité": "Compliance Frameworks",
  "Sélectionnez les référentiels que votre organisation doit respecter.": "Select the frameworks your organization must comply with.",
  "Limite de frameworks atteinte pour votre plan.": "Framework limit reached for your plan.",
  "Frameworks mis à jour avec succès": "Frameworks updated successfully",

  // common.statuses
  "Tous les statuts": "All statuses",
  "Non commencé": "Not started",
  "En cours": "In progress",
  "Partiel": "Partial",
  "Implémenté": "Implemented",
  "Non applicable": "Not applicable",

  // dashboard
  "Indicateurs & Scores": "Indicators & Scores",
  "Risques": "Risks",
  "Actions": "Actions",
  "Audits": "Audits",
  "Autre": "Other",
  "Vue globale des indicateurs clés": "Global overview of key indicators",
  "Niveau de maturité par domaine": "Maturity level by domain",
  "Progression Conformité": "Compliance Progress",
  "Configuration NIS2/DORA": "NIS2/DORA Configuration",
  "KPI Exécutifs": "Executive KPIs",
  "Risques Critiques RSSI": "CISO Critical Risks",
  "Actions RSSI": "CISO Actions",
  "Actions en retard": "Overdue Actions",
  "Chronologie": "Timeline",
  "Progression": "Progress",
  "Actualités Cyber": "Cyber News",
  "Statistiques Incidents": "Incident Statistics",
  "Statistiques Documents": "Document Statistics",
  "Statistiques Actifs": "Asset Statistics",
  "Statistiques Fournisseurs": "Supplier Statistics",
  "Plans de Continuité": "Continuity Plans",
  "Incidents RSSI": "CISO Incidents",
  "Maturité de la Flotte Agents": "Agent Fleet Maturity",
  "Disponibilité": "Availability",
  "Modernité": "Modernity",
  "Supervision": "Monitoring",
  "Maturité Flotte Agents": "Agent Fleet Maturity",
  "Vue globale des indicateurs clés.": "Global overview of key indicators.",
  "Vos tâches et actions immédiates.": "Your tasks and immediate actions.",
  "Suivi de la conformité dans le temps.": "Compliance tracking over time.",
  "État de santé global du système.": "Overall system health status.",
  "Focus sur les risques les plus critiques.": "Focus on the most critical risks.",
  "Dernières actions sur la plateforme.": "Latest actions on the platform.",
  "Niveau de maturité par domaine.": "Maturity level by domain.",
  "Flux d'actualités cybersécurité.": "Cybersecurity news feed.",
  "Matrice des risques (impact x probabilité).": "Risk matrix (impact x probability).",
  "Répartition des audits par statut.": "Audit distribution by status.",
  "Avancement des tâches projets.": "Project task progress.",
  "Métriques sur les incidents de sécurité.": "Security incident metrics.",
  "État de la base documentaire.": "Document repository status.",
  "Progression de la mise en conformité.": "Compliance implementation progress.",
  "Répartition et criticité des actifs.": "Asset distribution and criticality.",
  "Suivi des fournisseurs et de leur conformité.": "Supplier tracking and compliance.",
  "État des plans de continuité et exercices.": "Continuity plans and exercises status.",
  "Configuration des normes NIS2 et DORA.": "NIS2 and DORA standards configuration.",
  "Score de conformité global.": "Global compliance score.",
  "KPI Exécutifs pour la direction.": "Executive KPIs for leadership.",
  "Focus sur les risques critiques pour le RSSI.": "Focus on critical risks for the CISO.",
  "Incidents de sécurité récents.": "Recent security incidents.",
  "Actions prioritaires du RSSI.": "CISO priority actions.",
  "Liste des actions projet en retard.": "List of overdue project actions.",
  "Chronologie des projets en cours.": "Timeline of ongoing projects.",
  "État d'avancement global des projets.": "Overall project progress status.",
  "Vue 360° du niveau de maturité et de santé de la flotte d'agents.": "360-degree view of the agent fleet maturity and health.",
  "Utilisateur créé": "User Created",
  "Utilisateur mis à jour": "User Updated",
  "Utilisateur supprimé": "User Deleted",
  "Actif créé": "Asset Created",
  "Actif mis à jour": "Asset Updated",
  "Actif supprimé": "Asset Deleted",
  "Risque créé": "Risk Created",
  "Risque mis à jour": "Risk Updated",
  "Risque supprimé": "Risk Deleted",
  "Incident déclaré": "Incident Reported",
  "Incident mis à jour": "Incident Updated",
  "Incident clôturé": "Incident Closed",
  "Contrôle mis à jour": "Control Updated",
  "Contrôles mis à jour": "Controls Updated",
  "Bonjour": "Good morning",
  "Bon après-midi": "Good afternoon",
  "Bonsoir": "Good evening",
  "Bonne nuit": "Good night",
  "Démarrage": "Getting Started",
  "Bienvenue sur Sentinel": "Welcome to Sentinel",
  "Suivez ces étapes pour configurer votre gouvernance.": "Follow these steps to set up your governance.",
  "Astuce : Commencez par définir votre profil d'organisation.": "Tip: Start by defining your organization profile.",
  "Afficher le guide de démarrage": "Show getting started guide",
  "Progression setup": "Setup Progress",
  "Risques Critiques": "Critical Risks",
  "Indicateurs clés d'exposition.": "Key exposure indicators.",
  "Audits en Retard": "Overdue Audits",
  "Audits nécessitant une attention.": "Audits requiring attention.",
  "Score Faible": "Low Score",
  "Score actuel sous l'objectif.": "Current score below target.",
  "Contrats Expirés": "Expired Contracts",
  "Contrats proches de l'échéance.": "Contracts nearing expiration.",
  "Documents Expirés": "Expired Documents",
  "Documents à revoir.": "Documents past review date.",
  "Risque Financier": "Financial Risk",
  "Perte potentielle estimée : {{amount}}": "Estimated potential loss: {{amount}}",
  "Incidents Actifs": "Active Incidents",
  "{{count}} incidents en cours.": "{{count}} active incidents.",
  "Fournisseurs Critiques": "Critical Suppliers",
  "{{count}} fournisseurs à évaluer.": "{{count}} suppliers need assessment.",
  "Systèmes stables": "All systems stable",
  "Actions Requises": "Actions Required",
  "Accès Refusé": "Access Denied",
  "Sélectionner période": "Select period",
  "Bon retour": "Welcome back",
  "Voici votre vue d'ensemble de la gouvernance.": "Here is your governance overview.",
  "Voici votre vue d'ensemble de l'activité.": "Here is your activity overview.",
  "Créer Actif": "Create Asset",
  "Déclarez un nouvel actif.": "Declare a new asset.",
  "Déclarez un actif critique.": "Declare a critical asset.",
  "Configurer Contrôles": "Configure Controls",
  "Gérez les mesures de sécurité.": "Manage security controls.",
  "Ajouter Documents": "Add Documents",
  "Importez politiques ou procédures.": "Upload policies or procedures.",
  "Système Opérationnel": "Operational System",
  "Rapport Exécutif": "Executive Report",
  "Exporter Calendrier": "Export Calendar",
  "Base de données verrouillée. Copiez les règles.": "Database is locked. Copy the rules.",
  "Copier Règles": "Copy Rules",
  "Règles copiées !": "Rules copied!",
  "Ajouter Widget": "Add Widget",
  "Ajouter à votre tableau de bord": "Add to your dashboard",
  "Personnaliser votre tableau de bord": "Customize your dashboard",
  "Tout le temps": "All Time",
  "Filtrer l'activité": "Filter activity",
  "Tous widgets ajoutés": "All widgets added",
  "Évaluer": "Assess",
  "Statut des Audits": "Audits Status",
  "Calendrier Exporté": "Calendar Exported",
  "Cliquez pour résoudre": "Click to Resolve",
  "Conformité par Domaine": "Compliance by Domain",
  "Score de Conformité": "Compliance Score",
  "Les valeurs apparaîtront ici": "Compliance values will appear here",
  "Domaine": "Domain",
  "Généré le": "Generated on",
  "Génération du rapport...": "Generating Report...",
  "Problèmes d'Audit": "Audit Issues",
  "Contrôles à revoir": "Controls Attention",
  "Risques à traiter": "Risks to address",
  "éléments affectés": "items affected",
  "30 derniers jours": "Last 30 Days",
  "90 derniers jours": "Last 90 Days",
  "L'année dernière": "Last Year",
  "Maturité": "Maturity",
  "Aucune anomalie": "No Anomalies",
  "Pas de données d'audit": "No Audit Data",
  "Aucun risque critique": "No Critical Risks",
  "Aucune donnée disponible": "No Data Available",
  "Pas d'actualités": "No News",
  "Pas de données de projet": "No Project Data",
  "Rien à signaler": "Nothing to Report",
  "Audits Ouverts": "Open Audits",
  "Planifier": "Plan",
  "Statut Projets": "Project Status",
  "Actualiser": "Refresh",
  "Erreur de rapport": "Report Generation Error",
  "Rapport généré": "Report Generated",
  "Rapport de Gouvernance": "Governance Report",
  "Revue": "Review",
  "Matrice des Risques": "Risk Heatmap",
  "Score": "Score",
  "Statut": "Status",
  "Revue nécessaire": "Review Needed",
  "À lire": "To Read",
  "Stratégie": "Strategy",
  "Alertes Système": "System Alerts",
  "Système Sain": "System Healthy",
  "Systèmes Nominaux": "Systems Nominal",
  "Menace": "Threat",
  "À faire cette semaine": "To Do This Week",
  "Top 5 Risques": "Top 5 Risks",
  "Top Criticité": "Top Criticality",
  "Audit": "Audit",
  "Projet": "Project",
  "Revue Documentaire": "Document Review",
  "Signature": "Signature",
  "Vue 3D": "3D View",
  "Espace de travail": "Workspace",
  "Inviter Membre": "Invite Member",
  "Inviter un nouveau membre": "Invite a new member",
  "Tableau de Bord Gouvernance": "Governance Dashboard",
  "Vue d'ensemble de votre posture de sécurité et conformité.": "Overview of your security and compliance posture.",
  "Pilotage RSSI, KPI Cyber, Conformité, Gestion des Risques, Gouvernance": "CISO Steering, KPI Cyber, Compliance, Risk Management, Governance",
  "Actifs": "Assets",
  "Incidents": "Incidents",
  "Terminer l'édition": "Finish editing",
  "Personnaliser le tableau de bord": "Customize dashboard",
  "Évolution Conformité": "Compliance Evolution",
  "Santé Système": "System Health",
  "Maturité ISO": "ISO Maturity",
  "Actualités Cybersécurité": "Cyber Security News",
  "Dernières mises à jour": "Latest updates",
  "Mon Espace": "My Workspace",
  "Risques Prioritaires": "Priority Risks",
  "Activité Récente": "Recent Activity",
  "Temps Réel": "Real Time",
  "Tous les systèmes opérationnels": "All systems operational",

  // settings
  "Paramètres IA": "AI Settings",
  "Sentinel AI & Confidentialité": "Sentinel AI & Privacy",
  "Activer Sentinel AI": "Enable Sentinel AI",
  "Permet l'utilisation des fonctionnalités d'intelligence artificielle pour l'analyse de risques et la génération de contenu.": "Enables AI features for risk analysis and content generation.",
  "Anonymisation des Données": "Data Anonymization",
  "Supprime automatiquement les noms, emails et numéros de téléphone avant l'envoi aux modèles IA.": "Automatically removes names, emails and phone numbers before sending to AI models.",
  "Consentement d'analyse": "Analysis Consent",
  "J'autorise Sentinel à traiter les données (anonymisées si activé) pour fournir des analyses.": "I authorize Sentinel to process data (anonymized if enabled) to provide analyses.",
  "Configuration globale de l'organisation et préférences utilisateur.": "Global organization configuration and user preferences.",

  // risks.treatment
  "Actions de traitement": "Treatment Actions",
  "Aucune action de traitement définie. Ajoutez des actions pour suivre la mise en oeuvre du plan.": "No treatment actions defined. Add actions to track treatment plan implementation.",
  "Ajouter une action": "Add action",
  "Modifier l'action": "Edit action",
  "Supprimer l'action": "Delete action",
  "Nouvelle action": "New action",
  "Titre": "Title",
  "Responsable": "Owner",
  "Échéance": "Deadline",
  "Non assigné": "Not assigned",
  "En retard": "Overdue",
  "Aujourd'hui": "Today",
  "Ex: Mettre à jour la politique de sécurité": "E.g., Update the security policy",
  "Décrivez l'action à réaliser...": "Describe the action to be performed...",

  // risks tabs
  "Contexte & Actifs": "Context & Assets",
  "Identification": "Identification",
  "Évaluation": "Assessment",
  "Traitement & Contrôles": "Treatment & Controls",

  // risks
  "Plus d'actions": "More actions",
  "Mes Risques": "My Risks",
  "Exporter Rapport": "Export Report",
  "Risques Financiers": "Financial Risk",
  "Référentiel": "Framework",
  "Tous les référentiels": "All Frameworks",
  "Lancer visite guidée": "Start guided tour",
  "Rapports & Exports": "Reports & Exports",
  "Données": "Data",
  "Modèles": "Templates",
  "Analyse IA": "AI Analysis",
  "Analyse en cours...": "Analyzing...",
  "Nouveau Risque": "New Risk",
  "Ouvert": "Open",
  "Pris en compte": "Processed",
  "Traité": "Treated",
  "Clôturé": "Closed",
  "Réduire": "Reduce",
  "Accepter": "Accept",
  "Éviter": "Avoid",
  "Transférer": "Transfer",
  "Hébergeur de Santé (HDS)": "Health Data Hosting (HDS)",

  // compliance
  "Contrôles (Annexe A)": "Controls (Annex A)",
  "Déclaration d'Applicabilité (DdA)": "Statement of Applicability (SoA)",
  "Lancer un Audit": "Launch Audit",
  "Nouveau Projet": "New Project",
  "Simulation d'Audit": "Audit simulation",
  "Projet de Mise en Conformité": "Compliance Project",
  "Mode Liaison": "Link Mode",
  "Exporter": "Export",
  "Télécharger la DdA ou la liste des contrôles.": "Download the SoA or control list.",
  "Cartographie": "Mapping",
  "Partagé": "Shared",
  "Dossier généré": "Dossier generated",
  "Dossier Preuves": "Evidence Dossier",
  "Génération...": "Generating...",
  "Rechercher un contrôle (code, nom...)": "Search for a control (code, name...)",
  "Preuves manquantes": "Missing evidence",

  // compliance.dashboard
  "Initialisation de la conformité...": "Initializing compliance...",
  "Aucun référentiel configuré. Cliquez sur le bouton ci-dessous pour initialiser les données.": "No framework configured. Click the button below to initialize data.",
  "Référentiel non initialisé": "Framework not initialized",
  "Les contrôles pour {{framework}} ne sont pas encore chargés.": "Controls for {{framework}} are not yet loaded.",
  "Initialiser le référentiel {{framework}}": "Initialize {{framework}} framework",
  "Initialisation des données de base ISO 27001 (Mesures Annex A)...": "Initializing ISO 27001 baseline data (Annex A Controls)...",
  "Erreur lors de l'initialisation": "Error during initialization",
  "Données initialisées avec succès": "Data initialized successfully",
  "Alertes": "Alerts",
  "Score {{framework}}": "{{framework}} Score",
  "Conformité moyenne": "Average compliance",
  "vs 30j": "vs 30d",
  "Distribution par Statut": "Status Distribution",
  "Conformité par Domaine": "Compliance by Domain",
  "Vue Radar - Maturité par Domaine": "Radar View - Maturity by Domain",
  "Contrôles Critiques à Implémenter": "Critical Controls to Implement",
  "Détail par Domaine {{framework}}": "{{framework}} Domain Detail",
  "Non commencé": "Not started",
  "Taux %": "Rate %",
  "conformité": "compliance",
  "Excellent niveau de conformité.": "Excellent compliance level.",
  "Niveau acceptable, continuez les efforts.": "Acceptable level, keep up the efforts.",
  "Actions correctives prioritaires requises.": "Priority corrective actions required.",

  // compliance.assessment
  "Évaluation d'efficacité": "Effectiveness Assessment",
  "Contrôle": "Control",
  "Score d'efficacité": "Effectiveness score",
  "Méthode d'évaluation": "Assessment method",
  "Notes / Observations": "Notes / Observations",
  "Observations et constats de l'évaluation...": "Assessment observations and findings...",
  "Prochaine évaluation": "Next assessment",
  "Enregistrement...": "Saving...",
  "Revue documentaire": "Document review",
  "Entretien": "Interview",
  "Test technique": "Technical test",
  "Observation": "Observation",
  "Audit interne": "Internal audit",

  // smsi
  "Nouveau Programme": "New Program",
  "Détails du Programme": "Program Details",
  "Date Cible": "Target Date",

  // sidebar
  "Politiques des Agents": "Agent Policies",
  "Inventaire Logiciel": "Software Inventory",

  // system health
  "Santé du Système": "System Health",
  "État des services et métriques de performance.": "Service status and performance metrics.",
  "Opérationnel": "Operational",
  "État des Services": "Service Status",
  "Alertes Récentes": "Recent Alerts",
  "Utilisateurs Actifs": "Active Users",
  "Total Comptes": "Total Accounts",
  "Charge Système": "System Load",
  "CPU": "CPU",
  "Mémoire": "Memory",
  "RAM Allouée": "Allocated RAM",
  "Latence": "Latency",
  "Ping Global": "Global Ping",
  "Latence Réseau Élevée": "High Network Latency",
  "Pic de latence > 300ms détecté sur le cluster principal.": "Latency spike > 300ms detected on main cluster.",
  "Il y a 2 heures": "2 hours ago",
  "Sauvegarde Terminée": "Backup Complete",
  "La sauvegarde journalière a été effectuée avec succès.": "Daily backup completed successfully.",
  "Il y a 4 heures": "4 hours ago",

  // riskContext
  "Contexte de Risque": "Risk Context",
  "Définition du périmètre et des critères d'impact.": "Scope definition and impact criteria.",
  "Contexte, Périmètre, Critères, Impact, Vraisemblance": "Context, Scope, Criteria, Impact, Likelihood",

  // audits
  "Assigner un Partenaire": "Assign a Partner",
  "Planifiez et réalisez vos audits de conformité (Interne, Externe, Fournisseur).": "Plan and conduct your compliance audits (Internal, External, Supplier).",
  "Pilotage des Audits": "Audit Orchestration",
  "Supervisez le programme d'audit annuel et les résultats.": "Supervise the annual audit program and results.",
  "Synthèse des Audits": "Audit Summary",
  "Suivi des certifications, conformité et points majeurs.": "Track certifications, compliance and major findings.",

  // audits form templates
  "Vérification de conformité annuelle sur le périmètre complet.": "Annual compliance verification on the full scope.",
  "Évaluation de sécurité d'un hébergeur de données de santé.": "Security assessment of a health data hosting provider.",
  "Revue trimestrielle des comptes à privilèges.": "Quarterly review of privileged accounts.",

  // audits.findingsSection.form
  "Description du constat": "Finding description",
  "Détails de l'observation...": "Observation details...",
  "Non-conformité": "Non-conformity",
  "Opportunité": "Opportunity",
  "Non-Conformité Majeure": "Major Non-Conformity",
  "Non-Conformité Mineure": "Minor Non-Conformity",
  "Critique": "Critical",
  "Élevée": "High",
  "Moyenne": "Medium",
  "Faible": "Low",

  // ebios workshop1
  "Importer depuis l'inventaire": "Import from inventory",

  // suppliers
  "Retour au tableau de bord": "Back to dashboard",
  "Retour": "Back",
  "Éditeur de Modèle de Questionnaire": "Questionnaire Template Editor",
  "Ajouter un nouveau tiers": "Add a new third party",
  "Gérer les modèles d'évaluation": "Manage assessment templates",
  "Vue DORA des fournisseurs ICT": "DORA view of ICT suppliers",
  "Ajouter un nouveau fournisseur": "Add a new supplier",
  "Registre DORA": "DORA Register",
  "Contact": "Contact",
  "Sécurité": "Security",
  "Contrat & Documents": "Contract & Documents",
  "Aucun document lié": "No linked document",
  "Statut DORA": "DORA Status",
  "Profil de Risque": "Risk Profile",
  "Nouvelle Évaluation": "New Assessment",
  "Évaluations Terminées": "Completed Assessments",
  "Aucun modèle de questionnaire disponible. Créez-en un dans l'onglet Modèles.": "No questionnaire template available. Create one in the Templates tab.",
  "Fournisseurs à Auditer": "Suppliers to Audit",
  "Vue d'ensemble": "Overview",
  "Fournisseurs": "Suppliers",
  "Concentration": "Concentration",

  // projects
  "Créer Projet": "Create Project",
  "Créer depuis un modèle": "Create from template",
  "Tableau de bord": "Dashboard",
  "Liste": "List",
  "Chargement...": "Loading...",
  "Export_Projets": "Sentinel_Projects_Export",
  "Suspendu": "Suspended",
  "Tableau Kanban": "Kanban Board",
  "En Cours": "In Progress",
  "Terminé": "Done",
  "À Faire": "To Do",
  "Modifier le projet": "Edit project",
  "Supprimer le projet": "Delete project",
  "Projet créé avec succès": "Project created successfully",
  "Rapport généré": "Report generated",
  "Erreur lors de la génération": "Error generating report",
  "Une erreur est survenue": "An error occurred",
  "Détails et suivi du projet.": "Project details and tracking.",

  // notifications
  "Centre d'alertes et de messages.": "Alert and message center.",
  "Tout marquer comme lu": "Mark all as read",
  "Voir détails": "View details",
  "Rechercher...": "Search...",
  "Toutes": "All",
  "Non lues": "Unread",
  "Aucune notification": "No notifications",
  "Vous n'avez pas de nouvelles notifications.": "You have no new notifications.",
  "Aucune notification trouvée.": "No notifications found."
};

function translateValue(frVal, path) {
  // If it's an array, keep as-is or translate each
  if (Array.isArray(frVal)) {
    return frVal; // Keep arrays as-is (they're usually specific like CSV headers)
  }

  // Check dictionary
  if (typeof frVal === 'string' && dict[frVal]) {
    return dict[frVal];
  }

  // For non-string values, return as-is
  if (typeof frVal !== 'string') {
    return frVal;
  }

  // Smart auto-translation for common patterns
  let val = frVal;

  // Very common simple translations
  const simpleMap = {
    "Oui": "Yes",
    "Non": "No",
    "Enregistrer": "Save",
    "Annuler": "Cancel",
    "Supprimer": "Delete",
    "Modifier": "Edit",
    "Créer": "Create",
    "Fermer": "Close",
    "Retour": "Back",
    "Suivant": "Next",
    "Précédent": "Previous",
    "Valider": "Validate",
    "Confirmer": "Confirm",
    "Exporter": "Export",
    "Importer": "Import",
    "Actualiser": "Refresh",
    "Rechercher": "Search",
    "Ajouter": "Add",
    "Charger": "Load",
    "Appliquer": "Apply",
    "Envoyer": "Send",
    "Télécharger": "Download",
    "Succès": "Success",
    "Erreur": "Error"
  };

  if (simpleMap[val]) {
    return simpleMap[val];
  }

  // Return the French value as-is (we'll handle specific translations in the merged output)
  // This is for keys we couldn't auto-translate - we'll manually fill them in the final output
  return val;
}

// Perform the merge
const merged = deepMerge(fr, en, '');

// Count to verify
function countKeys2(obj) {
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      count += countKeys2(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}

console.log('FR keys:', countKeys2(fr));
console.log('EN keys (before):', countKeys2(en));
console.log('EN keys (after merge):', countKeys2(merged));

// Find what was added
const missing = findMissing(fr, en, '');
console.log('\nAdded', missing.length, 'missing keys');
console.log('\nMissing keys:');
for (const m of missing) {
  console.log('  ' + m.key);
}

// Write the merged file
fs.writeFileSync('public/locales/en/translation.json', JSON.stringify(merged, null, 2) + '\n', 'utf8');
console.log('\nMerged file written to public/locales/en/translation.json');
