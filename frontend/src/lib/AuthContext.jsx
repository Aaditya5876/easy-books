import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authApi, companyApi } from '@/api';
import { setActiveCompanyId, clearActiveCompany, getActiveCompanyId } from '@/lib/companyContext';
import { onCompaniesChanged } from '@/lib/companyEvents';

const AuthContext = createContext();

// /auth/me has no notion of "active company" — it always returns the
// caller's own permanent DB default (from UserCompany.isDefault; null for
// SUPER_ADMIN, who never owns one). But a user can be switched onto a
// *different* company than that permanent default: SUPER_ADMIN via "Switch
// To" in Settings -> Clients, or a regular multi-company ADMIN via "Set
// Active" in Settings -> Companies / the header company switcher — both just
// set the local activeCompanyId. Every place that reads user.defaultCompany
// (isSchool routing in App.jsx, the sidebar, Settings, Ledger) needs to see
// THAT company, not the permanent one, or switching silently does nothing
// (school/business nav, "Client Management" branding, etc. never update).
// companyApi.get() 403s if the caller isn't actually a member (or SUPER_ADMIN,
// who bypasses that check) so this can't be used to peek at someone else's
// company — on any failure we just fall back to the real default. Deliberately
// does NOT skip the override for a deactivated/expired company — losing
// access should keep the app looking like itself (same company name, same
// school/business nav, cached data still visible) with TopBar.jsx's banner
// explaining why writes/fresh reads are failing, not silently swap the admin
// onto a different company or a broken generic dashboard.
// (TopBar.jsx has its own equivalent fetch for the header — see loadData()
// there — since it reads companies via a differently-shaped API client.)
async function resolveActiveCompanyOverride(meData) {
  const activeId = getActiveCompanyId();
  if (!activeId || activeId === meData?.defaultCompanyId) return meData;
  try {
    const res = await companyApi.get(activeId);
    return { ...meData, defaultCompanyId: res.data.id, defaultCompany: res.data };
  } catch {
    // The selected company is gone (deleted) or no longer ours: forget it, so
    // nothing keeps sending its id. SUPER_ADMIN then has no company (null
    // default) and lands back on Settings -> Clients.
    if (meData?.defaultCompanyId) setActiveCompanyId(meData.defaultCompanyId);
    else clearActiveCompany();
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

  // Re-reads the user + active company after a company change (see
  // lib/companyEvents.js) so the sidebar and school/business routing follow
  // without a page reload.
  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      const resolved = await resolveActiveCompanyOverride(res.data);
      setUser(resolved);
      if (resolved?.defaultCompanyId) setActiveCompanyId(resolved.defaultCompanyId);
    } catch { /* signed out meanwhile — the 401 handler takes over */ }
  }, []);

  useEffect(() => onCompaniesChanged(() => { if (isAuthenticated) refreshUser(); }), [isAuthenticated, refreshUser]);

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
      refreshUser,
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
