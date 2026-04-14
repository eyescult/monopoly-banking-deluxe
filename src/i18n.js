import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationTR from './locales/tr/translation.json';
import translationDE from './locales/de/translation.json';

const resources = {
    en: {
        translation: translationEN,
    },
    tr: {
        translation: translationTR,
    },
    de: {
        translation: translationDE,
    },
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        fallbackLng: 'de',
        debug: false,

        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;
