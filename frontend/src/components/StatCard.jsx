import React from 'react';

export default function StatCard({ title, value, icon: Icon, color = 'blue', subtitle }) {
  const colorMap = {
    blue: {
      bg: 'rgba(37, 99, 235, 0.1)',
      text: '#2563eb',
      border: 'rgba(37, 99, 235, 0.2)',
    },
    emerald: {
      bg: 'rgba(5, 150, 105, 0.1)',
      text: '#059669',
      border: 'rgba(5, 150, 105, 0.2)',
    },
    amber: {
      bg: 'rgba(217, 119, 6, 0.1)',
      text: '#d97706',
      border: 'rgba(217, 119, 6, 0.2)',
    },
    rose: {
      bg: 'rgba(220, 38, 38, 0.1)',
      text: '#dc2626',
      border: 'rgba(220, 38, 38, 0.2)',
    },
    purple: {
      bg: 'rgba(124, 58, 237, 0.1)',
      text: '#7c3aed',
      border: 'rgba(124, 58, 237, 0.2)',
    }
  };

  const theme = colorMap[color] || colorMap.blue;

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {Icon && (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: theme.bg,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Icon size={24} />
        </div>
      )}
      <div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginTop: 2, fontFamily: 'var(--font-display)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
