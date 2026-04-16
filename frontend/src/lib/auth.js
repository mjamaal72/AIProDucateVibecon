import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('aiproducate_token'));
  const [loading, setLoading] = useState(true);

  const api = useCallback(() => {
    const instance = axios.create({ baseURL: API });
    if (token) {
      instance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
    return instance;
  }, [token]);

  useEffect(() => {
    if (token) {
      api().get('/auth/me')
        .then(res => { setUser(res.data); setLoading(false); })
        .catch(() => { setToken(null); localStorage.removeItem('aiproducate_token'); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [token, api]);

  const login = async (unique_identifier, password) => {
    const res = await axios.post(`${API}/auth/login`, { unique_identifier, password });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('aiproducate_token', res.data.token);
    return res.data;
  };

  const register = async (data) => {
    const res = await axios.post(`${API}/auth/register`, data);
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('aiproducate_token', res.data.token);
    return res.data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('aiproducate_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, api: api() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
