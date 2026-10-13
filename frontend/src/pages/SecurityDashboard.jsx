import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Eye,
  Clock,
  Ban,
  FileCheck2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { apiRequest } from '../api/client';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

export default function SecurityDashboard() {
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    setLoading(true);
    try {
      const [statsData, logsData] = await Promise.all([
        apiRequest('/access/stats/').catch(() => null),
        apiRequest('/access/history/').catch(() => []),
      ]);

      setStats(statsData);
      setLogs(logsData);
    } catch (err) {
      console.error('Failed to load security telemetry', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventBadgeClass = (eventType) => {
    switch (eventType) {
      case 'ACCESS_GRANTED':
      case 'VIEW':
      case 'DOWNLOAD':
      case 'SCAN_CLEAN':
        return 'badge-active';
      case 'ACCESS_DENIED':
      case 'WRONG_RECEIVER':
      case 'SCAN_INFECTED':
        return 'badge-revoked';
      case 'EXPIRED':
        return 'badge-expired';
      case 'LIMIT_REACHED':
        return 'badge-limit';
      default:
        return 'badge-blue';
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2>Security & Cryptographic Audit Telemetry</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
            Immutable security event logs, antimalware quarantine results, and zero-trust access attempts.
          </p>
        </div>
        <button onClick={loadSecurityData} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} className={loading ? 'pulse-scan' : ''} /> Refresh Logs
        </button>
      </div>

      {/* Telemetry Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 18, marginBottom: 32 }}>
        <StatCard
          title="Scanned & Vaulted"
          value={stats ? stats.clean_files : 0}
          icon={ShieldCheck}
          color="emerald"
          subtitle="Clean / Antimalware Passed"
        />
        <StatCard
          title="Active Ephemeral Links"
          value={stats ? stats.active_links : 0}
          icon={Clock}
          color="blue"
          subtitle="CSPRNG 256-bit Tokens"
        />
        <StatCard
          title="Denied Attempts"
          value={stats ? stats.denied_attempts : 0}
          icon={ShieldAlert}
          color="rose"
          subtitle="Wrong Receiver / Blocked"
        />
        <StatCard
          title="Revoked Tokens"
          value={stats ? stats.revoked_links : 0}
          icon={Ban}
          color="amber"
          subtitle="Manually Invalidated"
        />
      </div>

      {/* Security Audit Trail Log Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>Immutable Security Audit Trail</h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Zero-Trust records: Unauthorized forwarding, expirations, view streams, and downloads.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Latest {logs.length} logged events
          </span>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            No security audit events recorded yet.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event Type</th>
                  <th>Actor / Recipient</th>
                  <th>Status</th>
                  <th>IP Address</th>
                  <th>Security Event Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} •{' '}
                      {new Date(log.timestamp).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`badge ${getEventBadgeClass(log.event_type)}`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.user_name || 'Anonymous'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.user_email || '—'}</div>
                    </td>
                    <td>
                      <span style={{ color: log.status === 'SUCCESS' ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600, fontSize: '0.8rem' }}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {log.ip_address || '127.0.0.1'}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 350 }}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
