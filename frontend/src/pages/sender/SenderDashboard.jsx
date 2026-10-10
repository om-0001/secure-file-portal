import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  FileText, 
  Share2, 
  Clock, 
  Lock, 
  ShieldCheck, 
  Ban, 
  Copy, 
  Check, 
  UploadCloud, 
  X, 
  AlertCircle,
  Eye,
  Download,
  CheckCircle2,
  Mail,
  User,
  History,
  Search
} from 'lucide-react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';

export default function SenderDashboard({ onNavigateToUpload }) {
  const { user: currentUser } = useAuth();
  const [stats, setStats] = useState(null);
  const [files, setFiles] = useState([]);
  const [shares, setShares] = useState([]);
  const [receivers, setReceivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to generate consistent, modern avatar gradients
  const getAvatarGradient = (seed = '') => {
    const gradients = [
      'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
      'linear-gradient(135deg, #10b981 0%, #047857 100%)',
      'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
      'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
      'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',
    ];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState('');
  
  // Gmail-style recipient states
  const [selectedRecipient, setSelectedRecipient] = useState(null); // { id, email, username, isPastReceiver, shareCount }
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const [accessType, setAccessType] = useState('VIEW_ONLY');
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [maxAccesses, setMaxAccesses] = useState(1);
  const [filePassword, setFilePassword] = useState('');
  const [shareResult, setShareResult] = useState(null);
  const [modalError, setModalError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Close receiver suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, filesData, sharesData, receiversData] = await Promise.all([
        apiRequest('/access/stats/').catch(() => null),
        apiRequest('/files/').catch(() => []),
        apiRequest('/access/shares/sent/').catch(() => []),
        apiRequest('/auth/receivers/').catch(() => []),
      ]);

      setStats(statsData);
      setFiles(filesData);
      setShares(sharesData);
      setReceivers(receiversData);
      if (filesData.length > 0 && !selectedFileId) setSelectedFileId(filesData[0].id);
    } catch (err) {
      console.error('Error loading dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  // Derive unique past receivers that this sender has already sent files to
  const pastReceivers = useMemo(() => {
    const map = new Map();
    shares.forEach((share) => {
      if (share.receiver && share.receiver.email) {
        const emailKey = share.receiver.email.toLowerCase();
        if (!map.has(emailKey)) {
          map.set(emailKey, {
            ...share.receiver,
            shareCount: 1,
            lastSharedAt: share.created_at,
          });
        } else {
          const item = map.get(emailKey);
          item.shareCount += 1;
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => b.shareCount - a.shareCount);
  }, [shares]);

  // Combined candidate users: past receivers first, then other registered receivers
  const candidateUsers = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Add past receivers (already sent to)
    pastReceivers.forEach((pr) => {
      seen.add(pr.email.toLowerCase());
      list.push({ ...pr, isPastReceiver: true });
    });

    // 2. Add other registered users
    receivers.forEach((rec) => {
      const em = rec.email ? rec.email.toLowerCase() : '';
      if (em && !seen.has(em)) {
        seen.add(em);
        list.push({ ...rec, isPastReceiver: false, shareCount: 0 });
      }
    });

    return list;
  }, [pastReceivers, receivers]);

  // Filter candidate users based on sender's typed input
  const trimmedInput = inputValue.trim().toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!trimmedInput) return candidateUsers;
    return candidateUsers.filter((u) => {
      const emailMatch = u.email && u.email.toLowerCase().includes(trimmedInput);
      const userMatch = u.username && u.username.toLowerCase().includes(trimmedInput);
      const nameMatch = (u.first_name && u.first_name.toLowerCase().includes(trimmedInput)) ||
                        (u.last_name && u.last_name.toLowerCase().includes(trimmedInput));
      return emailMatch || userMatch || nameMatch;
    });
  }, [candidateUsers, trimmedInput]);

  const handleSelectEmail = (userObjOrEmail) => {
    let chosen = null;
    if (typeof userObjOrEmail === 'string') {
      const emailLower = userObjOrEmail.trim().toLowerCase();
      const existing = candidateUsers.find((u) => u.email && u.email.toLowerCase() === emailLower);
      if (existing) {
        chosen = existing;
      } else {
        chosen = {
          email: userObjOrEmail.trim(),
          username: userObjOrEmail.trim().split('@')[0],
          isPastReceiver: false,
          shareCount: 0,
        };
      }
    } else {
      chosen = userObjOrEmail;
    }

    setSelectedRecipient(chosen);
    setInputValue('');
    setIsDropdownOpen(false);
    setModalError('');
  };

  const handleRemoveRecipient = () => {
    setSelectedRecipient(null);
    setInputValue('');
    setIsDropdownOpen(true);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (inputValue.trim()) {
        e.preventDefault();
        const clean = inputValue.trim().replace(/,/g, '');
        if (clean) {
          if (filteredUsers.length > 0 && filteredUsers[0].email.toLowerCase().startsWith(clean.toLowerCase())) {
            handleSelectEmail(filteredUsers[0]);
          } else {
            handleSelectEmail(clean);
          }
        }
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedRecipient) {
      handleRemoveRecipient();
    }
  };

  const openShareModal = (fileId = null) => {
    if (fileId) {
      setSelectedFileId(fileId);
    } else if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id);
    }
    setShareResult(null);
    setModalError('');
    setSelectedRecipient(null);
    setInputValue('');
    setIsDropdownOpen(false);
    setIsShareModalOpen(true);
  };

  const handleCreateShare = async (e) => {
    e.preventDefault();
    setModalError('');
    setShareResult(null);

    // If user typed an email but didn't press enter, auto-commit it
    let target = selectedRecipient;
    if (!target && inputValue.trim()) {
      target = { email: inputValue.trim() };
    }

    if (!target || !target.email) {
      setModalError('Please specify the recipient email address.');
      return;
    }

    const targetEmail = target.email.trim();
    if (currentUser && targetEmail.toLowerCase() === currentUser.email?.toLowerCase()) {
      setModalError('You cannot share a file with yourself. Please specify another recipient\'s email.');
      return;
    }

    try {
      const payload = {
        file_id: selectedFileId,
        receiver_email: targetEmail,
        access_type: accessType,
        file_password: filePassword,
        duration_minutes: parseInt(durationMinutes, 10),
        max_accesses: parseInt(maxAccesses, 10),
      };

      if (target.id) {
        payload.receiver_id = target.id;
      }

      const result = await apiRequest('/access/share/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setShareResult(result);
      loadDashboardData(); // Refresh list and telemetry
    } catch (err) {
      setModalError(err.message || 'Failed to generate link.');
    }
  };

  const handleRevoke = async (policyId) => {
    if (!window.confirm('Are you sure you want to revoke this link immediately? Any future attempts to access it will be denied.')) {
      return;
    }

    try {
      await apiRequest(`/access/revoke/${policyId}/`, { method: 'POST' });
      loadDashboardData();
    } catch (err) {
      alert(err.message || 'Revocation failed.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header & Primary Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2>Sender Security Dashboard</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Manage files, configure cryptographic access controls, and monitor active ephemeral links.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onNavigateToUpload} className="btn btn-secondary">
            <UploadCloud size={16} /> Upload New File
          </button>
          <button
            onClick={() => openShareModal()}
            disabled={files.length === 0}
            className="btn btn-primary"
          >
            <Share2 size={16} /> Generate Ephemeral Link
          </button>
        </div>
      </div>

      {/* Telemetry Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 32 }}>
        <StatCard
          title="Vaulted Files"
          value={stats ? stats.total_files : files.length}
          icon={FileText}
          color="blue"
          subtitle="AES-256-GCM Encrypted"
        />
        <StatCard
          title="Active Links"
          value={stats ? stats.active_links : 0}
          icon={Clock}
          color="emerald"
          subtitle="Awaiting Authorized Access"
        />
        <StatCard
          title="Total Accesses"
          value={stats ? stats.total_accesses : 0}
          icon={Eye}
          color="purple"
          subtitle="View / Download events"
        />
        <StatCard
          title="Revoked / Expired"
          value={stats ? (stats.revoked_links + stats.expired_links) : 0}
          icon={Ban}
          color="amber"
          subtitle="Deactivated Tokens"
        />
      </div>

      {/* Shared Ephemeral Links Table */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: '1.15rem' }}>Active & Past Ephemeral Shares</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {shares.length} tracked policies
          </span>
        </div>

        {shares.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Share2 size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>No ephemeral links created yet. Click "Generate Ephemeral Link" to share a file.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Designated Receiver</th>
                  <th>Access Type</th>
                  <th>Expires At</th>
                  <th>Access Usage</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shares.map((share) => (
                  <tr key={share.id}>
                    <td style={{ fontWeight: 600 }}>{share.file.original_name}</td>
                    <td>
                      <div>{share.receiver.username}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{share.receiver.email}</div>
                    </td>
                    <td>
                      <span className={`badge ${share.access_type === 'VIEW_ONLY' ? 'badge-blue' : 'badge-clean'}`}>
                        {share.access_type === 'VIEW_ONLY' ? 'VIEW ONLY' : 'DOWNLOAD'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(share.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {new Date(share.expires_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{share.access_count}</span> / {share.max_accesses}
                    </td>
                    <td>
                      <StatusBadge status={share.status} />
                      {share.requires_password && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-amber)', marginTop: 3 }}>
                          🔒 Password Protected
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {share.status === 'ACTIVE' && share.is_valid_now ? (
                        <button
                          onClick={() => handleRevoke(share.id)}
                          className="btn btn-danger btn-sm"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Uploaded Files Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: '1.15rem' }}>Encrypted File Vault</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Total Vaulted: {files.length}
          </span>
        </div>

        {files.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
            No files uploaded yet.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Size</th>
                  <th>Malware Scan</th>
                  <th>Integrity (SHA-256)</th>
                  <th>Uploaded On</th>
                  <th style={{ textAlign: 'right' }}>Quick Share</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.original_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{(f.file_size_bytes / 1024).toFixed(1)} KB</td>
                    <td>
                      <StatusBadge status={f.scan_status} />
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {f.sha256_hash.substring(0, 16)}...
                      </code>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(f.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => openShareModal(f.id)}
                        className="btn btn-primary btn-sm"
                      >
                        <Share2 size={14} /> Share
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Share Policy Configuration Modal */}
      {isShareModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div className="card" style={{ maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: 'var(--accent-blue)' }}>
                  <Share2 size={24} />
                </div>
                <h3>Configure Ephemeral Link</h3>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#f87171', fontSize: '0.85rem', marginBottom: 16 }}>
                {modalError}
              </div>
            )}

            {!shareResult ? (
              <form onSubmit={handleCreateShare}>
                <div className="form-group">
                  <label className="form-label">Select Vaulted File</label>
                  <select
                    className="form-select"
                    value={selectedFileId}
                    onChange={(e) => setSelectedFileId(e.target.value)}
                    required
                  >
                    {files.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.original_name} ({(f.file_size_bytes / 1024).toFixed(1)} KB)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gmail-style Recipient Section */}
                <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Designated Recipient (Email Binding)</label>
                    {pastReceivers.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--accent-blue)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <History size={12} /> {pastReceivers.length} previous {pastReceivers.length === 1 ? 'contact' : 'contacts'}
                      </span>
                    )}
                  </div>

                  {/* Gmail 'To:' interactive input box */}
                  <div
                    onClick={() => {
                      if (inputRef.current) inputRef.current.focus();
                      setIsDropdownOpen(true);
                    }}
                    style={{
                      minHeight: 46,
                      padding: '5px 12px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: isDropdownOpen ? '1px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                      cursor: 'text',
                      transition: 'all 0.18s ease',
                      boxShadow: isDropdownOpen ? '0 0 0 3px rgba(59, 130, 246, 0.15)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', userSelect: 'none', marginRight: 2 }}>
                      To:
                    </span>

                    {/* Selected Recipient Chip (Gmail Chip) */}
                    {selectedRecipient && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 7,
                          background: 'rgba(30, 41, 59, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          padding: '3px 10px 3px 6px',
                          borderRadius: 20,
                          color: '#f8fafc',
                          fontSize: '0.84rem',
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            background: getAvatarGradient(selectedRecipient.email),
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            textTransform: 'uppercase',
                          }}
                        >
                          {(selectedRecipient.username || selectedRecipient.email || 'U')[0]}
                        </div>
                        <span style={{ fontWeight: 500 }}>
                          {selectedRecipient.username && selectedRecipient.username !== selectedRecipient.email.split('@')[0]
                            ? `${selectedRecipient.username} (${selectedRecipient.email})`
                            : selectedRecipient.email}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecipient();
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '50%',
                          }}
                          title="Remove recipient"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Text input (active when no chip or typing) */}
                    {(!selectedRecipient || inputValue) && (
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        onKeyDown={handleInputKeyDown}
                        placeholder={selectedRecipient ? '' : 'Type email address or name (like Gmail)...'}
                        style={{
                          flex: 1,
                          minWidth: 180,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: '#f8fafc',
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                          padding: '4px 0',
                        }}
                      />
                    )}
                  </div>

                  {/* Gmail-style Autocomplete Dropdown */}
                  {isDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 5px)',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: '#0b1120',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                        maxHeight: 280,
                        overflowY: 'auto',
                      }}
                    >
                      {/* Option to send to typed custom email if not in candidate list */}
                      {inputValue.trim() && !candidateUsers.some((u) => u.email.toLowerCase() === inputValue.trim().toLowerCase()) && (
                        <div
                          onClick={() => handleSelectEmail(inputValue.trim())}
                          style={{
                            padding: '11px 14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: 'rgba(59, 130, 246, 0.08)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)')}
                        >
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: 'var(--accent-blue)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Mail size={16} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.875rem' }}>
                              Send to: <span style={{ color: 'var(--accent-blue)' }}>{inputValue.trim()}</span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              Press Enter or click to add this recipient
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Suggested & Past Contacts */}
                      {filteredUsers.length > 0 ? (
                        filteredUsers.map((u) => {
                          const isSelected = selectedRecipient && selectedRecipient.email.toLowerCase() === u.email.toLowerCase();
                          return (
                            <div
                              key={u.id || u.email}
                              onClick={() => handleSelectEmail(u)}
                              style={{
                                padding: '10px 14px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                {/* Circular Avatar */}
                                <div
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: '50%',
                                    background: getAvatarGradient(u.email),
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    textTransform: 'uppercase',
                                    flexShrink: 0,
                                  }}
                                >
                                  {(u.username || u.email || 'U')[0]}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.875rem' }}>
                                      {u.username || u.email.split('@')[0]}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                      &lt;{u.email}&gt;
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                    {u.isPastReceiver ? (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 600,
                                          padding: '1px 6px',
                                          borderRadius: 10,
                                          background: 'rgba(16, 185, 129, 0.18)',
                                          color: '#34d399',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 3,
                                        }}
                                      >
                                        <History size={10} /> Sent before {u.shareCount > 1 ? `(${u.shareCount})` : ''}
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          color: 'var(--text-muted)',
                                        }}
                                      >
                                        Registered contact
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', flexShrink: 0, marginLeft: 10 }}>
                                {isSelected ? '✓ Added' : 'Select'}
                              </span>
                            </div>
                          );
                        })
                      ) : !inputValue.trim() ? (
                        <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          No previous contacts yet. Type any email to send.
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Quick-pick Chips for previously sent receivers */}
                  {pastReceivers.length > 0 && !selectedRecipient && (
                    <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quick pick recent:</span>
                      {pastReceivers.slice(0, 4).map((pr) => (
                        <button
                          key={pr.email}
                          type="button"
                          onClick={() => handleSelectEmail(pr)}
                          style={{
                            background: 'rgba(30, 41, 59, 0.7)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 14,
                            padding: '2px 9px',
                            fontSize: '0.74rem',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent-blue)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                          }}
                        >
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: getAvatarGradient(pr.email),
                              fontSize: '0.55rem',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                            }}
                          >
                            {(pr.username || pr.email)[0]}
                          </div>
                          <span>{pr.email}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
                    Only this email address will be authorized to decrypt and access this file.
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Access Permission Type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div
                      onClick={() => setAccessType('VIEW_ONLY')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        border: accessType === 'VIEW_ONLY' ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                        background: accessType === 'VIEW_ONLY' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>View Only</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        In-browser viewer only. Backend blocks download endpoint.
                      </div>
                    </div>

                    <div
                      onClick={() => setAccessType('DOWNLOAD')}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        border: accessType === 'DOWNLOAD' ? '2px solid var(--accent-emerald)' : '1px solid var(--border-subtle)',
                        background: accessType === 'DOWNLOAD' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.6)',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>Download</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        Allows receiver to save decrypted attachment.
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Expiration Window</label>
                    <select
                      className="form-select"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                    >
                      <option value="5">5 Minutes</option>
                      <option value="10">10 Minutes (Recommended)</option>
                      <option value="30">30 Minutes</option>
                      <option value="60">1 Hour</option>
                      <option value="1440">24 Hours</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Maximum Allowed Accesses</label>
                    <select
                      className="form-select"
                      value={maxAccesses}
                      onChange={(e) => setMaxAccesses(e.target.value)}
                    >
                      <option value="1">1 (One-Time Self-Destruct)</option>
                      <option value="2">2 Accesses</option>
                      <option value="3">3 Accesses</option>
                      <option value="5">5 Accesses</option>
                      <option value="10">10 Accesses</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: 12 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lock size={14} color="var(--accent-amber)" /> File Access Password (Optional)
                  </label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Set an optional passphrase to unlock this file..."
                    value={filePassword}
                    onChange={(e) => setFilePassword(e.target.value)}
                  />
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Enhanced 2FA Protection: Receiver must enter this password before they can view or download.
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 12 }}>
                  Generate Cryptographic Ephemeral Link
                </button>
              </form>
            ) : (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <CheckCircle2 size={40} color="var(--accent-emerald)" style={{ marginBottom: 8 }} />
                  <h4 style={{ color: '#34d399' }}>Ephemeral Link Generated</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    CSPRNG 256-bit token created. Raw token is NOT stored in DB (protected via SHA-256).
                  </p>
                </div>

                <div style={{ background: 'rgba(15, 23, 42, 0.9)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 16 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Shareable Access Link:
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="text"
                      readOnly
                      value={shareResult.share_url}
                      className="form-input"
                      style={{ fontSize: '0.8rem', flex: 1, fontFamily: 'var(--font-mono)' }}
                    />
                    <button
                      onClick={() => copyToClipboard(shareResult.share_url)}
                      className="btn btn-secondary btn-sm"
                    >
                      {copied ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4 }}>Security Policy Active:</div>
                  <div>• Receiver: {shareResult?.policy?.receiver?.email || shareResult?.policy?.receiver?.username || 'Authorized User'}</div>
                  <div>• Access: {shareResult?.policy?.access_type || 'RESTRICTED'}</div>
                  <div>• Max Accesses: {shareResult?.policy?.max_accesses || 1}</div>
                  <div>• Expiration: {shareResult?.policy?.expires_at ? new Date(shareResult.policy.expires_at).toLocaleTimeString() : 'Configured Window'}</div>
                </div>

                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ width: '100%' }}
                >
                  Close Window
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
