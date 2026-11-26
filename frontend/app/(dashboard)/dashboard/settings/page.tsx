'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { authApi, getApiErrorMessage, userApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store/authStore';
import { RL, Card, Btn, PageHead } from '../../../../components/rl-kit';
import {
  User, Lock, Mail, ShieldCheck, Download, Trash2, Smartphone,
  Key, Copy, Check, ChevronDown, ChevronUp, AlertTriangle, RefreshCw, X, ShieldAlert,
} from 'lucide-react';
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from '../../../../lib/password-policy';

const field: React.CSSProperties = {
  width: '100%', height: 44, borderRadius: 11, border: `1px solid var(--border)`,
  padding: '0 14px', fontSize: 14.5, color: 'var(--text)', background: 'var(--surface)', outline: 'none',
};
const lbl: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 7,
};

interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  isMandatory: boolean;
}

export default function SettingsPage() {
  const { user, fetchMe, logout } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionEmail, setDeletionEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  // 2FA state
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [loadingMfa, setLoadingMfa] = useState(true);

  // 2FA Setup state
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<'password' | 'scan' | 'recovery'>('password');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [setupQrDataUrl, setSetupQrDataUrl] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupRecoveryCodes, setSetupRecoveryCodes] = useState<string[]>([]);
  const [showManualKey, setShowManualKey] = useState(false);
  const [submittingSetup, setSubmittingSetup] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // 2FA Disable state
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [submittingDisable, setSubmittingDisable] = useState(false);

  // 2FA Regenerate Recovery Codes state
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenPassword, setRegenPassword] = useState('');
  const [regenCode, setRegenCode] = useState('');
  const [regenCodesList, setRegenCodesList] = useState<string[]>([]);
  const [submittingRegen, setSubmittingRegen] = useState(false);

  useEffect(() => {
    loadMfaStatus();
  }, []);

  async function loadMfaStatus() {
    setLoadingMfa(true);
    try {
      const res = await authApi.get2faStatus();
      setMfaStatus(res.data.data);
    } catch {
      // non-fatal
    } finally {
      setLoadingMfa(false);
    }
  }

  async function saveName() {
    if (!name.trim()) return toast.error('Name can’t be empty');
    setSavingName(true);
    try { await userApi.updateProfile({ name: name.trim() }); await fetchMe(); toast.success('Profile updated'); }
    catch (e: any) { toast.error(getApiErrorMessage(e, 'Could not update profile')); }
    finally { setSavingName(false); }
  }

  async function savePw() {
    if (!meetsPasswordPolicy(pw.next)) return toast.error(PASSWORD_POLICY_MESSAGE);
    if (pw.next !== pw.confirm) return toast.error('Passwords don’t match');
    setSavingPw(true);
    try {
      await userApi.changePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed successfully');
    }
    catch (e: any) { toast.error(getApiErrorMessage(e, 'Could not change password')); }
    finally { setSavingPw(false); }
  }

  async function exportAccountData() {
    setExporting(true);
    try {
      const response = await userApi.exportData();
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `heylaunch-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success('Your data export is ready');
    } catch {
      toast.error('Could not prepare your data export. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    if (!user?.email || deletionEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      return toast.error('Enter your account email exactly to confirm deletion');
    }
    if (!deletionPassword) return toast.error('Enter your current password to continue');
    setDeleting(true);
    try {
      await userApi.requestAccountDeletion({ currentPassword: deletionPassword, confirmationEmail: deletionEmail });
      toast.success('Deletion requested. Your account has been signed out.');
      await logout();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Could not request account deletion'));
    } finally {
      setDeleting(false);
    }
  }

  // 2FA Setup Flow handlers
  async function startSetup() {
    if (!setupPassword) return toast.error('Please enter your current password');
    setSubmittingSetup(true);
    try {
      const res = await authApi.begin2faSetup(setupPassword);
      const { secret, otpauthUri } = res.data.data;
      setSetupSecret(secret);

      const qr = await QRCode.toDataURL(otpauthUri, {
        width: 240,
        margin: 2,
        color: { dark: '#17171B', light: '#ffffff' },
      });
      setSetupQrDataUrl(qr);
      setSetupStep('scan');
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Could not begin 2FA setup. Check your password and try again.'));
    } finally {
      setSubmittingSetup(false);
    }
  }

  async function confirmSetup() {
    const cleanCode = setupCode.trim().replace(/\s+/g, '');
    if (!cleanCode || cleanCode.length < 6) return toast.error('Enter the 6-digit code from your authenticator app');
    setSubmittingSetup(true);
    try {
      const res = await authApi.confirm2faSetup(cleanCode);
      setSetupRecoveryCodes(res.data.data.recoveryCodes ?? []);
      setSetupStep('recovery');
      await loadMfaStatus();
      await fetchMe();
      toast.success('Two-factor authentication enabled successfully!');
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Invalid authenticator code. Check the time on your phone and try again.'));
    } finally {
      setSubmittingSetup(false);
    }
  }

  function finishSetup() {
    setSetupModalOpen(false);
    setSetupStep('password');
    setSetupPassword('');
    setSetupSecret('');
    setSetupQrDataUrl('');
    setSetupCode('');
    setSetupRecoveryCodes([]);
  }

  // 2FA Disable Flow handlers
  async function handleDisable2fa() {
    if (!disablePassword) return toast.error('Please enter your current password');
    if (!disableCode.trim()) return toast.error('Please enter your authenticator or recovery code');
    setSubmittingDisable(true);
    try {
      await authApi.disable2fa({
        currentPassword: disablePassword,
        code: disableCode.trim(),
      });
      toast.success('Two-factor authentication has been disabled.');
      setDisableModalOpen(false);
      setDisablePassword('');
      setDisableCode('');
      await loadMfaStatus();
      await fetchMe();
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Could not disable 2FA. Verify your password and code.'));
    } finally {
      setSubmittingDisable(false);
    }
  }

  // 2FA Regenerate Recovery Codes handlers
  async function handleRegenerateCodes() {
    if (!regenPassword) return toast.error('Please enter your current password');
    if (!regenCode.trim()) return toast.error('Please enter your 6-digit authenticator code');
    setSubmittingRegen(true);
    try {
      const res = await authApi.regenerate2faRecoveryCodes({
        currentPassword: regenPassword,
        code: regenCode.trim(),
      });
      setRegenCodesList(res.data.data.recoveryCodes ?? []);
      await loadMfaStatus();
      toast.success('New recovery codes generated. Store them safely!');
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, 'Could not regenerate codes. Verify your password and code.'));
    } finally {
      setSubmittingRegen(false);
    }
  }

  function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  function downloadBackupCodes(codes: string[]) {
    const content = [
      '========================================',
      'HeyLaunch Emergency Recovery Codes',
      `Account: ${user?.email}`,
      `Generated: ${new Date().toUTCString()}`,
      '========================================\n',
      'Each recovery code can only be used once.\nKeep these in a safe, secure place.\n',
      ...codes.map((code, index) => `${String(index + 1).padStart(2, '0')}. ${code}`),
      '\n========================================',
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heylaunch-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success('Recovery codes downloaded');
  }

  const isMfaActive = !!mfaStatus?.enabled;

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead title="Settings" sub="Manage your account details and security." />

      {/* Profile Card */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <User style={{ width: 18, height: 18, color: RL.teal }} /><span style={{ fontSize: 16, fontWeight: 700, color: RL.ink }}>Profile</span>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={lbl}>Name</label>
            <input style={field} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <div style={{ ...field, display: 'flex', alignItems: 'center', gap: 8, color: RL.muted, background: RL.soft }}>
              <Mail style={{ width: 16, height: 16 }} /> {user?.email}
              {user?.isVerified && (
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: RL.green, fontSize: 12.5, fontWeight: 600 }}>
                  <ShieldCheck style={{ width: 14, height: 14 }} /> Verified
                </span>
              )}
            </div>
          </div>
          <div><Btn onClick={saveName} disabled={savingName}>{savingName ? 'Saving…' : 'Save changes'}</Btn></div>
        </div>
      </Card>

      {/* Password Card */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Lock style={{ width: 18, height: 18, color: RL.teal }} /><span style={{ fontSize: 16, fontWeight: 700, color: RL.ink }}>Password</span>
        </div>
        <div style={{ display: 'grid', gap: 16 }}>
          <p style={{ margin: 0, color: RL.muted, fontSize: 13 }}>{PASSWORD_POLICY_MESSAGE} Other sessions lose refresh access immediately; current access tokens expire within 15 minutes.</p>
          <div><label style={lbl}>Current password</label><input type="password" autoComplete="current-password" style={field} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={lbl}>New password</label><input type="password" autoComplete="new-password" maxLength={128} style={field} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
            <div><label style={lbl}>Confirm new</label><input type="password" autoComplete="new-password" maxLength={128} style={field} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          <div><Btn onClick={savePw} disabled={savingPw}>{savingPw ? 'Updating…' : 'Update password'}</Btn></div>
        </div>
      </Card>

      {/* Two-Factor Authentication (2FA) Card */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone style={{ width: 18, height: 18, color: RL.teal }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: RL.ink }}>Two-Factor Authentication</span>
          </div>
          {isMfaActive ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#16a34a', background: 'rgba(22,163,74,0.1)', padding: '4px 10px', borderRadius: 20, fontSize: 12.5, fontWeight: 700 }}>
              <ShieldCheck style={{ width: 14, height: 14 }} /> Active
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: RL.muted, background: RL.soft, padding: '4px 10px', borderRadius: 20, fontSize: 12.5, fontWeight: 600 }}>
              Disabled
            </span>
          )}
        </div>

        {isMfaActive ? (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ margin: 0, color: RL.muted, fontSize: 13.5, lineHeight: 1.55 }}>
              Your account is fortified with an authenticator app (TOTP). Whenever you sign in, you’ll be prompted for a 6-digit security code.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, background: RL.soft, fontSize: 13, color: RL.ink }}>
              <Key style={{ width: 16, height: 16, color: RL.teal, flexShrink: 0 }} />
              <div>
                <strong>{mfaStatus?.recoveryCodesRemaining ?? 0}</strong> emergency backup codes remaining.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
              <Btn variant="ghost" onClick={() => { setRegenModalOpen(true); setRegenCodesList([]); setRegenPassword(''); setRegenCode(''); }}>
                <RefreshCw style={{ width: 14, height: 14, marginRight: 6 }} /> View / Regenerate backup codes
              </Btn>
              {!mfaStatus?.isMandatory && (
                <Btn variant="danger" onClick={() => { setDisableModalOpen(true); setDisablePassword(''); setDisableCode(''); }}>
                  Disable 2FA
                </Btn>
              )}
            </div>
            {mfaStatus?.isMandatory && (
              <p style={{ margin: 0, color: RL.muted, fontSize: 12 }}>
                Two-factor authentication is required for administrator roles and cannot be deactivated.
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <p style={{ margin: 0, color: RL.muted, fontSize: 13.5, lineHeight: 1.55 }}>
              Add an extra layer of bank-grade security to your creator profile. Use Google Authenticator, 1Password, Authy, or Microsoft Authenticator to generate one-time login codes.
            </p>
            <div>
              <Btn onClick={() => { setSetupModalOpen(true); setSetupStep('password'); setSetupPassword(''); setSetupCode(''); }} disabled={loadingMfa}>
                <ShieldCheck style={{ width: 16, height: 16, marginRight: 6 }} /> Enable Two-Factor Authentication
              </Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Data Export Card */}
      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Download style={{ width: 18, height: 18, color: RL.teal }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: RL.ink }}>Your data</span>
        </div>
        <p style={{ margin: '0 0 16px', color: RL.muted, fontSize: 13, lineHeight: 1.55 }}>
          Download your profile, connected Instagram account details, automations, contacts, delivery history, payments, and tracked-link activity. Passwords, access tokens, and raw provider webhook payloads are excluded.
        </p>
        <Btn variant="ghost" onClick={exportAccountData} loading={exporting}>
          {exporting ? 'Preparing export…' : 'Download my data'}
        </Btn>
      </Card>

      {/* Account Deletion Card */}
      <Card style={{ borderColor: 'var(--error)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Trash2 style={{ width: 18, height: 18, color: 'var(--error)' }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--error)' }}>Delete account</span>
        </div>
        <p style={{ margin: '0 0 16px', color: RL.muted, fontSize: 13, lineHeight: 1.55 }}>
          Submitting immediately signs out every session, hides your public profile, disables connected Instagram accounts and automations, and replaces your login details. A background worker permanently removes remaining creator data after queued work drains and a 15-minute processing delay. That delay is not a cancellation period: you cannot sign back in or restore the account after submitting. Instagram authorization may remain until you revoke HeyLaunch in Instagram settings. Payment transaction references are retained without your account link for accounting records.
        </p>
        {!deletionOpen ? (
          <Btn variant="ghost" onClick={() => setDeletionOpen(true)}>Continue to account deletion</Btn>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div><label style={lbl} htmlFor="delete-account-password">Current password</label><input id="delete-account-password" autoComplete="current-password" type="password" style={field} value={deletionPassword} onChange={(e) => setDeletionPassword(e.target.value)} /></div>
            <div><label style={lbl} htmlFor="delete-account-email">Type {user?.email} to confirm</label><input id="delete-account-email" autoComplete="email" type="email" style={field} value={deletionEmail} onChange={(e) => setDeletionEmail(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn variant="ghost" onClick={() => setDeletionOpen(false)} disabled={deleting}>Cancel</Btn>
              <Btn variant="danger" onClick={requestDeletion} disabled={deleting}>{deleting ? 'Submitting deletion…' : 'Permanently delete my account'}</Btn>
            </div>
          </div>
        )}
      </Card>

      {/* ============================================================== */}
      {/* 2FA SETUP MODAL                                                */}
      {/* ============================================================== */}
      {setupModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.18)', border: `1px solid var(--border)` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone style={{ width: 20, height: 20, color: RL.teal }} />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: RL.ink }}>
                  {setupStep === 'password' ? 'Verify your password' : setupStep === 'scan' ? 'Scan QR Code' : 'Save your recovery codes'}
                </h3>
              </div>
              {setupStep !== 'recovery' && (
                <button type="button" onClick={() => setSetupModalOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer', color: RL.muted }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              )}
            </div>

            {setupStep === 'password' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: RL.muted, lineHeight: 1.5 }}>
                  Please enter your current password to start setting up two-factor authentication.
                </p>
                <div>
                  <label style={lbl}>Current password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    style={field}
                    placeholder="Enter password"
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') startSetup(); }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <Btn variant="ghost" onClick={() => setSetupModalOpen(false)}>Cancel</Btn>
                  <Btn onClick={startSetup} disabled={submittingSetup}>{submittingSetup ? 'Verifying…' : 'Next'}</Btn>
                </div>
              </div>
            )}

            {setupStep === 'scan' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 13, color: RL.muted, lineHeight: 1.45 }}>
                  Scan this QR code with <strong>Google Authenticator</strong>, <strong>1Password</strong>, or <strong>Authy</strong> on your mobile device.
                </p>

                {setupQrDataUrl && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
                    <div style={{ background: '#ffffff', padding: 12, borderRadius: 12, border: `1px solid var(--border)` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={setupQrDataUrl} alt="Authenticator QR Code" style={{ width: 190, height: 190, display: 'block' }} />
                    </div>
                  </div>
                )}

                <div style={{ background: RL.soft, borderRadius: 10, padding: 12 }}>
                  <button
                    type="button"
                    onClick={() => setShowManualKey((v) => !v)}
                    style={{ background: 'none', border: 0, padding: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: RL.ink }}
                  >
                    <span>Can’t scan the QR code?</span>
                    {showManualKey ? <ChevronUp style={{ width: 16, height: 16 }} /> : <ChevronDown style={{ width: 16, height: 16 }} />}
                  </button>

                  {showManualKey && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, color: RL.muted, marginBottom: 4 }}>Manual setup key:</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <code style={{ fontSize: 12, letterSpacing: '1px', background: 'var(--surface)', padding: '6px 8px', borderRadius: 6, border: `1px solid var(--border)`, flex: 1, wordBreak: 'break-all' }}>
                          {setupSecret}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(setupSecret, setCopiedKey)}
                          style={{ height: 32, padding: '0 10px', borderRadius: 6, border: `1px solid var(--border)`, background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                        >
                          {copiedKey ? <Check style={{ width: 13, height: 13, color: RL.green }} /> : <Copy style={{ width: 13, height: 13 }} />}
                          {copiedKey ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label style={lbl}>Enter 6-digit code from app</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    style={{ ...field, textAlign: 'center', fontSize: 22, letterSpacing: '6px', fontWeight: 700 }}
                    placeholder="000000"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmSetup(); }}
                    autoFocus
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <Btn variant="ghost" onClick={() => setSetupStep('password')}>Back</Btn>
                  <Btn onClick={confirmSetup} disabled={submittingSetup || setupCode.length < 6}>
                    {submittingSetup ? 'Activating…' : 'Activate 2FA'}
                  </Btn>
                </div>
              </div>
            )}

            {setupStep === 'recovery' && (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 10, background: 'rgba(234, 179, 8, 0.1)', color: '#a16207', fontSize: 12.5, lineHeight: 1.45 }}>
                  <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Store these recovery codes safely!</strong> If you ever lose access to your authenticator app, these are the only way you can log into your account.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, borderRadius: 10, background: RL.soft, border: `1px solid var(--border)` }}>
                  {setupRecoveryCodes.map((code, idx) => (
                    <code key={idx} style={{ fontSize: 13, fontWeight: 600, color: RL.ink, letterSpacing: '0.5px', padding: '4px 6px' }}>
                      {code}
                    </code>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(setupRecoveryCodes.join('\n'), setCopiedCodes)}
                    style={{ flex: 1, height: 38, borderRadius: 8, border: `1px solid var(--border)`, background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: RL.ink }}
                  >
                    {copiedCodes ? <Check style={{ width: 14, height: 14, color: RL.green }} /> : <Copy style={{ width: 14, height: 14 }} />}
                    {copiedCodes ? 'Copied codes' : 'Copy all codes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBackupCodes(setupRecoveryCodes)}
                    style={{ flex: 1, height: 38, borderRadius: 8, border: `1px solid var(--border)`, background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: RL.ink }}
                  >
                    <Download style={{ width: 14, height: 14 }} /> Download backup
                  </button>
                </div>

                <div style={{ marginTop: 6 }}>
                  <Btn style={{ width: '100%' }} onClick={finishSetup}>
                    I’ve saved my backup codes
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2FA DISABLE MODAL                                              */}
      {/* ============================================================== */}
      {disableModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.18)', border: `1px solid var(--border)` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--error)' }}>
                <ShieldAlert style={{ width: 20, height: 20 }} />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Disable 2FA</h3>
              </div>
              <button type="button" onClick={() => setDisableModalOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer', color: RL.muted }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13.5, color: RL.muted, lineHeight: 1.5 }}>
              Disabling two-factor authentication removes the extra security layer from your account. To proceed, confirm your current password and 6-digit code.
            </p>

            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={lbl}>Current password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  style={field}
                  placeholder="Enter current password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label style={lbl}>Authenticator code or backup code</label>
                <input
                  type="text"
                  maxLength={24}
                  style={field}
                  placeholder="6-digit code or XXXX-XXXX-..."
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleDisable2fa(); }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <Btn variant="ghost" onClick={() => setDisableModalOpen(false)}>Cancel</Btn>
                <Btn variant="danger" onClick={handleDisable2fa} disabled={submittingDisable}>
                  {submittingDisable ? 'Disabling…' : 'Confirm & Disable'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2FA VIEW / REGENERATE RECOVERY CODES MODAL                     */}
      {/* ============================================================== */}
      {regenModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 16, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.18)', border: `1px solid var(--border)` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Key style={{ width: 20, height: 20, color: RL.teal }} />
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: RL.ink }}>
                  {regenCodesList.length > 0 ? 'Your New Backup Codes' : 'Regenerate Backup Codes'}
                </h3>
              </div>
              <button type="button" onClick={() => setRegenModalOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer', color: RL.muted }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {regenCodesList.length === 0 ? (
              <div style={{ display: 'grid', gap: 14 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: RL.muted, lineHeight: 1.5 }}>
                  Generating new recovery codes will immediately invalidate any previous codes you have saved. Enter your password and current authenticator code to generate 10 new codes.
                </p>
                <div>
                  <label style={lbl}>Current password</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    style={field}
                    placeholder="Enter current password"
                    value={regenPassword}
                    onChange={(e) => setRegenPassword(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={lbl}>6-digit authenticator code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    style={field}
                    placeholder="000000"
                    value={regenCode}
                    onChange={(e) => setRegenCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRegenerateCodes(); }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                  <Btn variant="ghost" onClick={() => setRegenModalOpen(false)}>Cancel</Btn>
                  <Btn onClick={handleRegenerateCodes} disabled={submittingRegen || regenCode.length < 6}>
                    {submittingRegen ? 'Generating…' : 'Generate New Codes'}
                  </Btn>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', gap: 10, padding: 12, borderRadius: 10, background: 'rgba(234, 179, 8, 0.1)', color: '#a16207', fontSize: 12.5, lineHeight: 1.45 }}>
                  <AlertTriangle style={{ width: 18, height: 18, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>New backup codes active!</strong> All previous codes have been revoked. Store these in a safe place.
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 12, borderRadius: 10, background: RL.soft, border: `1px solid var(--border)` }}>
                  {regenCodesList.map((code, idx) => (
                    <code key={idx} style={{ fontSize: 13, fontWeight: 600, color: RL.ink, letterSpacing: '0.5px', padding: '4px 6px' }}>
                      {code}
                    </code>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(regenCodesList.join('\n'), setCopiedCodes)}
                    style={{ flex: 1, height: 38, borderRadius: 8, border: `1px solid var(--border)`, background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: RL.ink }}
                  >
                    {copiedCodes ? <Check style={{ width: 14, height: 14, color: RL.green }} /> : <Copy style={{ width: 14, height: 14 }} />}
                    {copiedCodes ? 'Copied codes' : 'Copy all codes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadBackupCodes(regenCodesList)}
                    style={{ flex: 1, height: 38, borderRadius: 8, border: `1px solid var(--border)`, background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: RL.ink }}
                  >
                    <Download style={{ width: 14, height: 14 }} /> Download backup
                  </button>
                </div>

                <div style={{ marginTop: 6 }}>
                  <Btn style={{ width: '100%' }} onClick={() => setRegenModalOpen(false)}>
                    Done
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
