import React from 'react';
import { Shield, Lock, LogOut, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onNavigate, activeTab }) {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div
        onClick={() => onNavigate(user ? 'dashboard' : 'landing')}
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #10b981 100%)',
            width: 38,
            height: 38,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)',
          }}
        >
          <Shield size={22} />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: '#fff', letterSpacing: '-0.01em' }}>
            SECURE<span style={{ color: 'var(--accent-emerald)' }}>PORTAL</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            CRYPTOGRAPHIC EPHEMERAL LINK CONTROL
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {user ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 14px',
                background: 'rgba(30, 41, 59, 0.6)',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <UserIcon size={16} color="var(--accent-blue)" />
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: '#fff' }}>{user.username}</span>
              </div>
            </div>

            <button
              onClick={async () => {
                await logout();
                onNavigate('landing');
              }}
              className="btn btn-secondary btn-sm"
              title="Logout"
            >
              <LogOut size={16} /> Logout
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => onNavigate('login')}
              className={`btn btn-sm ${activeTab === 'login' ? 'btn-primary' : 'btn-secondary'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => onNavigate('register')}
              className={`btn btn-sm ${activeTab === 'register' ? 'btn-emerald' : 'btn-secondary'}`}
            >
              Register
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
