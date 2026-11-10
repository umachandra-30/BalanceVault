import React, { useState } from 'react';
import { Card } from '../components/Card.tsx';
import { Input } from '../components/Input.tsx';
import { Button } from '../components/Button.tsx';
import { Link } from 'react-router-dom';
import { KeyRound, Mail, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNotice('Phase 1 Foundation Setup: Authentication backend API is planned for Phase 3.');
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
        {notice && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: 6,
              backgroundColor: 'var(--accent-glow)',
              color: 'var(--accent-primary)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              border: '1px solid var(--accent-primary)',
            }}
          >
            <AlertCircle size={18} />
            <span>{notice}</span>
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
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            required
          />

          <Button
            type="submit"
            variant="primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            leftIcon={<KeyRound size={16} />}
          >
            Sign In to BalanceVault
          </Button>
        </form>

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
