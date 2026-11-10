export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)',
        padding: '1.25rem 2rem',
        textAlign: 'center',
        fontSize: '0.85rem',
        color: 'var(--text-muted)',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <span>BalanceVault © 2026 — Money movement with a ledger you can prove.</span>
        <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)' }}>
          <span>PostgreSQL + Prisma</span>
          <span>Double-Entry Bookkeeping</span>
          <span>Argon2 Security</span>
        </div>
      </div>
    </footer>
  );
}
