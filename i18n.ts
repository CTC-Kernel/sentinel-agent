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
                        create: "Create"
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
                        create: "Créer"
                    }
                }
            }
        }
    });

export default i18n;
