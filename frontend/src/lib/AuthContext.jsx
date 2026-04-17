import { createContext, useState, useContext, useEffect } from 'react';
import { authApi } from '@/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    authApi.me()
      .then((res) => {
        setUser(res.data);
        setIsAuthenticated(true);
        if (res.data?.companyId) {
          localStorage.setItem('activeCompanyId', res.data.companyId);
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
    setUser(res.data);
    setIsAuthenticated(true);
    if (res.data?.companyId) {
      localStorage.setItem('activeCompanyId', res.data.companyId);
    }
    return res.data;
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('activeCompanyId');
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
