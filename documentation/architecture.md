# BalanceVault — System Architecture & Design

> "Money movement with a ledger you can prove."

## 1. High-Level Architecture Overview

BalanceVault is built as a modular monorepo web platform engineered for verifiable financial integrity, role-based access control, and complete auditability.

```
                    ┌─────────────────────────────────────────┐
                    │          React + Vite Frontend          │
                    │      (Responsive Modern UI / SPA)       │
                    └────────────────────┬────────────────────┘
                                         │ HTTPS / REST (JSON)
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │          Express.js API Gateway         │
                    │   - Security Headers (Helmet)           │
                    │   - Origin Controls (CORS)              │
                    │   - Centralized Error & 404 Handlers    │
                    │   - Sanitized Request Logging           │
                    │   - Zod Input & Environment Validation  │
                    └──────────────┬──────────────────┬───────┘
                                   │                  │
               Rate Limiting &     │                  │ Type-Safe Queries
               Transient State     ▼                  ▼ & Transactions
                       ┌───────────────┐     ┌────────────────────────┐
                       │  Redis Cache  │     │       Prisma ORM       │
                       │ (or Fallback) │     └───────────┬────────────┘
                       └───────────────┘                 │
                                                         ▼
                                             ┌────────────────────────┐
                                             │  PostgreSQL Database   │
                                             │  - Relational Schema   │
                                             │  - Double-Entry Ledger │
                                             │  - Audit Logs          │
                                             │  - Least-Privilege     │
                                             └────────────────────────┘
```

---

## 2. Monorepo Organization

```
BalanceVault/
├── backend/                  # Express REST API, Prisma ORM & Business Logic
│   ├── prisma/               # Prisma schema, migrations, and seeds
│   │   └── schema.prisma     # Relational database models
│   ├── src/
│   │   ├── config/           # Environment, logger, redis configs
│   │   ├── middleware/       # Error handling, request logging, security
│   │   ├── routes/           # REST API routes (/api/v1/...)
│   │   ├── utils/            # Standard response helpers, AppError classes
│   │   ├── app.ts            # Express application bootstrap
│   │   └── server.ts         # HTTP server entry point with graceful shutdown
│   ├── tests/                # Automated API & unit test suites
│   ├── tsconfig.json         # Backend TypeScript config
│   └── package.json
│
├── frontend/                 # React 18 SPA (Vite + TypeScript)
│   ├── src/
│   │   ├── components/       # Reusable UI components (Navbar, Button, Input, Card)
│   │   ├── pages/            # Login, Register, Dashboard, NotFound
│   │   ├── index.css         # Responsive fintech design system
│   │   ├── App.tsx           # Route layout & router mounting
│   │   └── main.tsx          # Client entry point
│   ├── index.html            # Single page app template
│   ├── vite.config.ts        # Vite config with API reverse proxy
│   └── package.json
│
├── documentation/            # Architectural and operational specs
│   ├── architecture.md       # System design & component interactions
│   ├── database-schema.md    # Ledger models & relational dictionary
│   └── development-guide.md  # Step-by-step setup and troubleshooting
│
├── .env.example              # Root environment template
├── .gitignore                # Git exclusions
├── package.json              # Monorepo workspaces & convenience scripts
└── README.md                 # Project guide & quickstart
```

---

## 3. Financial Integrity: Double-Entry Ledger Principles

1. **Balance Equation**: Every transaction consists of balanced debits and credits:
   $$\sum \text{Debits} = \sum \text{Credits}$$
2. **Immutability**: Ledger entries (`LedgerEntry`) are strictly append-only. They are never updated or deleted. Corrections are handled by posting compensating reversal transactions.
3. **Atomicity**: Transactions are wrapped in PostgreSQL ACID transactions. An account balance is updated only when its corresponding ledger entry succeeds.
4. **Idempotency**: Every financial request carries a unique idempotency key (`Idempotency-Key` header). If a request is retried, the system returns the cached outcome instead of executing duplicate transfers.
5. **Least-Privilege Database Roles**: The application connects using tailored database privileges, while auditors receive read-only roles with no table mutation rights.

