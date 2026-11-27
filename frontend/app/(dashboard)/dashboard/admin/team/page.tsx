'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShieldCheck, ShieldPlus, UserRoundCog } from 'lucide-react';
import { adminApi } from '../../../../../services/api';
import { Btn, Card, Empty, PageHead, Pill, Skel } from '../../../../../components/rl-kit';
import { useAuthStore } from '../../../../../store/authStore';

type AdminPermission = 'SUPPORT_MANAGE' | 'PROFILE_MODERATE' | 'CONTACT_MANAGE' | 'MAIL_READ' | 'OPERATIONS_READ';
const permissionOptions: Array<{ id: AdminPermission; label: string; help: string }> = [
  { id: 'SUPPORT_MANAGE', label: 'Customer support', help: 'Read and update customer support requests.' },
  { id: 'PROFILE_MODERATE', label: 'Profile moderation', help: 'Review reports and hide public profiles that violate policy.' },
  { id: 'CONTACT_MANAGE', label: 'Contact enquiries', help: 'Read and respond to public contact enquiries.' },
  { id: 'MAIL_READ', label: 'Mail delivery', help: 'Inspect delivery status and safe error details.' },
  { id: 'OPERATIONS_READ', label: 'Operations', help: 'Inspect worker health and webhook dead letters.' },
];
function samePermissionSet(left: AdminPermission[], right: AdminPermission[]) {
  return [...left].sort().join(',') === [...right].sort().join(',');
}
type TeamMember = { id: string; name: string; email: string; role: 'ADMIN' | 'SUPER_ADMIN'; adminPermissions: AdminPermission[]; isVerified: boolean; adminMfaEnabledAt: string | null; createdAt: string; suspendedAt: string | null };

