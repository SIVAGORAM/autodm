// Connects the test Instagram account directly, using IG_TEST_* from .env.
// Run: node scripts/connect-test-account.js   (from backend-nest)
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const CryptoJS = require('crypto-js');

(async () => {
  const prisma = new PrismaClient();
  try {
    const key = process.env.ENCRYPTION_KEY;
    const token = process.env.IG_TEST_TOKEN;
    const igUserId = process.env.IG_TEST_USER_ID;
    const username = process.env.IG_TEST_USERNAME;
    if (!key || !token || !igUserId || !username) throw new Error('Missing ENCRYPTION_KEY or IG_TEST_* in .env');

    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!user) throw new Error('No user found — sign up in the app first.');

    const enc = CryptoJS.AES.encrypt(token, key).toString();
    const expires = new Date(Date.now() + 55 * 24 * 60 * 60 * 1000);
    const acc = await prisma.igAccount.upsert({
      where: { igUserId },
      update: { userId: user.id, username, accessTokenEnc: enc, tokenExpiresAt: expires, isActive: true },
      create: { userId: user.id, igUserId, username, accessTokenEnc: enc, tokenExpiresAt: expires },
    });
    console.log(`\n✅ Connected @${username} to ${user.email}`);
    console.log(`   igAccount id: ${acc.id}`);
    console.log(`   You can now create an automation on this account.\n`);
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
