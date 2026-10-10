import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest, getAuthToken, setAuthToken, getCurrentUser, setCurrentUser } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getCurrentUser());
  const [token, setToken] = useState(getAuthToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const profile = await apiRequest('/auth/profile/');
          setUser(profile);
          setCurrentUser(profile);
        } catch (err) {
          // Token expired or invalid
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = async (username, password) => {
    const data = await apiRequest('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    setAuthToken(data.token);
    setUser(data.user);
    setCurrentUser(data.user);
    return data;
  };

  const register = async (payload) => {
    const data = await apiRequest('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    setAuthToken(data.token);
    setUser(data.user);
    setCurrentUser(data.user);
    return data;
  };

  const logout = async () => {
    try {
      if (token) {
        await apiRequest('/auth/logout/', { method: 'POST' });
      }
    } catch (err) {
      // Continue cleanup even if server call fails
    } finally {
      setToken(null);
      setAuthToken(null);
      setUser(null);
      setCurrentUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
