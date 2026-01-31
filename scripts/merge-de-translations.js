#!/usr/bin/env node
/**
 * Script to merge missing French translation keys into the German translation file
 * with proper German translations for Sentinel GRC v2.
 */

const fs = require('fs');
const path = require('path');

const FR_PATH = path.join(__dirname, '..', 'public', 'locales', 'fr', 'translation.json');
const DE_PATH = path.join(__dirname, '..', 'public', 'locales', 'de', 'translation.json');

const fr = JSON.parse(fs.readFileSync(FR_PATH, 'utf8'));
const de = JSON.parse(fs.readFileSync(DE_PATH, 'utf8'));

// Comprehensive French -> German translation map for GRC/Cybersecurity context
const translations = {
  // Common UI
  "Tous": "Alle",
  "Enregistrer": "Speichern",
  "Suivant": "Weiter",
  "Précédent": "Zurück",
  "Annuler": "Abbrechen",
  "Quitter": "Beenden",
  "Supprimer": "Löschen",
  "Modifier": "Bearbeiten",
  "Créer": "Erstellen",
  "Rechercher": "Suchen",
  "Fermer": "Schließen",
  "Retour": "Zurück",
  "Actualiser": "Aktualisieren",
  "Exporter": "Exportieren",
  "Importer": "Importieren",
  "Voir": "Ansehen",
  "Détails": "Details",
  "Ouvrir": "Öffnen",
  "Copier": "Kopieren",
  "Réessayer": "Erneut versuchen",
  "Confirmer": "Bestätigen",
  "Terminé": "Erledigt",
  "Plus...": "Mehr...",
  "Filtres": "Filter",
  "Gérer": "Verwalten",
  "Oui": "Ja",
  "Non": "Nein",
  "Planifier": "Planen",
  "Configurer": "Konfigurieren",
  "Générer": "Generieren",
  "Télécharger": "Herunterladen",

  // Status
  "Actif": "Aktiv",
  "Inactif": "Inaktiv",
  "En cours": "In Bearbeitung",
  "Terminé": "Abgeschlossen",
  "Brouillon": "Entwurf",
  "Publié": "Veröffentlicht",
  "Approuvé": "Genehmigt",
  "En Revue": "In Überprüfung",
  "Expiré": "Abgelaufen",
  "Nouveau": "Neu",
  "Ouvert": "Offen",
  "Fermé": "Geschlossen",
  "Résolu": "Gelöst",
  "Planifié": "Geplant",
  "Validé": "Validiert",
  "Suspendu": "Ausgesetzt",

  // Severity
  "Critique": "Kritisch",
  "Élevé": "Hoch",
  "Élevée": "Hoch",
  "Moyen": "Mittel",
  "Moyenne": "Mittel",
  "Faible": "Niedrig",
  "Basse": "Niedrig",

  // GRC Terms
  "Risques": "Risiken",
  "Risque": "Risiko",
  "Conformité": "Compliance",
  "Audit": "Audit",
  "Audits": "Audits",
  "Incidents": "Vorfälle",
  "Incident": "Vorfall",
  "Contrôles": "Kontrollen",
  "Contrôle": "Kontrolle",
  "Fournisseurs": "Lieferanten",
  "Fournisseur": "Lieferant",
  "Documents": "Dokumente",
  "Document": "Dokument",
  "Actifs": "Assets",
  "Actif": "Asset",
  "Projets": "Projekte",
  "Projet": "Projekt",
  "Menaces": "Bedrohungen",
  "Menace": "Bedrohung",
  "Vulnérabilités": "Schwachstellen",
  "Vulnérabilité": "Schwachstelle",

  // Roles
  "Administrateur": "Administrator",
  "Auditeur": "Auditor",
  "Utilisateur": "Benutzer",
  "Direction": "Geschäftsführung",
  "Chef de Projet": "Projektleiter",

  // Module names
  "Tableau de Bord": "Dashboard",
  "Tableau de bord": "Dashboard",
  "Paramètres": "Einstellungen",
  "Organisation": "Organisation",
  "Équipe": "Team",
  "Formation": "Schulung",
  "Continuité": "Kontinuität",
  "Gouvernance": "Governance",
};

// A function to translate French text to German
// Uses the dictionary and pattern matching
function translateFrToDE(frValue, key) {
  if (typeof frValue !== 'string') return frValue;

  // Direct dictionary match
  if (translations[frValue]) return translations[frValue];

  // Key-based translations for specific paths
  return translateByKey(frValue, key);
}

// Translate based on key path context
function translateByKey(frValue, keyPath) {
  // This is the main translation function
  // We return null to indicate "no translation found, use auto-translate"
  return null;
}

