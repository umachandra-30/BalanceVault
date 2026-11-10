# BalanceVault — Database Schema Specification

## 1. Overview

The database is built on PostgreSQL using Prisma ORM. It models:
- Users & Role-Based Access Control (`ADMIN`, `ACCOUNT_HOLDER`, `AUDITOR`)
- Bank Accounts (`CHECKING`, `SAVINGS`, `SYSTEM_SETTLEMENT`)
- Double-Entry Ledger (`JournalTransaction` & `LedgerEntry`)
- Audit Log (`AuditLog`)
- Idempotency Tracking (`IdempotencyRecord`)

---

## 2. Entity Relational Models

### `User`
Stores authentication identities, roles, and onboarding status.
- `id`: UUID (Primary Key)
- `email`: VarChar (Unique, indexed)
- `passwordHash`: VarChar (Argon2 / bcrypt hash)
- `fullName`: VarChar
- `role`: Enum (`ADMIN`, `ACCOUNT_HOLDER`, `AUDITOR`)
- `status`: Enum (`PENDING_ONBOARDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### `Account`
Financial accounts holding stored balances.
- `id`: UUID (Primary Key)
- `accountNumber`: VarChar (Unique, 12-digit format, indexed)
- `userId`: UUID (Foreign Key to `User`)
- `currency`: VarChar (e.g., `USD`)
- `type`: Enum (`CHECKING`, `SAVINGS`, `SYSTEM_SETTLEMENT`)
- `status`: Enum (`ACTIVE`, `FROZEN`, `CLOSED`)
- `balance`: Decimal (18, 4) — Current balance snapshot, derived from ledger
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### `JournalTransaction`
High-level financial transaction record representing an economic event.
- `id`: UUID (Primary Key)
- `idempotencyKey`: VarChar (Unique, indexed)
- `type`: Enum (`DEPOSIT`, `WITHDRAWAL`, `TRANSFER`)
- `status`: Enum (`PENDING`, `POSTED`, `REJECTED`)
- `description`: VarChar
- `initiatedById`: UUID (Foreign Key to `User`)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### `LedgerEntry`
Atomic double-entry debits and credits. Every `JournalTransaction` contains at least two ledger entries whose sum balances out.
- `id`: UUID (Primary Key)
- `transactionId`: UUID (Foreign Key to `JournalTransaction`)
- `accountId`: UUID (Foreign Key to `Account`)
- `direction`: Enum (`DEBIT`, `CREDIT`)
- `amount`: Decimal (18, 4) — Non-negative monetary amount
- `balanceAfter`: Decimal (18, 4) — Account balance after entry is applied
- `createdAt`: Timestamp (Immutable append-only)

### `AuditLog`
Security and administrative trail for compliance and auditor review.
- `id`: UUID (Primary Key)
- `action`: VarChar (e.g. `USER_REGISTERED`, `ACCOUNT_FROZEN`, `TRANSFER_EXECUTED`)
- `actorId`: UUID (Nullable Foreign Key to `User`)
- `actorRole`: VarChar
- `targetResource`: VarChar
- `targetId`: VarChar (Nullable)
- `ipAddress`: VarChar (Nullable)
- `userAgent`: VarChar (Nullable)
- `metadata`: JSONB (Sanitized metadata payload)
- `createdAt`: Timestamp

### `IdempotencyRecord`
Guarantees at-most-once execution for mutating API requests.
- `id`: UUID (Primary Key)
- `key`: VarChar (Unique, indexed)
- `endpoint`: VarChar
- `requestHash`: VarChar
- `responseStatus`: Integer
- `responseBody`: JSONB
- `createdAt`: Timestamp
- `expiresAt`: Timestamp
