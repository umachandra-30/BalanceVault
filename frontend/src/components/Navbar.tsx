import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Activity, User, KeyRound, LayoutDashboard, LogOut, FileCheck, ShieldAlert, CreditCard } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';

interface BackendHealth {
  status: string;
}

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [health, setHealth] = useState<BackendHealth | null>(null);
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

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        padding: '0.85rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Brand Identity */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            backgroundColor: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 0 14px var(--accent-glow)',
          }}
        >
          <ShieldCheck size={22} />
        </div>
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'block' }}>
            BalanceVault
          </span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: -2 }}>
            Ledger you can prove
          </span>
        </div>
      </Link>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.9rem',
            borderRadius: 6,
            fontSize: '0.875rem',
            fontWeight: 500,
            color: isActive('/') ? 'var(--text-primary)' : 'var(--text-secondary)',
            backgroundColor: isActive('/') ? 'var(--border-subtle)' : 'transparent',
            textDecoration: 'none',
            transition: 'all 0.15s ease',
          }}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </Link>

        {user && (
          <Link
            to="/accounts"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: 6,
              fontSize: '0.875rem',
              fontWeight: 500,
              color: isActive('/accounts') ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive('/accounts') ? 'var(--border-subtle)' : 'transparent',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <CreditCard size={16} />
            Accounts
          </Link>
        )}

        {user && user.role === 'ADMIN' && (
          <Link
            to="/admin/onboardings"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: 6,
              fontSize: '0.875rem',
              fontWeight: 600,
              color: isActive('/admin/onboardings') ? 'var(--accent-primary)' : 'var(--text-primary)',
              backgroundColor: isActive('/admin/onboardings') ? 'var(--accent-glow)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <ShieldAlert size={16} color="var(--accent-primary)" />
            KYC Queue
          </Link>
        )}

        {user && user.role === 'ACCOUNT_HOLDER' && (
          <Link
            to="/onboarding"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: 6,
              fontSize: '0.875rem',
              fontWeight: 500,
              color: isActive('/onboarding') ? 'var(--text-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive('/onboarding') ? 'var(--border-subtle)' : 'transparent',
              textDecoration: 'none',
            }}
          >
            <FileCheck size={16} />
            Onboarding
          </Link>
        )}

        {!user ? (
          <>
            <Link
              to="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                borderRadius: 6,
                fontSize: '0.875rem',
                fontWeight: 500,
                color: isActive('/login') ? 'var(--text-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive('/login') ? 'var(--border-subtle)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              <KeyRound size={16} />
              Sign In
            </Link>

            <Link
              to="/register"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                borderRadius: 6,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: 'var(--accent-primary)',
                textDecoration: 'none',
                boxShadow: '0 2px 8px var(--accent-glow)',
              }}
            >
              <User size={16} />
              Register
            </Link>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {user.fullName} <strong style={{ color: 'var(--accent-primary)' }}>({user.role})</strong>
            </span>
            <button
              onClick={handleSignOut}
              title="Sign Out"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.4rem 0.75rem',
                borderRadius: 6,
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--danger)',
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                cursor: 'pointer',
              }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}

        {/* Backend Status Pill */}
        <div
          style={{
            marginLeft: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 20,
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: loading ? 'var(--warning-bg)' : health ? 'var(--success-bg)' : 'var(--danger-bg)',
            color: loading ? 'var(--warning)' : health ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${loading ? 'var(--warning)' : health ? 'var(--success)' : 'var(--danger)'}`,
          }}
          title={health ? 'Backend API v1 is healthy' : 'Backend is unreachable'}
        >
          <Activity size={13} />
          {loading ? 'Checking...' : health ? 'API Online' : 'API Offline'}
        </div>
      </nav>
    </header>
  );
}
