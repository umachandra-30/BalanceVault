import readline from 'readline';
import { bootstrapService } from '../services/bootstrap.service.js';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function runCliBootstrap() {
  console.log('================================================================');
  console.log('🛡️  BalanceVault — First Administrator Bootstrap CLI');
  console.log('================================================================\n');

  // 1. Check if bootstrap is allowed
  const status = await bootstrapService.canBootstrap();
  if (!status.canBootstrap) {
    console.error(`❌ Bootstrap cannot proceed: ${status.reason}`);
    process.exit(1);
  }

  // 2. Read parameters from environment or prompt interactively
  const bootstrapSecret =
    process.env.BOOTSTRAP_SECRET ||
    env.ADMIN_BOOTSTRAP_SECRET ||
    (await askQuestion('Enter ADMIN_BOOTSTRAP_SECRET: '));

  const email =
    process.env.ADMIN_EMAIL ||
    (await askQuestion('Enter Administrator Email Address: '));

  const fullName =
    process.env.ADMIN_FULL_NAME ||
    (await askQuestion('Enter Administrator Full Name: '));

  const password =
    process.env.ADMIN_PASSWORD ||
    (await askQuestion('Enter Administrator Password (min 8 chars, mixed case, number, special char): '));

  console.log('\n⏳ Initializing root administrator...');

  try {
    const admin = await bootstrapService.bootstrapAdmin(
      {
        bootstrapSecret,
        email,
        fullName,
        password,
      },
      {
        ipAddress: '127.0.0.1 (CLI)',
        userAgent: 'BalanceVault-Admin-CLI/1.0',
      }
    );

    console.log('\n✅ Root Administrator Initialized Successfully!');
    console.log(`   ID:        ${admin.id}`);
    console.log(`   Email:     ${admin.email}`);
    console.log(`   Full Name: ${admin.fullName}`);
    console.log(`   Role:      ${admin.role}`);
    console.log(`   Status:    ${admin.status}`);
    console.log('\n🔒 The bootstrap mechanism is now automatically locked.');
    console.log('   You can now log in via the web interface or API.');
  } catch (err: any) {
    console.error(`\n❌ Bootstrap failed: ${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCliBootstrap();