// Deep merge: for each key in source, if missing in target, add translated value
function deepMerge(source, target, keyPath = '') {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const fullKey = keyPath ? `${keyPath}.${key}` : key;

    if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
      if (typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
        result[key] = deepMerge(source[key], result[key], fullKey);
      } else if (result[key] === undefined) {
        // Entire section missing - translate it
        result[key] = translateObject(source[key], fullKey);
      }
    } else if (result[key] === undefined) {
      // Leaf value missing
      result[key] = translateValue(source[key], fullKey);
    }
  }

  return result;
}

function translateObject(obj, keyPath) {
  if (typeof obj !== 'object' || obj === null) {
    return translateValue(obj, keyPath);
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => translateValue(item, `${keyPath}[${i}]`));
  }
  const result = {};
  for (const key of Object.keys(obj)) {
    const fullKey = `${keyPath}.${key}`;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      result[key] = translateObject(obj[key], fullKey);
    } else {
      result[key] = translateValue(obj[key], fullKey);
    }
  }
  return result;
}

// The massive translation function that handles all keys
function translateValue(frValue, keyPath) {
  if (typeof frValue !== 'string') return frValue;

  // Check the comprehensive key-based translation map
  const deValue = KEY_TRANSLATIONS[keyPath];
  if (deValue !== undefined) return deValue;

  // Try direct dictionary
  if (translations[frValue]) return translations[frValue];

  // Fallback: return French with a marker (should not happen if map is complete)
  return frValue;
}

