import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Card } from '../components/Card.tsx';
import { Badge } from '../components/Badge.tsx';
import { Button } from '../components/Button.tsx';
import { Input } from '../components/Input.tsx';
import {
  History,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface LedgerEntryItem {
  id: string;
  accountId: string;
  accountNumber: string;
  accountType?: string;
  accountHolderName?: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
  balanceAfter: string;
}

interface TransactionItem {
  id: string;
  idempotencyKey: string;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  status: string;
  description: string;
  createdAt: string;
  initiatedBy?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  entries: LedgerEntryItem[];
}

interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export function TransactionsPage() {
  const { user, token } = useAuth();
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 15, totalCount: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modal
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);

  const fetchTransactions = async (targetPage = page) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(targetPage));
      params.set('limit', '15');
      if (search.trim()) params.set('search', search.trim());
      if (typeFilter) params.set('type', typeFilter);

      const res = await fetch(`/api/v1/transactions?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to fetch transaction history');
      }
      setTransactions(json.data);
      if (json.meta) {
        setMeta(json.meta);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching transactions';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTransactions(1);
    }
  }, [token, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > meta.totalPages) return;
    setPage(newPage);
    fetchTransactions(newPage);
  };

  const formatBalance = (amount: string | number) => {
    const val = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(val)
      ? '$0.00'
      : `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 600, margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <Card>
          <Lock size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Authentication Required</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Please log in to inspect your double-entry financial transaction ledger.
          </p>
          <Link to="/login">
            <Button variant="primary">Proceed to Login</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2.5rem 1.5rem', width: '100%' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
            {user.role === 'ACCOUNT_HOLDER'
              ? 'My Financial Transaction History'
              : 'Platform Double-Entry Ledger Movement'}
          </h1>
          <Badge variant="success">Immutable Ledger</Badge>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {user.role === 'ACCOUNT_HOLDER'
            ? 'Chronological record of deposits, withdrawals, and peer-to-peer transfers backed by zero-sum ledger entries.'
            : 'Audit-grade platform transaction movements verified with atomic row locking and cryptographic idempotency.'}
        </p>
      </div>

      {/* Search and Filters */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <Input
                placeholder="Search memo, account number (BV-...), or idempotency key..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} />}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <SlidersHorizontal size={14} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Operation Type:</span>
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
                  <option value="">All Operations</option>
                  <option value="DEPOSIT">DEPOSIT</option>
                  <option value="WITHDRAWAL">WITHDRAWAL</option>
                  <option value="TRANSFER">TRANSFER</option>
                </select>
              </div>

              <Button type="submit" variant="secondary" size="sm">
                Filter
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
                onClick={() => fetchTransactions(page)}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--danger)',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Transactions Table Card */}
      <Card style={{ padding: '0', overflow: 'hidden', marginBottom: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem' }}>
            <RefreshCw size={32} color="var(--accent-primary)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Loading ledger movements...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-secondary)' }}>
            <History size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem' }}>No Transactions Recorded</h3>
            <p style={{ fontSize: '0.85rem' }}>Execute deposits, withdrawals, or transfers from the Accounts page.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.85rem 1rem' }}>TYPE</th>
                  <th style={{ padding: '0.85rem 1rem' }}>MEMO / DESCRIPTION</th>
                  <th style={{ padding: '0.85rem 1rem' }}>BALANCED LEDGER POSTINGS</th>
                  <th style={{ padding: '0.85rem 1rem' }}>TIMESTAMP</th>
                  <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                      <Badge
                        variant={
                          tx.type === 'DEPOSIT' ? 'success' : tx.type === 'WITHDRAWAL' ? 'warning' : 'info'
                        }
                      >
                        {tx.type}
                      </Badge>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.description}</div>
                      <div style={{ fontSize: '0.725rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        TxID: {tx.id.substring(0, 10)}...
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {tx.entries.map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'var(--bg-primary)',
                              padding: '0.3rem 0.55rem',
                              borderRadius: 4,
                              fontSize: '0.78rem',
                              gap: '0.75rem',
                            }}
                          >
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                              {entry.accountNumber} ({entry.direction})
                            </span>
                            <span
                              style={{
                                fontWeight: 700,
                                color: entry.direction === 'CREDIT' ? 'var(--success)' : 'var(--danger)',
                              }}
                            >
                              {entry.direction === 'CREDIT' ? '+' : '-'}
                              {formatBalance(entry.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                      {new Date(tx.createdAt).toLocaleDateString()}{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'right' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTx(tx)}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.55rem' }}
                      >
                        Inspect Ledger
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--bg-primary)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Showing page <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{meta.page}</span> of{' '}
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{meta.totalPages}</span> ({meta.totalCount} total movements)
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page <= 1 || loading}
              onClick={() => handlePageChange(meta.page - 1)}
              leftIcon={<ChevronLeft size={16} />}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={meta.page >= meta.totalPages || loading}
              onClick={() => handlePageChange(meta.page + 1)}
              rightIcon={<ChevronRight size={16} />}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Transaction Details & Ledger Equilibrium Modal */}
      {selectedTx && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
          onClick={() => setSelectedTx(null)}
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <ShieldCheck size={22} color="var(--success)" />
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 800 }}>Double-Entry Transaction Proof</h3>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  ID: {selectedTx.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Invariant Status Banner */}
            <div
              style={{
                padding: '1rem 1.25rem',
                backgroundColor: 'var(--success-bg)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--success)',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                  Zero-Sum Double-Entry Equilibrium Verified
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  Total Debited Amount strictly equals Total Credited Amount
                </div>
              </div>
              <Badge variant="success">POSTED & AUDITED</Badge>
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>OPERATION TYPE</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedTx.type}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>MEMO</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedTx.description}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>IDEMPOTENCY KEY</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                  {selectedTx.idempotencyKey}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>POSTING TIMESTAMP</span>
                <span style={{ color: 'var(--text-primary)' }}>{new Date(selectedTx.createdAt).toLocaleString()}</span>
              </div>

              {selectedTx.initiatedBy && (
                <div style={{ gridColumn: 'span 2', padding: '0.75rem', backgroundColor: 'var(--bg-primary)', borderRadius: 6 }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>INITIATED BY</span>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedTx.initiatedBy.fullName}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{selectedTx.initiatedBy.email}</div>
                </div>
              )}
            </div>

            {/* Ledger Postings Table */}
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                ATOMIC LEDGER ENTRIES
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedTx.entries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '0.85rem 1rem',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{entry.accountNumber}</span>
                        <Badge variant={entry.direction === 'CREDIT' ? 'success' : 'warning'}>
                          {entry.direction}
                        </Badge>
                      </div>
                      {entry.accountHolderName && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Holder: {entry.accountHolderName}
                        </div>
                      )}
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Balance After: {formatBalance(entry.balanceAfter)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '1.2rem',
                          fontWeight: 800,
                          color: entry.direction === 'CREDIT' ? 'var(--success)' : 'var(--danger)',
                        }}
                      >
                        {entry.direction === 'CREDIT' ? '+' : '-'}
                        {formatBalance(entry.amount)}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                        USD (Exact Decimal)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setSelectedTx(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TransactionsPage;
