const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');

if (process.env.CI !== 'true') {
  console.error('This destructive-fixture smoke test is restricted to CI. No database was changed.');
  process.exit(2);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. No database was changed.');
  process.exit(2);
}

const databaseHost = new URL(process.env.DATABASE_URL).hostname;
if (!['localhost', '127.0.0.1', '::1', 'postgres'].includes(databaseHost)) {
  console.error('Refusing to run the audit immutability smoke test against a non-local database.');
  process.exit(2);
}

const prisma = new PrismaClient();

async function main() {
  const event = await prisma.adminAuditEvent.create({
    data: {
      action: 'CI_AUDIT_IMMUTABILITY_PROBE',
      targetType: 'CI_PROBE',
      reason: 'Temporary CI verification record.',
      requestId: randomUUID(),
    },
    select: { id: true, reason: true },
  });

  for (const [operation, execute] of [
    ['update', () => prisma.adminAuditEvent.update({ where: { id: event.id }, data: { reason: 'must not change' } })],
    ['delete', () => prisma.adminAuditEvent.delete({ where: { id: event.id } })],
    ['truncate', () => prisma.$executeRawUnsafe('TRUNCATE TABLE "admin_audit_events"')],
  ]) {
    let rejected = false;
    try {
      await execute();
    } catch {
      rejected = true;
    }
    if (!rejected) throw new Error(`Audit ${operation} unexpectedly succeeded.`);
  }

  const unchanged = await prisma.adminAuditEvent.findUnique({ where: { id: event.id }, select: { reason: true } });
  if (unchanged?.reason !== event.reason) throw new Error('The audit record changed during the immutability checks.');

  const actor = await prisma.user.create({
    data: {
      email: `${randomUUID()}@audit-smoke.invalid`,
      passwordHash: 'not-a-login-credential',
      name: 'Audit smoke actor',
    },
    select: { id: true },
  });
  const attributedEvent = await prisma.adminAuditEvent.create({
    data: {
      actorId: actor.id,
      action: 'CI_AUDIT_ACTOR_DELETE_PROBE',
      targetType: 'CI_PROBE',
      reason: 'Verify account deletion preserves audit history.',
      requestId: randomUUID(),
    },
    select: { id: true },
  });
  await prisma.user.delete({ where: { id: actor.id } });
  const preserved = await prisma.adminAuditEvent.findUnique({
    where: { id: attributedEvent.id },
    select: { actorId: true, reason: true },
  });
  if (preserved?.actorId !== null || preserved.reason !== 'Verify account deletion preserves audit history.') {
    throw new Error('Deleting an actor did not preserve and safely detach its audit event.');
  }

  console.log('Audit UPDATE, DELETE, and TRUNCATE protections passed on disposable local PostgreSQL.');
}

main().catch((error) => {
  console.error(error.message || 'Audit immutability smoke test failed.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
