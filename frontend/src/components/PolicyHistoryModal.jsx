import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  Download,
  Share2,
  Ban,
  UserCheck,
  AlertTriangle,
  RefreshCw,
  Search
} from 'lucide-react';
import { apiRequest } from '../api/client';

export default function PolicyHistoryModal({ isOpen, onClose, policy }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (isOpen && policy?.id) {
      loadHistory(policy.id);
    }
  }, [isOpen, policy?.id]);

  const loadHistory = async (policyId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/access/shares/${policyId}/history/`);
      setLogs(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch access history.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !policy) return null;

  const filteredLogs = logs.filter((log) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (log.event_type && log.event_type.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(q))
    );
  });

  const getEventBadge = (type, status) => {
    switch (type) {
      case 'LINK_CREATED':
        return <span className="badge badge-clean">Created</span>;
      case 'EXTERNAL_SHARE':
        return <span className="badge badge-blue">External Share</span>;
      case 'VIEW':
        return <span className="badge badge-blue">Viewed</span>;
      case 'DOWNLOAD':
        return <span className="badge badge-clean">Downloaded</span>;
      case 'WRONG_RECEIVER':
      case 'ACCESS_DENIED':
        return <span className="badge badge-danger">Denied Attempt</span>;
      case 'REVOKED':
        return <span className="badge badge-danger">Revoked</span>;
      case 'LIMIT_REACHED':
      case 'EXPIRED':
        return <span className="badge badge-quarantine">Self-Destructed</span>;
      default:
        return <span className="badge">{type}</span>;
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
          maxWidth: 780,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 28,
          background: '#0b1329',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.4))', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#fff' }}>Access Audit History</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '3px 0 0 0' }}>
                Immutable security logs for <strong style={{ color: '#fff' }}>{policy.file?.original_name || 'File'}</strong> (Receiver: {policy.receiver?.email})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}>
            <X size={16} />
          </button>
        </div>

        {/* Filter bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search event type, IP, or details..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="form-input"
              style={{ paddingLeft: 34, width: '100%', fontSize: '0.82rem' }}
            />
          </div>
          <button
            onClick={() => loadHistory(policy.id)}
            disabled={loading}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'pulse-scan' : ''} /> Refresh
          </button>
        </div>

        {/* Logs Table Area */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 250, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: 'rgba(15, 23, 42, 0.4)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div className="pulse-scan" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                Loading audit trail from database...
              </div>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#f87171' }}>
              <AlertTriangle size={24} style={{ marginBottom: 8 }} />
              <div>{error}</div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No audit events found for this share link.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Timestamp</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Event</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>Details</th>
                  <th style={{ padding: '10px 14px', color: 'var(--text-muted)' }}>IP / Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {getEventBadge(log.event_type, log.status)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#fff', maxWidth: 300, wordBreak: 'break-word' }}>
                      {log.details || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      {log.ip_address || 'Internal/Client'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
