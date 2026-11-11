# BalanceVault — First Administrator Bootstrap Specification & Operational Guide

> "Money movement with a ledger you can prove."

## 1. Problem Statement & Architecture

In any secure multi-tenant banking platform, user registration APIs must **never** permit a user to self-assign the `ADMIN` role. Doing so is a critical security vulnerability (Privilege Escalation).

However, upon initial deployment ("greenfield" installation), the system requires at least one root administrator to review customer onboardings, manage accounts, and view global audit logs.

BalanceVault solves this through a **Controlled, Single-Use First Administrator Bootstrap Mechanism**.

```
                ┌──────────────────────────────────────────────┐
                │        Bootstrap Request (API or CLI)        │
                │  { bootstrapSecret, email, fullName, pass }  │
                └──────────────────────┬───────────────────────┘
                                       │
                                       ▼
                     [1. Secret Configured & Valid?]
                                       │ Yes (Timing-safe comparison)
                                       ▼
                     [2. Does ANY Admin Already Exist?]
                         │                         │
                         │ Yes                     │ No
                         ▼                         ▼
             ┌─────────────────────────┐ ┌───────────────────────────────────┐
             │   409 CONFLICT          │ │   Atomic Provisioning:            │
             │   "Bootstrap rejected:  │ │   - User created (role: ADMIN)    │
             │   Admin already exists" │ │   - Onboarding profile APPROVED   │
             │   Audit: BLOCKED        │ │   - System Settlement Account open│
             │   (LOCKED PERMANENTLY)  │ │   - Audit: BOOTSTRAP_EXECUTED     │
             └─────────────────────────┘ └─────────────────┬─────────────────┘
                                                           │
                                                           ▼
                                                ┌─────────────────────────────┐
                                                │ Success 201 Created         │
                                                │ Mechanism is now permanently│
                                                │ locked against future calls │
                                                └─────────────────────────────┘
```

---

## 2. Core Security Controls

### A. Environment-Based Secret (`ADMIN_BOOTSTRAP_SECRET`)
- The bootstrap mechanism requires the `ADMIN_BOOTSTRAP_SECRET` environment variable (minimum 16 high-entropy characters).
- If this secret is missing or blank, the endpoint is disabled entirely (`403 Forbidden`).
- Secrets are **never** hardcoded in source code.

### B. Timing-Safe Secret Verification (`crypto.timingSafeEqual`)
- Standard string comparisons (`a === b`) terminate on the first differing character, creating a timing side-channel that allows attackers to guess secrets byte-by-byte.
- BalanceVault uses Node.js `crypto.timingSafeEqual` over fixed UTF-8 buffers to guarantee constant-time execution regardless of input similarity.

### C. Automatic Single-Use Lock (Anti-Replay Protection)
- Before creating an admin, the service queries PostgreSQL:
  ```ts
  const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  ```
- If `adminCount > 0`, the bootstrap endpoint **rejects the call immediately** with `409 Conflict`:
  ```
  "Administrator bootstrap rejected: An administrator account already exists. For security reasons, the bootstrap mechanism can only be executed once."
  ```
- Once the initial administrator is created, the bootstrap mechanism is permanently locked. Subsequent administrators can only be invited or provisioned by existing authenticated administrators via internal administrative workflows.

### D. Rejection of Public Registration as ADMIN
- Public registration (`POST /api/v1/auth/register`) strictly accepts only `ACCOUNT_HOLDER` or `AUDITOR`.
- Submitting `role: "ADMIN"` is blocked at the schema validation boundary with a `422 Validation Error` (`"Privilege escalation rejected: The ADMIN role cannot be self-assigned during registration"`).

### E. Database Least-Privilege Protection
- The bootstrap mechanism operates under the standard `balancevault_app` PostgreSQL role.
- It does **not** require PostgreSQL `SUPERUSER` or `CREATEROLE` privileges. It executes standard row-level `INSERT` statements on `users`, `onboardings`, `accounts`, and `audit_logs`.

### F. Tamper-Evident Audit Trail
Every bootstrap attempt writes an immutable record to the `audit_logs` table:
- Successful bootstrap: `action: "ADMIN_BOOTSTRAP_EXECUTED"`
- Invalid secret supplied: `action: "ADMIN_BOOTSTRAP_FAILED"`
- Attempted re-run after lock: `action: "ADMIN_BOOTSTRAP_BLOCKED"`

---

## 3. Operational Procedures

### Option 1: Local Development via Interactive CLI (Recommended)

1. Ensure your `.env` contains `ADMIN_BOOTSTRAP_SECRET`:
   ```bash
   ADMIN_BOOTSTRAP_SECRET="balancevault_super_admin_bootstrap_secret_2026"
   ```
2. Run the bootstrap CLI command from the repository root:
   ```bash
   npm run bootstrap:admin
   ```
3. Follow the interactive prompts:
   ```
   🛡️  BalanceVault — First Administrator Bootstrap CLI
   ================================================================
   Enter Administrator Email Address: admin@balancevault.local
   Enter Administrator Full Name: System Administrator
   Enter Administrator Password: SuperSecureAdmin2026!#
   
   ⏳ Initializing root administrator...
   ✅ Root Administrator Initialized Successfully!
   🔒 The bootstrap mechanism is now automatically locked.
   ```

### Option 2: Production / Deployment via Secure REST API

In headless or containerized environments (Kubernetes, Cloud Run, Docker), administrators can initialize the root admin via curl:

1. **Check if bootstrap is available**:
   ```bash
   curl -X GET https://api.yourdomain.com/api/v1/auth/bootstrap-status
   ```
   Response:
   ```json
   {
     "success": true,
     "data": {
       "canBootstrap": true
     }
   }
   ```

2. **Execute bootstrap**:
   ```bash
   curl -X POST https://api.yourdomain.com/api/v1/auth/bootstrap-admin \
     -H "Content-Type: application/json" \
     -d '{
       "bootstrapSecret": "your_high_entropy_secret_from_env",
       "email": "root.admin@company.com",
       "fullName": "Chief Security Officer",
       "password": "ProdPassword2026!#Strong"
     }'
   ```
   Response (`201 Created`):
   ```json
   {
     "success": true,
     "message": "Root administrator created",
     "data": {
       "admin": {
         "id": "c88f28bc-5cfb-4a57-bfa8-b214df97a312",
         "email": "root.admin@company.com",
         "fullName": "Chief Security Officer",
         "role": "ADMIN",
         "status": "ACTIVE"
       }
     }
   }
   ```

3. **Verify immediate locking**:
   Subsequent calls to `POST /api/v1/auth/bootstrap-admin` immediately return:
   ```json
   {
     "success": false,
     "error": {
       "code": "CONFLICT",
       "message": "Administrator bootstrap rejected: An administrator account already exists. For security reasons, the bootstrap mechanism can only be executed once."
     }
   }
   ```

