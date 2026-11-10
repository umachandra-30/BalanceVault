import { PrismaClient, Role, UserStatus, OnboardingStatus, AccountType, AccountStatus, TransactionType, TransactionStatus, LedgerDirection } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting BalanceVault synthetic database seed...');

  // 1. Clean existing data in reverse relational dependency order
  await prisma.ledgerEntry.deleteMany();
  await prisma.ledgerTransaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.onboarding.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.user.deleteMany();

  // 2. Hash standard test password (using Argon2id)
  const defaultPasswordHash = await argon2.hash('DemoPass123!');

  // 3. Seed Users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@balancevault.local',
      fullName: 'System Administrator',
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const auditorUser = await prisma.user.create({
    data: {
      email: 'auditor@balancevault.local',
      fullName: 'Compliance Auditor',
      passwordHash: defaultPasswordHash,
      role: Role.AUDITOR,
      status: UserStatus.ACTIVE,
    },
  });

  const aliceUser = await prisma.user.create({
    data: {
      email: 'alice@example.com',
      fullName: 'Alice Johnson',
      passwordHash: defaultPasswordHash,
      role: Role.ACCOUNT_HOLDER,
      status: UserStatus.ACTIVE,
    },
  });

  const bobUser = await prisma.user.create({
    data: {
      email: 'bob@example.com',
      fullName: 'Bob Smith',
      passwordHash: defaultPasswordHash,
      role: Role.ACCOUNT_HOLDER,
      status: UserStatus.PENDING_ONBOARDING,
    },
  });

  console.log('✅ Seeded 4 Users (Admin, Auditor, Alice, Bob)');

  // 4. Seed Onboarding records
  await prisma.onboarding.create({
    data: {
      userId: aliceUser.id,
      status: OnboardingStatus.APPROVED,
      documentType: 'PASSPORT',
      documentNumberMasked: '******8832',
      notes: 'Identity verified via synthetic AML/KYC checklist.',
      reviewedById: adminUser.id,
      submittedAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
      reviewedAt: new Date(Date.now() - 86400000),      // 1 day ago
    },
  });

  await prisma.onboarding.create({
    data: {
      userId: bobUser.id,
      status: OnboardingStatus.SUBMITTED,
      documentType: 'NATIONAL_ID',
      documentNumberMasked: '******4190',
      notes: 'Submitted documentation awaiting Admin review.',
      submittedAt: new Date(),
    },
  });

  console.log('✅ Seeded Onboarding records');

  // 5. Seed Accounts
  // System settlement account (Holds bank central cash position)
  const systemSettlementAccount = await prisma.account.create({
    data: {
      accountNumber: 'BV-SYSTEM-001',
      userId: adminUser.id,
      type: AccountType.SYSTEM_SETTLEMENT,
      status: AccountStatus.ACTIVE,
      currency: 'USD',
      balance: 1750.0000, // Assets: Cash deposited by customers
    },
  });

  // Alice Checking & Savings (Demonstrating multi-account support per user)
  const aliceChecking = await prisma.account.create({
    data: {
      accountNumber: 'BV-1000000001',
      userId: aliceUser.id,
      type: AccountType.CHECKING,
      status: AccountStatus.ACTIVE,
      currency: 'USD',
      balance: 1000.0000,
    },
  });

  const aliceSavings = await prisma.account.create({
    data: {
      accountNumber: 'BV-1000000002',
      userId: aliceUser.id,
      type: AccountType.SAVINGS,
      status: AccountStatus.ACTIVE,
      currency: 'USD',
      balance: 500.0000,
    },
  });

  // Bob Checking
  const bobChecking = await prisma.account.create({
    data: {
      accountNumber: 'BV-2000000001',
      userId: bobUser.id,
      type: AccountType.CHECKING,
      status: AccountStatus.ACTIVE,
      currency: 'USD',
      balance: 250.0000,
    },
  });

  console.log('✅ Seeded 4 Accounts (1 System Settlement, 3 Customer Accounts)');

  // 6. Seed Double-Entry Transactions & Balanced Ledger Entries
  // Transaction 1: Alice Initial Deposit of $1,000 into Checking
  const txAliceDeposit = await prisma.ledgerTransaction.create({
    data: {
      idempotencyKey: 'tx_seed_alice_dep_001',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.POSTED,
      description: 'Initial demonstration deposit for Alice Checking',
      initiatedById: aliceUser.id,
      entries: {
        create: [
          {
            accountId: systemSettlementAccount.id,
            direction: LedgerDirection.DEBIT, // Debit: Bank Cash Asset increases
            amount: 1000.0000,
            balanceAfter: 1000.0000,
          },
          {
            accountId: aliceChecking.id,
            direction: LedgerDirection.CREDIT, // Credit: Customer Liability increases
            amount: 1000.0000,
            balanceAfter: 1000.0000,
          },
        ],
      },
    },
  });

  // Transaction 2: Alice Transfer of $500 from Checking to Savings
  const txAliceTransfer = await prisma.ledgerTransaction.create({
    data: {
      idempotencyKey: 'tx_seed_alice_xfer_002',
      type: TransactionType.TRANSFER,
      status: TransactionStatus.POSTED,
      description: 'Internal transfer from Checking to Savings',
      initiatedById: aliceUser.id,
      entries: {
        create: [
          {
            accountId: aliceChecking.id,
            direction: LedgerDirection.DEBIT, // Alice Checking balance decreases
            amount: 500.0000,
            balanceAfter: 500.0000,
          },
          {
            accountId: aliceSavings.id,
            direction: LedgerDirection.CREDIT, // Alice Savings balance increases
            amount: 500.0000,
            balanceAfter: 500.0000,
          },
        ],
      },
    },
  });

  // Transaction 3: Bob Initial Deposit of $250 into Checking
  const txBobDeposit = await prisma.ledgerTransaction.create({
    data: {
      idempotencyKey: 'tx_seed_bob_dep_003',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.POSTED,
      description: 'Initial demonstration deposit for Bob Checking',
      initiatedById: bobUser.id,
      entries: {
        create: [
          {
            accountId: systemSettlementAccount.id,
            direction: LedgerDirection.DEBIT,
            amount: 250.0000,
            balanceAfter: 1250.0000,
          },
          {
            accountId: bobChecking.id,
            direction: LedgerDirection.CREDIT,
            amount: 250.0000,
            balanceAfter: 250.0000,
          },
        ],
      },
    },
  });

  console.log('✅ Seeded 3 Double-Entry Transactions with 6 Balanced Ledger Entries');

  // 7. Seed Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        action: 'SYSTEM_GENESIS_INITIALIZED',
        actorId: adminUser.id,
        actorRole: Role.ADMIN,
        targetResource: 'SYSTEM',
        targetId: 'LEDGER_GENESIS',
        metadata: { note: 'Initial synthetic seed generated successfully' },
      },
      {
        action: 'ONBOARDING_APPROVED',
        actorId: adminUser.id,
        actorRole: Role.ADMIN,
        targetResource: 'USER',
        targetId: aliceUser.id,
        metadata: { notes: 'Alice Johnson KYC verified' },
      },
      {
        action: 'FINANCIAL_TRANSACTION_POSTED',
        actorId: aliceUser.id,
        actorRole: Role.ACCOUNT_HOLDER,
        targetResource: 'TRANSACTION',
        targetId: txAliceDeposit.id,
        metadata: { amount: '1000.0000', currency: 'USD' },
      },
    ],
  });

  console.log('✅ Seeded Audit Log entries');
  console.log('🎉 Synthetic Database Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
