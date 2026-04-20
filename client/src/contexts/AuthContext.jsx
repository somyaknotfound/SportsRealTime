import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Try to restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('srt_token');
    if (!token) { setLoading(false); return; }

    api.auth.me()
      .then(res => setUser(res.data.user))
      .catch(() => localStorage.removeItem('srt_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.auth.login({ email, password });
    localStorage.setItem('srt_token', res.data.token);
    window.dispatchEvent(new Event('srt_token_changed'));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const res = await api.auth.register({ username, email, password });
    localStorage.setItem('srt_token', res.data.token);
    window.dispatchEvent(new Event('srt_token_changed'));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.auth.logout(); } catch {}
    localStorage.removeItem('srt_token');
    window.dispatchEvent(new Event('srt_token_changed'));
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const res = await api.auth.updateMe(payload);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
