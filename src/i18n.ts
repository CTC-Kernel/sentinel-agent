import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        debug: false,
        fallbackLng: 'fr',
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        resources: {
            en: {
                translation: {
                    common: {
                        save: "Save",
                        cancel: "Cancel",
                        delete: "Delete",
                        edit: "Edit",
                        create: "Create",
                        pilotage: "Steering",
                        calendar: "Calendar",
                        ctcEngine: "CTC Engine",
                        governance: "Governance",
                        riskManagement: "Risk Management",
                        complianceDda: "Compliance & DDA",
                        privacyGdpr: "Privacy & GDPR",
                        repository: "Repository",
                        administration: "Administration",
                        backup: "Backup",
                        support: "Support",
                        helpCenter: "Help Center",
                        logout: "Logout",
                        search: "Search",
                        adminShort: "Admin",
                        darkMode: "Dark Mode",
                        lightMode: "Light Mode",
                        settings: "Settings"
                    },
                    sidebar: {
                        dashboard: "Dashboard",
                        projects: "Projects",
                        incidents: "Incidents",
                        audits: "Audits",
                        continuity: "Continuity",
                        assets: "Assets",
                        suppliers: "Suppliers",
                        documents: "Documents",
                        team: "Team",
                        superAdmin: "Super Admin",
                        settings: "Settings"
                    },
                    settings: {
                        mentionsLegales: "Legal Notice",
                        myProfile: "My Profile",
                        plansAndBilling: "Plans & Billing"
                    }
                }
            },
            fr: {
                translation: {
                    common: {
                        save: "Enregistrer",
                        cancel: "Annuler",
                        delete: "Supprimer",
                        edit: "Modifier",
                        create: "Créer",
                        pilotage: "Pilotage",
                        calendar: "Calendrier",
                        ctcEngine: "Moteur CTC",
                        governance: "Gouvernance",
                        riskManagement: "Gestion des Risques",
                        complianceDda: "Conformité & DDA",
                        privacyGdpr: "Vie Privée & RGPD",
                        repository: "Référentiel",
                        administration: "Administration",
                        backup: "Sauvegardes",
                        support: "Support",
                        helpCenter: "Centre d'Aide",
                        logout: "Déconnexion",
                        search: "Rechercher",
                        adminShort: "Admin",
                        darkMode: "Mode Sombre",
                        lightMode: "Mode Clair",
                        settings: "Paramètres"
                    },
                    sidebar: {
                        dashboard: "Tableau de Bord",
                        projects: "Projets",
                        incidents: "Incidents",
                        audits: "Audits",
                        continuity: "Continuité",
                        assets: "Actifs",
                        suppliers: "Fournisseurs",
                        documents: "Documents",
                        team: "Équipe",
                        superAdmin: "Super Admin",
                        settings: "Paramètres"
                    },
                    settings: {
                        mentionsLegales: "Mentions Légales",
                        myProfile: "Mon Profil",
                        plansAndBilling: "Offres & Facturation"
                    }
                }
            }
        }
    });

export default i18n;
