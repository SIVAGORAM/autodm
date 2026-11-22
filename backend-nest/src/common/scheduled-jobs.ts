export function areScheduledJobsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') return true;
  return env.RUN_SCHEDULED_JOBS_IN_DEVELOPMENT === 'true';
}
