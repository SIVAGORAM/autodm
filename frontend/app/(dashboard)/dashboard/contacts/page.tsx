'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Search, Users, ChevronLeft, ChevronRight, RefreshCw, Save } from 'lucide-react';
import { userApi } from '../../../../services/api';
import { Btn, Card, Empty, PageHead, Skel } from '../../../../components/rl-kit';

type Contact = {
  id: string;
  username: string | null;
  notes: string;
  tags: string[];
  follows: boolean;
  dmsSent: number;
  firstInteraction: string;
  lastInteraction: string;
  igAccount: { id: string; username: string };
};
type ContactData = {
  contacts: Contact[];
  accounts: Array<{ id: string; username: string }>;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [accountId, setAccountId] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const updateContact = useMutation({
    mutationFn: async (input: { id: string; notes: string; tags: string[] }) => userApi.updateContact(input.id, { notes: input.notes, tags: input.tags }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setAppliedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [accountId, appliedSearch]);

  const query = useQuery({
    queryKey: ['contacts', page, accountId, appliedSearch],
    queryFn: async () => (await userApi.contacts({
      page,
      pageSize: 25,
      ...(accountId ? { accountId } : {}),
      ...(appliedSearch ? { search: appliedSearch } : {}),
    })).data.data as ContactData,
    // New contacts can be created by webhook-driven automation while this page is open.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  const downloadCsv = async () => {
    setExporting(true);
    setExportError('');
    try {
      const response = await userApi.exportContacts({
        ...(accountId ? { accountId } : {}),
        ...(appliedSearch ? { search: appliedSearch } : {}),
      });
      const url = URL.createObjectURL(response.data as Blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `heylaunch-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Give the browser time to consume the Blob before releasing its object URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setExportError('Could not export contacts. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const date = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const data = query.data;
  const pagination = data?.pagination;

  return (
    <div>
      <PageHead
        title="Contacts"
        sub="See the people who have interacted with your automations and export a filtered CSV for your own follow-up."
        action={<Btn variant="accent" onClick={downloadCsv} loading={exporting} disabled={!data?.pagination.total}>
          <Download style={{ width: 16, height: 16 }} /> Export CSV
        </Btn>}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <label style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
          <Search style={{ position: 'absolute', left: 12, top: 12, width: 16, height: 16, color: 'var(--text-faint)' }} aria-hidden />
          <input
            className="rl-input"
            aria-label="Search Instagram username"
            placeholder="Search Instagram username"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={80}
            style={{ width: '100%', height: 40, padding: '0 12px 0 38px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13.5 }}>
          <span>Instagram account</span>
          <select
            aria-label="Filter by Instagram account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            style={{ height: 40, minWidth: 150, padding: '0 30px 0 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }}
          >
            <option value="">All accounts</option>
            {(data?.accounts ?? []).map((account) => <option key={account.id} value={account.id}>@{account.username}</option>)}
          </select>
        </label>
        {pagination && <span aria-live="polite" style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>{pagination.total.toLocaleString()} contacts</span>}
      </div>

      {exportError && <div role="alert" style={{ marginBottom: 14, color: 'var(--error)', fontSize: 13.5 }}>{exportError}</div>}
      {updateContact.isError && <div role="alert" style={{ marginBottom: 14, color: 'var(--error)', fontSize: 13.5 }}>Contact details could not be saved. Please try again.</div>}
      {query.isError ? (
        <Card style={{ textAlign: 'center', padding: 36 }}>
          <p role="alert" style={{ margin: '0 0 14px', color: 'var(--error)' }}>Contacts could not be loaded.</p>
          <Btn variant="ghost" onClick={() => query.refetch()}><RefreshCw style={{ width: 15, height: 15 }} /> Try again</Btn>
        </Card>
      ) : query.isLoading ? (
        <Card pad={18}><div style={{ display: 'grid', gap: 12 }}>{[0, 1, 2, 3, 4].map((item) => <Skel key={item} h={58} />)}</div></Card>
      ) : (data?.contacts.length ?? 0) === 0 ? (
        <Empty
          icon={<Users style={{ width: 24, height: 24 }} />}
          title={appliedSearch ? 'No matching contacts' : 'No contacts yet'}
          sub={appliedSearch ? 'Try another username or clear your filters.' : 'Contacts appear here after someone interacts with one of your live automations.'}
        />
      ) : (
        <>
          <Card pad={0}>
            <div className="hl-contact-head" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr .8fr 1fr 150px', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-faint)', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <span>Contact</span><span>Instagram account</span><span>Activity</span><span>Last interaction</span><span>Lead notes</span>
            </div>
            {data!.contacts.map((contact) => (
              <div key={contact.id} className="hl-contact-row" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr .8fr 1fr 150px', gap: 16, alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ minWidth: 0 }}>
                  <span className="hl-contact-label">Contact</span>
                  <div style={{ color: 'var(--text)', fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.username ? `@${contact.username}` : 'Instagram user'}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 12, marginTop: 3 }}>First seen {date(contact.firstInteraction)}</div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span className="hl-contact-label">Instagram account</span>@{contact.igAccount.username}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
                  <span className="hl-contact-label">Activity</span>{contact.dmsSent} DMs sent{contact.follows ? ' · Follows' : ''}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13.5 }}>
                  <span className="hl-contact-label">Last interaction</span>{date(contact.lastInteraction)}
                </div>
                <details className="hl-contact-editor">
                  <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: 13, fontWeight: 650 }}>Notes &amp; tags</summary>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const notes = String(form.get('notes') ?? '').slice(0, 2000);
                      const tags = String(form.get('tags') ?? '').split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 10);
                      updateContact.mutate({ id: contact.id, notes, tags });
                    }}
                    style={{ display: 'grid', gap: 8, minWidth: 240, paddingTop: 10 }}
                  >
                    <label style={{ color: 'var(--text-muted)', fontSize: 12 }}>Private note
                      <textarea name="notes" defaultValue={contact.notes} maxLength={2000} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical' }} />
                    </label>
                    <label style={{ color: 'var(--text-muted)', fontSize: 12 }}>Tags, separated by commas
                      <input name="tags" defaultValue={contact.tags.join(', ')} maxLength={300} placeholder="customer, needs follow-up" style={{ display: 'block', width: '100%', height: 36, marginTop: 4, padding: '0 8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }} />
                    </label>
                    <Btn type="submit" variant="accent" loading={updateContact.isPending} disabled={updateContact.isPending}>
                      <Save style={{ width: 14, height: 14 }} /> Save details
                    </Btn>
                    <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Up to 10 tags, 24 characters each. Notes are private to your HeyLaunch account.</span>
                  </form>
                  {contact.tags.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>{contact.tags.map((tag) => <span key={tag} style={{ padding: '3px 7px', borderRadius: 999, background: 'var(--surface-soft)', color: 'var(--text-muted)', fontSize: 11 }}>{tag}</span>)}</div>}
                </details>
              </div>
            ))}
          </Card>
          {pagination && pagination.totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18 }}>
              <Btn variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                <ChevronLeft style={{ width: 16, height: 16 }} /> Previous
              </Btn>
              <span aria-live="polite" style={{ color: 'var(--text-muted)', fontSize: 13 }}>Page {page} of {pagination.totalPages}</span>
              <Btn variant="ghost" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))}>
                Next <ChevronRight style={{ width: 16, height: 16 }} />
              </Btn>
            </div>
          )}
        </>
      )}

      <style>{`
        .hl-contact-label{display:none;color:var(--text-faint);font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px}
        @media(max-width:760px){.hl-contact-head{display:none!important}.hl-contact-row{grid-template-columns:1fr 1fr!important;gap:14px!important;padding:16px!important}.hl-contact-label{display:block}.hl-contact-editor{grid-column:1/-1}}
        @media(max-width:430px){.hl-contact-row{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  );
}
