import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/Card.tsx';
import { Input } from '../components/Input.tsx';
import { Button } from '../components/Button.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { KeyRound, Mail, Lock, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const loggedInUser = await login(email, password);
      setSuccessMessage('Authentication successful! Loading your dashboard...');

      setTimeout(() => {
        if (loggedInUser.role === 'ADMIN') {
          navigate('/admin/onboardings');
        } else if (loggedInUser.status === 'PENDING_ONBOARDING') {
          navigate('/onboarding');
        } else {
          navigate('/dashboard');
        }
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div style={{ maxWidth: 460, margin: '4rem auto', padding: '0 1rem', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: 'var(--accent-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            marginBottom: '1rem',
            boxShadow: '0 0 16px var(--accent-glow)',
          }}
        >
          <ShieldCheck size={28} />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Sign in to access your BalanceVault account
        </p>
      </div>

      <Card>
        {errorMessage && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--danger)',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--success)',
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Email Address"
            type="email"
            placeholder="e.g. user@balancevault.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            required
            disabled={isLoading}
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            required
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            leftIcon={<KeyRound size={16} />}
            isLoading={isLoading}
          >
            Sign In to BalanceVault
          </Button>
        </form>

        {/* Demo Fast Fillers */}
        <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
            DEMO QUICK LOGINS:
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleFillDemo('admin@balancevault.local', 'DemoPass123!')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--accent-primary)', cursor: 'pointer' }}
            >
              👑 Admin
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('auditor@balancevault.local', 'DemoPass123!')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              🔍 Auditor
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('alice@example.com', 'DemoPass123!')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              👤 Alice (Active)
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('bob@example.com', 'DemoPass123!')}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4, border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer' }}
            >
              ⏳ Bob (Pending)
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
          }}
        >
          Do not have an account yet?{' '}
          <Link to="/register" style={{ fontWeight: 600 }}>
            Register here
          </Link>
        </div>
      </Card>
    </div>
  );
}
