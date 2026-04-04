import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchMe,
  getStoredToken,
  login as apiLogin,
  setStoredToken,
  setStoredUser,
  signup as apiSignup,
} from '../api/authApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => getStoredToken());
  const [ready, setReady] = useState(false);

  const setToken = useCallback((t) => {
    setStoredToken(t);
    setTokenState(t || null);
    if (!t) { setUser(null); setStoredUser(null); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = getStoredToken();
      if (!t) {
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const { user: u } = await fetchMe(t);
        if (!cancelled) setUser(u);
      } catch {
        if (!cancelled) {
          setStoredToken(null);
          setTokenState(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiLogin({ email, password });
    setStoredToken(data.token);
    setStoredUser(data.user);
    setTokenState(data.token);
    setUser(data.user);
    return data;
  }, []);

  const signup = useCallback(async ({ name, email, password }) => {
    const data = await apiSignup({ name, email, password });
    setStoredToken(data.token);
    setStoredUser(data.user);
    setTokenState(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setStoredUser(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      ready,
      login,
      signup,
      logout,
      setToken,
    }),
    [user, token, ready, login, signup, logout, setToken],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
