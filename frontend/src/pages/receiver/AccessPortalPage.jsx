import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  Eye, 
  Download, 
  AlertTriangle, 
  Clock, 
  UserCheck, 
  FileText, 
  Ban,
  ArrowRight,
  KeyRound
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function AccessPortalPage({ token, onOpenViewer, onNavigateToLogin }) {
  const { user } = useAuth();
  const [manualToken, setManualToken] = useState(token || '');
  const [inputPassword, setInputPassword] = useState('');
  const [validating, setValidating] = useState(false);
  const [fileMeta, setFileMeta] = useState(null);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (token) {
      validateLink(token);
    }
  }, [token, user]);

  const validateLink = async (targetToken, passwordToVerify = '') => {
    if (!targetToken) return;
    setError(null);
    setValidating(true);

    try {
      const queryParam = passwordToVerify ? `?password=${encodeURIComponent(passwordToVerify)}` : '';
      const data = await apiRequest(`/access/token/${targetToken}/validate/${queryParam}`);
      setFileMeta(data);
    } catch (err) {
      setError({
        status: err.status,
        message: err.message || 'Access verification failed.',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleDownload = async () => {
    if (!manualToken) return;
    setDownloading(true);
    try {
      const queryParam = inputPassword ? `?password=${encodeURIComponent(inputPassword)}` : '';
      const blob = await apiRequest(`/access/token/${manualToken}/download/${queryParam}`);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileMeta.file_name || 'downloaded_file';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Re-validate to update access count
      validateLink(manualToken, inputPassword);
    } catch (err) {
      alert(err.message || 'Download rejected by server policy.');
    } finally {
      setDownloading(false);
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div className="card" style={{ padding: 36 }}>
          <div style={{ color: 'var(--accent-blue)', marginBottom: 16 }}>
            <Lock size={36} />
          </div>
          <h3>Authentication Required</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '12px 0 24px 0' }}>
            Ephemeral access links require identity verification. Senders bind access to a designated recipient account.
          </p>
          <button onClick={onNavigateToLogin} className="btn btn-primary" style={{ width: '100%' }}>
            Sign In with Recipient Account <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 20px' }}>
      <div className="card" style={{ padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: 12,
              background: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--accent-blue)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Lock size={26} />
          </div>
          <h2>Ephemeral Access Verification Portal</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Zero-Trust Link Validator: Verifying token, receiver identity, expiration, and access limits.
          </p>
        </div>

        {/* Manual Token Entry if none in URL */}
        {!token && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <input
              type="text"
              className="form-input"
              style={{ flex: 1 }}
              placeholder="Paste Ephemeral Access Token..."
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
            <button
              onClick={() => validateLink(manualToken, inputPassword)}
              disabled={validating || !manualToken}
              className="btn btn-primary"
            >
              {validating ? 'Verifying...' : 'Validate'}
            </button>
          </div>
        )}

        {/* Validation Progress */}
        {validating && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)' }}>
            <div className="pulse-scan" style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent-blue)' }}>
              Executing 12-Step Backend Security Verification...
            </div>
          </div>
        )}

        {/* Access Denied Card (Forwarded Link / Expired / Limit) */}
        {error && (
          <div
            style={{
              padding: 24,
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            <div style={{ color: 'var(--accent-rose)', marginBottom: 12 }}>
              <ShieldAlert size={42} style={{ display: 'inline-block' }} />
            </div>
            <h3 style={{ color: '#f87171', marginBottom: 8 }}>ACCESS DENIED</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
              {error.message}
            </p>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(15, 23, 42, 0.6)', padding: 10, borderRadius: 'var(--radius-md)' }}>
              Authenticated as: <strong>{user.email}</strong>
              <br />
              If this link was forwarded to you, access is rejected because the link is cryptographically bound to the original recipient.
            </div>
          </div>
        )}

        {/* Access Granted Card */}
        {fileMeta && (
          <div
            style={{
              padding: 24,
              borderRadius: 'var(--radius-lg)',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <UserCheck size={22} color="var(--accent-emerald)" />
              <div style={{ fontWeight: 700, color: '#34d399', fontSize: '1.05rem' }}>
                ACCESS GRANTED • RECEIVER VERIFIED
              </div>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: 16, borderRadius: 'var(--radius-md)', fontSize: '0.85rem', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>File Name:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>{fileMeta.file_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Shared By:</span>
                <span>{fileMeta.sender_email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Access Policy:</span>
                <span className={`badge ${fileMeta.access_type === 'VIEW_ONLY' ? 'badge-blue' : 'badge-clean'}`}>
                  {fileMeta.access_type === 'VIEW_ONLY' ? 'VIEW ONLY' : 'DOWNLOAD PERMITTED'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Remaining Accesses:</span>
                <span style={{ fontWeight: 600, color: '#fff' }}>
                  {fileMeta.remaining_accesses} of {fileMeta.max_accesses}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>Expires At:</span>
                <span style={{ color: 'var(--accent-amber)', fontWeight: 500 }}>
                  {new Date(fileMeta.expires_at).toLocaleTimeString()}
                </span>
              </div>
              {fileMeta.requires_password && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>Security:</span>
                  <span style={{ color: fileMeta.password_verified ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                    {fileMeta.password_verified ? '🔓 Password Unlocked' : '🔒 Password Protected'}
                  </span>
                </div>
              )}
            </div>

            {/* Password Unlock Form if password is required and not yet verified */}
            {fileMeta.requires_password && !fileMeta.password_verified ? (
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <KeyRound size={16} color="var(--accent-amber)" /> Enter File Password to Unlock:
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter file passcode..."
                    style={{ flex: 1 }}
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                  />
                  <button
                    onClick={() => validateLink(manualToken, inputPassword)}
                    className="btn btn-primary btn-sm"
                  >
                    Unlock
                  </button>
                </div>
              </div>
            ) : (
              /* Action Buttons depending on policy */
              fileMeta.access_type === 'VIEW_ONLY' ? (
                <div>
                  <button
                    onClick={() => onOpenViewer(manualToken, fileMeta, inputPassword)}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
                  >
                    <Eye size={18} /> Open Secure In-Browser Viewer
                  </button>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
                    🛡️ Normal download controls are disabled on server & browser per sender policy.
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="btn btn-emerald"
                    style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
                  >
                    <Download size={18} /> {downloading ? 'Decrypting & Streaming...' : 'Download Decrypted File'}
                  </button>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
                    📥 Attachment will be decrypted in-memory and delivered to your device.
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
