import { computeHealth } from './health';
const now = new Date('2026-11-18T00:00:00Z');
const d = (days: number) => new Date(now.getTime() + days * 86400000);

describe('computeHealth', () => {
  it('draft and paused', () => {
    expect(computeHealth({ status: 'DRAFT', tokenExpiresAt: d(30), recentFailures: 0, now }).level).toBe('draft');
    expect(computeHealth({ status: 'PAUSED', tokenExpiresAt: d(30), recentFailures: 0, now }).level).toBe('paused');
  });
  it('expired token -> needs reconnect', () => {
    expect(computeHealth({ status: 'LIVE', tokenExpiresAt: d(-1), recentFailures: 0, now }).level).toBe('needs_reconnect');
  });
  it('token expiring soon -> at risk', () => {
    expect(computeHealth({ status: 'LIVE', tokenExpiresAt: d(2), recentFailures: 0, now }).level).toBe('at_risk');
  });
  it('many failures -> at risk', () => {
    expect(computeHealth({ status: 'LIVE', tokenExpiresAt: d(30), recentFailures: 5, now }).level).toBe('at_risk');
  });
  it('all good -> healthy', () => {
    expect(computeHealth({ status: 'LIVE', tokenExpiresAt: d(30), recentFailures: 0, now }).level).toBe('healthy');
  });
  it('no token set, live, no failures -> healthy', () => {
    expect(computeHealth({ status: 'LIVE', tokenExpiresAt: null, recentFailures: 0, now }).level).toBe('healthy');
  });
});
