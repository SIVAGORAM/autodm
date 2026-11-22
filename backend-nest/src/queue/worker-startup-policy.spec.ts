import { isDeliveryWorkerEnabledInEnvironment, isMailOutboxWorkerEnabledInEnvironment } from './worker-startup-policy';

describe('isDeliveryWorkerEnabledInEnvironment', () => {
  it('enables the worker in production', () => {
    expect(isDeliveryWorkerEnabledInEnvironment({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('requires an explicit opt-in for development delivery jobs', () => {
    expect(isDeliveryWorkerEnabledInEnvironment({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isDeliveryWorkerEnabledInEnvironment({ NODE_ENV: 'development', RUN_DELIVERY_WORKER_IN_DEVELOPMENT: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isDeliveryWorkerEnabledInEnvironment({ NODE_ENV: 'development', RUN_DELIVERY_WORKER_IN_DEVELOPMENT: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('never enables the live delivery worker in tests', () => {
    expect(isDeliveryWorkerEnabledInEnvironment({ NODE_ENV: 'test', RUN_DELIVERY_WORKER_IN_DEVELOPMENT: 'true' } as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe('isMailOutboxWorkerEnabledInEnvironment', () => {
  it('requires an explicit development-only opt-in', () => {
    expect(isMailOutboxWorkerEnabledInEnvironment({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isMailOutboxWorkerEnabledInEnvironment({ NODE_ENV: 'development', RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT: 'false' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isMailOutboxWorkerEnabledInEnvironment({ NODE_ENV: 'development', RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT: 'true' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('never enables email delivery in test or production', () => {
    expect(isMailOutboxWorkerEnabledInEnvironment({ NODE_ENV: 'test', RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT: 'true' } as NodeJS.ProcessEnv)).toBe(false);
    expect(isMailOutboxWorkerEnabledInEnvironment({ NODE_ENV: 'production', RUN_MAIL_OUTBOX_WORKER_IN_DEVELOPMENT: 'true' } as NodeJS.ProcessEnv)).toBe(false);
  });
});
