import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'easybooks_preferences';

const DEFAULTS = {
  sidebarColor: '',        // '' = use CSS default
  topbarColor: '',         // '' = use CSS default
  fontSize: 'medium',      // small | medium | large | xl
  companyLogoUrl: '',
  notifications: {
    transactions: true,
    reminders: true,
    system: true,
  },
};

const FONT_SIZE_MAP = {
  small:  '12px',
  medium: '14px',
  large:  '16px',
  xl:     '18px',
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw), notifications: { ...DEFAULTS.notifications, ...JSON.parse(raw).notifications } };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  // Apply font size to document root
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_MAP[prefs.fontSize] || FONT_SIZE_MAP.medium;
  }, [prefs.fontSize]);

  // Apply sidebar + topbar colors via CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.sidebarColor) {
      root.style.setProperty('--sidebar-custom', prefs.sidebarColor);
    } else {
      root.style.removeProperty('--sidebar-custom');
    }
    if (prefs.topbarColor) {
      root.style.setProperty('--topbar-custom', prefs.topbarColor);
    } else {
      root.style.removeProperty('--topbar-custom');
    }
  }, [prefs.sidebarColor, prefs.topbarColor]);

  const updatePref = useCallback((key, value) => {
    setPrefs(prev => {
      const next = key === 'notifications'
        ? { ...prev, notifications: { ...prev.notifications, ...value } }
        : { ...prev, [key]: value };
      savePrefs(next);
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefs({ ...DEFAULTS });
    savePrefs({ ...DEFAULTS });
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref, resetPrefs, FONT_SIZE_MAP }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}

// Helper: is a hex color dark? (for choosing text color over it)
export function isColorDark(hex) {
  if (!hex) return true;
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
