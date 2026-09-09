import { createContext, useState, useContext, useEffect } from 'react';
import { authApi, companyApi } from '@/api';
import { setActiveCompanyId, clearActiveCompany, getActiveCompanyId } from '@/lib/companyContext';

const AuthContext = createContext();

// SUPER_ADMIN never has a default company of their own (see Settings ->
// Clients — they manage clients, they don't own a school/business). But they
// can switch into a client's actual view via the "View" button there, which
// only sets the local activeCompanyId — /auth/me has no notion of "active
// company" and always returns the caller's own permanent default (null for
// SUPER_ADMIN). Without this patch, every place that reads user.defaultCompany
// (isSchool routing in App.jsx, the sidebar) would still think SUPER_ADMIN has
// nothing selected and bounce them back to Settings even after "View". This
// resolves it once, here, instead of duplicating the fetch in every consumer.
// (TopBar.jsx has its own equivalent fetch for the header — see loadData()
// there — since it reads companies via a differently-shaped API client.)
async function resolveActiveCompanyOverride(meData) {
  if (meData?.role !== 'SUPER_ADMIN' || meData?.defaultCompanyId) return meData;
  const activeId = getActiveCompanyId();
  if (!activeId) return meData;
  try {
    const res = await companyApi.get(activeId);
    return { ...meData, defaultCompanyId: res.data.id, defaultCompany: res.data };
  } catch {
    return meData;
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(async (res) => {
        const resolved = await resolveActiveCompanyOverride(res.data);
        setUser(resolved);
        setIsAuthenticated(true);
        if (resolved?.defaultCompanyId) {
          setActiveCompanyId(resolved.defaultCompanyId);
        }
      })
      .catch(() => {
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => setIsLoadingAuth(false));
  }, []);

  const login = async (email, password) => {
    await authApi.login({ email, password });
    const res = await authApi.me();
    const resolved = await resolveActiveCompanyOverride(res.data);
    setUser(resolved);
    setIsAuthenticated(true);
    if (resolved?.defaultCompanyId) {
      setActiveCompanyId(resolved.defaultCompanyId);
    }
    return resolved;
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    setIsAuthenticated(false);
    clearActiveCompany();
    window.location.href = '/login';
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      logout,
      navigateToLogin,
      login,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
