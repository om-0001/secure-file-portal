import React from 'react';
import {
  ShieldCheck,
  Lock,
  Clock,
  UserCheck,
  EyeOff,
  FileCheck2,
  ArrowRight,
  ShieldAlert,
  KeyRound
} from 'lucide-react';

export default function LandingPage({ onNavigate }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 60 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 16px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            color: 'var(--accent-blue)',
            fontSize: '0.85rem',
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          <KeyRound size={16} /> Zero-Trust Ephemeral Sharing Architecture
        </div>

        <h1 style={{ fontSize: '3rem', lineHeight: 1.15, marginBottom: 20 }}>
          Secure File Exchange Portal with<br />
          <span style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #059669 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Cryptographic Ephemeral Link Control
          </span>
        </h1>

        <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: 780, margin: '0 auto 36px auto' }}>
          "The link itself is never permanent permission." Senders define strict receiver-bound access policies,
          AES-256-GCM envelope encryption, automated ClamAV antimalware inspection, and self-destructing ephemeral links.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button onClick={() => onNavigate('register')} className="btn btn-primary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
            Get Started <ArrowRight size={18} />
          </button>
          <button onClick={() => onNavigate('login')} className="btn btn-secondary" style={{ padding: '14px 28px', fontSize: '1rem' }}>
            Live Portal Sign In
          </button>
        </div>
      </div>

      {/* Feature Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 60 }}>
        <div className="card">
          <div style={{ color: 'var(--accent-emerald)', marginBottom: 12 }}>
            <ShieldCheck size={32} />
          </div>
          <h3 style={{ marginBottom: 8 }}>ClamAV Malware Quarantine</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            All uploads are immediately placed into an isolated temporary quarantine and inspected before storage. Unsafe files are rejected and purged from disk immediately.
          </p>
        </div>

        <div className="card">
          <div style={{ color: 'var(--accent-blue)', marginBottom: 12 }}>
            <Lock size={32} />
          </div>
          <h3 style={{ marginBottom: 8 }}>AES-256-GCM Envelope Encryption</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Every file is encrypted at rest using a unique 256-bit key and 96-bit initialization vector with cryptographic authentication tags (GCM) to detect any tampering.
          </p>
        </div>

        <div className="card">
          <div style={{ color: 'var(--accent-rose)', marginBottom: 12 }}>
            <UserCheck size={32} />
          </div>
          <h3 style={{ marginBottom: 8 }}>Receiver Forwarding Protection</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Access is cryptographically bound to the intended recipient's authenticated identity. If Receiver A forwards the ephemeral link to Receiver B, access is strictly denied.
          </p>
        </div>

        <div className="card">
          <div style={{ color: 'var(--accent-amber)', marginBottom: 12 }}>
            <Clock size={32} />
          </div>
          <h3 style={{ marginBottom: 8 }}>Time & Limit Invalidation</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Set precise expiration windows (e.g. 10 minutes) and single/multi-use access limits (e.g. 1 view). The link automatically self-destructs upon limit exhaustion.
          </p>
        </div>

        <div className="card">
          <div style={{ color: 'var(--accent-purple)', marginBottom: 12 }}>
            <EyeOff size={32} />
          </div>
          <h3 style={{ marginBottom: 8 }}>Server-Enforced View-Only</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Sender chooses View-Only or Download. In View-Only mode, the backend strictly rejects download endpoints and only serves an in-browser authenticated renderer.
          </p>
        </div>

        <div className="card">
          <div style={{ color: 'var(--accent-blue)', marginBottom: 12 }}>
            <FileCheck2 size={32} />
          </div>
          <h3 style={{ marginBottom: 8 }}>Immutable Audit Trail</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Every security event—file scans, link generation, successful views, unauthorized attempts, and manual revocations—is permanently recorded in the security audit log.
          </p>
        </div>
      </div>
    </div>
  );
}
