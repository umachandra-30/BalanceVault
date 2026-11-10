import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, ShieldCheck, Database, Layers } from 'lucide-react';

interface BackendHealth {
  status: string;
  uptimeSeconds: number;
  service: string;
  version: string;
}

export function App() {
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setHealth(data.data);
        } else {
          setError(data.error?.message || 'Failed to fetch backend status');
        }
      })
      .catch((err) => {
        setError(`Backend offline or unreachable (${err.message})`);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 0 12px var(--accent-glow)',
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              BalanceVault
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Money movement with a ledger you can prove
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.75rem',
              borderRadius: 20,
              fontSize: '0.8rem',
              fontWeight: 500,
              backgroundColor: loading
                ? 'var(--warning-bg)'
                : error
                ? 'var(--danger-bg)'
                : 'var(--success-bg)',
              color: loading
                ? 'var(--warning)'
                : error
                ? 'var(--danger)'
                : 'var(--success)',
              border: `1px solid ${
                loading
                  ? 'var(--warning)'
                  : error
                  ? 'var(--danger)'
                  : 'var(--success)'
              }`,
            }}
          >
            <Activity size={14} />
            {loading ? 'Checking API...' : error ? 'Backend Offline' : 'API v1 Connected'}
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: 1100, margin: '0 auto', padding: '3rem 1.5rem', width: '100%' }}>
        {/* Hero Section */}
        <div
          style={{
            padding: '2.5rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-color)',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              padding: '0.25rem 0.75rem',
              borderRadius: 6,
              backgroundColor: 'var(--accent-glow)',
              color: 'var(--accent-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              marginBottom: '1rem',
            }}
          >
            Phase 1 — Foundation & Core Architecture
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Auditable Financial Ledger & Account Platform
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', maxWidth: 700 }}>
            BalanceVault ensures financial integrity through immutable double-entry ledger accounting,
            atomic database transactions, strict role-based access control, and comprehensive auditability.
          </p>
        </div>

        {/* Status Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          {/* Card 1: Backend Health */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Layers size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Backend Service</h3>
            </div>
            {loading && <p style={{ color: 'var(--text-muted)' }}>Pinging health endpoint...</p>}
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</p>}
            {health && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>{health.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Service</span>
                  <span>{health.service}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Uptime</span>
                  <span>{health.uptimeSeconds}s</span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Security Architecture */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <ShieldCheck size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Security Hardening</h3>
            </div>
            <ul style={{ listStyle: 'none', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Helmet HTTP Security Headers
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> CORS Whitelist Protection
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Request Payload Size Limiting (100kb)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Sensitive Data Log Redaction
              </li>
            </ul>
          </div>

          {/* Card 3: Ledger Engine */}
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Database size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Ledger Architecture</h3>
            </div>
            <ul style={{ listStyle: 'none', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> PostgreSQL 18 Local Engine
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Prisma Type-Safe ORM
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Double-Entry Debit/Credit Engine
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={16} color="var(--success)" /> Redis-based Rate Limiter Support
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)',
          padding: '1rem 2rem',
          textAlign: 'center',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
        }}
      >
        BalanceVault © 2026 — Secure Account Management & Auditable Financial Movement
      </footer>
    </div>
  );
}

export default App;