export default function AdminTeamPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [invitePermissions, setInvitePermissions] = useState<AdminPermission[]>([]);
  const [removeReason, setRemoveReason] = useState<Record<string, string>>({});
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, AdminPermission[]>>({});
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const query = useQuery({
    queryKey: ['admin', 'team'],
    enabled: isSuperAdmin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => (await adminApi.team()).data.data as TeamMember[],
  });
  const invitations = useQuery({
    queryKey: ['admin', 'team', 'invitations'],
    enabled: isSuperAdmin,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => (await adminApi.adminInvitations()).data.data as Array<{
      id: string; email: string; permissions: AdminPermission[]; createdAt: string; expiresAt: string;
      invitedBy: { id: string; name: string; email: string };
    }>,
  });
  const invite = useMutation({
    mutationFn: () => adminApi.createAdminInvitation(email, invitePermissions, reason),
    onSuccess: async () => {
      setEmail(''); setReason(''); setInvitePermissions([]);
      toast.success('Invitation queued. The recipient must verify this email and accept before admin access is enabled.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'team', 'invitations'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not create this administrator invitation.'),
  });
  const revokeInvitation = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => adminApi.revokeAdminInvitation(id, why),
    onSuccess: async () => {
      toast.success('Invitation revoked. Its acceptance link can no longer be used.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'team', 'invitations'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not revoke this invitation.'),
  });
  const demote = useMutation({
    mutationFn: ({ id, role, why }: { id: string; role: 'ADMIN' | 'SUPER_ADMIN' | 'INFLUENCER'; why: string }) => adminApi.updateAdminRole(id, role, why),
    onSuccess: async () => {
      toast.success('Administrator role updated and active sessions revoked.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update this role.'),
  });
  const resetMfa = useMutation({
    mutationFn: ({ id, why }: { id: string; why: string }) => adminApi.resetAdminMfa(id, why),
    onSuccess: async () => {
      toast.success('Authenticator reset. The administrator must enroll MFA again.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not reset administrator MFA.'),
  });
  const updatePermissions = useMutation({
    mutationFn: ({ id, permissions, why }: { id: string; permissions: AdminPermission[]; why: string }) =>
      adminApi.updateAdminPermissions(id, permissions, why),
    onSuccess: async (_response, variables) => {
      setPermissionDrafts((current) => { const next = { ...current }; delete next[variables.id]; return next; });
      toast.success('Administrator permissions updated and audited.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update administrator permissions.'),
  });
  const lifecycle = useMutation({
    mutationFn: ({ id, suspended, why }: { id: string; suspended: boolean; why: string }) =>
      suspended ? adminApi.suspendAdmin(id, why) : adminApi.reactivateAdmin(id, why),
    onSuccess: async (_response, variables) => {
      toast.success(variables.suspended ? 'Administrator suspended and sessions revoked.' : 'Administrator reactivated. They must sign in again.');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'team'] });
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Could not update administrator status.'),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim() && reason.trim().length >= 10) invite.mutate();
  }

  if (!isSuperAdmin) return <Card style={{ maxWidth: 560, margin: '32px auto', padding: 28, textAlign: 'center' }}>
    <ShieldCheck style={{ width: 26, height: 26, color: 'var(--warning)', margin: '0 auto 12px' }} aria-hidden />
    <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 18 }}>Super Admin access required</h1>
    <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>Only a Super Admin can manage administrator access.</p>
  </Card>;

  return <div>
    <PageHead title="Admin team" sub="Invite administrators, assign least-privilege permissions, and review each administrator's security status." />

    <Card style={{ marginBottom: 18 }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 8px', fontSize: 16, color: 'var(--text)' }}>
        <ShieldPlus style={{ width: 18, height: 18, color: 'var(--accent)' }} aria-hidden /> Invite an administrator
      </h2>
      <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.55 }}>
        The recipient must create or verify a HeyLaunch account using this exact email, then accept the one-use link within seven days. New invitations start with no operational permissions. Customer controls, billing, team management, and webhook redrive remain Super Admin-only.
      </p>
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 12, alignItems: 'end' }}>
        <label style={{ display: 'grid', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
          Invite email
          <input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}
            style={{ width: '100%', minHeight: 42, padding: '0 12px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }} />
        </label>
        <label style={{ display: 'grid', gap: 6, color: 'var(--text-muted)', fontSize: 13 }}>
          Reason (10–500 characters)
          <input required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)}
            style={{ width: '100%', minHeight: 42, padding: '0 12px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9 }} />
        </label>
        <fieldset style={{ gridColumn: '1 / -1', border: '1px solid var(--border)', borderRadius: 9, padding: 12, margin: 0 }}>
          <legend style={{ padding: '0 6px', color: 'var(--text-muted)', fontSize: 12 }}>Optional initial permissions</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 9 }}>
            {permissionOptions.map((permission) => <label key={permission.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: 'var(--text-muted)', fontSize: 12 }}>
              <input type="checkbox" checked={invitePermissions.includes(permission.id)} onChange={(event) => setInvitePermissions((current) => event.target.checked
                ? [...current, permission.id] : current.filter((value) => value !== permission.id))} />
              <span><strong style={{ color: 'var(--text)' }}>{permission.label}</strong><br />{permission.help}</span>
            </label>)}
          </div>
        </fieldset>
        <Btn type="submit" variant="accent" loading={invite.isPending} disabled={!email.trim() || reason.trim().length < 10}>
          <ShieldPlus style={{ width: 15, height: 15 }} aria-hidden /> Queue invitation
        </Btn>
      </form>
    </Card>

    <PageHead title="Pending invitations" sub="Invitations expire after seven days, can be revoked before acceptance, and grant no access until the recipient verifies the matching email." />
    {invitations.isError ? <Card style={{ textAlign: 'center', padding: 24 }}>
      <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load pending invitations.</p>
      <Btn variant="ghost" onClick={() => invitations.refetch()}>Try again</Btn>
    </Card> : invitations.isLoading ? <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}><Skel h={80} /></div>
      : invitations.data?.length ? <div style={{ display: 'grid', gap: 9, marginBottom: 22 }}>
        {invitations.data.map((invitation) => <Card key={invitation.id} pad={14}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 240px' }}>
              <strong style={{ color: 'var(--text)', fontSize: 14, overflowWrap: 'anywhere' }}>{invitation.email}</strong>
              <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 12 }}>Invited by {invitation.invitedBy.name} · expires {new Date(invitation.expiresAt).toLocaleString()}</div>
              <div style={{ marginTop: 5, color: 'var(--text-faint)', fontSize: 11 }}>
                Permissions: {invitation.permissions.length ? invitation.permissions.map((value) => permissionOptions.find((item) => item.id === value)?.label ?? value).join(', ') : 'None'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 11 }}>
                Revocation reason
                <input minLength={10} maxLength={500} value={removeReason[invitation.id] ?? ''}
                  onChange={(event) => setRemoveReason((current) => ({ ...current, [invitation.id]: event.target.value }))}
                  style={{ width: 'min(270px,70vw)', minHeight: 36, padding: '0 9px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              </label>
              <Btn variant="danger" disabled={revokeInvitation.isPending || (removeReason[invitation.id] ?? '').trim().length < 10}
                onClick={() => {
                  const why = removeReason[invitation.id].trim();
                  if (!window.confirm(`Revoke the invitation for ${invitation.email}? The link will stop working.`)) return;
                  revokeInvitation.mutate({ id: invitation.id, why });
                }}>Revoke invitation</Btn>
            </div>
          </div>
        </Card>)}
      </div> : <Empty icon={<ShieldCheck style={{ width: 24, height: 24 }} />} title="No pending invitations" sub="New invites appear here until accepted, revoked, or expired." />}

    <PageHead title="Current administrators" sub="Super Admin privileges are kept distinct. You cannot change your own role, and the last active Super Admin cannot be removed." />
    {query.isError ? <Card style={{ textAlign: 'center', padding: 28 }}>
      <p role="alert" style={{ color: 'var(--error)', margin: '0 0 12px' }}>Could not load the admin team.</p>
      <Btn variant="ghost" onClick={() => query.refetch()}>Try again</Btn>
    </Card> : query.isLoading ? <div style={{ display: 'grid', gap: 10 }}><Skel h={92} /><Skel h={92} /></div>
      : query.data?.length ? <div style={{ display: 'grid', gap: 10 }}>
        {query.data.map((member) => <Card key={member.id} pad={16}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong style={{ color: 'var(--text)', fontSize: 14 }}>{member.name}</strong>
                <Pill tone={member.role === 'SUPER_ADMIN' ? 'lime' : 'violet'}>{member.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}</Pill>
                <Pill tone={member.suspendedAt ? 'red' : 'green'} dot>{member.suspendedAt ? 'Suspended' : 'Active'}</Pill>
                <Pill tone={member.adminMfaEnabledAt ? 'green' : 'red'} dot>{member.adminMfaEnabledAt ? 'MFA enabled' : 'MFA required'}</Pill>
                {!member.isVerified && <Pill tone="amber">Unverified</Pill>}
              </div>
              <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 13, overflowWrap: 'anywhere' }}>{member.email}</div>
              <div style={{ marginTop: 4, color: 'var(--text-faint)', fontSize: 12 }}>Added {new Date(member.createdAt).toLocaleDateString()}</div>
            </div>
            {member.role === 'ADMIN' && <section aria-label={`Permissions for ${member.name}`} style={{ flex: '1 1 100%', padding: '12px 0 2px', borderTop: '1px solid var(--border)' }}>
              <strong style={{ display: 'block', marginBottom: 9, color: 'var(--text)', fontSize: 13 }}>Standard admin access</strong>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,210px),1fr))', gap: 9 }}>
                {permissionOptions.map((permission) => {
                  const selected = permissionDrafts[member.id] ?? member.adminPermissions ?? [];
                  return <label key={permission.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--text-muted)', fontSize: 12, cursor: member.suspendedAt ? 'not-allowed' : 'pointer' }}>
                    <input type="checkbox" checked={selected.includes(permission.id)} disabled={!!member.suspendedAt}
                      onChange={(event) => setPermissionDrafts((current) => ({
                        ...current,
                        [member.id]: event.target.checked
                          ? [...selected, permission.id]
                          : selected.filter((value) => value !== permission.id),
                      }))} />
                    <span><strong style={{ color: 'var(--text)' }}>{permission.label}</strong><br />{permission.help}</span>
                  </label>;
                })}
              </div>
              <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Changes take effect on the next protected request. Every change requires a reason and is recorded in the audit log.</span>
                <Btn variant="ghost" disabled={member.suspendedAt !== null || updatePermissions.isPending || (removeReason[member.id] ?? '').trim().length < 10 ||
                  samePermissionSet(permissionDrafts[member.id] ?? member.adminPermissions ?? [], member.adminPermissions ?? [])}
                  onClick={() => updatePermissions.mutate({ id: member.id, permissions: permissionDrafts[member.id] ?? member.adminPermissions ?? [], why: removeReason[member.id].trim() })}>
                  Save permissions
                </Btn>
              </div>
            </section>}
            {member.id !== user?.id && <div style={{ display: 'flex', alignItems: 'end', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 5, color: 'var(--text-muted)', fontSize: 12 }}>
                Reason for admin action
                <input minLength={10} maxLength={500} value={removeReason[member.id] ?? ''}
                  onChange={(event) => setRemoveReason((current) => ({ ...current, [member.id]: event.target.value }))}
                  aria-label={`Reason for administrator action on ${member.name}`}
                  style={{ width: 'min(290px, 70vw)', minHeight: 38, padding: '0 10px', color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
              </label>
              <Btn variant="ghost" disabled={demote.isPending || member.suspendedAt !== null || (removeReason[member.id] ?? '').trim().length < 10}
                onClick={() => {
                  if (!window.confirm(`Remove ${member.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} access from ${member.email}? Their existing sessions will be revoked.`)) return;
                  demote.mutate({ id: member.id, role: 'INFLUENCER', why: removeReason[member.id].trim() });
                }}>
                <UserRoundCog style={{ width: 15, height: 15 }} aria-hidden /> Revoke access
              </Btn>
              {member.role === 'ADMIN' ? <Btn variant="ghost" disabled={demote.isPending || member.suspendedAt !== null || (removeReason[member.id] ?? '').trim().length < 10}
                onClick={() => {
                  if (!window.confirm(`Promote ${member.email} to Super Admin? This grants full administrative access and revokes their existing sessions.`)) return;
                  demote.mutate({ id: member.id, role: 'SUPER_ADMIN', why: removeReason[member.id].trim() });
                }}>Promote to Super Admin</Btn>
                : <Btn variant="ghost" disabled={demote.isPending || member.suspendedAt !== null || (removeReason[member.id] ?? '').trim().length < 10}
                  onClick={() => {
                    if (!window.confirm(`Reduce ${member.email} to standard Admin? Their access will be reset to the standard permission set and sessions revoked.`)) return;
                    demote.mutate({ id: member.id, role: 'ADMIN', why: removeReason[member.id].trim() });
                  }}>Demote to Admin</Btn>}
              <Btn variant={member.suspendedAt ? 'accent' : 'danger'} disabled={lifecycle.isPending || (removeReason[member.id] ?? '').trim().length < 10}
                onClick={() => {
                  const suspended = !member.suspendedAt;
                  const action = suspended ? 'Suspend' : 'Reactivate';
                  if (!window.confirm(`${action} ${member.email}? ${suspended ? 'Their sessions will be revoked and pending MFA setup will be cleared.' : 'They must sign in again to regain access.'}`)) return;
                  lifecycle.mutate({ id: member.id, suspended, why: removeReason[member.id].trim() });
                }}>
                {member.suspendedAt ? 'Reactivate admin' : 'Suspend admin'}
              </Btn>
              {!member.suspendedAt && member.adminMfaEnabledAt && <Btn variant="danger" disabled={resetMfa.isPending || (removeReason[member.id] ?? '').trim().length < 10}
                onClick={() => {
                  if (!window.confirm(`Reset MFA for ${member.email}? Their sessions will be revoked and they must enroll an authenticator again.`)) return;
                  resetMfa.mutate({ id: member.id, why: removeReason[member.id].trim() });
                }}>
                Reset MFA
              </Btn>}
            </div>}
          </div>
        </Card>)}
      </div> : <Empty icon={<ShieldCheck style={{ width: 24, height: 24 }} />} title="No administrators yet" sub="Bootstrap the first Super Admin with the secured backend command, then add verified team accounts here." />}
  </div>;
}
