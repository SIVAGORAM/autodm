'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { userApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store/authStore';
import { RL, Card, Btn, PageHead } from '../../../../components/rl-kit';
import { User, Lock, Mail, ShieldCheck } from 'lucide-react';

const field: React.CSSProperties = { width: '100%', height: 44, borderRadius: 11, border: `1px solid ${RL.line}`, padding: '0 14px', fontSize: 14.5, color: RL.ink, background: '#fff', outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: RL.ink, display: 'block', marginBottom: 7 };

export default function SettingsPage() {
  const { user, fetchMe } = useAuthStore();
  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  async function saveName() {
    if (!name.trim()) return toast.error('Name can’t be empty');
    setSavingName(true);
    try { await userApi.updateProfile({ name: name.trim() }); await fetchMe(); toast.success('Profile updated'); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Could not update profile'); }
    finally { setSavingName(false); }
  }
  async function savePw() {
    if (pw.next.length < 8) return toast.error('New password must be at least 8 characters');
    if (pw.next !== pw.confirm) return toast.error('Passwords don’t match');
    setSavingPw(true);
    try { await userApi.changePassword({ currentPassword: pw.current, newPassword: pw.next }); setPw({ current: '', next: '', confirm: '' }); toast.success('Password changed'); }
    catch (e: any) { toast.error(e?.response?.data?.message ?? 'Could not change password'); }
    finally { setSavingPw(false); }
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
          <div><label style={lbl}>Current password</label><input type="password" style={field} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label style={lbl}>New password</label><input type="password" style={field} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
            <div><label style={lbl}>Confirm new</label><input type="password" style={field} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
          </div>
          <div><Btn onClick={savePw} disabled={savingPw}>{savingPw ? 'Updating…' : 'Update password'}</Btn></div>
        </div>
      </Card>
    </div>
  );
}
