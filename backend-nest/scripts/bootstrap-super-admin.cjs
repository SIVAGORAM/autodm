const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { validateBootstrapRequest } = require('./bootstrap-super-admin-policy.cjs');

try {
  process.loadEnvFile('.env');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const args = process.argv.slice(2);
const emailArg = args.find((arg) => !arg.startsWith('--'));
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
let bootstrapRequest;
try {
  bootstrapRequest = validateBootstrapRequest({ email: emailArg, flags, env: process.env });
} catch (error) {
  console.error(error.message || 'Super Admin bootstrap request is invalid. No database was changed.');
  console.error('Usage: npm run admin:bootstrap-super-admin -- <verified-account-email> --confirm=CREATE_SUPER_ADMIN --confirm-database=<host>/<database> [--allow-production]');
  process.exit(2);
}

const prisma = new PrismaClient();
async function main() {
  const { email, target } = bootstrapRequest;
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
  console.log(`Super Admin provisioned on ${target}. Sign in with the verified account to manage the admin team.`);
}

main().catch((error) => {
  console.error(error.message || 'Super Admin bootstrap failed.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