// ============================================================
// COMPREHENSIVE KEY-BASED TRANSLATIONS
// ============================================================
const KEY_TRANSLATIONS = {
  // ---- common ----
  "common.next": "Weiter",
  "common.previous": "Zurück",
  "common.exit": "Beenden",
  "common.importCsv": "CSV importieren",
  "common.documents": "Dokumentation",
  "common.system-health": "Systemzustand",
  "common.team": "Team",
  "common.compliance": "Compliance",
  "common.smsi": "ISMS",
  "common.continuity": "Kontinuität",
  "common.training": "Schulung & Sensibilisierung",
  "common.retry": "Erneut versuchen",
  "common.back": "Zurück",
  "common.closeMenu": "Menü schließen",
  "common.active": "Aktiv",
  "common.close": "Schließen",
  "common.agents": "Agenten",
  "common.threat-intelligence": "Threat Intelligence",
  "common.controls": "Kontrollen",
  "common.vulnerability": "Schwachstelle",
  "common.pricing": "Pläne & Preise",

  // common.settings sub-keys (under common namespace)
  "common.settings.website": "Webseite",
  "common.settings.profile": "Mein Profil",
  "common.settings.activity": "Aktivitätsprotokoll",
  "common.settings.security": "Sicherheit & Anmeldung",
  "common.settings.securityDesc": "Verwalten Sie Ihre Authentifizierungsmethoden und sichere Sitzungen.",
  "common.settings.frameworks": "Frameworks",
  "common.settings.partners": "Partner",
  "common.settings.integrations": "Integrationen",
  "common.settings.ssoDescription": "Unternehmens-Authentifizierung (SAML/OIDC)",
  "common.settings.centralizeAccess": "Zugang zentralisieren",
  "common.settings.ssoExplanation": "Verbinden Sie Sentinel GRC mit Ihrem bestehenden Identitätsanbieter, um die Anmeldung zu vereinfachen.",
  "common.settings.enableSSO": "SSO aktivieren",
  "common.settings.passwordChanged": "Passwort erfolgreich geändert",
  "common.settings.reloginRequired": "Bitte melden Sie sich erneut an",
  "common.settings.mfaEnabled": "Zwei-Faktor-Authentifizierung aktiviert",
  "common.settings.mfaDisabled": "Zwei-Faktor-Authentifizierung deaktiviert",
  "common.settings.changePassword": "Passwort ändern",
  "common.settings.newPassword": "Neues Passwort",
  "common.settings.confirmPassword": "Passwort bestätigen",
  "common.settings.securityPage.mfaTitle": "Zwei-Faktor-Authentifizierung (MFA)",
  "common.settings.securityPage.mfaDesc": "Sichern Sie Ihr Konto mit einer zweiten Authentifizierungsmethode.",
  "common.settings.securityPage.enableMfa": "MFA aktivieren",
  "common.settings.securityPage.disableMfa": "MFA deaktivieren",
  "common.settings.securityPage.scanQr": "Scannen Sie diesen QR-Code",
  "common.settings.securityPage.verifyCode": "Verifizierungscode",
  "common.settings.securityPage.cancel": "Abbrechen",
  "common.settings.securityPage.verify": "Verifizieren",
  "common.settings.photoUpdated": "Profilbild aktualisiert",
  "common.settings.hibpKeyRequired": "HIBP API-Schlüssel erforderlich",
  "common.settings.noBreachesFound": "Keine Datenlecks gefunden",
  "common.settings.breachesFound": "{count} Datenlecks gefunden",
  "common.settings.hibpError": "Fehler bei der Überprüfung auf Datenlecks",
  "common.settings.profileUpdated": "Profil aktualisiert",
  "common.settings.accountDeleted": "Konto gelöscht",
  "common.settings.profilePhoto": "Profilbild",
  "common.settings.photoRequirements": "JPG, PNG oder GIF. Max. 5 MB.",
  "common.settings.personalInfo": "Persönliche Informationen",
  "common.settings.personalInfoDesc": "Verwalten Sie Ihre Identitätsinformationen.",
  "common.settings.displayName": "Anzeigename",
  "common.settings.email": "E-Mail",
  "common.settings.department": "Abteilung",
  "common.settings.notifications": "Benachrichtigungen",
  "common.settings.notificationsDesc": "Wählen Sie, wie Sie benachrichtigt werden möchten.",
  "common.settings.notificationsChannels.email": "E-Mail",
  "common.settings.notificationsChannels.push": "Push-Benachrichtigung",
  "common.settings.notificationsChannels.inApp": "In der App",
  "common.settings.apiKeys": "API-Schlüssel",
  "common.settings.private": "Privat",
  "common.settings.frameworksTitle": "Compliance-Frameworks",
  "common.settings.frameworksDescription": "Wählen Sie die Frameworks aus, die Ihre Organisation einhalten muss.",
  "common.settings.frameworkLimitReached": "Framework-Limit für Ihren Plan erreicht.",
  "common.settings.frameworksUpdated": "Frameworks erfolgreich aktualisiert",

  // common.statuses
  "common.statuses.all": "Alle Status",
  "common.statuses.notStarted": "Nicht begonnen",
  "common.statuses.inProgress": "In Bearbeitung",
  "common.statuses.partial": "Teilweise",
  "common.statuses.implemented": "Implementiert",
  "common.statuses.notApplicable": "Nicht anwendbar",

  // ---- admin ----
  "admin.dashboard": "Super-Admin-Dashboard",
  "admin.subtitle": "Gesamtübersicht der Sentinel GRC-Instanz, Organisationsverwaltung und Wartung.",
  "admin.accessDenied": "Zugriff verweigert",
  "admin.accessDeniedDesc": "Sie haben keine Super-Admin-Rechte.",
  "admin.stats.orgs": "Organisationen",
  "admin.stats.users": "Gesamte Benutzer",
  "admin.stats.health": "Systemzustand",
  "admin.stats.operational": "Betriebsbereit",
  "admin.orgs.title": "Organisationen",
  "admin.orgs.searchPlaceholder": "Organisation suchen...",
  "admin.orgs.name": "Name",
  "admin.orgs.plan": "Plan",
  "admin.orgs.created": "Erstellt am",
  "admin.orgs.actions": "Aktionen",
  "admin.orgs.manage": "Verwalten",
  "admin.orgs.switching": "Wechsel...",
  "admin.toast.switchSuccess": "Zu {name} gewechselt",
  "admin.toast.switchError": "Organisationswechsel fehlgeschlagen",

  // ---- ai ----
  "ai.prompts.explain": "Erklären Sie die ISO 27001-Maßnahme \"{{code}} - {{name}}\" einfach und konkret für ein KMU. Geben Sie Anwendungsbeispiele.",
  "ai.prompts.evidence": "Welche Nachweise (Dokumente, Logs, Screenshots) werden typischerweise von einem Auditor für die Maßnahme \"{{code}} - {{name}}\" erwartet? Listen Sie diese als Aufzählungspunkte auf.",
  "ai.prompts.policy": "Verfassen Sie einen prägnanten Absatz einer Sicherheitsrichtlinie zur Maßnahme \"{{code}} - {{name}}\". Der Ton soll formal sein.",

  // ---- calendar ----
  "calendar.title": "Kalender",
  "calendar.subtitle": "Planung von Audits, Überprüfungen und regulatorischen Fristen.",
  "calendar.keywords": "Kalender, Planung, Audit, Fristen, ISO 27001",

  // ---- certifier ----
  "certifier.portalTitle": "Auditor-Portal",
  "certifier.portalSubtitle": "Melden Sie sich an, um Ihre Audits und Zertifizierungen zu verwalten",
  "certifier.emailLabel": "Geschäftliche E-Mail",
  "certifier.passwordLabel": "Passwort",
  "certifier.loginButton": "Anmelden",
  "certifier.newPartner": "Neuer Partner?",
  "certifier.registerLink": "Meine Zertifizierungsstelle registrieren",
  "certifier.registerTitle": "Partner werden",
  "certifier.registerSubtitle": "Registrieren Sie Ihre Organisation, um mit Ihren Kunden zusammenzuarbeiten",
  "certifier.orgNameLabel": "Organisationsname",
  "certifier.siretLabel": "Handelsregisternummer",
  "certifier.confirmPasswordLabel": "Bestätigung",
  "certifier.registerButton": "Registrieren",
  "certifier.alreadyRegistered": "Bereits registriert?",
  "certifier.loginLink": "Anmelden",
  "certifier.dashboard.title": "Sentinel Certifier",
  "certifier.dashboard.role": "Leitender Auditor",
  "certifier.dashboard.activeClients": "Aktive Kunden",
  "certifier.dashboard.activeAudits": "Laufende Audits",
  "certifier.dashboard.certifiedAudits": "Zertifizierte Audits",
  "certifier.dashboard.assignedAudits": "Zugewiesene Audits",
  "certifier.dashboard.searchPlaceholder": "Audit suchen...",
  "certifier.dashboard.noAudits": "Derzeit keine zugewiesenen Audits.",
  "certifier.dashboard.myClients": "Meine Kunden",
  "certifier.dashboard.noClients": "Keine Partnerkunden.",
  "certifier.dashboard.inviteClient": "+ Kunden zur Zusammenarbeit einladen",
  "certifier.partners.title": "Zertifizierungspartner",
  "certifier.partners.description": "Verwalten Sie Ihre Beziehungen zu externen Zertifizierungsstellen.",
  "certifier.partners.inviteButton": "Partner einladen",
  "certifier.partners.noPartners": "Keine Partner",
  "certifier.partners.noPartnersDesc": "Laden Sie Ihren Auditor oder Ihre Zertifizierungsstelle zur Zusammenarbeit ein.",
  "certifier.partners.activePartner": "Aktiver Partner",
  "certifier.partners.pendingInvite": "Ausstehende Einladung",
  "certifier.partners.resendInvite": "Einladung erneut senden",
  "certifier.partners.modalTitle": "Organisation einladen",
  "certifier.partners.emailPlaceholder": "auditor@tuev.de",
  "certifier.partners.inviteHelp": "Eine E-Mail mit einem Link zur Erstellung ihres Certifier-Kontos und zum Beitritt zu Ihrem Ökosystem wird gesendet.",
  "certifier.partners.cancel": "Abbrechen",
  "certifier.partners.send": "Einladung senden",
  "certifier.portal.loading": "Sicherer Zugang wird überprüft...",
  "certifier.portal.accessDenied": "Zugriff verweigert",
  "certifier.portal.invalidLink": "Der Zugangslink ist ungültig oder abgelaufen.",
  "certifier.portal.contactAdmin": "Wenn Sie glauben, dass dies ein Fehler ist, wenden Sie sich an den Administrator, der Sie eingeladen hat.",
  "certifier.portal.defaultError": "Zugriff verweigert oder Link abgelaufen",
  "certifier.portal.invitedAs": "Eingeladen als:",
  "certifier.portal.validation_residual_error": "Das Restrisiko kann nicht größer als das inhärente Risiko sein.",
  "certifier.portal.tabs.overview": "Übersicht",
  "certifier.portal.tabs.findings": "Feststellungen",
  "certifier.portal.tabs.evidence": "Nachweise",
  "certifier.portal.tabs.certification": "Zertifizierung",
  "certifier.portal.overview.scope": "Audit-Umfang",
  "certifier.portal.overview.defaultScope": "Das gesamte Informationssicherheits-Managementsystem (ISMS) ist im Geltungsbereich enthalten, einschließlich der HR-, IT-Prozesse und der Büroräume.",
  "certifier.portal.overview.refDocs": "Referenzdokumente",
  "certifier.portal.overview.docs.pssi": "Informationssicherheitsrichtlinie (ISP)",
  "certifier.portal.overview.docs.charter": "IT-Nutzungsrichtlinie",
  "certifier.portal.overview.docs.gdpr": "Verarbeitungsverzeichnis (DSGVO)",
  "certifier.portal.findings.title": "Feststellungsregister",
  "certifier.portal.findings.new": "+ Neue Feststellung",
  "certifier.portal.findings.empty": "Bisher keine Feststellungen erfasst",
  "certifier.portal.evidence.title": "Maßnahmen & Nachweise",
  "certifier.portal.evidence.subtitle": "Überprüfen Sie die diesem Audit zugeordneten Nachweise, um die Maßnahmen zu validieren.",
  "certifier.portal.evidence.download": "Herunterladen",
  "certifier.portal.evidence.empty": "Keine Nachweise verfügbar.",
  "certifier.portal.evidence.defaultCategory": "Dokumentation",

  // ---- commandPalette ----
  "commandPalette.actions.declareIncident": "Vorfall melden",
  "commandPalette.actions.declareIncidentSub": "Neue Sicherheitswarnung erstellen",
  "commandPalette.actions.addAsset": "Asset hinzufügen",
  "commandPalette.actions.addAssetSub": "Neue Hardware oder Software erfassen",
  "commandPalette.actions.newRisk": "Neues Risiko",
  "commandPalette.actions.newRiskSub": "Neue Bedrohung identifizieren",
  "commandPalette.actions.inviteUser": "Benutzer einladen",
  "commandPalette.actions.inviteUserSub": "Teammitglied hinzufügen",
  "commandPalette.actions.planAudit": "Audit planen",
  "commandPalette.actions.planAuditSub": "Neues Compliance-Audit erstellen",
  "commandPalette.categories.navigation": "Navigation",
  "commandPalette.categories.actions": "Aktionen",
  "commandPalette.categories.recent": "Kürzlich",
  "commandPalette.categories.compliance": "Compliance",
  "commandPalette.categories.management": "Verwaltung",
  "commandPalette.categories.alerts": "Warnungen",
  "commandPalette.categories.global": "Global",

  // ---- dashboard ----
  "dashboard.widgetCategories.scoreKpi": "Kennzahlen & Scores",
  "dashboard.widgetCategories.risks": "Risiken",
  "dashboard.widgetCategories.actions": "Aktionen",
  "dashboard.widgetCategories.audits": "Audits",
  "dashboard.widgetCategories.other": "Sonstiges",
  "dashboard.statsOverview": "Gesamtübersicht der Schlüsselkennzahlen",
  "dashboard.maturityRadar": "Reifegrad nach Bereich",
  "dashboard.complianceProgress": "Compliance-Fortschritt",
  "dashboard.nis2doraConfig": "NIS2/DORA-Konfiguration",
  "dashboard.executiveKpi": "Executive KPIs",
  "dashboard.rssiCriticalRisks": "Kritische CISO-Risiken",
  "dashboard.rssiActions": "CISO-Maßnahmen",
  "dashboard.pmActionsOverdue": "Überfällige Maßnahmen",
  "dashboard.pmTimeline": "Zeitplan",
  "dashboard.pmProgress": "Fortschritt",
  "dashboard.cyberNews": "Cyber-Nachrichten",
  "dashboard.incidentsStats": "Vorfallstatistiken",
  "dashboard.documentsStats": "Dokumentenstatistiken",
  "dashboard.assetStats": "Asset-Statistiken",
  "dashboard.suppliersStats": "Lieferantenstatistiken",
  "dashboard.continuityPlans": "Kontinuitätspläne",
  "dashboard.rssiIncidents": "CISO-Vorfälle",
  "dashboard.agentMaturityRadar": "Agenten-Flottenreife",
  "dashboard.agentMaturity.compliance": "Compliance",
  "dashboard.agentMaturity.availability": "Verfügbarkeit",
  "dashboard.agentMaturity.modernity": "Modernität",
  "dashboard.agentMaturity.health": "Systemzustand",
  "dashboard.agentMaturity.monitoring": "Überwachung",
  "dashboard.agentMaturity.fleetMaturity": "Flottenreife Agenten",
  "dashboard.widgets.stats-overview.description": "Gesamtübersicht der Schlüsselkennzahlen.",
  "dashboard.widgets.my-workspace.description": "Ihre Aufgaben und sofortigen Aktionen.",
  "dashboard.widgets.compliance-evolution.description": "Compliance-Entwicklung im Zeitverlauf.",
  "dashboard.widgets.health-check.description": "Gesamter Systemzustand.",
  "dashboard.widgets.priority-risks.description": "Fokus auf die kritischsten Risiken.",
  "dashboard.widgets.recent-activity.description": "Letzte Aktionen auf der Plattform.",
  "dashboard.widgets.maturity-radar.description": "Reifegrad nach Bereich.",
  "dashboard.widgets.cyber-news.description": "Cybersicherheits-Nachrichtenfeed.",
  "dashboard.widgets.risk-heatmap.description": "Risikomatrix (Auswirkung x Wahrscheinlichkeit).",
  "dashboard.widgets.audits-donut.description": "Auditverteilung nach Status.",
  "dashboard.widgets.project-tasks.description": "Fortschritt der Projektaufgaben.",
  "dashboard.widgets.incidents-stats.description": "Metriken zu Sicherheitsvorfällen.",
  "dashboard.widgets.documents-stats.description": "Status der Dokumentenbasis.",
  "dashboard.widgets.compliance-progress.description": "Fortschritt der Compliance-Umsetzung.",
  "dashboard.widgets.asset-stats.description": "Verteilung und Kritikalität der Assets.",
  "dashboard.widgets.suppliers-stats.description": "Lieferantenüberwachung und Compliance.",
  "dashboard.widgets.continuity-plans.description": "Status der Kontinuitätspläne und Übungen.",
  "dashboard.widgets.system-health.description": "Gesamter Systemzustand.",
  "dashboard.widgets.nis2-dora-kpi.description": "NIS2- und DORA-Standards-Konfiguration.",
  "dashboard.widgets.compliance-score.description": "Gesamter Compliance-Score.",
  "dashboard.widgets.executive-kpi.description": "Executive KPIs für die Geschäftsführung.",
  "dashboard.widgets.rssi-critical-risks.description": "Fokus auf kritische CISO-Risiken.",
  "dashboard.widgets.rssi-incidents.description": "Aktuelle Sicherheitsvorfälle.",
  "dashboard.widgets.rssi-actions.description": "Prioritäre CISO-Maßnahmen.",
  "dashboard.widgets.pm-actions-overdue.description": "Liste überfälliger Projektmaßnahmen.",
  "dashboard.widgets.pm-timeline.description": "Zeitplan laufender Projekte.",
  "dashboard.widgets.pm-progress.description": "Gesamtfortschritt der Projekte.",
  "dashboard.widgets.agent-maturity-radar.description": "360°-Ansicht des Reifegrads und Zustands der Agenten-Flotte.",
  "dashboard.actions.USERS_CREATE": "Benutzer erstellt",
  "dashboard.actions.USERS_UPDATE": "Benutzer aktualisiert",
  "dashboard.actions.USERS_DELETE": "Benutzer gelöscht",
  "dashboard.actions.ASSET_CREATE": "Asset erstellt",
  "dashboard.actions.ASSET_UPDATE": "Asset aktualisiert",
  "dashboard.actions.ASSET_DELETE": "Asset gelöscht",
  "dashboard.actions.RISK_CREATE": "Risiko erstellt",
  "dashboard.actions.RISK_UPDATE": "Risiko aktualisiert",
  "dashboard.actions.RISK_DELETE": "Risiko gelöscht",
  "dashboard.actions.INCIDENT_CREATE": "Vorfall gemeldet",
  "dashboard.actions.INCIDENT_UPDATE": "Vorfall aktualisiert",
  "dashboard.actions.INCIDENT_CLOSE": "Vorfall geschlossen",
  "dashboard.actions.CONTROL_UPDATE": "Kontrolle aktualisiert",
  "dashboard.actions.CONTROLS_UPDATE": "Kontrollen aktualisiert",
  "dashboard.greetingMorning": "Guten Morgen",
  "dashboard.greetingAfternoon": "Guten Nachmittag",
  "dashboard.greetingEvening": "Guten Abend",
  "dashboard.greetingNight": "Gute Nacht",
  "dashboard.stepOrg": "Organisation",
  "dashboard.stepTeam": "Team",
  "dashboard.stepAsset": "Assets",
  "dashboard.stepRisk": "Risiken",
  "dashboard.stepControl": "Kontrollen",
  "dashboard.stepControls": "Kontrollen",
  "dashboard.stepPolicy": "Richtlinien",
  "dashboard.stepPolicies": "Richtlinien",
  "dashboard.stepAudit": "Audits",
  "dashboard.gettingStarted": "Erste Schritte",
  "dashboard.gettingStartedTitle": "Willkommen bei Sentinel",
  "dashboard.gettingStartedSubtitle": "Folgen Sie diesen Schritten, um Ihre Governance einzurichten.",
  "dashboard.gettingStartedTip": "Tipp: Beginnen Sie mit der Definition Ihres Organisationsprofils.",
  "dashboard.showGettingStarted": "Erste-Schritte-Anleitung anzeigen",
  "dashboard.setupProgress": "Einrichtungsfortschritt",
  "dashboard.insightRisks": "Kritische Risiken",
  "dashboard.insightRisksDesc": "Schlüsselindikatoren der Exposition.",
  "dashboard.insightAudits": "Überfällige Audits",
  "dashboard.insightAuditsDesc": "Audits, die Aufmerksamkeit erfordern.",
  "dashboard.insightCompliance": "Niedriger Score",
  "dashboard.insightComplianceDesc": "Aktueller Score unter dem Ziel.",
  "dashboard.insightContracts": "Abgelaufene Verträge",
  "dashboard.insightContractsDesc": "Verträge nahe dem Ablaufdatum.",
  "dashboard.insightDocs": "Abgelaufene Dokumente",
  "dashboard.insightDocsDesc": "Zu überprüfende Dokumente.",
  "dashboard.insightFinancial": "Finanzielles Risiko",
  "dashboard.insightFinancialDesc": "Geschätzter potenzieller Verlust: {{amount}}",
  "dashboard.insightIncidents": "Aktive Vorfälle",
  "dashboard.insightIncidentsDesc": "{{count}} laufende Vorfälle.",
  "dashboard.insightSuppliers": "Kritische Lieferanten",
  "dashboard.insightSuppliersDesc": "{{count}} zu bewertende Lieferanten.",
  "dashboard.insightStable": "Systeme stabil",
  "dashboard.actionsRequired": "Erforderliche Maßnahmen",
  "dashboard.accessDenied": "Zugriff verweigert",
  "dashboard.selectPeriod": "Zeitraum auswählen",
  "dashboard.welcomeTitle_admin": "Willkommen zurück",
  "dashboard.welcomeTitle_user": "Willkommen zurück",
  "dashboard.welcomeSubtitle1_admin": "Hier ist Ihre Governance-Übersicht.",
  "dashboard.welcomeSubtitle1_user": "Hier ist Ihre Aktivitätsübersicht.",
  "dashboard.createAsset": "Asset erstellen",
  "dashboard.createAssetDesc": "Neues Asset erfassen.",
  "dashboard.createAssetDesc_rssi": "Kritisches Asset erfassen.",
  "dashboard.configureControls": "Kontrollen konfigurieren",
  "dashboard.configureControlsDesc": "Sicherheitsmaßnahmen verwalten.",
  "dashboard.addDocuments": "Dokumente hinzufügen",
  "dashboard.addDocumentsDesc": "Richtlinien oder Verfahren importieren.",
  "dashboard.operationalSystem": "System betriebsbereit",
  "dashboard.executiveReport": "Executive-Bericht",
  "dashboard.exportIcal": "Kalender exportieren",
  "dashboard.dbLocked": "Datenbank gesperrt. Kopieren Sie die Regeln.",
  "dashboard.copyRules": "Regeln kopieren",
  "dashboard.rulesCopied": "Regeln kopiert!",
  "dashboard.progression": "Fortschritt",
  "dashboard.activeIncidents": "Aktive Vorfälle",
  "dashboard.addWidget": "Widget hinzufügen",
  "dashboard.addWidgetToDashboard": "Zu Ihrem Dashboard hinzufügen",
  "dashboard.customizeDashboard": "Dashboard anpassen",
  "dashboard.allTime": "Gesamter Zeitraum",
  "dashboard.filterActivity": "Aktivität filtern",
  "dashboard.CONTROLS_UPDATE": "Kontrollen aktualisiert",
  "dashboard.allWidgetsAdded": "Alle Widgets hinzugefügt",
  "dashboard.assess": "Bewerten",
  "dashboard.auditsStatus": "Audit-Status",
  "dashboard.calendarExported": "Kalender exportiert",
  "dashboard.clickToResolve": "Klicken zum Beheben",
  "dashboard.compliance": "Compliance",
  "dashboard.complianceByDomain": "Compliance nach Bereich",
  "dashboard.complianceValuesWillAppearHere": "Werte werden hier angezeigt",
  "dashboard.criticalRisks": "Kritische Risiken",
  "dashboard.domain": "Bereich",
  "dashboard.generatedOn": "Erstellt am",
  "dashboard.generatingReport": "Bericht wird erstellt...",
  "dashboard.icsAudit": "Audit",
  "dashboard.icsAuditor": "Auditor",
  "dashboard.icsManager": "Manager",
  "dashboard.icsProject": "Projekte",
  "dashboard.issueAudits": "Audit-Probleme",
  "dashboard.issueControls": "Zu überprüfende Kontrollen",
  "dashboard.issueRisks": "Zu behandelnde Risiken",
  "dashboard.itemsAffected": "betroffene Elemente",
  "dashboard.last30Days": "Letzte 30 Tage",
  "dashboard.last90Days": "Letzte 90 Tage",
  "dashboard.lastYear": "Letztes Jahr",
  "dashboard.maturity": "Reifegrad",
  "dashboard.noAnomalies": "Keine Anomalien",
  "dashboard.noAuditsData": "Keine Auditdaten",
  "dashboard.noCriticalRisks": "Keine kritischen Risiken",
  "dashboard.noDataAvailable": "Keine Daten verfügbar",
  "dashboard.noNews": "Keine Nachrichten",
  "dashboard.noProjectsData": "Keine Projektdaten",
  "dashboard.nothingToReport": "Nichts zu berichten",
  "dashboard.openAudits": "Offene Audits",
  "dashboard.plan": "Planen",
  "dashboard.projectStatus": "Projektstatus",
  "dashboard.refresh": "Aktualisieren",
  "dashboard.reportError": "Berichtsfehler",
  "dashboard.reportGenerated": "Bericht erstellt",
  "dashboard.reportTitle": "Governance-Bericht",
  "dashboard.review": "Überprüfung",
  "dashboard.riskHeatmap": "Risikomatrix",
  "dashboard.risks": "Risiken",
  "dashboard.score": "Score",
  "dashboard.status": "Status",
  "dashboard.statusReview": "Überprüfung erforderlich",
  "dashboard.statusToRead": "Zu lesen",
  "dashboard.strategy": "Strategie",
  "dashboard.systemAlerts": "Systemwarnungen",
  "dashboard.systemHealthy": "System gesund",
  "dashboard.systemsNominal": "Systeme nominal",
  "dashboard.team": "Team",
  "dashboard.threat": "Bedrohung",
  "dashboard.todoThisWeek": "Diese Woche erledigen",
  "dashboard.top5Risks": "Top 5 Risiken",
  "dashboard.topCriticality": "Top-Kritikalität",
  "dashboard.typeAudit": "Audit",
  "dashboard.typeProject": "Projekt",
  "dashboard.typeReview": "Dokumentenprüfung",
  "dashboard.typeSignature": "Unterschrift",
  "dashboard.voxel3d": "3D-Ansicht",
  "dashboard.workspace": "Arbeitsbereich",
  "dashboard.inviteMember": "Mitglied einladen",
  "dashboard.inviteTooltip": "Neues Mitglied einladen",
  "dashboard.seoTitle": "Governance-Dashboard",
  "dashboard.seoDescription": "Übersicht Ihrer Sicherheits- und Compliance-Postur.",
  "dashboard.seoKeywords": "CISO-Steuerung, Cyber-KPIs, Compliance, Risikomanagement, Governance",
  "dashboard.assets": "Assets",
  "dashboard.incidents": "Vorfälle",
  "dashboard.edit.finish": "Bearbeitung beenden",
  "dashboard.edit.customize": "Dashboard anpassen",
  "dashboard.complianceEvolution": "Compliance-Entwicklung",
  "dashboard.healthCheck": "Systemzustand",
  "dashboard.isoMaturity": "ISO-Reifegrad",
  "dashboard.cyberNewsTitle": "Cybersicherheits-Nachrichten",
  "dashboard.newsSubtitle": "Neueste Updates",
  "dashboard.myWorkspace": "Mein Arbeitsbereich",
  "dashboard.priorityRisks": "Prioritäre Risiken",
  "dashboard.realTime": "Echtzeit",
  "dashboard.allSystemsOperational": "Alle Systeme betriebsbereit",
};

