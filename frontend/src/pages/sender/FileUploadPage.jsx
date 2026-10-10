import React, { useState } from 'react';
import { 
  UploadCloud, 
  ShieldCheck, 
  Lock, 
  FileCheck2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight,
  FileText
} from 'lucide-react';
import { apiRequest } from '../../api/client';

export default function FileUploadPage({ onUploadSuccess, onNavigateToShare }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0: Idle, 1: Quarantine, 2: Malware Scan, 3: Encrypting, 4: Done
  const [error, setError] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setUploadedFile(null);
      setCurrentStep(0);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setError(null);
    setUploading(true);
    setCurrentStep(1); // Quarantining

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate visual progress stages for clarity in demonstration
      setTimeout(() => setCurrentStep(2), 600); // ClamAV scan
      setTimeout(() => setCurrentStep(3), 1200); // AES-256-GCM

      const response = await apiRequest('/files/upload/', {
        method: 'POST',
        body: formData,
      });

      setCurrentStep(4);
      setUploadedFile(response.file);
      if (onUploadSuccess) onUploadSuccess(response.file);
    } catch (err) {
      setError(err.data || { error: err.message });
      setCurrentStep(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h2>Upload & Encrypt Secure File</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
          Files are automatically quarantined, scanned with ClamAV, and encrypted with AES-256-GCM before storage.
        </p>
      </div>

      {/* Upload Zone Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={handleUpload}>
          <div
            style={{
              border: '2px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(15, 23, 42, 0.4)',
              transition: 'border-color 0.2s',
            }}
            onClick={() => document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={uploading}
            />

            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 'var(--radius-full)',
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--accent-blue)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <UploadCloud size={30} />
            </div>

            {file ? (
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB • {file.type || 'Custom Type'}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#fff' }}>
                  Click to browse or drag file here
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  Allowed: PDF, DOCX, TXT, PNG, JPG, ZIP (Max 25MB)
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!file || uploading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 20, padding: '12px' }}
          >
            {uploading ? 'Processing Security Pipeline...' : 'Upload & Secure File'}
          </button>
        </form>
      </div>

      {/* Security Pipeline Progress Indicator */}
      {uploading && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>
            AUTOMATED SECURITY PIPELINE EXECUTION
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: currentStep >= 1 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                border: currentStep >= 1 ? '1px solid var(--accent-blue)' : '1px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: currentStep >= 1 ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                <ShieldCheck size={16} /> 1. Quarantine
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>Isolated staging hold</div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: currentStep >= 2 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                border: currentStep >= 2 ? '1px solid var(--accent-emerald)' : '1px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: currentStep >= 2 ? 'var(--accent-emerald)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                <ShieldCheck size={16} /> 2. ClamAV Scan
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>Antimalware inspection</div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-md)',
                background: currentStep >= 3 ? 'rgba(139, 92, 246, 0.15)' : 'rgba(30, 41, 59, 0.4)',
                border: currentStep >= 3 ? '1px solid var(--accent-purple)' : '1px solid transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: currentStep >= 3 ? 'var(--accent-purple)' : 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                <Lock size={16} /> 3. AES-256-GCM
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>Envelope encryption</div>
            </div>
          </div>
        </div>
      )}

      {/* Error / Threat Detected Display */}
      {error && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)',
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ color: 'var(--accent-rose)', marginTop: 2 }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h4 style={{ color: '#f87171', marginBottom: 4 }}>Security Alert: File Rejected</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                {error.error || error.detail || 'The security pipeline rejected this file.'}
              </p>
              {error.threat && (
                <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                  <strong>Threat Signature:</strong> {error.threat}
                </div>
              )}
              {error.engine && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Engine: {error.engine}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Details Display */}
      {uploadedFile && (
        <div
          className="card"
          style={{
            borderColor: 'rgba(16, 185, 129, 0.4)',
            background: 'rgba(16, 185, 129, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <CheckCircle2 size={24} color="var(--accent-emerald)" />
            <div>
              <h4 style={{ color: '#34d399' }}>File Successfully Encrypted & Vaulted</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Plaintext purged from memory & quarantine. Stored strictly in AES-256-GCM ciphertext vault.
              </p>
            </div>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: 14, borderRadius: 'var(--radius-md)', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Original File:</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{uploadedFile.original_name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Scan Status:</span>
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>{uploadedFile.scan_status} (Clean)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Encryption:</span>
              <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>AES-256-GCM (Authenticated)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>SHA-256 Fingerprint:</span>
              <code style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{uploadedFile.sha256_hash.substring(0, 20)}...</code>
            </div>
          </div>

          <button
            onClick={() => onNavigateToShare(uploadedFile.id)}
            className="btn btn-emerald"
            style={{ width: '100%', marginTop: 16 }}
          >
            Create Ephemeral Share Link Now <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
