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
    // Clear any prior credentials before initiating a new login
    setAuthToken(null);
    setCurrentUser(null);
    setToken(null);
    setUser(null);

    const data = await apiRequest('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    // Synchronously set local storage before notifying state
    setAuthToken(data.token);
    setCurrentUser(data.user);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (payload) => {
    setAuthToken(null);
    setCurrentUser(null);
    setToken(null);
    setUser(null);

    const data = await apiRequest('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setAuthToken(data.token);
    setCurrentUser(data.user);
    setToken(data.token);
    setUser(data.user);
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
      setAuthToken(null);
      setCurrentUser(null);
      setToken(null);
      setUser(null);
      try {
        sessionStorage.clear();
      } catch (e) {
        // Ignore browser sandbox restrictions if any
      }
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
