'use strict';

function databaseTarget(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.pathname || parsed.pathname === '/') {
    throw new Error('DATABASE_URL must identify a PostgreSQL host and database.');
  }
  return `${parsed.hostname}/${decodeURIComponent(parsed.pathname.slice(1))}`;
}

function validateBootstrapRequest({ email, flags, env }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Provide the email address of an existing verified account.');
  }
  if (!flags.has('--confirm=CREATE_SUPER_ADMIN')) {
    throw new Error('Explicit confirmation is required: --confirm=CREATE_SUPER_ADMIN.');
  }
  if (!['development', 'test', 'production'].includes(env.NODE_ENV)) {
    throw new Error('Set NODE_ENV to development, test, or production before bootstrapping.');
  }
  if (env.NODE_ENV === 'production' && !flags.has('--allow-production')) {
    throw new Error('Refusing to bootstrap against NODE_ENV=production without --allow-production.');
  }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required. No database was changed.');

  const target = databaseTarget(env.DATABASE_URL);
  if (!flags.has(`--confirm-database=${target}`)) {
    throw new Error(`Database target confirmation is missing. Verify the intended database, then pass --confirm-database=${target}.`);
  }
  return { email: email.trim().toLowerCase(), target };
}

module.exports = { databaseTarget, validateBootstrapRequest };
