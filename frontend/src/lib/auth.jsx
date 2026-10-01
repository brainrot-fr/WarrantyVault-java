import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiJson, clearAccessToken, clearCachedUserData, refreshSession, setAccessToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading');
  const [bootstrapError, setBootstrapError] = useState('');

  const acceptSession = useCallback((nextSession) => {
    if (nextSession?.accessToken) {
      setAccessToken(nextSession.accessToken);
      setSession(nextSession.user);
      setStatus('authenticated');
      setBootstrapError('');
      return nextSession;
    }
    clearAccessToken();
    setSession(null);
    setStatus('anonymous');
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    refreshSession()
      .then((restored) => {
        if (active) acceptSession(restored);
      })
      .catch((error) => {
        if (active) {
          setBootstrapError(error.message || 'Unable to connect to WarrantyVault.');
          setStatus('anonymous');
        }
      });
    return () => {
      active = false;
    };
  }, [acceptSession]);

  useEffect(() => {
    const expire = () => {
      clearAccessToken();
      setSession(null);
      setStatus('anonymous');
    };
    window.addEventListener('warrantyvault:session-expired', expire);
    return () => window.removeEventListener('warrantyvault:session-expired', expire);
  }, []);

  const login = useCallback(async (email, password) => {
    const nextSession = await apiJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    return acceptSession(nextSession);
  }, [acceptSession]);

  const register = useCallback(async ({ name, email, password }) => {
    const nextSession = await apiJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      })
    });
    return acceptSession(nextSession);
  }, [acceptSession]);

  const updateUser = useCallback((user) => setSession(user), []);

  const logout = useCallback(async () => {
    try {
      await apiJson('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'warrantyvault' },
        body: '{}',
        skipRefresh: true
      });
    } finally {
      clearCachedUserData();
      acceptSession(null);
    }
  }, [acceptSession]);

  const value = useMemo(() => ({
    user: session,
    status,
    bootstrapError,
    login,
    register,
    logout,
    updateUser
  }), [session, status, bootstrapError, login, register, logout, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
