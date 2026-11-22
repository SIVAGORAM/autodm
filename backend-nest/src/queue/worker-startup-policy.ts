export function isDeliveryWorkerEnabledInEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return true;
  return env.NODE_ENV === 'development' && env.RUN_DELIVERY_WORKER_IN_DEVELOPMENT === 'true';
}

/** Email-only development worker; never enable it implicitly in tests or production. */
export function isMailOutboxWorkerEnabledInEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' && env.RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT === 'true';
}
