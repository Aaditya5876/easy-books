import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ne from './locales/ne.json';

// English lives inline in components as `t('key', { defaultValue: 'English text' })`,
// so only Nepali needs a dictionary. Unknown keys fall back to their English default —
// untranslated screens simply stay English, nothing breaks.
i18n.use(initReactI18next).init({
  resources: { ne: { translation: ne } },
  lng: localStorage.getItem('easybooks_lang') || 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function toggleLanguage() {
  const next = i18n.language === 'ne' ? 'en' : 'ne';
  localStorage.setItem('easybooks_lang', next);
  i18n.changeLanguage(next);
}

export default i18n;
