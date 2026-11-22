const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const emailArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith('--')));
const production = process.env.NODE_ENV === 'production';

if (!emailArg || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailArg) || !flags.has('--confirm=CREATE_SUPER_ADMIN')) {
  console.error('Usage: npm run admin:bootstrap-super-admin -- <verified-account-email> --confirm=CREATE_SUPER_ADMIN [--allow-production]');
  process.exit(2);
}
if (production && !flags.has('--allow-production')) {
  console.error('Refusing to bootstrap against NODE_ENV=production without the explicit --allow-production flag.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. No database was changed.');
  process.exit(2);
}

const prisma = new PrismaClient();
async function main() {
  const email = emailArg.trim().toLowerCase();
  await prisma.$transaction(async (tx) => {
    const existingOwner = await tx.user.findFirst({
      where: { role: 'SUPER_ADMIN', deletionRequestedAt: null, suspendedAt: null },
      select: { id: true },
    });
    if (existingOwner) throw new Error('An active Super Admin already exists; use the authenticated team-management API.');

    const user = await tx.user.findUnique({ where: { email }, select: { id: true, role: true, isVerified: true, deletionRequestedAt: true, suspendedAt: true } });
    if (!user || !user.isVerified || user.deletionRequestedAt || user.suspendedAt) {
      throw new Error('The account must exist, have a verified email, and be active before bootstrap.');
    }

    const changed = await tx.user.updateMany({
      where: { id: user.id, role: user.role, isVerified: true, deletionRequestedAt: null, suspendedAt: null },
      data: { role: 'SUPER_ADMIN', sessionVersion: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error('The account changed during bootstrap; retry after checking its current state.');

    // Force a fresh sign-in after the privilege change. The persisted role is
    // authoritative, while session rotation prevents stale customer sessions
    // from becoming administrator sessions in the browser.
    await tx.refreshToken.deleteMany({ where: { userId: user.id } });

    await tx.adminAuditEvent.create({
      data: {
        action: 'SUPER_ADMIN_BOOTSTRAPPED', targetType: 'USER', targetId: user.id,
        reason: 'Initial Super Admin provisioned through the one-time operator CLI.',
        requestId: randomUUID(), before: { role: user.role }, after: { role: 'SUPER_ADMIN' },
      },
    });
  }, { isolationLevel: 'Serializable' });
  console.log('Super Admin provisioned. Sign in with the verified account to manage the admin team.');
}

main().catch((error) => {
  console.error(error.message || 'Super Admin bootstrap failed.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
