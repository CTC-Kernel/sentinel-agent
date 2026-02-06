import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
 .use(Backend)
 .use(LanguageDetector)
 .use(initReactI18next)
 .init({
 debug: import.meta.env.DEV,
 fallbackLng: 'fr',
 load: 'languageOnly',
 interpolation: {
 escapeValue: false, // not needed for react as it escapes by default
 },
 backend: {
 loadPath: '/locales/{{lng}}/translation.json',
 },
 react: {
 useSuspense: false, // Disable suspense to prevent accessing translations before loading
 bindI18n: 'languageChanged',
 bindI18nStore: 'added removed',
 },
 returnObjects: true, // Enable returning objects for nested translations
 saveMissing: import.meta.env.DEV,
 missingKeyHandler: import.meta.env.DEV ? (lng, _ns, key) => {
 console.warn(`Missing translation key: ${key} for language: ${lng}`);
 } : undefined,
 initImmediate: false, // Ensure initialization is complete before rendering
 });

export default i18n;
