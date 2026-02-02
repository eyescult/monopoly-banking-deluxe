import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationTR from './locales/tr/translation.json';

const resources = {
    en: {
        translation: translationEN,
    },
    tr: {
        translation: translationTR,
    },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        fallbackLng: 'tr', // Default language is Turkish as per user request context implicitly, or maybe EN. Let's stick to TR default as the user asked for "Lokalizasyon özelliği eklemeni istiyorum" in Turkish.
        debug: true,

        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;
