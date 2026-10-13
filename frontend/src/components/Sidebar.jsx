import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Share2,
  Inbox,
  ShieldAlert,
  History,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activeTab, onSelectTab }) {
  const { user } = useAuth();
  if (!user) return null;

  const menuItems = [
    { id: 'portal', label: 'Unified Portal Hub', icon: LayoutDashboard },
    { id: 'send', label: 'Send & Encrypt File', icon: UploadCloud },
    { id: 'sent', label: 'Sent Transfers', icon: Share2 },
    { id: 'received', label: 'Received Files', icon: Inbox },
    { id: 'unlock', label: 'Unlock by Token', icon: Lock },
    { id: 'security', label: 'Security & Audit Logs', icon: ShieldAlert },
  ];

  return (
    <aside
      style={{
        width: 260,
        background: 'rgba(15, 23, 42, 0.5)',
        borderRight: '1px solid var(--border-subtle)',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 'calc(100vh - 65px)',
      }}
    >
      <div style={{ padding: '0 12px 12px 12px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
        PORTAL NAVIGATION
      </div>

      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: isActive ? '#60a5fa' : 'var(--text-secondary)',
              fontWeight: isActive ? 600 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              borderLeft: isActive ? '3px solid var(--accent-blue)' : '3px solid transparent',
            }}
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}

      <div
        style={{
          marginTop: 'auto',
          padding: 16,
          borderRadius: 'var(--radius-md)',
          background: 'rgba(30, 41, 59, 0.4)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-emerald)', fontSize: '0.8rem', fontWeight: 600 }}>
          <Lock size={14} /> AES-256-GCM
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          Hardware-accelerated authenticated encryption active.
        </div>
      </div>
    </aside>
  );
}
