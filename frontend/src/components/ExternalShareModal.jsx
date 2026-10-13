import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Mail,
  Send,
  Globe,
  AlertTriangle,
  Clock,
  Eye,
  Download,
  Ban,
  ShieldCheck,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '../api/client';

export default function ExternalShareModal({
  isOpen,
  onClose,
  shareData,
  onRevokeSuccess,
  onShareTracked,
}) {
  const [copied, setCopied] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [shareSuccessMsg, setShareSuccessMsg] = useState('');
  const [revoking, setRevoking] = useState(false);

  if (!isOpen || !shareData) return null;

  const {
    policy_id,
    share_url,
    file_name = 'Encrypted File',
    file_size = 0,
    recipient_email = '',
    access_type = 'VIEW_ONLY',
    expires_at,
    max_accesses = 1,
    access_count = 0,
    status = 'ACTIVE',
  } = shareData;

  const isRevoked = status === 'REVOKED';
  const isLimitReached = access_count >= max_accesses;
  const isExpired = expires_at && new Date() >= new Date(expires_at);
  const isUsable = !isRevoked && !isLimitReached && !isExpired;

  // Track the sharing method on backend
  const trackShareMethod = async (method) => {
    if (!policy_id) return;
    try {
      setTrackingLoading(true);
      await apiRequest(`/access/shares/${policy_id}/track-share/`, {
        method: 'POST',
        body: JSON.stringify({ sharing_method: method }),
      });
      if (onShareTracked) onShareTracked(method);
    } catch (err) {
      console.warn('Share tracking note:', err);
    } finally {
      setTrackingLoading(false);
    }
  };

  // 1. Copy Link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(share_url);
      setCopied(true);
      setShareSuccessMsg('Link copied to clipboard!');
      trackShareMethod('CLIPBOARD');
      setTimeout(() => {
        setCopied(false);
        setShareSuccessMsg('');
      }, 3000);
    } catch {
      alert('Failed to copy to clipboard.');
    }
  };

  // 2. WhatsApp
  const handleShareWhatsApp = () => {
    trackShareMethod('WHATSAPP');
    const text = `Secure file shared with you: "${file_name}". Open this link to verify your identity and access the file: ${share_url}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShareSuccessMsg('Opened WhatsApp with secure access link!');
    setTimeout(() => setShareSuccessMsg(''), 4000);
  };

  // 3. Gmail
  const handleShareGmail = () => {
    trackShareMethod('GMAIL');
    const subject = `Secure File Shared With You: ${file_name}`;
    const body = `Hello,\n\nA secure file has been shared with you via the Secure File Exchange Portal.\n\nFile Name: ${file_name}\nAccess Mode: ${access_type === 'VIEW_ONLY' ? 'View Only (Protected In-Browser Viewer)' : 'Decrypted Download'}\nLink Expiration: ${expires_at ? new Date(expires_at).toLocaleString() : 'Strict Ephemeral TTL'}\nPermitted Access Limit: ${max_accesses} access(es)\n\nOpen this link to verify your identity and access the file:\n${share_url}\n\nSecurity Notice:\nThis link is cryptographically bound to ${recipient_email}. Unauthorized forwarding will result in ACCESS DENIED.`;

    const webGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient_email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open Gmail web compose in new tab, fallback to mailto
    const newWindow = window.open(webGmailUrl, '_blank', 'noopener,noreferrer');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      window.location.href = `mailto:${encodeURIComponent(recipient_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
    setShareSuccessMsg('Drafted Gmail message with secure access link!');
    setTimeout(() => setShareSuccessMsg(''), 4000);
  };

  // 4. Telegram
  const handleShareTelegram = () => {
    trackShareMethod('TELEGRAM');
    const text = `Secure file shared with you: "${file_name}". Open this link to verify your identity:`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(share_url)}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShareSuccessMsg('Opened Telegram share dialog!');
    setTimeout(() => setShareSuccessMsg(''), 4000);
  };

  // 5. Native Share API (if supported)
  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Secure File: ${file_name}`,
          text: `Secure file shared with you. Open this link to verify your identity and access the file:`,
          url: share_url,
        });
        trackShareMethod('NATIVE');
        setShareSuccessMsg('Shared successfully via system dialog!');
        setTimeout(() => setShareSuccessMsg(''), 4000);
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  // Revoke action from modal
  const handleRevoke = async () => {
    if (!window.confirm('Are you sure you want to revoke this access link immediately? All shared links (WhatsApp, Gmail, Telegram) will instantly self-destruct.')) return;
    try {
      setRevoking(true);
      await apiRequest(`/access/shares/${policy_id}/revoke/`, { method: 'POST' });
      setShareSuccessMsg('Access link revoked successfully.');
      if (onRevokeSuccess) onRevokeSuccess(policy_id);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      alert(err.message || 'Failed to revoke link.');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 28,
          background: '#0b1329',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.4))', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Share2 size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>Share Link Externally</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                Distribute secure ephemeral URL via external apps under sender-controlled policy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 10px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Security & Architecture Limitation Notice (Requirement 8) */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 14,
            marginBottom: 20,
            fontSize: '0.8rem',
            lineHeight: 1.45,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-emerald)', fontWeight: 600, marginBottom: 4 }}>
            <ShieldCheck size={16} /> Cryptographically Bound Access Control
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            The raw file is <strong>never</strong> transmitted as an unencrypted attachment. Only a controlled, ephemeral URL is shared. Access is strictly bound to <strong style={{ color: '#fff' }}>{recipient_email || 'the authorized recipient'}</strong>. Forwarded links to unauthorized parties will be rejected by server-side policy.
          </p>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            <em>Important Notice:</em> If download permissions are granted, downloaded offline files cannot be remotely deleted. View-Only mode renders documents strictly in-browser but cannot prevent external photography/screen captures.
          </div>
        </div>

        {/* File & Policy Metadata Card */}
        <div
          style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            marginBottom: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            fontSize: '0.82rem',
          }}
        >
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Document</div>
            <div style={{ fontWeight: 600, color: '#fff', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {file_name}
            </div>
            {file_size > 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                {(file_size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Authorized Recipient</div>
            <div style={{ fontWeight: 600, color: 'var(--accent-blue)', marginTop: 2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {recipient_email}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Permitted Mode</div>
            <div style={{ fontWeight: 600, color: access_type === 'VIEW_ONLY' ? '#60a5fa' : '#34d399', marginTop: 2 }}>
              {access_type === 'VIEW_ONLY' ? 'View Only (No Download)' : 'Decrypted Download'}
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>Usage Limits & Expiry</div>
            <div style={{ fontWeight: 600, color: '#fbbf24', marginTop: 2 }}>
              {access_count} / {max_accesses} Accesses • {expires_at ? new Date(expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
            </div>
          </div>
        </div>

        {/* Ephemeral Access Link Box */}
        <div style={{ marginBottom: 22 }}>
          <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
            EPHEMERAL ACCESS LINK (256-BIT ENTROPY TOKEN)
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              readOnly
              value={share_url}
              onClick={(e) => e.target.select()}
              className="form-input font-mono"
              style={{ flex: 1, fontSize: '0.85rem', color: '#60a5fa' }}
            />
            <button
              onClick={handleCopyLink}
              className="btn btn-emerald"
              style={{ flexShrink: 0 }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {shareSuccessMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 18,
            }}
          >
            <CheckCircle2 size={16} /> {shareSuccessMsg}
          </div>
        )}

        {/* Invalidation Alert if link inactive */}
        {!isUsable && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 18,
            }}
          >
            <AlertTriangle size={16} />
            <div>
              {isRevoked
                ? 'This link has been revoked by you. Access attempts will be denied.'
                : isExpired
                ? 'This ephemeral link has expired and self-destructed.'
                : 'Maximum access count reached. Link is exhausted.'}
            </div>
          </div>
        )}

        {/* External Apps Sharing Options Grid */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, letterSpacing: '0.04em' }}>
            EXTERNAL APPLICATION CHANNELS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12 }}>
            {/* WhatsApp */}
            <button
              onClick={handleShareWhatsApp}
              disabled={!isUsable}
              className="btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 10px',
                background: isUsable ? 'rgba(37, 211, 102, 0.12)' : 'rgba(255,255,255,0.03)',
                border: isUsable ? '1px solid rgba(37, 211, 102, 0.4)' : '1px solid var(--border-subtle)',
                color: isUsable ? '#25D366' : 'var(--text-muted)',
                borderRadius: 'var(--radius-md)',
                cursor: isUsable ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(37, 211, 102, 0.22)';
              }}
              onMouseLeave={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(37, 211, 102, 0.12)';
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-full)', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Send size={18} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>WhatsApp</span>
            </button>

            {/* Gmail */}
            <button
              onClick={handleShareGmail}
              disabled={!isUsable}
              className="btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 10px',
                background: isUsable ? 'rgba(234, 67, 53, 0.12)' : 'rgba(255,255,255,0.03)',
                border: isUsable ? '1px solid rgba(234, 67, 53, 0.4)' : '1px solid var(--border-subtle)',
                color: isUsable ? '#ea4335' : 'var(--text-muted)',
                borderRadius: 'var(--radius-md)',
                cursor: isUsable ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(234, 67, 53, 0.22)';
              }}
              onMouseLeave={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(234, 67, 53, 0.12)';
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-full)', background: '#ea4335', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={18} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Gmail</span>
            </button>

            {/* Telegram */}
            <button
              onClick={handleShareTelegram}
              disabled={!isUsable}
              className="btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 10px',
                background: isUsable ? 'rgba(0, 136, 204, 0.12)' : 'rgba(255,255,255,0.03)',
                border: isUsable ? '1px solid rgba(0, 136, 204, 0.4)' : '1px solid var(--border-subtle)',
                color: isUsable ? '#0088cc' : 'var(--text-muted)',
                borderRadius: 'var(--radius-md)',
                cursor: isUsable ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(0, 136, 204, 0.22)';
              }}
              onMouseLeave={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(0, 136, 204, 0.12)';
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-full)', background: '#0088cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Globe size={18} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Telegram</span>
            </button>

            {/* Device Native Share / Copy */}
            <button
              onClick={handleNativeShare}
              disabled={!isUsable}
              className="btn"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px 10px',
                background: isUsable ? 'rgba(139, 92, 246, 0.12)' : 'rgba(255,255,255,0.03)',
                border: isUsable ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid var(--border-subtle)',
                color: isUsable ? '#a78bfa' : 'var(--text-muted)',
                borderRadius: 'var(--radius-md)',
                cursor: isUsable ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.22)';
              }}
              onMouseLeave={(e) => {
                if (isUsable) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.12)';
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-full)', background: '#8b5cf6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Share2 size={18} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                {typeof navigator !== 'undefined' && navigator.share ? 'Device Apps' : 'Copy Link'}
              </span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 12 }}>
          {isUsable ? (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="btn btn-danger btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Ban size={14} /> {revoking ? 'Revoking...' : 'Revoke Access Now'}
            </button>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Status: {status}
            </span>
          )}

          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