// Now let's build the complete translation map for ALL remaining missing keys
// This is done section by section

// We need to add ALL the missing keys. Let's get them programmatically
// and add section-by-section translations

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getValueByPath(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function setValueByPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current[parts[i]] === undefined) {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Get all missing keys
const frKeys = getAllKeys(fr);
const deKeysSet = new Set(getAllKeys(de));
const missingKeys = frKeys.filter(k => !deKeysSet.has(k));

console.log(`Total FR keys: ${frKeys.length}`);
console.log(`Total DE keys: ${deKeysSet.size}`);
console.log(`Missing keys: ${missingKeys.length}`);
console.log(`Keys in translation map: ${Object.keys(KEY_TRANSLATIONS).length}`);

// For keys not in KEY_TRANSLATIONS, we'll need auto-translation
// Let's count how many still need translation
const untranslated = missingKeys.filter(k => KEY_TRANSLATIONS[k] === undefined);
console.log(`Keys needing auto-translation: ${untranslated.length}`);

// Write the untranslated keys to a file for the next step
if (untranslated.length > 0) {
  const output = untranslated.map(k => `"${k}": "${getValueByPath(fr, k)}"`).join('\n');
  fs.writeFileSync(path.join(__dirname, 'untranslated-keys.txt'), output, 'utf8');
  console.log('Wrote untranslated keys to scripts/untranslated-keys.txt');
}
