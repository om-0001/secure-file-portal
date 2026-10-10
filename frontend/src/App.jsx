import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SenderDashboard from './pages/sender/SenderDashboard';
import FileUploadPage from './pages/sender/FileUploadPage';
import ReceiverDashboard from './pages/receiver/ReceiverDashboard';
import AccessPortalPage from './pages/receiver/AccessPortalPage';
import SecureViewerPage from './pages/receiver/SecureViewerPage';
import SecurityDashboard from './pages/SecurityDashboard';

import UnifiedPortal from './pages/UnifiedPortal';

import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [activeToken, setActiveToken] = useState(null);
  const [viewerFileMeta, setViewerFileMeta] = useState(null);
  const [viewerPassword, setViewerPassword] = useState('');

  // Check URL pathname for ephemeral link pattern: /access/:token
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/access/')) {
      const token = path.replace('/access/', '').split('/')[0];
      if (token) {
        setActiveToken(token);
        setActiveTab('access_link');
      }
    } else if (user && activeTab === 'landing') {
      setActiveTab('portal');
    }
  }, [user]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="pulse-scan" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
          Initializing Secure Portal Environment...
        </div>
      </div>
    );
  }

  const handleOpenViewer = (token, meta, password = '') => {
    setActiveToken(token);
    setViewerFileMeta(meta);
    setViewerPassword(password);
    setActiveTab('viewer');
  };

  const handleOpenPortalFromReceiver = (token) => {
    setActiveToken(token);
    setActiveTab('access_link');
  };

  const renderContent = () => {
    // If opening viewer directly
    if (activeTab === 'viewer') {
      return (
        <SecureViewerPage
          token={activeToken}
          fileMeta={viewerFileMeta}
          password={viewerPassword}
          onBack={() => setActiveTab('portal')}
        />
      );
    }

    // Ephemeral access portal for direct access links
    if (activeTab === 'access_link') {
      return (
        <AccessPortalPage
          token={activeToken}
          onOpenViewer={handleOpenViewer}
          onNavigateToLogin={() => setActiveTab('login')}
        />
      );
    }

    // Public Pages
    if (!user) {
      if (activeTab === 'login') return <LoginPage onNavigate={setActiveTab} />;
      if (activeTab === 'register') return <RegisterPage onNavigate={setActiveTab} />;
      return <LandingPage onNavigate={setActiveTab} />;
    }

    // Authenticated Unified Portal
    switch (activeTab) {
      case 'send':
      case 'upload':
        return <UnifiedPortal onOpenViewer={handleOpenViewer} onOpenPortal={handleOpenPortalFromReceiver} initialTab="send" />;
      case 'sent':
      case 'shares':
        return <UnifiedPortal onOpenViewer={handleOpenViewer} onOpenPortal={handleOpenPortalFromReceiver} initialTab="sent" />;
      case 'received':
        return <UnifiedPortal onOpenViewer={handleOpenViewer} onOpenPortal={handleOpenPortalFromReceiver} initialTab="received" />;
      case 'unlock':
        return <UnifiedPortal onOpenViewer={handleOpenViewer} onOpenPortal={handleOpenPortalFromReceiver} initialTab="unlock" />;
      case 'security':
        return <UnifiedPortal onOpenViewer={handleOpenViewer} onOpenPortal={handleOpenPortalFromReceiver} initialTab="security" />;
      case 'portal':
      case 'dashboard':
      default:
        return <UnifiedPortal onOpenViewer={handleOpenViewer} onOpenPortal={handleOpenPortalFromReceiver} initialTab="send" />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar onNavigate={setActiveTab} activeTab={activeTab} />

      <div style={{ display: 'flex', flex: 1 }}>
        {user && activeTab !== 'viewer' && (
          <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} />
        )}
        <main style={{ flex: 1, padding: user ? '32px' : '0' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
