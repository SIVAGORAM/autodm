import { AuthController } from './auth.controller';
import { PRIVACY_VERSION, TERMS_VERSION } from '../legal/policy-versions';

describe('AuthController token transport', () => {
  const user = { id: 'user-1', email: 'creator@example.test', isVerified: true };
  const auth = {
    signup: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    verificationEmailStatus: jest.fn(),
  };
  const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };
  const reply = { setCookie: jest.fn(), clearCookie: jest.fn() };
  const controller = new AuthController(auth as any, config as any);
  const httpRequest = { protocol: 'http', headers: {} } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    auth.signup.mockResolvedValue({ user, accessToken: 'access-secret', refreshToken: 'refresh-secret', verificationEmailQueued: true });
    auth.login.mockResolvedValue({ user, accessToken: 'access-secret', refreshToken: 'refresh-secret' });
    auth.refresh.mockResolvedValue({ accessToken: 'access-secret', refreshToken: 'refresh-secret' });
  });

  it('sets HTTP-only cookies on signup without returning the access token in JSON', async () => {
    const result = await controller.signup(httpRequest, {
      name: 'Creator', email: 'creator@example.test', password: 'StrongPass1!',
      termsAccepted: true, privacyAcknowledged: true, ageConfirmed: true,
      termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION,
    }, reply as any);

    expect(result).toEqual({ success: true, data: { user, verificationEmailQueued: true } });
    expect(JSON.stringify(result)).not.toContain('access-secret');
    expect(reply.setCookie).toHaveBeenCalledWith('access_token', 'access-secret', expect.objectContaining({ httpOnly: true }));
    expect(reply.setCookie).toHaveBeenCalledWith('refresh_token', 'refresh-secret', expect.objectContaining({ httpOnly: true }));
  });

  it('keeps production signup disabled until the legal policy drafts are approved', async () => {
    const productionController = new AuthController(auth as any, {
      get: (key: string, fallback?: unknown) => key === 'NODE_ENV' ? 'production' : fallback,
    } as any);

    await expect(productionController.signup(httpRequest, {}, reply as any)).rejects.toThrow('legal policies are being finalized');
    expect(auth.signup).not.toHaveBeenCalled();
  });

  it('sets HTTP-only cookies on login without returning the access token in JSON', async () => {
    const result = await controller.login(httpRequest, { email: 'creator@example.test', password: 'StrongPass1!' }, reply as any);

    expect(result).toEqual({ success: true, data: { user } });
    expect(JSON.stringify(result)).not.toContain('access-secret');
    expect(reply.setCookie).toHaveBeenCalledWith('access_token', 'access-secret', expect.objectContaining({ httpOnly: true }));
  });

  it('withholds administrator sessions until the authenticator challenge is completed', async () => {
    auth.login.mockResolvedValue({ mfaRequired: true, mfaSetupRequired: false, challenge: 'challenge-secret' });
    const result = await controller.login(httpRequest, { email: 'creator@example.test', password: 'StrongPass1!' }, reply as any);
    expect(result).toEqual({ success: true, data: { mfaRequired: true, mfaSetupRequired: false } });
    expect(JSON.stringify(result)).not.toContain('challenge-secret');
    expect(reply.setCookie).toHaveBeenCalledWith('admin_mfa_challenge', 'challenge-secret', expect.objectContaining({ httpOnly: true, maxAge: 300 }));
    expect(reply.setCookie).not.toHaveBeenCalledWith('access_token', expect.anything(), expect.anything());
  });

  it('rotates cookies on refresh without returning the replacement access token in JSON', async () => {
    const result = await controller.refresh({ ...httpRequest, cookies: { refresh_token: 'refresh-secret' } }, reply as any);

    expect(result).toEqual({ success: true });
    expect(JSON.stringify(result)).not.toContain('access-secret');
    expect(reply.setCookie).toHaveBeenCalledWith('access_token', 'access-secret', expect.objectContaining({ httpOnly: true }));
  });

  it('marks cookies secure for HTTPS requests even when COOKIE_SECURE is not configured', async () => {
    const httpsRequest = { protocol: 'http', headers: { 'x-forwarded-proto': 'https, http' } } as any;
    await controller.login(httpsRequest, { email: 'creator@example.test', password: 'StrongPass1!' }, reply as any);

    expect(reply.setCookie).toHaveBeenCalledWith('access_token', 'access-secret', expect.objectContaining({ secure: true, sameSite: 'none' }));
  });

  it('never downgrades explicitly secure cookies when a proxy omits HTTPS headers', async () => {
    const secureController = new AuthController(auth as any, {
      get: (key: string, fallback?: unknown) => key === 'COOKIE_SECURE' ? true : fallback,
    } as any);

    await secureController.login(httpRequest, { email: 'creator@example.test', password: 'StrongPass1!' }, reply as any);

    expect(reply.setCookie).toHaveBeenCalledWith('access_token', 'access-secret', expect.objectContaining({ secure: true, sameSite: 'none' }));
  });

  it('scopes the delivery-status request to the authenticated user', async () => {
    auth.verificationEmailStatus.mockResolvedValue({ success: true, status: 'sent' });

    await expect(controller.verificationEmailStatus('user-1')).resolves.toEqual({ success: true, status: 'sent' });
    expect(auth.verificationEmailStatus).toHaveBeenCalledWith('user-1');
  });
});
