# BalanceVault — Database Schema Specification

> "Money movement with a ledger you can prove."

## 1. Overview

BalanceVault uses **PostgreSQL 18** and **Prisma ORM**. The data tier enforces:
1. **Mathematical Ledger Integrity**: Double-entry bookkeeping where every financial transaction consists of balanced debits and credits ($\sum \text{Debits} = \sum \text{Credits}$).
2. **Immutability**: `LedgerEntry` rows are strictly append-only. They do not have an `updatedAt` field.
3. **Exact Decimal Precision**: All monetary values are typed as `Decimal(18, 4)`. Floating-point numbers are prohibited.
4. **Least-Privilege Security**: Database-level roles isolate the read-write application user from the strictly read-only auditor user.
5. **PII Protection**: Identity document numbers in `Onboarding` are stored only in masked form (e.g. `******8832`).

---

## 2. Relational Entity Dictionary

### `User` (`users`)
Stores authentication identities, roles, and onboarding status.
- `id`: `String` (UUID PK)
- `email`: `String` (Unique, indexed)
- `passwordHash`: `String` (Argon2id hash)
- `fullName`: `String`
- `role`: Enum `Role` (`ADMIN`, `ACCOUNT_HOLDER`, `AUDITOR`)
- `status`: Enum `UserStatus` (`PENDING_ONBOARDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`)
- `createdAt`: `DateTime` (Default `now()`)
- `updatedAt`: `DateTime` (Auto-updated)
- **Relationships**:
  - `accounts`: `Account[]`
  - `onboarding`: `Onboarding?`
  - `reviewedOnboardings`: `Onboarding[]` (for admin reviewers)
  - `initiatedTxs`: `LedgerTransaction[]`
  - `auditLogs`: `AuditLog[]`

---

### `Onboarding` (`onboardings`)
Tracks identity verification, KYC document submission, and administrator review decisions.
- `id`: `String` (UUID PK)
- `userId`: `String` (Unique FK to `User`)
- `status`: Enum `OnboardingStatus` (`NOT_STARTED`, `SUBMITTED`, `IN_REVIEW`, `APPROVED`, `REJECTED`)
- `documentType`: `String?` (e.g. `PASSPORT`, `NATIONAL_ID`)
- `documentNumberMasked`: `String?` (Masked identifier, e.g. `******8832`)
- `notes`: `String?` (Administrator notes or rejection reason)
- `reviewedById`: `String?` (FK to `User` with role `ADMIN`)
- `submittedAt`: `DateTime?`
- `reviewedAt`: `DateTime?`
- `createdAt`: `DateTime`
- `updatedAt`: `DateTime`

---

### `Account` (`accounts`)
Holds customer and system balances. A user can own multiple accounts (e.g., checking and savings).
- `id`: `String` (UUID PK)
- `accountNumber`: `String` (Unique indexed identifier, e.g. `BV-1000000001`)
- `userId`: `String` (FK to `User`)
- `currency`: `String` (Default `'USD'`)
- `type`: Enum `AccountType` (`CHECKING`, `SAVINGS`, `SYSTEM_SETTLEMENT`)
- `status`: Enum `AccountStatus` (`ACTIVE`, `FROZEN`, `CLOSED`)
- `balance`: `Decimal(18, 4)` (Running balance snapshot derived from ledger)
- `createdAt`: `DateTime`
- `updatedAt`: `DateTime`
- **Relationships**:
  - `user`: `User`
  - `ledgerEntries`: `LedgerEntry[]`

---

### `LedgerTransaction` (`ledger_transactions`)
Represents an atomic financial event (deposit, withdrawal, transfer).
- `id`: `String` (UUID PK)
- `idempotencyKey`: `String` (Unique indexed key for idempotency enforcement)
- `type`: Enum `TransactionType` (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER`)
- `status`: Enum `TransactionStatus` (`PENDING`, `POSTED`, `REJECTED`, `REVERSED`)
- `description`: `String`
- `initiatedById`: `String` (FK to `User`)
- `createdAt`: `DateTime`
- `updatedAt`: `DateTime`
- **Relationships**:
  - `initiatedBy`: `User`
  - `entries`: `LedgerEntry[]` (minimum 2 entries per transaction)

---

### `LedgerEntry` (`ledger_entries`)
Atomic debit or credit entry in double-entry bookkeeping.
- `id`: `String` (UUID PK)
- `transactionId`: `String` (FK to `LedgerTransaction`)
- `accountId`: `String` (FK to `Account`)
- `direction`: Enum `LedgerDirection` (`DEBIT`, `CREDIT`)
- `amount`: `Decimal(18, 4)` (Always positive magnitude)
- `balanceAfter`: `Decimal(18, 4)` (Account balance immediately after entry was applied)
- `createdAt`: `DateTime` (Immutable append-only timestamp. **No `updatedAt`**)
- **Relationships**:
  - `transaction`: `LedgerTransaction`
  - `account`: `Account`

---

### `AuditLog` (`audit_logs`)
Tamper-evident audit trail for security compliance and auditor review.
- `id`: `String` (UUID PK)
- `action`: `String` (e.g. `USER_LOGIN`, `TRANSFER_EXECUTED`, `ONBOARDING_APPROVED`)
- `actorId`: `String?` (FK to `User`, nullable for unauthenticated events)
- `actorRole`: `String?`
- `targetResource`: `String` (`USER`, `ACCOUNT`, `TRANSACTION`, `SYSTEM`)
- `targetId`: `String?`
- `ipAddress`: `String?`
- `userAgent`: `String?`
- `metadata`: `Json?` (Sanitized JSON payload)
- `createdAt`: `DateTime`

---

### `IdempotencyKey` (`idempotency_keys`)
Guarantees at-most-once execution for mutating requests.
- `id`: `String` (UUID PK)
- `key`: `String` (Unique client idempotency token)
- `endpoint`: `String`
- `requestHash`: `String` (SHA-256 hash of the incoming request body)
- `responseStatus`: `Int`
- `responseBody`: `Json` (Cached response returned on duplicate request)
- `createdAt`: `DateTime`
- `expiresAt`: `DateTime` (TTL expiration)

---

## 3. Least-Privilege Database Roles

Configured in [`backend/prisma/roles.sql`](file:///t:/PROJECT/BalanceVault/backend/prisma/roles.sql):

| Role Name | Table Privileges | Sequence Privileges | Role Attributes | Usage Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `balancevault_app` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `USAGE`, `SELECT` | `NOSUPERUSER`, `NOCREATEROLE` | Used by the Node.js backend for everyday transactional operations. |
| `balancevault_auditor` | `SELECT` only | None | `NOSUPERUSER`, `NOCREATEROLE` | Used for read-only auditor exploration and reporting. Cannot alter data. |
