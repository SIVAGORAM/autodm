import { areScheduledJobsEnabled } from './scheduled-jobs';

describe('areScheduledJobsEnabled', () => {
  it('keeps scheduled jobs off by default in development and test environments', () => {
    expect(areScheduledJobsEnabled({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
    expect(areScheduledJobsEnabled({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)).toBe(false);
  });

  it('allows deliberate opt-in for a controlled non-production environment', () => {
    expect(areScheduledJobsEnabled({ NODE_ENV: 'development', RUN_SCHEDULED_JOBS_IN_DEVELOPMENT: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('keeps production schedules enabled even if the development opt-in is false', () => {
    expect(areScheduledJobsEnabled({ NODE_ENV: 'production', RUN_SCHEDULED_JOBS_IN_DEVELOPMENT: 'false' } as NodeJS.ProcessEnv)).toBe(true);
  });
});
