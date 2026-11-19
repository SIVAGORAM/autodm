'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { automationApi } from '../../../../../services/api';
import { useAuthStore } from '../../../../../store/authStore';
import {
  Button, Card, Badge, Stepper, Toggle, TagInput, Input, Textarea, Label,
} from '../../../../../components/ui/primitives';
import { ArrowLeft, ArrowRight, MessageCircle, Film, Radio, Mail, Plus, Trash2, Check } from 'lucide-react';

const STEPS = ['Trigger', 'Keywords & reply', 'The DM'];

type Btn = { title: string; url: string };
const paidTriggers = ['ANY_POST', 'STORY_REPLY', 'LIVE_COMMENT', 'DM'];

const triggerOptions = [
  { value: 'POST_COMMENT', label: 'Comment on a post or Reel', icon: MessageCircle, paid: false },
  { value: 'NEXT_POST', label: 'My next post', icon: Film, paid: false },
  { value: 'ANY_POST', label: 'Comment on any post', icon: MessageCircle, paid: true },
  { value: 'STORY_REPLY', label: 'Story reply', icon: Film, paid: true },
  { value: 'LIVE_COMMENT', label: 'Live comment', icon: Radio, paid: true },
  { value: 'DM', label: 'Incoming DM', icon: Mail, paid: true },
];

