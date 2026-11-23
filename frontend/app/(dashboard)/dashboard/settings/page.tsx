'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { userApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store/authStore';
import { RL, Card, Btn, PageHead } from '../../../../components/rl-kit';
import { User, Lock, Mail, ShieldCheck, Download, Trash2 } from 'lucide-react';
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from '../../../../lib/password-policy';

const field: React.CSSProperties = { width: '100%', height: 44, borderRadius: 11, border: `1px solid var(--border)`, padding: '0 14px', fontSize: 14.5, color: 'var(--text)', background: 'var(--surface)', outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 7 };

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

  async function saveName() {
    if (!name.trim()) return toast.error('Name can’t be empty');
    setSavingName(true);
    try { await userApi.updateProfile({ name: name.trim() }); await fetchMe(); toast.success('Profile updated'); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Could not update profile'); }
    finally { setSavingName(false); }
  }
  async function savePw() {
    if (!meetsPasswordPolicy(pw.next)) return toast.error(PASSWORD_POLICY_MESSAGE);
    if (pw.next !== pw.confirm) return toast.error('Passwords don’t match');
    setSavingPw(true);
    try { await userApi.changePassword({ currentPassword: pw.current, newPassword: pw.next }); setPw({ current: '', next: '', confirm: '' }); toast.success('Password changed'); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Could not change password'); }
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
      toast.error(e?.response?.data?.message ?? 'Could not request account deletion');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead title="Settings" sub="Manage your account details and security." />

      {/* profile */}
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
              {user?.isVerified && <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: RL.green, fontSize: 12.5, fontWeight: 600 }}><ShieldCheck style={{ width: 14, height: 14 }} /> Verified</span>}
            </div>
          </div>
          <div><Btn onClick={saveName} disabled={savingName}>{savingName ? 'Saving…' : 'Save changes'}</Btn></div>
        </div>
      </Card>

      {/* password */}
      <Card>
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
      <Card style={{ marginTop: 18 }}>
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
      <Card style={{ marginTop: 18, borderColor: 'var(--error)' }}>
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
    </div>
  );
}
