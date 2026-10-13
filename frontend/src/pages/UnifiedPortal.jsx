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
  Fingerprint,
  Paperclip,
  MessageSquare,
  Globe,
  History
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import ExternalShareModal from '../components/ExternalShareModal';
import PolicyHistoryModal from '../components/PolicyHistoryModal';

export default function UnifiedPortal({ onOpenViewer, onOpenPortal, initialTab = 'send' }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // 'send', 'sent', 'external', 'received', 'unlock', 'security'

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
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRecipientObj, setSelectedRecipientObj] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [accessType, setAccessType] = useState('VIEW_ONLY');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [customDuration, setCustomDuration] = useState(false);
  const [maxAccesses, setMaxAccesses] = useState(1);
  const [filePassword, setFilePassword] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sharing Mode: Option A (My Portal) vs Option B (External Sharing)
  const [sharingMode, setSharingMode] = useState('portal'); // 'portal' | 'external'
  const [externalTargetApp, setExternalTargetApp] = useState('WHATSAPP'); // 'WHATSAPP' | 'GMAIL' | 'TELEGRAM' | 'CLIPBOARD' | 'NATIVE'

  // Upload Pipeline Progress State
  const [uploadStep, setUploadStep] = useState(0); // 0: Idle, 1: Quarantine, 2: ClamAV, 3: AES-256, 4: Policy Link Gen, 5: Done
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [createdShareResult, setCreatedShareResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Search & Filter States
  const [sentSearchQuery, setSentSearchQuery] = useState('');
  const [receivedSearchQuery, setReceivedSearchQuery] = useState('');
  const [externalSearchQuery, setExternalSearchQuery] = useState('');
  const [externalFilterMode, setExternalFilterMode] = useState('all'); // 'all', 'external_only'

  // External Sharing & History Modal States
  const [shareModalData, setShareModalData] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [historyModalPolicy, setHistoryModalPolicy] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Manual Unlock Tab State
  const [unlockTokenInput, setUnlockTokenInput] = useState('');
  const [unlockPasswordInput, setUnlockPasswordInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMeta, setUnlockMeta] = useState(null);
  const [unlockError, setUnlockError] = useState(null);

  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load all portal data whenever user changes or mounts
  useEffect(() => {
    setStats(null);
    setSentShares([]);
    setReceivedShares([]);
    setMyFiles([]);
    setRegisteredReceivers([]);
    setSecurityLogs([]);
    loadPortalData();
  }, [user?.id, user?.username]);

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
      const file = e.dataTransfer.files[0];
      if (file.size <= 0) {
        setUploadError({ error: `File "${file.name}" is empty (0 bytes). Please select a file that contains data.` });
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
      setCreatedShareResult(null);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size <= 0) {
        setUploadError({ error: `File "${file.name}" is empty (0 bytes). Please select a file that contains data.` });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
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

    if (selectedFile.size <= 0) {
      setUploadError({ error: `The selected file "${selectedFile.name}" is empty (0 bytes). Please choose a file containing data.` });
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
        subject: subject.trim(),
        message: message.trim(),
        access_type: accessType,
        duration_minutes: parseInt(durationMinutes, 10),
        max_accesses: parseInt(maxAccesses, 10),
        file_password: filePassword,
        sharing_method: sharingMode === 'portal' ? 'PORTAL' : externalTargetApp,
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
        subject: subject.trim(),
        message: message.trim(),
        accessType,
        sharingMode,
        externalTargetApp,
        expiresAt: shareRes.policy?.expires_at || new Date(Date.now() + durationMinutes * 60000).toISOString(),
      });

      // If External Sharing mode, automatically trigger the selected channel
      if (sharingMode === 'external') {
        const shareUrl = shareRes.share_url;
        if (externalTargetApp === 'WHATSAPP') {
          const text = `Secure file shared with you: "${uploadedFileRecord.original_name}". Open this link to verify your identity and access the file: ${shareUrl}`;
          window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        } else if (externalTargetApp === 'GMAIL') {
          const subj = `Secure File Shared With You: ${uploadedFileRecord.original_name}`;
          const body = `Hello,\n\nA secure file has been shared with you via the Secure File Exchange Portal.\n\nFile Name: ${uploadedFileRecord.original_name}\nAccess Mode: ${accessType === 'VIEW_ONLY' ? 'View Only (Protected)' : 'Decrypted Download'}\nLink Expiration: In ${durationMinutes} minutes\nPermitted Access Count: ${maxAccesses} access(es)\n\nOpen this link to verify your identity and access the file:\n${shareUrl}\n\nSecurity Notice:\nThis link is cryptographically bound to ${emailTarget}. Unauthorized forwarding will result in ACCESS DENIED.`;
          window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailTarget)}&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
        } else if (externalTargetApp === 'TELEGRAM') {
          const text = `Secure file shared with you: "${uploadedFileRecord.original_name}". Open this link to verify your identity:`;
          window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        } else if (externalTargetApp === 'CLIPBOARD') {
          navigator.clipboard.writeText(shareUrl);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        } else if (externalTargetApp === 'NATIVE' && navigator.share) {
          navigator.share({
            title: `Secure File: ${uploadedFileRecord.original_name}`,
            text: 'Secure file shared with you. Open this link to verify your identity and access the file:',
            url: shareUrl,
          }).catch(() => {});
        }
      }

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
    setSubject('');
    setMessage('');
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

  // Open External Share Modal for newly created share
  const handleOpenExternalShareForCreated = () => {
    if (!createdShareResult) return;
    setShareModalData({
      policy_id: createdShareResult.policy?.id,
      share_url: createdShareResult.share_url,
      file_name: createdShareResult.file?.original_name || 'Encrypted File',
      file_size: createdShareResult.file?.file_size || 0,
      recipient_email: createdShareResult.recipientEmail,
      access_type: createdShareResult.accessType,
      expires_at: createdShareResult.expiresAt,
      max_accesses: parseInt(maxAccesses, 10),
      access_count: 0,
      status: 'ACTIVE',
    });
    setIsShareModalOpen(true);
  };

  // Open External Share Modal for an existing policy row
  const handleOpenExternalShareForPolicy = (share) => {
    const shareUrl = share.raw_token
      ? `${window.location.origin}/access/${share.raw_token}`
      : `${window.location.origin}/portal?tab=unlock`;
    setShareModalData({
      policy_id: share.id,
      share_url: shareUrl,
      file_name: share.file?.original_name || 'Encrypted File',
      file_size: share.file?.file_size || 0,
      recipient_email: share.receiver?.email || '',
      access_type: share.access_type,
      expires_at: share.expires_at,
      max_accesses: share.max_accesses,
      access_count: share.access_count,
      status: share.effective_status || share.status,
    });
    setIsShareModalOpen(true);
  };

  // Open History Audit Modal for an existing policy row
  const handleOpenHistoryModal = (policy) => {
    setHistoryModalPolicy(policy);
    setIsHistoryModalOpen(true);
  };

  // Sharing method badge helper
  const renderSharingMethodBadge = (method) => {
    const m = (method || '').toUpperCase();
    if (m === 'WHATSAPP') {
      return (
        <span className="badge" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)' }}>
          WhatsApp
        </span>
      );
    }
    if (m === 'GMAIL') {
      return (
        <span className="badge" style={{ background: 'rgba(234, 67, 53, 0.15)', color: '#EA4335', border: '1px solid rgba(234, 67, 53, 0.3)' }}>
          Gmail
        </span>
      );
    }
    if (m === 'TELEGRAM') {
      return (
        <span className="badge" style={{ background: 'rgba(0, 136, 204, 0.15)', color: '#0088cc', border: '1px solid rgba(0, 136, 204, 0.3)' }}>
          Telegram
        </span>
      );
    }
    if (m === 'NATIVE') {
      return (
        <span className="badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          Native Share
        </span>
      );
    }
    if (m === 'CLIPBOARD') {
      return (
        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          Copy Link
        </span>
      );
    }
    if (m === 'PORTAL') {
      return (
        <span className="badge badge-clean">
          Portal Direct
        </span>
      );
    }
    return (
      <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-muted)' }}>
        Direct / Unshared
      </span>
    );
  };

  // 1. My Portal Shares List: internal transfers sent to registered portal receivers
  const portalSharesList = useMemo(() => {
    return sentShares.filter((s) => !s.is_external && (!s.sharing_method || s.sharing_method === 'PORTAL'));
  }, [sentShares]);

  // 2. External Shares List: transfers distributed via external channels (WhatsApp, Gmail, Telegram, etc.)
  const externalSharesList = useMemo(() => {
    return sentShares.filter((s) => s.is_external || (s.sharing_method && s.sharing_method !== 'PORTAL'));
  }, [sentShares]);

  // Filtered My Portal Shares
  const filteredPortalShares = useMemo(() => {
    const q = sentSearchQuery.toLowerCase();
    if (!q) return portalSharesList;
    return portalSharesList.filter((s) =>
      s.file?.original_name?.toLowerCase().includes(q) ||
      s.receiver?.email?.toLowerCase().includes(q) ||
      s.receiver?.username?.toLowerCase().includes(q) ||
      s.status?.toLowerCase().includes(q)
    );
  }, [portalSharesList, sentSearchQuery]);

  // Filtered External Shares
  const filteredExternalShares = useMemo(() => {
    const q = externalSearchQuery.toLowerCase();
    if (!q) return externalSharesList;
    return externalSharesList.filter((s) =>
      s.file?.original_name?.toLowerCase().includes(q) ||
      s.receiver?.email?.toLowerCase().includes(q) ||
      s.receiver?.username?.toLowerCase().includes(q) ||
      (s.sharing_method && s.sharing_method.toLowerCase().includes(q)) ||
      (s.effective_status && s.effective_status.toLowerCase().includes(q)) ||
      s.status?.toLowerCase().includes(q)
    );
  }, [externalSharesList, externalSearchQuery]);

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
          <Inbox size={16} /> My Portal Shares ({portalSharesList.length})
        </button>

        <button
          onClick={() => setActiveTab('external')}
          className="btn"
          style={{
            flex: '1 1 auto',
            minWidth: 150,
            background: activeTab === 'external' ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : 'transparent',
            color: activeTab === 'external' ? '#fff' : 'var(--text-secondary)',
            boxShadow: activeTab === 'external' ? '0 4px 12px rgba(6, 182, 212, 0.3)' : 'none',
          }}
        >
          <Globe size={16} /> External Shares ({externalSharesList.length})
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
        <div style={{ width: '100%' }}>
          {/* Main Upload & Email Recipient Form */}
          {!createdShareResult ? (
            <div className="card" style={{ padding: '32px 36px', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>Compose Secure Transfer</h3>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                      Send end-to-end encrypted files and private messages with strict cryptographic ephemeral link control.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-clean" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '6px 12px' }}>
                    <ShieldCheck size={14} color="var(--accent-emerald)" /> AES-256-GCM Hardware Encrypted
                  </span>
                </div>
              </div>

              <form onSubmit={handleEncryptAndSend}>
                {/* PART 1: TWO CLEARLY SEPARATE SHARING OPTIONS: A. MY PORTAL vs B. EXTERNAL SHARING */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
                  <div
                    onClick={() => setSharingMode('portal')}
                    style={{
                      padding: '16px 18px',
                      borderRadius: 'var(--radius-md)',
                      border: sharingMode === 'portal' ? '2px solid var(--accent-blue)' : '1px solid var(--border-subtle)',
                      background: sharingMode === 'portal' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: sharingMode === 'portal' ? '0 0 20px rgba(59, 130, 246, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.2)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Inbox size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: sharingMode === 'portal' ? '#60a5fa' : '#fff' }}>
                            Option A: My Portal
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Internal Portal Exchange</div>
                        </div>
                      </div>
                      <input type="radio" checked={sharingMode === 'portal'} onChange={() => setSharingMode('portal')} />
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                      Send directly to a registered receiver. The file automatically appears in their portal dashboard (Received Files) upon authenticated login.
                    </p>
                  </div>

                  <div
                    onClick={() => setSharingMode('external')}
                    style={{
                      padding: '16px 18px',
                      borderRadius: 'var(--radius-md)',
                      border: sharingMode === 'external' ? '2px solid #22d3ee' : '1px solid var(--border-subtle)',
                      background: sharingMode === 'external' ? 'rgba(6, 182, 212, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: sharingMode === 'external' ? '0 0 20px rgba(6, 182, 212, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius-sm)', background: 'rgba(6, 182, 212, 0.2)', color: '#22d3ee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Globe size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.98rem', color: sharingMode === 'external' ? '#22d3ee' : '#fff' }}>
                            Option B: External Sharing
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>WhatsApp, Gmail, Telegram...</div>
                        </div>
                      </div>
                      <input type="radio" checked={sharingMode === 'external'} onChange={() => setSharingMode('external')} />
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45 }}>
                      Generate an ephemeral access link to share via external apps. The actual file stays securely stored on the portal and remains under sender control.
                    </p>
                  </div>
                </div>

                {/* If Option B: External Sharing, show Target Application Selector */}
                {sharingMode === 'external' && (
                  <div style={{ marginBottom: 22, padding: 16, background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(6, 182, 212, 0.35)' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22d3ee', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Globe size={14} /> CHOOSE EXTERNAL SHARING APPLICATION
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setExternalTargetApp('WHATSAPP')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: externalTargetApp === 'WHATSAPP' ? '2px solid #25D366' : '1px solid var(--border-subtle)',
                          background: externalTargetApp === 'WHATSAPP' ? 'rgba(37, 211, 102, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          color: externalTargetApp === 'WHATSAPP' ? '#25D366' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          justifyContent: 'center',
                        }}
                      >
                        <MessageSquare size={15} /> WhatsApp
                      </button>

                      <button
                        type="button"
                        onClick={() => setExternalTargetApp('GMAIL')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: externalTargetApp === 'GMAIL' ? '2px solid #EA4335' : '1px solid var(--border-subtle)',
                          background: externalTargetApp === 'GMAIL' ? 'rgba(234, 67, 53, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          color: externalTargetApp === 'GMAIL' ? '#EA4335' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          justifyContent: 'center',
                        }}
                      >
                        <Mail size={15} /> Gmail
                      </button>

                      <button
                        type="button"
                        onClick={() => setExternalTargetApp('TELEGRAM')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: externalTargetApp === 'TELEGRAM' ? '2px solid #0088cc' : '1px solid var(--border-subtle)',
                          background: externalTargetApp === 'TELEGRAM' ? 'rgba(0, 136, 204, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          color: externalTargetApp === 'TELEGRAM' ? '#0088cc' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          justifyContent: 'center',
                        }}
                      >
                        <Send size={15} /> Telegram
                      </button>

                      <button
                        type="button"
                        onClick={() => setExternalTargetApp('CLIPBOARD')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: externalTargetApp === 'CLIPBOARD' ? '2px solid #60a5fa' : '1px solid var(--border-subtle)',
                          background: externalTargetApp === 'CLIPBOARD' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          color: externalTargetApp === 'CLIPBOARD' ? '#60a5fa' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          justifyContent: 'center',
                        }}
                      >
                        <Copy size={15} /> Copy Link
                      </button>

                      <button
                        type="button"
                        onClick={() => setExternalTargetApp('NATIVE')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: externalTargetApp === 'NATIVE' ? '2px solid #c084fc' : '1px solid var(--border-subtle)',
                          background: externalTargetApp === 'NATIVE' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                          color: externalTargetApp === 'NATIVE' ? '#c084fc' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          justifyContent: 'center',
                        }}
                      >
                        <Share2 size={15} /> More Apps
                      </button>
                    </div>
                  </div>
                )}

                {/* 1. Recipient Email with Autocomplete */}
                <div className="form-group" style={{ position: 'relative', marginBottom: 20 }} ref={dropdownRef}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span>
                      {sharingMode === 'portal'
                        ? 'TO / REGISTERED PORTAL RECEIVER EMAIL'
                        : 'TO / INTENDED RECIPIENT EMAIL (IDENTITY-BOUND LINK)'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: sharingMode === 'portal' ? 'var(--accent-blue)' : '#22d3ee' }}>
                      {sharingMode === 'portal' ? 'Delivered to Portal Inbox' : 'Anti-Forwarding Protection'}
                    </span>
                  </label>

                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 14, top: 12, color: 'var(--text-muted)' }}>
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
                      placeholder="e.g. colleague@organization.com or bob@example.com"
                      className="form-input"
                      style={{ paddingLeft: 42, width: '100%', fontSize: '0.92rem' }}
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

                {/* 2. Subject Line */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                    SUBJECT
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Confidential Project Files & Security Tokens"
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.92rem' }}
                    disabled={uploading}
                  />
                </div>

                {/* 3. Secure Message Box (Gmail style) */}
                <div className="form-group" style={{ marginBottom: 22 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MessageSquare size={14} color="var(--accent-blue)" /> SECURE MESSAGE / BODY
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Communicated securely with link</span>
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your message here... The recipient will be able to read this securely when accessing the file transfer, just like an email."
                    className="form-input"
                    rows={4}
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: '0.92rem',
                      lineHeight: 1.55,
                      padding: '12px 14px',
                      background: 'rgba(15, 23, 42, 0.6)',
                    }}
                    disabled={uploading}
                  />
                </div>

                {/* 4. Attached File Box (Big, prominent dropzone covering space) */}
                <div className="form-group" style={{ marginBottom: 22 }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 700 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Paperclip size={14} color="var(--accent-emerald)" /> ATTACH FILE TO ENCRYPT
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Max 25MB • Quarantined & Malware Scanned</span>
                  </label>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    style={{
                      border: selectedFile ? '2px solid var(--accent-emerald)' : '2px dashed var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: selectedFile ? '20px 24px' : '36px 20px',
                      textAlign: 'center',
                      background: selectedFile ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 23, 42, 0.45)',
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <div style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={26} />
                          </div>
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontWeight: 700, color: '#fff', fontSize: '1rem' }}>{selectedFile.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                              {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Binary Document'} • <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>Ready for Encryption</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current && fileInputRef.current.click(); }}
                            className="btn btn-secondary btn-sm"
                          >
                            Change File
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                            className="btn btn-danger btn-sm"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ width: 52, height: 52, borderRadius: 'var(--radius-full)', background: 'rgba(59, 130, 246, 0.12)', color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                          <UploadCloud size={28} />
                        </div>
                        <div style={{ fontWeight: 600, color: '#fff', fontSize: '1.05rem' }}>
                          Drop your document here or <span style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>browse</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                          Supports PDF, Word, Excel, Images, Text, Archives, and Data Files
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Security & Access Policy Controls */}
                <div style={{ marginTop: 22, borderTop: '1px solid var(--border-subtle)', paddingTop: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                      ACCESS POLICY CONSTRAINTS
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Sliders size={13} /> {showAdvanced ? 'Simple Mode' : 'Advanced Policy Options'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 14, padding: 16, background: 'rgba(15, 23, 42, 0.4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
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
                    <div>
                      {(() => {
                        if (!uploadError) return 'Transfer rejected by security policy.';
                        if (typeof uploadError === 'string') return uploadError;
                        if (uploadError.error) return typeof uploadError.error === 'string' ? uploadError.error : JSON.stringify(uploadError.error);
                        if (uploadError.detail) return typeof uploadError.detail === 'string' ? uploadError.detail : JSON.stringify(uploadError.detail);
                        if (uploadError.message) return typeof uploadError.message === 'string' ? uploadError.message : JSON.stringify(uploadError.message);
                        if (uploadError.file) return Array.isArray(uploadError.file) ? uploadError.file.join(' ') : String(uploadError.file);
                        if (uploadError.receiver_email) return Array.isArray(uploadError.receiver_email) ? uploadError.receiver_email.join(' ') : String(uploadError.receiver_email);
                        if (Array.isArray(uploadError)) return uploadError.join(' ');
                        const vals = Object.values(uploadError);
                        if (vals.length > 0) {
                          const v = vals[0];
                          return Array.isArray(v) ? v.join(' ') : String(v);
                        }
                        return 'Transfer rejected by security policy.';
                      })()}
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={!selectedFile || !recipientEmail || uploading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    marginTop: 24,
                    padding: '14px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    background: sharingMode === 'external' ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : undefined,
                    boxShadow: sharingMode === 'external' ? '0 4px 16px rgba(6, 182, 212, 0.3)' : undefined,
                  }}
                >
                  {uploading ? (
                    'Executing Cryptographic Pipeline & Ephemeral Link...'
                  ) : sharingMode === 'portal' ? (
                    <>
                      <Inbox size={18} /> ⚡ Encrypt & Deliver to My Portal Receiver Inbox
                    </>
                  ) : (
                    <>
                      <Globe size={18} /> ⚡ Encrypt & Share via {externalTargetApp === 'WHATSAPP' ? 'WhatsApp' : externalTargetApp === 'GMAIL' ? 'Gmail' : externalTargetApp === 'TELEGRAM' ? 'Telegram' : externalTargetApp === 'CLIPBOARD' ? 'Copy Link' : 'More Apps'}
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* TRANSFER SUCCESS DISPLAY */
            <div className="card" style={{ padding: 36, borderColor: createdShareResult.sharingMode === 'external' ? 'rgba(6, 182, 212, 0.4)' : 'rgba(16, 185, 129, 0.4)', background: createdShareResult.sharingMode === 'external' ? 'rgba(6, 182, 212, 0.04)' : 'rgba(16, 185, 129, 0.04)', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', background: createdShareResult.sharingMode === 'external' ? 'rgba(6, 182, 212, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: createdShareResult.sharingMode === 'external' ? '#22d3ee' : 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={30} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ color: createdShareResult.sharingMode === 'external' ? '#22d3ee' : '#34d399', fontSize: '1.3rem', margin: 0 }}>
                      {createdShareResult.sharingMode === 'external' ? 'External Share Link Ready!' : 'My Portal Transfer Active!'}
                    </h3>
                    <span className="badge badge-clean" style={{ fontSize: '0.72rem' }}>
                      {createdShareResult.sharingMode === 'external' ? 'Option B: External Sharing' : 'Option A: My Portal'}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 4 }}>
                    {createdShareResult.sharingMode === 'external'
                      ? `Access link generated and bound to intended recipient ${createdShareResult.recipientEmail}.`
                      : `Encrypted file delivered directly to ${createdShareResult.recipientEmail}'s portal dashboard.`}
                  </p>
                </div>
              </div>

              {/* Message Summary if provided */}
              {(createdShareResult.subject || createdShareResult.message) && (
                <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: 20 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Mail size={14} /> COMMUNICATED MESSAGE
                  </div>
                  {createdShareResult.subject && (
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem', marginBottom: 4 }}>
                      Subject: {createdShareResult.subject}
                    </div>
                  )}
                  {createdShareResult.message && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, background: 'rgba(30, 41, 59, 0.5)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
                      {createdShareResult.message}
                    </div>
                  )}
                </div>
              )}

              {/* Generated Ephemeral Link Box */}
              <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 20 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
                  SHAREABLE ACCESS URL (256-BIT ENTROPY TOKEN)
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    readOnly
                    value={createdShareResult.share_url}
                    className="form-input font-mono"
                    style={{ flex: '1 1 260px', fontSize: '0.85rem', color: '#60a5fa' }}
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={() => handleCopy(createdShareResult.share_url)}
                    className="btn btn-secondary"
                    style={{ flexShrink: 0 }}
                  >
                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                    {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={handleOpenExternalShareForCreated}
                    className="btn btn-emerald"
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Share2 size={16} /> Share Externally
                  </button>
                </div>

                {/* Quick External App Sharing Action Bar */}
                {createdShareResult.sharingMode === 'external' && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Quick Share:</span>
                    <button
                      onClick={() => {
                        const text = `Secure file shared with you: "${createdShareResult.file?.original_name}". Open this link to verify your identity: ${createdShareResult.share_url}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="btn btn-sm"
                      style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366', border: '1px solid rgba(37, 211, 102, 0.3)', fontSize: '0.75rem' }}
                    >
                      <MessageSquare size={13} /> WhatsApp
                    </button>
                    <button
                      onClick={() => {
                        const subj = `Secure File Shared: ${createdShareResult.file?.original_name}`;
                        const body = `Secure file access link:\n${createdShareResult.share_url}\n\nBound to: ${createdShareResult.recipientEmail}`;
                        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(createdShareResult.recipientEmail)}&su=${encodeURIComponent(subj)}&body=${encodeURIComponent(body)}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="btn btn-sm"
                      style={{ background: 'rgba(234, 67, 53, 0.15)', color: '#EA4335', border: '1px solid rgba(234, 67, 53, 0.3)', fontSize: '0.75rem' }}
                    >
                      <Mail size={13} /> Gmail
                    </button>
                    <button
                      onClick={() => {
                        const text = `Secure file: "${createdShareResult.file?.original_name}". Open:`;
                        window.open(`https://t.me/share/url?url=${encodeURIComponent(createdShareResult.share_url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                      }}
                      className="btn btn-sm"
                      style={{ background: 'rgba(0, 136, 204, 0.15)', color: '#0088cc', border: '1px solid rgba(0, 136, 204, 0.3)', fontSize: '0.75rem' }}
                    >
                      <Send size={13} /> Telegram
                    </button>
                  </div>
                )}
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
                  onClick={() => setActiveTab(createdShareResult.sharingMode === 'external' ? 'external' : 'sent')}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  {createdShareResult.sharingMode === 'external' ? (
                    <>
                      <Globe size={16} /> View in External Shares
                    </>
                  ) : (
                    <>
                      <Inbox size={16} /> View in My Portal Shares
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY PORTAL SHARES (CATEGORY 1: INTERNAL PORTAL TRANSFERS) */}
      {activeTab === 'sent' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>My Portal Shares</h3>
                <span className="badge badge-clean" style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <Inbox size={12} /> PORTAL DIRECT TRANSFERS
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: 4 }}>
                Files transferred directly to registered receivers. Documents appear inside recipient's portal dashboard upon authenticated login.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter portal files / receivers..."
                  value={sentSearchQuery}
                  onChange={(e) => setSentSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 30, fontSize: '0.8rem', width: 220 }}
                />
              </div>
            </div>
          </div>

          {filteredPortalShares.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Inbox size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>No portal direct transfers match your filter.</p>
              <button onClick={() => { setActiveTab('send'); setSharingMode('portal'); }} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                <Send size={14} /> Send a portal transfer now
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Registered Recipient</th>
                    <th>Sharing Method</th>
                    <th>Access Mode</th>
                    <th>Expires At</th>
                    <th>Access Usage</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPortalShares.map((share) => {
                    const isRevoked = share.status === 'REVOKED';
                    const isExpired = share.status === 'EXPIRED';
                    const isLimitReached = share.access_count >= share.max_accesses;
                    const isActive = share.status === 'ACTIVE' && share.is_valid_now;

                    return (
                      <tr key={share.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{share.file?.original_name || 'Encrypted File'}</div>
                          {share.subject && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', marginTop: 2, fontWeight: 500 }}>
                              Subject: {share.subject}
                            </div>
                          )}
                          {share.message && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={share.message}>
                              "{share.message}"
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            SHA256: {share.file?.sha256_hash?.substring(0, 10)}...
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{share.receiver?.username || 'Authorized Recipient'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{share.receiver?.email}</div>
                        </td>
                        <td>
                          {renderSharingMethodBadge(share.sharing_method || 'PORTAL')}
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
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                                onClick={() => handleOpenExternalShareForPolicy(share)}
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                                title="Share via WhatsApp, Gmail, Telegram..."
                              >
                                <Share2 size={13} /> Share
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenHistoryModal(share)}
                              className="btn btn-secondary btn-sm"
                              title="View Access History"
                            >
                              <History size={13} />
                            </button>

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

      {/* TAB: EXTERNAL SHARES (CROSS-PLATFORM DISTRIBUTION & ACCESS CONTROL) */}
      {activeTab === 'external' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>External Shares</h3>
                <span className="badge badge-clean" style={{ fontSize: '0.75rem', background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                  <Globe size={12} /> CROSS-PLATFORM CONTROL
                </span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', marginTop: 4 }}>
                Control and monitor access links distributed through WhatsApp, Gmail, Telegram, and native mobile/desktop shares.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Search Box */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Filter external files / receivers..."
                  value={externalSearchQuery}
                  onChange={(e) => setExternalSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: 30, fontSize: '0.8rem', width: 240 }}
                />
              </div>
            </div>
          </div>

          {/* Section 8 Security Notice Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.6) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={18} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: '#fff' }}>Centralized Access Policy:</strong> Shared links never expose secret keys. When access is revoked or expires, recipients lose access instantly across all external apps.
              </div>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Bound to intended recipient identity
            </div>
          </div>

          {filteredExternalShares.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <Globe size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p>
                No external app shares tracked yet. Use Option B (External Sharing) to generate links for WhatsApp, Gmail, or Telegram.
              </p>
              <button onClick={() => { setActiveTab('send'); setSharingMode('external'); }} className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>
                <Send size={14} /> Send via External Apps
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Intended Receiver</th>
                    <th>Sharing Method</th>
                    <th>Access Type</th>
                    <th>Creation Time</th>
                    <th>Expiry Date & Time</th>
                    <th>Access Usage</th>
                    <th>Current Status</th>
                    <th>Last Access</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExternalShares.map((share) => {
                    const isRevoked = share.status === 'REVOKED' || share.is_revoked;
                    const isExpired = share.status === 'EXPIRED';
                    const isLimitReached = share.access_count >= share.max_accesses;
                    const isActive = !isRevoked && !isExpired && !isLimitReached;
                    const effectiveStatus = share.effective_status || (isRevoked ? 'Revoked' : isExpired ? 'Expired' : isLimitReached ? 'Access Limit Reached' : 'Active');

                    return (
                      <tr key={share.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{share.file?.original_name || 'Encrypted File'}</div>
                          {share.subject && (
                            <div style={{ fontSize: '0.76rem', color: 'var(--accent-blue)', marginTop: 2, fontWeight: 500 }}>
                              {share.subject}
                            </div>
                          )}
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {(share.file?.file_size / 1024).toFixed(1)} KB
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500 }}>{share.receiver?.username || 'Authorized Recipient'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{share.receiver?.email}</div>
                        </td>
                        <td>
                          {renderSharingMethodBadge(share.sharing_method)}
                        </td>
                        <td>
                          <span className={`badge ${share.access_type === 'VIEW_ONLY' ? 'badge-blue' : 'badge-clean'}`}>
                            {share.access_type === 'VIEW_ONLY' ? <Eye size={11} /> : <Download size={11} />}
                            {share.access_type === 'VIEW_ONLY' ? 'View Only' : 'Download'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <div>{new Date(share.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(share.created_at).toLocaleDateString()}</div>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          <div>{new Date(share.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(share.expires_at).toLocaleDateString()}</div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: share.access_count > 0 ? '#34d399' : 'var(--text-secondary)' }}>
                            {share.access_count}
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> / {share.max_accesses}</span>
                        </td>
                        <td>
                          <StatusBadge status={effectiveStatus} />
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {share.last_accessed_at ? (
                            <div>
                              <div>{new Date(share.last_accessed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{new Date(share.last_accessed_at).toLocaleDateString()}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.75rem' }}>Never</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {/* Copy Link */}
                            {isActive && share.raw_token && (
                              <button
                                onClick={() => handleCopy(`${window.location.origin}/access/${share.raw_token}`)}
                                className="btn btn-secondary btn-sm"
                                title="Copy Secure Access Link"
                              >
                                <Copy size={13} />
                              </button>
                            )}

                            {/* Share Again */}
                            {isActive && (
                              <button
                                onClick={() => handleOpenExternalShareForPolicy(share)}
                                className="btn btn-secondary btn-sm"
                                style={{ color: '#22d3ee', borderColor: 'rgba(6, 182, 212, 0.4)' }}
                                title="Share Again via WhatsApp, Gmail, Telegram, Native Share"
                              >
                                <Share2 size={13} /> Share Again
                              </button>
                            )}

                            {/* View Access History */}
                            <button
                              onClick={() => handleOpenHistoryModal(share)}
                              className="btn btn-secondary btn-sm"
                              title="View Access History"
                            >
                              <History size={13} />
                            </button>

                            {/* Revoke Access */}
                            {isActive && (
                              <button
                                onClick={() => handleRevokeShare(share.id)}
                                className="btn btn-danger btn-sm"
                                title="Revoke Access Immediately"
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
                          {share.subject && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--accent-blue)', marginTop: 2, fontWeight: 500 }}>
                              Subject: {share.subject}
                            </div>
                          )}
                          {share.message && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={share.message}>
                              "{share.message}"
                            </div>
                          )}
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

      {/* External Share Modal */}
      <ExternalShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        shareData={shareModalData}
        onRevokeSuccess={() => loadPortalData(true)}
        onShareTracked={() => loadPortalData(true)}
      />

      {/* Access History Audit Modal */}
      <PolicyHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        policy={historyModalPolicy}
      />
    </div>
  );
}