export default function NewAutomationPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user) as any;
  const isPaid = user?.plan === 'PAID' || user?.subscription?.status === 'ACTIVE';

  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');

  // form state
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('POST_COMMENT');
  const [mediaId, setMediaId] = useState('');
  const [matchMode, setMatchMode] = useState<'KEYWORDS' | 'ANY' | 'AI_INTENT'>('KEYWORDS');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [replyToComment, setReplyToComment] = useState(true);
  const [publicReplies, setPublicReplies] = useState<string[]>(['']);
  const [dmText, setDmText] = useState('');
  const [buttons, setButtons] = useState<Btn[]>([{ title: '', url: '' }]);
  const [askToFollow, setAskToFollow] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [trackClicks, setTrackClicks] = useState(true);
  const [followUps, setFollowUps] = useState<{ condition: string; delayMinutes: number; text: string }[]>([]);

  const igAccountId = user?.instagramAccount?.id ?? user?.igAccounts?.[0]?.id ?? '';

  const create = useMutation({
    mutationFn: (status: 'DRAFT' | 'LIVE') => {
      const dmBlocks: any[] = [{ type: 'text', text: dmText }];
      const validBtns = buttons.filter((b) => b.title.trim() && b.url.trim());
      if (validBtns.length) dmBlocks.push({ type: 'buttons', buttons: validBtns });
      return automationApi.create({
        igAccountId, name, triggerType,
        mediaId: triggerType === 'POST_COMMENT' && mediaId ? mediaId : null,
        matchMode, keywords,
        publicReplies: replyToComment ? publicReplies.filter((r) => r.trim()) : [],
        replyToComment, askToFollow, collectEmail, trackClicks, dmBlocks, status,
        followUps: followUps
          .filter((f) => f.text.trim())
          .map((f, i) => ({ order: i, condition: f.condition, delayMinutes: f.delayMinutes, dmBlocks: [{ type: 'text', text: f.text }] })),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); router.push('/dashboard/automations'); },
    onError: (e: any) => setErr(e.response?.data?.message ?? 'Could not save. Check the fields and try again.'),
  });

  // step validation
  function validate(s: number): string | null {
    if (s === 0) {
      if (!name.trim()) return 'Give your automation a name.';
      if (!isPaid && paidTriggers.includes(triggerType)) return 'That trigger needs a paid plan.';
    }
    if (s === 1) {
      if (matchMode === 'KEYWORDS' && keywords.length === 0) return 'Add at least one keyword.';
      if (!isPaid && keywords.length > 1) return 'Free plan allows one keyword.';
    }
    if (s === 2) {
      if (!dmText.trim()) return 'Write the DM message.';
      const bad = buttons.find((b) => (b.title.trim() && !b.url.trim()) || (!b.title.trim() && b.url.trim()));
      if (bad) return 'Each button needs both a label and a URL.';
    }
    return null;
  }
  const next = () => { const e = validate(step); if (e) return setErr(e); setErr(''); setStep((s) => Math.min(s + 1, 3)); };
  const back = () => { setErr(''); setStep((s) => Math.max(s - 1, 0)); };

  const keywordCap = isPaid ? undefined : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => router.push('/dashboard/automations')} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <Stepper steps={STEPS} current={step} />
      </div>

      {err && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* ─── Left: the form ─── */}
        <Card className="p-6">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="name">Automation name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Free guide on my Reel" className="mt-1.5" />
              </div>
              <div>
                <Label>When someone…</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {triggerOptions.map((o) => {
                    const locked = o.paid && !isPaid;
                    const active = triggerType === o.value;
                    const Icon = o.icon;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => !locked && setTriggerType(o.value)}
                        aria-pressed={active}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                          active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                        } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{o.label}</span>
                        {locked && <Badge tone="primary">Paid</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>
              {triggerType === 'POST_COMMENT' && (
                <div>
                  <Label htmlFor="media">Post or Reel ID <span className="text-muted-foreground">(optional — leave blank for any)</span></Label>
                  <Input id="media" value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="17912345678901234" className="mt-1.5" />
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>Match</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['KEYWORDS', 'ANY', 'AI_INTENT'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMatchMode(m)}
                      aria-pressed={matchMode === m}
                      className={`rounded-full border px-3 py-1 text-sm ${matchMode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                    >
                      {m === 'KEYWORDS' ? 'Specific keywords' : m === 'ANY' ? 'Any comment' : 'AI intent'}
                    </button>
                  ))}
                </div>
              </div>
              {matchMode === 'KEYWORDS' && (
                <div>
                  <Label>Keywords</Label>
                  <div className="mt-1.5"><TagInput tags={keywords} onChange={setKeywords} max={keywordCap} placeholder="e.g. GUIDE" /></div>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Also reply under the comment</p>
                  <p className="text-xs text-muted-foreground">Rotates up to 3 public replies.</p>
                </div>
                <Toggle checked={replyToComment} onChange={setReplyToComment} label="Reply under the comment" />
              </div>
              {replyToComment && (
                <div className="space-y-2">
                  {publicReplies.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={r} onChange={(e) => setPublicReplies((p) => p.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Public reply ${i + 1}`} />
                      {publicReplies.length > 1 && (
                        <button type="button" aria-label="Remove reply" onClick={() => setPublicReplies((p) => p.filter((_, j) => j !== i))} className="rounded-md px-2 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                  {publicReplies.length < 3 && (
                    <Button variant="ghost" className="h-9 px-2" onClick={() => setPublicReplies((p) => [...p, ''])}><Plus className="h-4 w-4" /> Add reply</Button>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="dm">The DM</Label>
                <Textarea id="dm" value={dmText} onChange={(e) => setDmText(e.target.value)} placeholder="Thanks for commenting, {{name}}! Here's your link 👇" className="mt-1.5" />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Insert:</span>
                  {['{{name}}', '{{first_name}}', '{{username}}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setDmText((t) => (t ? t + ' ' + tag : tag))}
                      className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground hover:bg-background"
                    >
                      {tag}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground">— filled with the commenter&apos;s name.</span>
                </div>
              </div>
              <div>
                <Label>Buttons <span className="text-muted-foreground">(up to 3)</span></Label>
                <div className="mt-1.5 space-y-2">
                  {buttons.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={b.title} maxLength={20} onChange={(e) => setButtons((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Label" className="w-1/3" />
                      <Input value={b.url} onChange={(e) => setButtons((p) => p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} placeholder="https://…" />
                      {buttons.length > 1 && (
                        <button type="button" aria-label="Remove button" onClick={() => setButtons((p) => p.filter((_, j) => j !== i))} className="rounded-md px-2 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                  {buttons.length < 3 && (
                    <Button variant="ghost" className="h-9 px-2" onClick={() => setButtons((p) => [...p, { title: '', url: '' }])}><Plus className="h-4 w-4" /> Add button</Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Row label="Ask to follow before sending" hint="Only followers get the link." checked={askToFollow} onChange={setAskToFollow} locked={!isPaid} />
                <Row label="Collect email in the DM" hint="Send to your email tool." checked={collectEmail} onChange={setCollectEmail} locked={!isPaid} />
                <Row label="Track link clicks" hint="Count clicks on your buttons." checked={trackClicks} onChange={setTrackClicks} />
              </div>

              <div className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Follow-ups {!isPaid && <Badge tone="primary">Paid</Badge>}</p>
                    <p className="text-xs text-muted-foreground">Send a nudge later if they don&apos;t click or reply (within 24h).</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {followUps.map((f, i) => (
                    <div key={i} className="space-y-2 rounded-md border border-border p-2">
                      <div className="flex gap-2">
                        <select
                          value={f.condition}
                          onChange={(e) => setFollowUps((p) => p.map((x, j) => (j === i ? { ...x, condition: e.target.value } : x)))}
                          className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="DELAY">After a delay</option>
                          <option value="LINK_NOT_CLICKED">If link not clicked</option>
                          <option value="NO_REPLY">If no reply</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <Input type="number" min={1} max={1439} value={f.delayMinutes}
                            onChange={(e) => setFollowUps((p) => p.map((x, j) => (j === i ? { ...x, delayMinutes: Number(e.target.value) } : x)))}
                            className="w-20" />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                        <button type="button" aria-label="Remove follow-up" onClick={() => setFollowUps((p) => p.filter((_, j) => j !== i))} className="rounded-md px-2 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <Input value={f.text} onChange={(e) => setFollowUps((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder="Follow-up message" />
                    </div>
                  ))}
                  {isPaid && followUps.length < 3 && (
                    <Button variant="ghost" className="h-9 px-2" onClick={() => setFollowUps((p) => [...p, { condition: 'LINK_NOT_CLICKED', delayMinutes: 60, text: '' }])}><Plus className="h-4 w-4" /> Add follow-up</Button>
                  )}
                  {!isPaid && <p className="text-xs text-muted-foreground">Upgrade to add follow-ups.</p>}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-foreground">Review</h2>
              <dl className="space-y-2 text-sm">
                <Review k="Name" v={name} />
                <Review k="Trigger" v={triggerOptions.find((o) => o.value === triggerType)?.label ?? triggerType} />
                <Review k="Match" v={matchMode === 'KEYWORDS' ? keywords.join(', ') : matchMode === 'ANY' ? 'Any comment' : 'AI intent'} />
                <Review k="Buttons" v={buttons.filter((b) => b.title && b.url).map((b) => b.title).join(', ') || '—'} />
              </dl>
              <p className="text-xs text-muted-foreground">Check the preview on the right, then launch.</p>
            </div>
          )}

          {/* nav */}
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0}><ArrowLeft className="h-4 w-4" /> Back</Button>
            {step < 3 ? (
              <Button onClick={next}>Next <ArrowRight className="h-4 w-4" /></Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate('DRAFT')}>Save draft</Button>
                <Button variant="accent" loading={create.isPending} onClick={() => create.mutate('LIVE')}><Check className="h-4 w-4" /> Confirm &amp; launch</Button>
              </div>
            )}
          </div>
        </Card>

        {/* ─── Right: phone preview ─── */}
        <div className="lg:sticky lg:top-6 h-fit">
          <PhonePreview
            username={user?.instagramAccount?.username ?? user?.igAccounts?.[0]?.username ?? 'yourbrand'}
            reply={replyToComment ? publicReplies.find((r) => r.trim()) : undefined}
            dmText={dmText}
            buttons={buttons.filter((b) => b.title.trim())}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, checked, onChange, locked }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label} {locked && <Badge tone="primary">Paid</Badge>}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Toggle checked={checked && !locked} onChange={onChange} label={label} locked={locked} />
    </div>
  );
}

function Review({ k, v }: { k: string; v: string }) {
  return <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">{k}</dt><dd className="text-foreground">{v || '—'}</dd></div>;
}

function PhonePreview({ username, reply, dmText, buttons }: { username: string; reply?: string; dmText: string; buttons: { title: string; url: string }[] }) {
  return (
    <Card className="p-3">
      <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Preview</p>
      <div className="mx-auto max-w-[280px] rounded-2xl border border-border bg-background p-3">
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-2">
          <div className="h-7 w-7 rounded-full bg-muted" aria-hidden />
          <span className="text-sm font-medium text-foreground">{username}</span>
        </div>
        {reply && (
          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Public reply</p>
            <p className="rounded-lg bg-muted px-3 py-1.5 text-sm text-foreground">{reply}</p>
          </div>
        )}
        <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Direct message</p>
        <div className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          {dmText || <span className="opacity-70">Your DM text appears here…</span>}
          {buttons.length > 0 && (
            <div className="mt-2 space-y-1">
              {buttons.map((b, i) => (
                <div key={i} className="rounded-md bg-background/20 px-2 py-1 text-center text-xs font-medium">{b.title || 'Button'}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
