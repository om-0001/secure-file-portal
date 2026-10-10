import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, 
  UploadCloud, 
  Inbox, 
  Share2, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Eye, 
  Download, 
  Clock, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  User, 
  Mail, 
  KeyRound, 
  RefreshCw, 
  Ban, 
  Search, 
  Sparkles,
  ArrowRight,
  ExternalLink,
  FileText,
  Sliders,
  ChevronRight,
  Fingerprint
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

export default function UnifiedPortal({ onOpenViewer, onOpenPortal, initialTab = 'send' }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // 'send', 'sent', 'received', 'unlock', 'security'

  // Dashboard / Shared Data States
  const [stats, setStats] = useState(null);
  const [sentShares, setSentShares] = useState([]);
  const [receivedShares, setReceivedShares] = useState([]);
  const [myFiles, setMyFiles] = useState([]);
  const [registeredReceivers, setRegisteredReceivers] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Send & Upload Form States
  const [selectedFile, setSelectedFile] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [selectedRecipientObj, setSelectedRecipientObj] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [accessType, setAccessType] = useState('VIEW_ONLY');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [customDuration, setCustomDuration] = useState(false);
  const [maxAccesses, setMaxAccesses] = useState(1);
  const [filePassword, setFilePassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Upload Pipeline Progress State
  const [uploadStep, setUploadStep] = useState(0); // 0: Idle, 1: Quarantine, 2: ClamAV, 3: AES-256, 4: Policy Link Gen, 5: Done
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [createdShareResult, setCreatedShareResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Search & Filter States
  const [sentSearchQuery, setSentSearchQuery] = useState('');
  const [receivedSearchQuery, setReceivedSearchQuery] = useState('');

  // Manual Unlock Tab State
  const [unlockTokenInput, setUnlockTokenInput] = useState('');
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMeta, setUnlockMeta] = useState(null);
  const [unlockError, setUnlockError] = useState(null);

  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load all portal data
  useEffect(() => {
    loadPortalData();
  }, []);

  // Sync initialTab if prop changes
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Handle outside click for autocomplete
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadPortalData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, sentData, receivedData, filesData, receiversData, logsData] = await Promise.all([
        apiRequest('/access/stats/').catch(() => null),
        apiRequest('/access/shares/sent/').catch(() => []),
        apiRequest('/access/shares/received/').catch(() => []),
        apiRequest('/files/').catch(() => []),
        apiRequest('/auth/receivers/').catch(() => []),
        apiRequest('/access/history/').catch(() => []),
      ]);

      setStats(statsData);
      setSentShares(sentData);
      setReceivedShares(receivedData);
      setMyFiles(filesData);
      setRegisteredReceivers(receiversData);
      setSecurityLogs(logsData);
    } catch (err) {
      console.error('Error fetching portal data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Compute past recipients
  const pastRecipients = useMemo(() => {
    const map = new Map();
    sentShares.forEach((share) => {
      if (share.receiver && share.receiver.email) {
        const em = share.receiver.email.toLowerCase();
        if (!map.has(em)) {
          map.set(em, {
            ...share.receiver,
            shareCount: 1,
            lastShared: share.created_at,
          });
        } else {
          map.get(em).shareCount += 1;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.shareCount - a.shareCount);
  }, [sentShares]);

  // Combined candidate suggestions for autocomplete
  const candidateRecipients = useMemo(() => {
    const list = [];
    const seen = new Set();

    pastRecipients.forEach((p) => {
      seen.add(p.email.toLowerCase());
      list.push({ ...p, isPast: true });
    });

    registeredReceivers.forEach((r) => {
      const em = r.email ? r.email.toLowerCase() : '';
      if (em && !seen.has(em) && em !== user?.email?.toLowerCase()) {
        seen.add(em);
        list.push({ ...r, isPast: false });
      }
    });

    return list;
  }, [pastRecipients, registeredReceivers, user]);

  const filteredRecipients = useMemo(() => {
    const q = recipientEmail.trim().toLowerCase();
    if (!q) return candidateRecipients.slice(0, 6);
    return candidateRecipients
      .filter((r) => r.email.toLowerCase().includes(q) || (r.username && r.username.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [candidateRecipients, recipientEmail]);

  // Handle Drag and Drop
  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadError(null);
      setCreatedShareResult(null);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setCreatedShareResult(null);
    }
  };

  // ONE-STEP ENCRYPT & SEND HANDLER
  const handleEncryptAndSend = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError({ error: 'Please choose a file to encrypt and send.' });
      return;
    }

    const emailTarget = recipientEmail.trim();
    if (!emailTarget) {
      setUploadError({ error: 'Please enter recipient email address.' });
      return;
    }

    if (emailTarget.toLowerCase() === user?.email?.toLowerCase()) {
      setUploadError({ error: 'You cannot share a file with your own email. Please specify another recipient.' });
      return;
    }

    setUploadError(null);
    setCreatedShareResult(null);
    setUploading(true);
    setUploadStep(1); // 1. Quarantine

    try {
      // Step 1: Upload and Quarantine + ClamAV + AES-256
      setTimeout(() => setUploadStep(2), 500);
      setTimeout(() => setUploadStep(3), 1100);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const uploadRes = await apiRequest('/files/upload/', {
        method: 'POST',
        body: formData,
      });

      const uploadedFileRecord = uploadRes.file;

      // Step 2: Create Ephemeral Access Policy bound to recipient
      setUploadStep(4); // Ephemeral Token Generation & Policy Binding

      const sharePayload = {
        file_id: uploadedFileRecord.id,
        receiver_email: emailTarget,
        access_type: accessType,
        duration_minutes: parseInt(durationMinutes, 10),
        max_accesses: parseInt(maxAccesses, 10),
        file_password: filePassword,
      };

      const shareRes = await apiRequest('/access/shares/create/', {
        method: 'POST',
        body: JSON.stringify(sharePayload),
      });

      setUploadStep(5); // Complete!
      setCreatedShareResult({
        ...shareRes,
        file: uploadedFileRecord,
        recipientEmail: emailTarget,
        accessType,
        expiresAt: shareRes.policy?.expires_at || new Date(Date.now() + durationMinutes * 60000).toISOString(),
      });

      // Refresh list in background
      loadPortalData(true);
    } catch (err) {
      console.error('Upload & Send failed', err);
      setUploadError(err.data || { error: err.message || 'Transfer pipeline failed.' });
      setUploadStep(0);
    } finally {
      setUploading(false);
    }
  };

  // Reset Send form for another transfer
  const handleResetSendForm = () => {
    setSelectedFile(null);
    setRecipientEmail('');
    setSelectedRecipientObj(null);
    setFilePassword('');
    setCreatedShareResult(null);
    setUploadError(null);
    setUploadStep(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Revoke Share Policy
  const handleRevokeShare = async (policyId) => {
    if (!window.confirm('Are you sure you want to revoke this access link immediately? The recipient will lose all access.')) return;
    try {
      await apiRequest(`/access/shares/${policyId}/revoke/`, { method: 'POST' });
      loadPortalData(true);
    } catch (err) {
      alert(err.message || 'Failed to revoke share link.');
    }
  };

  // Copy Link Helper
  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  // Manual Token Unlock
  const handleManualUnlock = async (e) => {
    e.preventDefault();
    if (!unlockTokenInput.trim()) return;

    // Extract token if user pasted full URL
    let cleanToken = unlockTokenInput.trim();
    if (cleanToken.includes('/access/')) {
      cleanToken = cleanToken.split('/access/')[1].split('/')[0].split('?')[0];
    }

    setUnlocking(true);
    setUnlockError(null);
    try {
      const queryParam = unlockPasswordInput ? `?password=${encodeURIComponent(unlockPasswordInput)}` : '';
      const data = await apiRequest(`/access/token/${cleanToken}/validate/${queryParam}`);
      setUnlockMeta({ ...data, raw_token: cleanToken, password: unlockPasswordInput });
    } catch (err) {
      setUnlockError(err.message || 'Token validation failed. Verify expiry or password.');
    } finally {
      setUnlocking(false);
    }
  };

  // Filtered Sent Shares
  const filteredSentShares = useMemo(() => {
    const q = sentSearchQuery.toLowerCase();
    if (!q) return sentShares;
    return sentShares.filter((s) => 
      s.file?.original_name?.toLowerCase().includes(q) ||
      s.receiver?.email?.toLowerCase().includes(q) ||
      s.receiver?.username?.toLowerCase().includes(q) ||
      s.status?.toLowerCase().includes(q)
    );
  }, [sentShares, sentSearchQuery]);

  // Filtered Received Shares
  const filteredReceivedShares = useMemo(() => {
    const q = receivedSearchQuery.toLowerCase();
    if (!q) return receivedShares;
    return receivedShares.filter((s) => 
      s.file?.original_name?.toLowerCase().includes(q) ||
      s.sender?.email?.toLowerCase().includes(q) ||
      s.sender?.username?.toLowerCase().includes(q) ||
      s.status?.toLowerCase().includes(q)
    );
  }, [receivedShares, receivedSearchQuery]);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Unified Cryptographic Portal</h2>
            <span className="badge badge-clean" style={{ fontSize: '0.75rem' }}>
              <Lock size={12} /> ZERO-KNOWLEDGE PIPELINE
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginTop: 4 }}>
            Send, encrypt, access, and track hardware-encrypted ephemeral files from one central control hub.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => loadPortalData(true)}
            className="btn btn-secondary btn-sm"
            disabled={refreshing}
            title="Refresh portal telemetry"
          >
            <RefreshCw size={14} className={refreshing ? 'pulse-scan' : ''} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
          
          <button
            onClick={() => { setActiveTab('send'); handleResetSendForm(); }}
            className="btn btn-primary btn-sm"
          >
            <Send size={14} /> Send New File
          </button>
        </div>
      </div>

      {/* Top Stats Overview */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
          <StatCard
            title="Encrypted Files Vaulted"
            value={stats.total_files || myFiles.length}
            icon={Lock}
            color="blue"
            subtitle="AES-256-GCM authenticated"
          />
          <StatCard
            title="Active Share Links"
            value={stats.active_policies || sentShares.filter(s => s.status === 'ACTIVE').length}
            icon={Share2}
            color="emerald"
            subtitle="CSPRNG ephemeral tokens"
          />
          <StatCard
            title="Incoming Files (Inbox)"
            value={receivedShares.length}
            icon={Inbox}
            color="purple"
            subtitle="Bound to your identity"
          />
          <StatCard
            title="Audit Access Events"
            value={stats.total_accesses || securityLogs.length}
            icon={ShieldCheck}
            color="amber"
            subtitle="Zero-trust telemetry"
          />
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.7)',
          padding: 6,
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          marginBottom: 24,
          overflowX: 'auto',
        }}
      >
        <button
          onClick={() => setActiveTab('send')}
          className="btn"
          style={{
            flex: '1 1 auto',
            minWidth: 150,
            background: activeTab === 'send' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
            color: activeTab === 'send' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'send' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
          }}
        >
          <Send size={16} /> Send & Encrypt
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className="btn"
          style={{
            flex: '1 1 auto',
            minWidth: 150,
            background: activeTab === 'sent' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
            color: activeTab === 'sent' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'sent' ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none',
          }}
        >
          <Share2 size={16} /> Sent Transfers ({sentShares.length})
        </button>

        <button
          onClick={() => setActiveTab('received')}
          className="btn"
          style={{
            flex: '1 1 auto',
            minWidth: 150,
            background: activeTab === 'received' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
            color: activeTab === 'received' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'received' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
          }}
        >
          <Inbox size={16} /> Received Files ({receivedShares.length})
        </button>

        <button
          onClick={() => setActiveTab('unlock')}
          className="btn"
          style={{
            flex: '1 1 auto',
            minWidth: 150,
            background: activeTab === 'unlock' ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'transparent',
            color: activeTab === 'unlock' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'unlock' ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
          }}
        >
          <KeyRound size={16} /> Access Link / Token
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className="btn"
          style={{
            flex: '1 1 auto',
            minWidth: 150,
            background: activeTab === 'security' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'transparent',
            color: activeTab === 'security' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'security' ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none',
          }}
        >
          <ShieldAlert size={16} /> Audit Telemetry
        </button>
      </div>

      {/* TAB 1: SEND & ENCRYPT FILE (ALL IN ONE) */}
      {activeTab === 'send' && (
        <div style={{ display: 'grid', gridTemplateColumns: createdShareResult ? '1fr' : '1.3fr 1fr', gap: 24 }}>
          {/* Main Upload & Email Recipient Form */}
          {!createdShareResult ? (
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ padding: 8, borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>
                  <UploadCloud size={22} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Direct File Transfer & Encryption</h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Attach your file, enter recipient email, and enforce cryptographically signed ephemeral access.
                  </p>
                </div>
              </div>

              <form onSubmit={handleEncryptAndSend}>
                {/* 1. File Selection Drag & Drop */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>1. SELECT FILE TO ENCRYPT</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max 25MB • Quarantined & Scanned</span>
                  </label>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    style={{
                      border: selectedFile ? '2px solid var(--accent-emerald)' : '2px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: '28px 20px',
                      textAlign: 'center',
                      background: selectedFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      disabled={uploading}
                    />

                    {selectedFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                        <div style={{ padding: 10, borderRadius: 'var(--radius-full)', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)' }}>
                          <CheckCircle2 size={24} />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{selectedFile.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Binary Document'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          className="btn btn-secondary btn-sm"
                          style={{ marginLeft: 16 }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div>
                        <UploadCloud size={32} color="var(--accent-blue)" style={{ marginBottom: 8, opacity: 0.8 }} />
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                          Drop your document here or <span style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>browse</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Supports PDF, Word, Images, Text, Archives, and Data Files
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Recipient Email with Autocomplete */}
                <div className="form-group" style={{ position: 'relative', marginTop: 18 }} ref={dropdownRef}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>2. RECIPIENT EMAIL ADDRESS</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>Strict Identity Binding</span>
                  </label>

                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }}>
                      <Mail size={16} />
                    </div>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => {
                        setRecipientEmail(e.target.value);
                        setSelectedRecipientObj(null);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      placeholder="e.g. colleague@organization.com"
                      className="form-input"
                      style={{ paddingLeft: 38, width: '100%' }}
                      required
                      disabled={uploading}
                    />
                  </div>

                  {/* Autocomplete suggestions dropdown */}
                  {isDropdownOpen && filteredRecipients.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 50,
                        background: '#0f172a',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        marginTop: 4,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      <div style={{ padding: '6px 12px', fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)' }}>
                        SUGGESTED REGISTERED RECIPIENTS
                      </div>
                      {filteredRecipients.map((rec) => (
                        <div
                          key={rec.email}
                          onClick={() => {
                            setRecipientEmail(rec.email);
                            setSelectedRecipientObj(rec);
                            setIsDropdownOpen(false);
                          }}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                              {rec.username ? rec.username[0].toUpperCase() : rec.email[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>{rec.username || rec.email}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rec.email}</div>
                            </div>
                          </div>
                          {rec.isPast && (
                            <span className="badge badge-clean" style={{ fontSize: '0.7rem' }}>
                              Recent
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Security & Access Policy Controls */}
                <div style={{ marginTop: 22, borderTop: '1px solid var(--border-subtle)', paddingTop: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                      3. ACCESS POLICY CONSTRAINTS
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Sliders size={13} /> {showAdvanced ? 'Simple Mode' : 'Advanced Policy Options'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    {/* Access Mode */}
                    <div>
                      <label className="form-label">Access Mode</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setAccessType('VIEW_ONLY')}
                          className="btn btn-sm"
                          style={{
                            background: accessType === 'VIEW_ONLY' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                            border: accessType === 'VIEW_ONLY' ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                            color: accessType === 'VIEW_ONLY' ? '#60a5fa' : 'var(--text-secondary)',
                            fontWeight: 600,
                          }}
                        >
                          <Eye size={14} /> View Only
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccessType('DOWNLOAD')}
                          className="btn btn-sm"
                          style={{
                            background: accessType === 'DOWNLOAD' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                            border: accessType === 'DOWNLOAD' ? '1px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                            color: accessType === 'DOWNLOAD' ? '#34d399' : 'var(--text-secondary)',
                            fontWeight: 600,
                          }}
                        >
                          <Download size={14} /> Download
                        </button>
                      </div>
                    </div>

                    {/* Expiration Duration */}
                    <div>
                      <label className="form-label">Link Expiration (TTL)</label>
                      <select
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        className="form-select"
                        style={{ width: '100%' }}
                        disabled={uploading}
                      >
                        <option value={5}>5 Minutes (Ultra Ephemeral)</option>
                        <option value={15}>15 Minutes (Standard)</option>
                        <option value={60}>1 Hour</option>
                        <option value={360}>6 Hours</option>
                        <option value={1440}>24 Hours (Max Limit)</option>
                      </select>
                    </div>
                  </div>

                  {/* Advanced Options Drawer */}
                  {showAdvanced && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14, padding: 14, background: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <label className="form-label">Max Allowed Accesses</label>
                        <select
                          value={maxAccesses}
                          onChange={(e) => setMaxAccesses(e.target.value)}
                          className="form-select"
                          style={{ width: '100%' }}
                          disabled={uploading}
                        >
                          <option value={1}>1 Access (Burn After Reading)</option>
                          <option value={2}>2 Accesses</option>
                          <option value={5}>5 Accesses</option>
                          <option value={10}>10 Accesses</option>
                        </select>
                      </div>

                      <div>
                        <label className="form-label">Optional File Passphrase</label>
                        <input
                          type="password"
                          value={filePassword}
                          onChange={(e) => setFilePassword(e.target.value)}
                          placeholder="Optional 2FA passcode"
                          className="form-input"
                          style={{ width: '100%' }}
                          disabled={uploading}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Pipeline Execution Card during Upload */}
                {uploading && (
                  <div style={{ marginTop: 20, padding: 16, borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid var(--border-focus)' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <RefreshCw size={14} className="pulse-scan" /> EXECUTING CRYPTOGRAPHIC SECURITY PIPELINE...
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: uploadStep >= 1 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.4)', color: uploadStep >= 1 ? '#60a5fa' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                        1. Quarantine
                      </div>
                      <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: uploadStep >= 2 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.4)', color: uploadStep >= 2 ? '#34d399' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                        2. ClamAV Scan
                      </div>
                      <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: uploadStep >= 3 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(30, 41, 59, 0.4)', color: uploadStep >= 3 ? '#c084fc' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                        3. AES-256-GCM
                      </div>
                      <div style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: uploadStep >= 4 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(30, 41, 59, 0.4)', color: uploadStep >= 4 ? '#fbbf24' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                        4. Ephemeral Link
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {uploadError && (
                  <div style={{ marginTop: 18, padding: 14, borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', display: 'flex', alignItems: 'center', gap: 10, color: '#f87171', fontSize: '0.85rem' }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <div>{uploadError.error || uploadError.detail || 'Transfer rejected by security policy.'}</div>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={!selectedFile || !recipientEmail || uploading}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 22, padding: '13px', fontSize: '0.95rem' }}
                >
                  <Send size={18} /> {uploading ? 'Encrypting & Generating Ephemeral Link...' : '⚡ Encrypt & Share Securely'}
                </button>
              </form>
            </div>
          ) : (
            /* TRANSFER SUCCESS DISPLAY */
            <div className="card" style={{ padding: 32, borderColor: 'rgba(16, 185, 129, 0.4)', background: 'rgba(16, 185, 129, 0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-full)', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={28} />
                </div>
                <div>
                  <h3 style={{ color: '#34d399', fontSize: '1.25rem' }}>Ephemeral Transfer Link Active!</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    File is hardware-encrypted and bound to <strong style={{ color: '#fff' }}>{createdShareResult.recipientEmail}</strong>.
                  </p>
                </div>
              </div>

              {/* Generated Ephemeral Link Box */}
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                  SHAREABLE ACCESS URL (256-BIT ENTROPY TOKEN)
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    readOnly
                    value={createdShareResult.share_url}
                    className="form-input font-mono"
                    style={{ flex: 1, fontSize: '0.85rem', color: '#60a5fa' }}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => handleCopy(createdShareResult.share_url)}
                    className="btn btn-emerald"
                    style={{ flexShrink: 0 }}
                  >
                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* Security Telemetry Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 22, fontSize: '0.82rem' }}>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Cipher Algorithm</div>
                  <div style={{ fontWeight: 700, color: '#fff', marginTop: 2 }}>AES-256-GCM</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Policy Enforcement</div>
                  <div style={{ fontWeight: 700, color: createdShareResult.accessType === 'VIEW_ONLY' ? '#60a5fa' : '#34d399', marginTop: 2 }}>
                    {createdShareResult.accessType === 'VIEW_ONLY' ? 'In-Browser Watermarked View' : 'Full Decrypted Download'}
                  </div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Max Accesses</div>
                  <div style={{ fontWeight: 700, color: '#fff', marginTop: 2 }}>{maxAccesses} Access Allowed</div>
                </div>
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(30, 41, 59, 0.4)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-muted)' }}>Auto-Expiry</div>
                  <div style={{ fontWeight: 700, color: '#fbbf24', marginTop: 2 }}>In {durationMinutes} Minutes</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={handleResetSendForm}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <Send size={16} /> Send Another File
                </button>
                <button
                  onClick={() => setActiveTab('sent')}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  <Share2 size={16} /> View Sent Transfers
                </button>
              </div>
            </div>
          )}

          {/* Right Side: Security Guarantees & Recent Activity */}
          {!createdShareResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card" style={{ padding: 22 }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldCheck size={18} color="var(--accent-emerald)" /> Zero-Trust Security Guarantees
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ color: 'var(--accent-blue)', marginTop: 2 }}><Lock size={15} /></div>
                    <div>
                      <strong style={{ color: '#fff' }}>Authenticated AES-256-GCM:</strong> Payload is encrypted before disk write; plaintext is purged from memory.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ color: 'var(--accent-emerald)', marginTop: 2 }}><ShieldCheck size={15} /></div>
                    <div>
                      <strong style={{ color: '#fff' }}>ClamAV Pipeline:</strong> Automatic malware inspection during isolated quarantine stage.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ color: 'var(--accent-purple)', marginTop: 2 }}><Fingerprint size={15} /></div>
                    <div>
                      <strong style={{ color: '#fff' }}>Cryptographic Binding:</strong> Tokens reject unauthorized identities even if links are forwarded.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ color: 'var(--accent-amber)', marginTop: 2 }}><Clock size={15} /></div>
                    <div>
                      <strong style={{ color: '#fff' }}>Strict Time-To-Live:</strong> Expired links instantly self-destruct and prevent token reuse.
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Incoming Inbox Peek */}
              <div className="card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Inbox size={16} color="var(--accent-blue)" /> Incoming Files ({receivedShares.length})
                  </h4>
                  <button onClick={() => setActiveTab('received')} className="btn btn-secondary btn-sm" style={{ fontSize: '0.72rem' }}>
                    View All
                  </button>
                </div>

                {receivedShares.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No files waiting in your inbox.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {receivedShares.slice(0, 3).map((share) => (
                      <div
                        key={share.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          background: 'rgba(15, 23, 42, 0.4)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {share.file.original_name}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            From: {share.sender.username || share.sender.email}
                          </div>
                        </div>
                        <button
                          onClick={() => onOpenPortal(share.raw_token)}
                          className="btn btn-emerald btn-sm"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        >
                          Access
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SENT TRANSFERS (MANAGE SHARED LINKS & REVOCATIONS) */}
      {activeTab === 'sent' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Active & Past Sent Transfers</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
                Monitor link access counters, copy ephemeral links, or immediately revoke permissions.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter sent files / receivers..."
                  value={sentSearchQuery}
                  onChange={(e) => setSentSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 30, fontSize: '0.8rem', width: 220 }}
                />
              </div>
            </div>
          </div>

          {filteredSentShares.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Share2 size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>No transfers match your filter.</p>
              <button onClick={() => setActiveTab('send')} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                <Send size={14} /> Send a file now
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Recipient</th>
                    <th>Access Mode</th>
                    <th>Expires At</th>
                    <th>Access Usage</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSentShares.map((share) => {
                    const isRevoked = share.status === 'REVOKED';
                    const isExpired = share.status === 'EXPIRED';
                    const isLimitReached = share.access_count >= share.max_accesses;
                    const isActive = share.status === 'ACTIVE' && share.is_valid_now;

                    return (
                      <tr key={share.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{share.file?.original_name || 'Encrypted File'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            SHA256: {share.file?.sha256_hash?.substring(0, 10)}...
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{share.receiver?.username || 'Authorized Recipient'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{share.receiver?.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${share.access_type === 'VIEW_ONLY' ? 'badge-blue' : 'badge-clean'}`}>
                            {share.access_type === 'VIEW_ONLY' ? <Eye size={11} /> : <Download size={11} />}
                            {share.access_type}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(share.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {new Date(share.expires_at).toLocaleDateString()}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{share.access_count}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> / {share.max_accesses} views</span>
                        </td>
                        <td>
                          <StatusBadge status={share.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            {isActive && share.raw_token && (
                              <button
                                onClick={() => handleCopy(`${window.location.origin}/access/${share.raw_token}`)}
                                className="btn btn-secondary btn-sm"
                                title="Copy Ephemeral Link"
                              >
                                <Copy size={13} />
                              </button>
                            )}

                            {isActive && (
                              <button
                                onClick={() => handleRevokeShare(share.id)}
                                className="btn btn-danger btn-sm"
                                title="Revoke Link"
                              >
                                <Ban size={13} /> Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RECEIVED FILES (INBOX - FILES SHARED WITH YOU) */}
      {activeTab === 'received' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Files Shared With Me</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
                Encrypted incoming documents bound to your identity (<strong style={{ color: '#fff' }}>{user?.email}</strong>).
              </p>
            </div>

            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filter received files / sender..."
                value={receivedSearchQuery}
                onChange={(e) => setReceivedSearchQuery(e.target.value)}
                className="form-input"
                style={{ paddingLeft: 30, fontSize: '0.8rem', width: 220 }}
              />
            </div>
          </div>

          {filteredReceivedShares.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Inbox size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>No files currently shared with your account.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Sender</th>
                    <th>Access Policy</th>
                    <th>Expiration</th>
                    <th>Accesses Left</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Access Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceivedShares.map((share) => {
                    const remaining = Math.max(0, share.max_accesses - share.access_count);
                    const isUsable = share.status === 'ACTIVE' && share.is_valid_now && remaining > 0;

                    return (
                      <tr key={share.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{share.file?.original_name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {(share.file?.file_size / 1024).toFixed(1)} KB
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{share.sender?.username}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{share.sender?.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${share.access_type === 'VIEW_ONLY' ? 'badge-blue' : 'badge-clean'}`}>
                            {share.access_type === 'VIEW_ONLY' ? <Eye size={11} /> : <Download size={11} />}
                            {share.access_type === 'VIEW_ONLY' ? 'VIEW ONLY (PROTECTED)' : 'DOWNLOADABLE'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {new Date(share.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {new Date(share.expires_at).toLocaleDateString()}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: remaining > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
                            {remaining}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> / {share.max_accesses} left</span>
                        </td>
                        <td>
                          <StatusBadge status={share.status} />
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isUsable ? (
                            <button
                              onClick={() => onOpenPortal(share.raw_token)}
                              className={`btn btn-sm ${share.access_type === 'VIEW_ONLY' ? 'btn-primary' : 'btn-emerald'}`}
                            >
                              {share.access_type === 'VIEW_ONLY' ? (
                                <>
                                  <Eye size={14} /> View Document
                                </>
                              ) : (
                                <>
                                  <Download size={14} /> Access / Decrypt
                                </>
                              )}
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {share.status === 'REVOKED' ? 'Revoked by Sender' : share.status === 'EXPIRED' ? 'Expired' : 'Limit Exhausted'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MANUAL ACCESS LINK / TOKEN UNLOCK */}
      {activeTab === 'unlock' && (
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div className="card" style={{ padding: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 50, height: 50, borderRadius: 'var(--radius-full)', background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <KeyRound size={26} />
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Direct Ephemeral Link Unlock</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                Paste any shared URL or raw cryptographic token to verify authorization and decrypt payload.
              </p>
            </div>

            <form onSubmit={handleManualUnlock}>
              <div className="form-group">
                <label className="form-label">EPHEMERAL LINK OR TOKEN</label>
                <input
                  type="text"
                  value={unlockTokenInput}
                  onChange={(e) => setUnlockTokenInput(e.target.value)}
                  placeholder="e.g. http://localhost:5173/access/a1b2c3... or raw token string"
                  className="form-input font-mono"
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">OPTIONAL PASSPHRASE (IF SET BY SENDER)</label>
                <input
                  type="password"
                  value={unlockPasswordInput}
                  onChange={(e) => setUnlockPasswordInput(e.target.value)}
                  placeholder="Enter access passphrase if required"
                  className="form-input"
                  style={{ width: '100%' }}
                />
              </div>

              {unlockError && (
                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontSize: '0.85rem', marginBottom: 16 }}>
                  {unlockError}
                </div>
              )}

              <button
                type="submit"
                disabled={!unlockTokenInput.trim() || unlocking}
                className="btn btn-primary"
                style={{ width: '100%', padding: 12 }}
              >
                {unlocking ? 'Verifying Ephemeral Signature...' : 'Unlock & Verify Permissions'}
              </button>
            </form>

            {/* Unlock Success Result Card */}
            {unlockMeta && (
              <div style={{ marginTop: 24, padding: 20, borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <CheckCircle2 size={20} color="var(--accent-emerald)" />
                  <h4 style={{ color: '#34d399' }}>Token Verified & Authorized</h4>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                  <div><strong>File:</strong> {unlockMeta.file_name}</div>
                  <div><strong>Policy:</strong> {unlockMeta.access_type}</div>
                  <div><strong>Sender:</strong> {unlockMeta.sender_email || 'Authorized Party'}</div>
                </div>

                <button
                  onClick={() => {
                    if (unlockMeta.access_type === 'VIEW_ONLY') {
                      onOpenViewer(unlockMeta.raw_token, unlockMeta, unlockMeta.password);
                    } else {
                      onOpenPortal(unlockMeta.raw_token);
                    }
                  }}
                  className="btn btn-emerald"
                  style={{ width: '100%' }}
                >
                  {unlockMeta.access_type === 'VIEW_ONLY' ? <Eye size={16} /> : <Download size={16} />}
                  Proceed to Secure File View / Download
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TELEMETRY & SECURITY LOGS */}
      {activeTab === 'security' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Cryptographic Audit Telemetry</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 2 }}>
                Tamper-evident logs of all token validations, view events, and security rejections.
              </p>
            </div>
            <button onClick={() => loadPortalData(true)} className="btn btn-secondary btn-sm">
              <RefreshCw size={13} /> Refresh Logs
            </button>
          </div>

          {securityLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
              <ShieldAlert size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>No audit telemetry logged yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event Type</th>
                    <th>File</th>
                    <th>IP Address</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {securityLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(log.created_at).toLocaleTimeString()} • {new Date(log.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`badge ${log.status === 'SUCCESS' ? 'badge-clean' : 'badge-revoked'}`}>
                          {log.event_type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.file?.original_name || 'N/A'}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>{log.ip_address || '127.0.0.1'}</td>
                      <td>
                        <span style={{ color: log.status === 'SUCCESS' ? '#34d399' : '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {log.details || 'Standard verification'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
