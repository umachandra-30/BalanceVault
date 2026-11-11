import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Card } from '../components/Card.tsx';
import { Badge } from '../components/Badge.tsx';
import { Button } from '../components/Button.tsx';
import { Input } from '../components/Input.tsx';
import {
  CreditCard,
  PlusCircle,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  X,
  Clock,
  ArrowUpRight,
  ReceiptText,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface AccountItem {
  id: string;
  accountNumber: string;
  type: 'CHECKING' | 'SAVINGS' | 'SYSTEM_SETTLEMENT';
  status: 'PENDING' | 'ACTIVE' | 'FROZEN' | 'CLOSED';
  currency: string;
  balance: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    status: string;
  };
}

interface BalanceResponse {
  accountId: string;
  accountNumber: string;
  balance: string;
  currency: string;
  status: string;
}

export function AccountsPage() {
  const { user, token, refreshUser } = useAuth();
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccountType, setNewAccountType] = useState<'CHECKING' | 'SAVINGS'>('CHECKING');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Selected account for details drawer
  const [selectedAccount, setSelectedAccount] = useState<AccountItem | null>(null);
  const [balanceDetail, setBalanceDetail] = useState<BalanceResponse | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Admin status update states
  const [adminTargetStatus, setAdminTargetStatus] = useState<'ACTIVE' | 'FROZEN' | 'CLOSED'>('ACTIVE');
  const [adminStatusReason, setAdminStatusReason] = useState('');
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminActionError, setAdminActionError] = useState<string | null>(null);

  // Fetch accounts list
  const fetchAccounts = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to fetch accounts');
      }
      setAccounts(data.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error fetching accounts';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [token]);

  // Fetch single account balance
  const refreshSingleBalance = async (accountId: string) => {
    if (!token) return;
    setBalanceLoading(true);
    try {
      const res = await fetch(`/api/v1/accounts/${accountId}/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBalanceDetail(data.data);
        // Also update in accounts list
        setAccounts((prev) =>
          prev.map((acc) =>
            acc.id === accountId ? { ...acc, balance: data.data.balance, status: data.data.status } : acc
          )
        );
        if (selectedAccount && selectedAccount.id === accountId) {
          setSelectedAccount((prev) =>
            prev ? { ...prev, balance: data.data.balance, status: data.data.status } : null
          );
        }
      }
    } catch {
      // Balance fetch failed silently, fallback to existing display
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleOpenDetails = (acc: AccountItem) => {
    setSelectedAccount(acc);
    setAdminTargetStatus(acc.status === 'ACTIVE' ? 'FROZEN' : 'ACTIVE');
    setAdminStatusReason('');
    setAdminActionError(null);
    refreshSingleBalance(acc.id);
  };

  // Create new account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: newAccountType,
          currency: 'USD',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create account');
      }
      setShowCreateModal(false);
      setSuccessMsg(`Successfully opened new ${newAccountType} account: ${data.data.accountNumber}`);
      await fetchAccounts();
      await refreshUser();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creating account';
      setCreateError(message);
    } finally {
      setCreateLoading(false);
    }
  };

  // Admin status update
  const handleAdminStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedAccount) return;
    setAdminActionLoading(true);
    setAdminActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/accounts/${selectedAccount.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: adminTargetStatus,
          reason: adminStatusReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to update account status');
      }
      setSuccessMsg(`Account ${selectedAccount.accountNumber} status changed to ${adminTargetStatus}`);
      setSelectedAccount(data.data);
      await fetchAccounts();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Status update failed';
      setAdminActionError(message);
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchesSearch =
        acc.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.user?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.user?.email.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || acc.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || acc.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [accounts, searchTerm, statusFilter, typeFilter]);

  // Aggregate metrics
  const totalBalance = useMemo(() => {
    return accounts.reduce((acc, curr) => acc + (parseFloat(curr.balance) || 0), 0);
  }, [accounts]);

  const activeCount = useMemo(() => {
    return accounts.filter((a) => a.status === 'ACTIVE').length;
  }, [accounts]);

  const formatBalance = (amount: string | number) => {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(val)
      ? '$0.00'
      : `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: AccountItem['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">ACTIVE</Badge>;
      case 'FROZEN':
        return <Badge variant="warning">FROZEN</Badge>;
      case 'CLOSED':
        return <Badge variant="danger">CLOSED</Badge>;
      case 'PENDING':
        return <Badge variant="info">PENDING</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <Card>
          <Lock size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Authentication Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Please log in to access your BalanceVault financial accounts and ledger records.
          </p>
          <Link to="/login">
            <Button variant="primary">Proceed to Login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {user.role === 'ADMIN'
                ? 'Account Management Registry'
                : user.role === 'AUDITOR'
                ? 'Auditor Account Ledger Explorer'
                : 'My Financial Accounts'}
            </h1>
            {user.role === 'AUDITOR' && <Badge variant="info">Read-Only Mode</Badge>}
            {user.role === 'ADMIN' && <Badge variant="neutral">Administrative Controls Active</Badge>}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {user.role === 'ACCOUNT_HOLDER'
              ? 'View balances, inspect account details, and open additional savings or checking accounts.'
              : user.role === 'ADMIN'
              ? 'Oversee system-wide accounts, manage account operational status (Freeze/Unfreeze/Close), and inspect ownership.'
              : 'Audit read-only access to platform accounts, immutable balances, and verification metadata.'}
          </p>
        </div>

        {/* Action Button: Only active ACCOUNT_HOLDER can open an account */}
        {user.role === 'ACCOUNT_HOLDER' && (
          <div>
            {user.status === 'ACTIVE' ? (
              <Button
                variant="primary"
                leftIcon={<PlusCircle size={18} />}
                onClick={() => setShowCreateModal(true)}
              >
                Open New Account
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled
                title="KYC Onboarding must be approved to open accounts"
              >
                Account Opening Locked (Pending KYC)
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Feedback Messages */}
      {successMsg && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--success)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--danger)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <AlertCircle size={18} />
          <span style={{ fontSize: '0.9rem' }}>{error}</span>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '2rem',
        }}
      >
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {user.role === 'ACCOUNT_HOLDER' ? 'TOTAL CUMULATIVE BALANCE' : 'PLATFORM AGGREGATE BALANCE'}
            </span>
            <ReceiptText size={18} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
            {formatBalance(totalBalance)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Calculated via double-entry ledger balance state
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ACTIVE ACCOUNTS
            </span>
            <CreditCard size={18} color="var(--success)" />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, marginTop: '0.5rem', color: 'var(--text-primary)' }}>
            {activeCount}{' '}
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
              / {accounts.length} total
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Authorized for financial movements
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              LEDGER INTEGRITY STATUS
            </span>
            <Shield size={18} color="var(--accent-primary)" />
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.75rem', color: 'var(--success)' }}>
            Double-Entry Locked
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Zero-sum balanced & audit logged
          </div>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <Input
              placeholder={
                user.role === 'ACCOUNT_HOLDER'
                  ? 'Search by account number (e.g. BV-1001)...'
                  : 'Search by account number, holder name or email...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} />}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <SlidersHorizontal size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="FROZEN">FROZEN</option>
                <option value="CLOSED">CLOSED</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.85rem',
                }}
              >
                <option value="ALL">All Types</option>
                <option value="CHECKING">CHECKING</option>
                <option value="SAVINGS">SAVINGS</option>
                <option value="SYSTEM_SETTLEMENT">SYSTEM SETTLEMENT</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={fetchAccounts}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      {/* Account Grid / Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <RefreshCw size={32} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading account ledgers...</p>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <CreditCard size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Accounts Found</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            {searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL'
              ? 'No accounts matched your search and filter criteria. Try resetting your filters.'
              : user.role === 'ACCOUNT_HOLDER'
              ? 'You do not have any open accounts yet. Submit your onboarding verification to receive your initial checking account.'
              : 'No accounts recorded in the database.'}
          </p>
          {(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setTypeFilter('ALL');
              }}
            >
              Clear Filters
            </Button>
          )}
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredAccounts.map((acc) => (
            <Card
              key={acc.id}
              style={{
                cursor: 'pointer',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
              onClick={() => handleOpenDetails(acc)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {acc.type.replace('_', ' ')}
                    </span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                      {acc.accountNumber}
                    </div>
                  </div>
                  <div>{getStatusBadge(acc.status)}</div>
                </div>

                {/* Show Owner information for Admin / Auditor */}
                {acc.user && (
                  <div
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: 6,
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '1rem',
                      fontSize: '0.8rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{acc.user.fullName}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{acc.user.email}</div>
                  </div>
                )}
              </div>

              <div>
                <div
                  style={{
                    paddingTop: '0.85rem',
                    borderTop: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Available Balance</span>
                  <span style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatBalance(acc.balance)}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.75rem',
                    paddingTop: '0.5rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>Currency: {acc.currency}</span>
                  <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 500 }}>
                    Inspect Details <ArrowUpRight size={13} />
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Account Details & Management Drawer / Modal */}
      {selectedAccount && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={() => setSelectedAccount(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              maxWidth: 640,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <CreditCard size={22} color="var(--accent-primary)" />
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Account Specification</h2>
                  {getStatusBadge(selectedAccount.status)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
                  {selectedAccount.accountNumber}
                </div>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Live Balance Card */}
            <div
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border-color)',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Verified Ledger Balance ({selectedAccount.currency})
                </span>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                  {balanceDetail ? formatBalance(balanceDetail.balance) : formatBalance(selectedAccount.balance)}
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Exact Decimal precision: {balanceDetail?.balance || selectedAccount.balance}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={balanceLoading ? 'animate-spin' : ''} />}
                onClick={() => refreshSingleBalance(selectedAccount.id)}
                disabled={balanceLoading}
              >
                Verify Balance
              </Button>
            </div>

            {/* Metadata Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Account Type</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAccount.type}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Currency</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAccount.currency} (ISO 4217)</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Internal Account ID</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {selectedAccount.id}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>Created Date</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {new Date(selectedAccount.createdAt).toLocaleString()}
                </span>
              </div>

              {selectedAccount.user && (
                <div style={{ gridColumn: 'span 2', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 6 }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem', fontSize: '0.75rem' }}>
                    Account Holder Profile
                  </span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedAccount.user.fullName}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{selectedAccount.user.email}</div>
                </div>
              )}
            </div>

            {/* Admin Status Controls Section (Visible only to ADMIN) */}
            {user.role === 'ADMIN' && (
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <ShieldAlert size={18} color="var(--warning)" />
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Administrative Status Control</h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Modify account status. Changing to FROZEN prevents all debit and credit movements. Changing to CLOSED permanently deactivates account access.
                </p>

                {adminActionError && (
                  <div
                    style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--danger-bg)',
                      color: 'var(--danger)',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    {adminActionError}
                  </div>
                )}

                <form onSubmit={handleAdminStatusChange}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        Target Status
                      </label>
                      <select
                        value={adminTargetStatus}
                        onChange={(e) => setAdminTargetStatus(e.target.value as 'ACTIVE' | 'FROZEN' | 'CLOSED')}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '0.55rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="FROZEN">FROZEN</option>
                        <option value="CLOSED">CLOSED</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                        Audit Justification Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Risk compliance review or customer request..."
                        value={adminStatusReason}
                        onChange={(e) => setAdminStatusReason(e.target.value)}
                        style={{
                          width: '100%',
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: '0.55rem',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant={adminTargetStatus === 'FROZEN' ? 'warning' : adminTargetStatus === 'CLOSED' ? 'danger' : 'primary'}
                    size="sm"
                    loading={adminActionLoading}
                  >
                    Confirm Status Transition to {adminTargetStatus}
                  </Button>
                </form>
              </div>
            )}

            {/* Auditor Read-Only Notice */}
            {user.role === 'AUDITOR' && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <Shield size={16} color="var(--info)" />
                Auditor View: Account parameters are read-only. Ledger transactions and balances are immutable.
              </div>
            )}

            {/* Transaction History Placeholder */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Double-Entry Transaction History</h4>
                <Badge variant="neutral">Phase 7 Engine Ready</Badge>
              </div>

              <div
                style={{
                  padding: '2rem 1.5rem',
                  backgroundColor: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                  border: '1px dashed var(--border-color)',
                  textAlign: 'center',
                }}
              >
                <Clock size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem' }} />
                <h5 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  No Financial Movements Recorded
                </h5>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto' }}>
                  BalanceVault's double-entry accounting engine will record deposits, withdrawals, and peer-to-peer transfers with atomic debit/credit balancing in Phase 7.
                </p>
              </div>
            </div>

            {/* Modal Close Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.75rem' }}>
              <Button variant="secondary" onClick={() => setSelectedAccount(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Open Account Modal (for ACCOUNT_HOLDER) */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
              maxWidth: 480,
              width: '100%',
              padding: '2rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Open New Account</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Create an additional verified account under your verified KYC profile.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  borderRadius: 6,
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAccount}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Select Account Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div
                    onClick={() => setNewAccountType('CHECKING')}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius)',
                      border: `2px solid ${newAccountType === 'CHECKING' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      backgroundColor: newAccountType === 'CHECKING' ? 'var(--accent-glow)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Checking</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Daily expenses & transfers
                    </div>
                  </div>

                  <div
                    onClick={() => setNewAccountType('SAVINGS')}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius)',
                      border: `2px solid ${newAccountType === 'SAVINGS' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      backgroundColor: newAccountType === 'SAVINGS' ? 'var(--accent-glow)' : 'var(--bg-primary)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Savings</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Interest & wealth preservation
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Base Currency
                </label>
                <input
                  type="text"
                  value="USD (United States Dollar)"
                  disabled
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6,
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={createLoading}>
                  Confirm & Open Account
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AccountsPage;
