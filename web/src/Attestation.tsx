import { useState, useCallback } from 'react';
import GlareHover from './components/GlareHover';
import Layout, { MONO } from './Layout';

const OCR_API_URL = process.env.REACT_APP_OCR_API_URL ?? '';

function Attestation() {
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyQuote = useCallback(() => {
    if (!quote) return;
    navigator.clipboard.writeText(quote);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [quote]);

  const fetchAttestation = async () => {
    setLoading(true);
    setError(null);
    setQuote(null);
    setEventLog(null);
    setFetched(false);
    try {
      const res = await fetch(`${OCR_API_URL}/attestation`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setQuote(json.quote ?? null);
        setEventLog(json.event_log ?? null);
      }
      setFetched(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to reach attestation service');
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const isInTee = fetched && !error && !!quote;

  return (
    <Layout subtitle="View the TEE attestation of this project">
      <div style={{ position: 'absolute', top: '12rem', left: '2rem', right: '2rem', bottom: '2rem', zIndex: 1, overflowY: 'auto' }}>

        <GlareHover
          background="#000"
          borderColor="#fff"
          borderRadius="0"
          width="auto"
          height="auto"
          glareColor="#ffffff"
          glareOpacity={1}
          glareAngle={-30}
          glareSize={200}
          transitionDuration={800}
          style={{ display: 'inline-grid', marginBottom: '2rem' }}
        >
          <button
            onClick={fetchAttestation}
            disabled={loading}
            style={{ padding: '1rem', background: 'transparent', border: 'none', color: '#fff', ...MONO, fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Fetching...' : 'Fetch TEE Attestation'}
          </button>
        </GlareHover>

        {fetched && !isInTee && (
          <p style={{ color: '#f87171', ...MONO, fontSize: '1rem', margin: '0 0 2rem 0' }}>
            {error?.includes('not available') || error?.includes('TEE')
              ? 'Not running in a TEE (development mode)'
              : `Error: ${error}`}
          </p>
        )}

        {isInTee && (
          <>
            <h2 style={{ color: '#fff', ...MONO, fontSize: '2rem', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ background: '#000', padding: '0.25rem 0' }}>Quote</span>
              <span
                onClick={handleCopyQuote}
                title={copied ? 'Copied!' : 'Copy quote'}
                style={{ cursor: 'pointer', color: copied ? '#4ade80' : '#fff', display: 'inline-flex', alignItems: 'center', fontSize: '1rem' }}
              >
                {copied ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </span>
            </h2>
            <pre style={{
              background: '#000',
              border: '1px solid #333',
              color: '#fff',
              ...MONO,
              fontSize: '1rem',
              padding: '1rem',
              overflowX: 'auto',
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto',
              margin: '0 0 2rem 0',
            }}>
              {quote}
            </pre>

            <GlareHover
              background="#000"
              borderColor="#fff"
              borderRadius="0"
              width="auto"
              height="auto"
              glareColor="#ffffff"
              glareOpacity={1}
              glareAngle={-30}
              glareSize={200}
              transitionDuration={800}
              style={{ display: 'inline-grid' }}
            >
              <button
                onClick={() => window.open('https://proof.t16z.com/', '_blank')}
                style={{ padding: '1rem', background: 'transparent', border: 'none', color: '#fff', ...MONO, fontSize: '1rem', cursor: 'pointer' }}
              >
                Verify on Phala TEE Attestation Explorer
              </button>
            </GlareHover>

          </>
        )}
      </div>
    </Layout>
  );
}

export default Attestation;
