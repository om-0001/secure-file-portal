import React, { useState, useEffect } from 'react';
import { Inbox, Eye, Download, Lock, Clock, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';

export default function ReceiverDashboard({ onOpenViewer, onOpenPortal }) {
  const [receivedShares, setReceivedShares] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadShares();
  }, []);

  const loadShares = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/access/shares/received/');
      setReceivedShares(data);
    } catch (err) {
      console.error('Failed to load received shares', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (policyId, fileName) => {
    try {
      // Find token associated with policy or trigger direct download
      alert(`To access this file, use the designated ephemeral link provided by the sender. Validating directly through the portal.`);
    } catch (err) {
      alert(err.message || 'Download error');
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h2>Files Shared With Me</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
          Access encrypted files granted to your authenticated identity. Permission is governed strictly by the sender's ephemeral policy.
        </p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontSize: '1.15rem' }}>Authorized Incoming Shares</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {receivedShares.length} incoming authorizations
          </span>
        </div>

        {receivedShares.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
            <Inbox size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>No files have been shared with you yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Sender</th>
                  <th>Access Type</th>
                  <th>Expires At</th>
                  <th>Accesses Remaining</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {receivedShares.map((share) => {
                  const remaining = Math.max(0, share.max_accesses - share.access_count);
                  const isUsable = share.status === 'ACTIVE' && share.is_valid_now && remaining > 0;

                  return (
                    <tr key={share.id}>
                      <td style={{ fontWeight: 600 }}>{share.file.original_name}</td>
                      <td>
                        <div>{share.sender.username}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{share.sender.email}</div>
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
                      <td style={{ fontWeight: 600 }}>
                        {remaining} remaining (of {share.max_accesses})
                      </td>
                      <td>
                        <StatusBadge status={share.status} />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {isUsable ? (
                          <div style={{ display: 'inline-flex', gap: 8 }}>
                            <button
                              onClick={() => onOpenPortal(share.raw_token)}
                              className={`btn btn-sm ${share.access_type === 'VIEW_ONLY' ? 'btn-primary' : 'btn-emerald'}`}
                            >
                              {share.access_type === 'VIEW_ONLY' ? (
                                <>
                                  <Eye size={14} /> View File
                                </>
                              ) : (
                                <>
                                  <Download size={14} /> Access / Download
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {share.status === 'EXPIRED' ? 'Expired' : share.status === 'REVOKED' ? 'Revoked' : 'Limit Reached'}
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
    </div>
  );
}
