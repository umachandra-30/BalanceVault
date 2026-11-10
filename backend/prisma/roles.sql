-- ==============================================================================
-- BalanceVault: Least-Privilege Database Roles Setup
-- ==============================================================================

-- 1. Create Application Role (Read-Write for transactional operations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'balancevault_app') THEN
    CREATE ROLE balancevault_app WITH LOGIN PASSWORD 'change_this_app_password_in_prod';
  END IF;
END $$;

-- 2. Create Auditor Role (Read-Only access for audit & compliance inspection)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'balancevault_auditor') THEN
    CREATE ROLE balancevault_auditor WITH LOGIN PASSWORD 'change_this_auditor_password_in_prod';
  END IF;
END $$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO balancevault_app, balancevault_auditor;

-- Application permissions (Standard CRUD on ledger and account tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO balancevault_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO balancevault_app;

-- Auditor permissions (STRICTLY READ-ONLY on public tables)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO balancevault_auditor;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM balancevault_auditor;

-- Ensure future tables also inherit these default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO balancevault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO balancevault_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO balancevault_auditor;

