import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  ShieldAlert, 
  ArrowLeft, 
  Lock, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  ShieldCheck,
  Ban,
  Printer,
  Download
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

// Configure PDF.js worker locally to avoid CDN failure
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export default function SecureViewerPage({ token, fileMeta, password, onBack }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasFetchedRef = useRef(false);

  // Content States
  const [fileType, setFileType] = useState(''); // 'pdf', 'image', 'text', 'other'
  const [textContent, setTextContent] = useState('');
  const [imageUrl, setImageUrl] = useState(null);

  // PDF Canvas Viewer States
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [renderingPage, setRenderingPage] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Anti-print and Anti-save Keyboard listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Intercept Ctrl+P, Ctrl+S, Ctrl+U, F12, Ctrl+Shift+I, Cmd+P, Cmd+S
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')
      ) {
        e.preventDefault();
        e.stopPropagation();
        alert('Security Policy Alert: Printing and downloading are strictly prohibited in View-Only mode.');
        return false;
      }
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Fetch Decrypted File Stream
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetchDecryptedStream();
    return () => {
      if (imageUrl) {
        window.URL.revokeObjectURL(imageUrl);
      }
    };
  }, [token]);

  const fetchDecryptedStream = async () => {
    setLoading(true);
    setError(null);

    try {
      const query = password ? `?password=${encodeURIComponent(password)}` : '';
      const blob = await apiRequest(`/access/token/${token}/view/${query}`);
      
      const mime = (fileMeta?.mime_type || blob.type || '').toLowerCase();
      const fileName = (fileMeta?.file_name || '').toLowerCase();

      if (mime.includes('pdf') || fileName.endsWith('.pdf')) {
        setFileType('pdf');
        const arrayBuffer = await blob.arrayBuffer();
        const loadedPdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPdfDoc(loadedPdf);
        setNumPages(loadedPdf.numPages);
        setPageNum(1);
      } else if (mime.includes('image') || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
        setFileType('image');
        const url = window.URL.createObjectURL(blob);
        setImageUrl(url);
      } else if (mime.includes('text') || mime.includes('json') || fileName.match(/\.(txt|csv|json|md|py|js|html)$/)) {
        setFileType('text');
        const text = await blob.text();
        setTextContent(text);
      } else {
        setFileType('text');
        const text = await blob.text();
        setTextContent(text);
      }
    } catch (err) {
      setError(err.message || 'Decryption failed or link expired.');
    } finally {
      setLoading(false);
    }
  };

  // Render PDF Page onto HTML5 Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isMounted = true;
    const renderPdfPage = async () => {
      setRenderingPage(true);
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering PDF page on canvas', err);
      } finally {
        if (isMounted) setRenderingPage(false);
      }
    };

    renderPdfPage();
    return () => { isMounted = false; };
  }, [pdfDoc, pageNum, scale]);

  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum(pageNum + 1);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.6));
  };

  return (
    <div 
      className="secure-view-protected"
      style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 20px 40px 20px' }}
      onContextMenu={(e) => {
        e.preventDefault();
        return false;
      }}
    >
      {/* Top Controls Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} /> Return to Portal Hub
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
            <Lock size={13} /> SECURE VIEW-ONLY ENFORCED
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {fileMeta?.file_name}
          </span>
        </div>
      </div>

      {/* Security Disclaimer Banner */}
      <div
        style={{
          padding: '14px 20px',
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Lock size={20} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#fff' }}>Protected View Mode Active:</strong> Decrypted directly in isolated browser memory.
            <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
              Direct downloads, print commands, and file saving have been cryptographically stripped and disabled.
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <span className="badge badge-revoked" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Download size={12} /> Download Disabled
          </span>
          <span className="badge badge-revoked" style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Printer size={12} /> Print Blocked
          </span>
        </div>
      </div>

      {/* Canvas / Secure Content Viewer Frame */}
      <div
        ref={containerRef}
        className="card"
        style={{
          padding: 0,
          overflow: 'hidden',
          minHeight: 650,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: '#070b12',
          border: '1px solid rgba(59, 130, 246, 0.2)',
        }}
      >
        {/* Anti-Theft Dynamic Security Watermark Grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 30,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridTemplateRows: 'repeat(3, 1fr)',
            opacity: 0.13,
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.05rem',
            textAlign: 'center',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            overflow: 'hidden',
          }}
        >
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transform: 'rotate(-25deg)',
                padding: 10,
              }}
            >
              <div>CONFIDENTIAL • VIEW ONLY</div>
              <div style={{ fontSize: '0.75rem', marginTop: 2 }}>{user?.email || 'AUTHORIZED IDENTITY'}</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>NO PRINT • NO DOWNLOAD</div>
            </div>
          ))}
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="pulse-scan" style={{ fontSize: '1.15rem', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Decrypting payload in-memory & initializing protected canvas...
            </div>
          </div>
        )}

        {/* Decryption Error */}
        {error && (
          <div style={{ padding: 70, textAlign: 'center' }}>
            <ShieldAlert size={50} color="var(--accent-rose)" style={{ marginBottom: 14 }} />
            <h3 style={{ color: '#f87171', marginBottom: 8 }}>Decryption / Security Rejection</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{error}</p>
          </div>
        )}

        {/* PDF CANVAS VIEWER */}
        {!loading && !error && fileType === 'pdf' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Custom Canvas Toolbar (NO print/download buttons!) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 20px',
                background: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid var(--border-subtle)',
                zIndex: 20,
              }}
            >
              {/* Page Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handlePrevPage}
                  disabled={pageNum <= 1 || renderingPage}
                  className="btn btn-secondary btn-sm"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} /> Previous
                </button>

                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 8px' }}>
                  Page {pageNum} of {numPages}
                </span>

                <button
                  onClick={handleNextPage}
                  disabled={pageNum >= numPages || renderingPage}
                  className="btn btn-secondary btn-sm"
                  title="Next Page"
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>

              {/* Zoom Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handleZoomOut}
                  disabled={scale <= 0.6 || renderingPage}
                  className="btn btn-secondary btn-sm"
                  title="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: 45, textAlign: 'center' }}>
                  {Math.round(scale * 100)}%
                </span>

                <button
                  onClick={handleZoomIn}
                  disabled={scale >= 2.5 || renderingPage}
                  className="btn btn-secondary btn-sm"
                  title="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
              </div>
            </div>

            {/* Canvas Container */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: '24px 16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                maxHeight: '75vh',
                position: 'relative',
              }}
            >
              <canvas
                ref={canvasRef}
                style={{
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                  borderRadius: '4px',
                  background: '#fff',
                  maxWidth: '100%',
                }}
              />
            </div>
          </div>
        )}

        {/* IMAGE VIEWER */}
        {!loading && !error && fileType === 'image' && imageUrl && (
          <div
            style={{
              width: '100%',
              padding: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              maxHeight: '75vh',
              overflow: 'auto',
            }}
          >
            <img
              src={imageUrl}
              alt="Decrypted Document"
              style={{
                maxWidth: '100%',
                maxHeight: '70vh',
                objectFit: 'contain',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                pointerEvents: 'none', // Prevent image dragging
              }}
            />
          </div>
        )}

        {/* TEXT / CODE VIEWER */}
        {!loading && !error && fileType === 'text' && (
          <div style={{ width: '100%', padding: 28, maxHeight: '75vh', overflowY: 'auto' }}>
            <pre
              style={{
                color: '#e2e8f0',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {textContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
