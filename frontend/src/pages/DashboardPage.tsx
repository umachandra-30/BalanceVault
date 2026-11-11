import { useEffect, useState } from 'react';
import { Card } from '../components/Card.tsx';
import { Badge } from '../components/Badge.tsx';
import { Button } from '../components/Button.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, Layers, Database, Activity, CheckCircle, ArrowRight, Clock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

interface HealthData {
  status: string;
  uptimeSeconds: number;
  service: string;
  version: string;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) setHealth(data.data);
      })
      .catch(() => setHealth(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
      {/* Onboarding Pending Action Banner for logged in users */}
      {user && user.status === 'PENDING_ONBOARDING' && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--warning-bg)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--warning)',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Clock size={24} color="var(--warning)" />
            <div>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'block' }}>
                Account Onboarding Incomplete
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Please submit your identity verification credentials to activate deposit and transfer capabilities.
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => navigate('/onboarding')}
            rightIcon={<ArrowRight size={14} />}
          >
            Complete Onboarding Now
          </Button>
        </div>
      )}

      {/* Logged in Active User Accounts Section */}
      {user && user.status === 'ACTIVE' && user.accounts && user.accounts.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Your Financial Accounts</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Double-entry backed accounts with cryptographically verifiable balances.
              </p>
            </div>
            <Badge variant="success">KYC Verified & Active</Badge>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {user.accounts.map((acc) => (
              <Card key={acc.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>
                      {acc.type} ACCOUNT
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600 }}>
                      {acc.accountNumber}
                    </span>
                  </div>
                  <Badge variant={acc.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {acc.status}
                  </Badge>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Available Balance</span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ${parseFloat(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Platform Banner */}
      <div
        style={{
          padding: '2.5rem',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-color)',
          marginBottom: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Badge variant="info">Phase 5 Onboarding & KYC Active</Badge>
          <Badge variant={loading ? 'warning' : health ? 'success' : 'danger'}>
            {loading ? 'Probing API...' : health ? 'Core Engine Online' : 'API Offline'}
          </Badge>
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
          Secure Account Management & Auditable Movement
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: 720, lineHeight: 1.6 }}>
          BalanceVault ensures financial integrity through immutable double-entry ledger accounting,
          atomic transactions, least-privilege database roles, and end-to-end auditability.
        </p>

        {!user && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.75rem' }}>
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                padding: '0.65rem 1.3rem',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
                boxShadow: '0 2px 10px var(--accent-glow)',
              }}
            >
              Access Account Portal
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '0.65rem 1.3rem',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: '0.9rem',
                textDecoration: 'none',
              }}
            >
              Create New Account
            </Link>
          </div>
        )}
      </div>

      {/* Grid of Core Pillars */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        {/* Core Pillar 1: Backend Health */}
        <Card title="Core Engine Service" icon={<Activity size={20} />}>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Checking backend runtime...</p>
          ) : health ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Status:</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>{health.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Service:</span>
                <span>{health.service}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Uptime:</span>
                <span>{health.uptimeSeconds} seconds</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>API Gateway:</span>
                <span style={{ color: 'var(--accent-primary)' }}>/api/v1 (Express)</span>
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>
              Backend server is currently offline. Start the backend with <code>npm run dev:backend</code>.
            </p>
          )}
        </Card>

        {/* Core Pillar 2: Double-Entry Ledger */}
        <Card title="Double-Entry Ledger" icon={<Database size={20} />}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} color="var(--success)" /> Balanced debits and credits: &sum;Debits = &sum;Credits
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} color="var(--success)" /> Strictly append-only, immutable ledger entries
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} color="var(--success)" /> Atomic database transactions & idempotency
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} color="var(--success)" /> PostgreSQL 18 & Prisma schema compiled
            </li>
          </ul>
        </Card>

        {/* Core Pillar 3: Role-Based Access & Security */}
        <Card title="Role-Based Security" icon={<Layers size={20} />}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} color="var(--accent-primary)" /> <strong>ADMIN:</strong> Review onboarding & KYC queue
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} color="var(--accent-primary)" /> <strong>ACCOUNT_HOLDER:</strong> Balances & transfers
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} color="var(--accent-primary)" /> <strong>AUDITOR:</strong> Read-only compliance access
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={16} color="var(--success)" /> Sensitive credential redaction in logs
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
