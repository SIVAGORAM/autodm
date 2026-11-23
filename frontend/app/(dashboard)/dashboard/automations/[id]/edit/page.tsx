'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { automationApi, instagramApi } from '../../../../../../services/api';
import { useAuthStore } from '../../../../../../store/authStore';
import { InstagramPostSelector } from '../../../../../../components/instagram-post-selector';
import { AutomationMessagePreview } from '../../../../../../components/automation-message-preview';
import { Badge, Button, Card, Input, Label, TagInput, Textarea, Toggle } from '../../../../../../components/ui/primitives';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';

type FollowUp = { id?: string; condition: string; delayMinutes: number; text: string };
type MessageButton = { title: string; url: string };

const triggers = [
  { value: 'POST_COMMENT', label: 'Comment on a post' },
  { value: 'ANY_POST', label: 'Comment on any post', paid: true },
  { value: 'STORY_REPLY', label: 'Story reply', paid: true },
  { value: 'LIVE_COMMENT', label: 'Comment during a live broadcast', paid: true },
  { value: 'DM', label: 'Incoming DM', paid: true },
];
const paidTriggers = ['ANY_POST', 'STORY_REPLY', 'LIVE_COMMENT', 'DM'];
const supportedTriggers = triggers.map((trigger) => trigger.value);
const unavailableFollowUpConditions: Record<string, string> = {
  BOUGHT: 'Purchase event (integration unavailable)',
  NOT_BOUGHT: 'No purchase event (integration unavailable)',
  FORM_NOT_SUBMITTED: 'Form submission event (integration unavailable)',
};

export default function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user) as any;
  const isPaid = ['CREATOR', 'PRO', 'AGENCY'].includes(user?.plan);
  const automation = useQuery({ queryKey: ['automation', id], queryFn: async () => (await automationApi.get(id)).data.data });
  const loginOptions = useQuery({ queryKey: ['instagram-login-options'], queryFn: async () => (await instagramApi.loginOptions()).data.data as { liveCommentsEnabled?: boolean } });
  const liveCommentsEnabled = loginOptions.data?.liveCommentsEnabled === true;

  const [initializedForId, setInitializedForId] = useState('');
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('POST_COMMENT');
  const [mediaId, setMediaId] = useState('');
  const [selectedMediaSupported, setSelectedMediaSupported] = useState(true);
  const [matchMode, setMatchMode] = useState<'KEYWORDS' | 'ANY'>('KEYWORDS');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [replyToComment, setReplyToComment] = useState(false);
  const [publicReplies, setPublicReplies] = useState<string[]>([]);
  const [dmText, setDmText] = useState('');
  const [buttons, setButtons] = useState<MessageButton[]>([]);
  const [trackClicks, setTrackClicks] = useState(true);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [error, setError] = useState('');
  const supportsPublicCommentReply = ['POST_COMMENT', 'ANY_POST'].includes(triggerType);

  useEffect(() => {
    const current = automation.data;
    if (!current || initializedForId === id) return;
    const blocks = Array.isArray(current.dmBlocks) ? current.dmBlocks : [];
    const textBlock = blocks.find((block: any) => block?.type === 'text');
    const buttonBlocks = blocks.filter((block: any) => block?.type === 'buttons');
    setName(current.name ?? '');
    setTriggerType(supportedTriggers.includes(current.triggerType) ? current.triggerType : 'POST_COMMENT');
    setMediaId(current.mediaId ?? '');
    setMatchMode(current.matchMode === 'ANY' ? 'ANY' : 'KEYWORDS');
    setKeywords(Array.isArray(current.keywords) ? current.keywords : []);
    setReplyToComment(!!current.replyToComment);
    setPublicReplies(Array.isArray(current.publicReplies) ? current.publicReplies : []);
    setDmText(typeof textBlock?.text === 'string' ? textBlock.text : '');
    setButtons(buttonBlocks.flatMap((block: any) => Array.isArray(block.buttons) ? block.buttons : []));
    setTrackClicks(current.trackClicks !== false);
    setFollowUps((current.followUps ?? []).map((item: any) => {
      const text = Array.isArray(item.dmBlocks) ? item.dmBlocks.find((block: any) => block?.type === 'text')?.text : '';
      return { id: item.id, condition: item.condition, delayMinutes: item.delayMinutes, text: typeof text === 'string' ? text : '' };
    }));
    setInitializedForId(id);
  }, [automation.data, id, initializedForId]);

  const save = useMutation({
    mutationFn: () => {
      const dmBlocks: any[] = [{ type: 'text', text: dmText.trim() }];
      const validButtons = buttons.filter((button) => button.title.trim() && button.url.trim());
      if (validButtons.length) dmBlocks.push({ type: 'buttons', buttons: validButtons });
      return automationApi.update(id, {
        name: name.trim(),
        // Keep an already-disabled Live Comment trigger intact when editing a
        // paused legacy record; do not silently convert it or ask the API to
        // activate a feature that is disabled in this deployment.
        ...(triggerType === 'LIVE_COMMENT' && !liveCommentsEnabled && automation.data?.triggerType === 'LIVE_COMMENT' ? {} : { triggerType }),
        mediaId: triggerType === 'POST_COMMENT' && mediaId.trim() ? mediaId.trim() : null,
        matchMode, keywords,
        publicReplies: supportsPublicCommentReply && replyToComment ? publicReplies.filter((reply) => reply.trim()) : [],
        replyToComment: supportsPublicCommentReply && replyToComment,
        trackClicks, askToFollow: false, collectEmail: false, dmBlocks,
        followUps: followUps.map((item, index) => ({
          ...(item.id ? { id: item.id } : {}), order: index, condition: item.condition, delayMinutes: item.delayMinutes,
          dmBlocks: [{ type: 'text', text: item.text.trim() }],
        })),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['automation', id] }),
        queryClient.invalidateQueries({ queryKey: ['automations'] }),
        queryClient.invalidateQueries({ queryKey: ['automation-runs', id] }),
      ]);
      router.push(`/dashboard/automations/${id}`);
    },
    onError: (cause: any) => {
      const message = cause.response?.data?.message;
      setError(Array.isArray(message) ? message.join(' ') : message ?? 'Could not save changes. Check the fields and try again.');
    },
  });

  function submit() {
    setError('');
    if (!name.trim()) return setError('Give your automation a name.');
    if (triggerType === 'POST_COMMENT' && !mediaId.trim()) return setError('Choose a specific post. Use “Comment on any post” for account-wide coverage.');
    if (triggerType === 'POST_COMMENT' && !selectedMediaSupported) return setError('Choose a supported Instagram post.');
    if (paidTriggers.includes(triggerType) && !isPaid) return setError('This trigger requires a paid plan.');
    if (triggerType === 'LIVE_COMMENT' && !liveCommentsEnabled && automation.data?.triggerType !== 'LIVE_COMMENT') return setError('Live Comment is not enabled for this Meta app.');
    if (triggerType === 'LIVE_COMMENT' && followUps.length > 0) return setError('Live comment automations cannot use follow-ups. Remove the follow-up steps before saving.');
    if (matchMode === 'KEYWORDS' && keywords.length === 0) return setError('Add at least one keyword.');
    if (!isPaid && keywords.length > 1) return setError('Your plan allows one keyword per automation.');
    if (!dmText.trim()) return setError('Write the DM message.');
    if (buttons.filter((button) => button.title.trim() && button.url.trim()).length > 3) return setError('Instagram allows up to 3 message buttons.');
    if (replyToComment && publicReplies.filter((reply) => reply.trim()).length > 3) return setError('Choose up to 3 public replies.');
    if (buttons.some((button) => (button.title.trim() && !button.url.trim()) || (!button.title.trim() && button.url.trim()))) {
      return setError('Each button needs both a label and a URL.');
    }
    if (followUps.some((item) => !item.text.trim())) return setError('Add a message or remove each empty follow-up.');
    if (['POST_COMMENT', 'ANY_POST'].includes(triggerType) && followUps.some((item) => item.condition === 'NO_REPLY')) return setError('A comment private reply cannot be followed by an unsolicited message. Choose another condition; the commenter must reply first.');
    save.mutate();
  }

  if (automation.isLoading || initializedForId !== id) {
    return <div className="mx-auto max-w-3xl py-12 text-center text-sm text-muted-foreground">Loading automation…</div>;
  }
  if (automation.isError || !automation.data) {
    return <div role="alert" className="mx-auto max-w-3xl py-12 text-center text-sm text-destructive">Couldn’t load this automation. <Link className="underline" href="/dashboard/automations">Return to automations</Link></div>;
  }

  const keywordLimit = isPaid ? undefined : 1;
  const hasLegacyUnsupportedOptions = automation.data.askToFollow || automation.data.collectEmail
    || automation.data.matchMode === 'AI_INTENT' || !supportedTriggers.includes(automation.data.triggerType);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
      <Link href={`/dashboard/automations/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Automation
      </Link>
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Edit automation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Queued events may keep their captured DM text. Pending follow-ups retain their scheduled step; removing a step cancels its pending follow-up.</p>
      </header>

      {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {hasLegacyUnsupportedOptions && <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">This automation contains legacy options that are no longer supported. Saving will turn off follow gating and email capture and use a supported trigger and keyword rule.</div>}

      <Card className="space-y-6 p-6">
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Trigger</h2>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            Instagram account: @{automation.data.igAccount?.username ?? 'connected account'}
          </div>
          <div>
            <Label htmlFor="automation-name">Automation name</Label>
            <Input id="automation-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="trigger-type">When someone…</Label>
            <select id="trigger-type" value={triggerType} onChange={(event) => setTriggerType(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
              {triggers.map((trigger) => (
                <option key={trigger.value} value={trigger.value} disabled={!!trigger.paid && !isPaid || trigger.value === 'LIVE_COMMENT' && !liveCommentsEnabled && automation.data.triggerType !== 'LIVE_COMMENT'}>
                  {trigger.label}{trigger.paid && !isPaid ? ' (paid plan)' : trigger.value === 'LIVE_COMMENT' && !liveCommentsEnabled ? ' (not enabled)' : ''}
                </option>
              ))}
            </select>
          </div>
          {triggerType === 'LIVE_COMMENT' && <p role="status" className="text-xs leading-relaxed text-muted-foreground">HeyLaunch attempts one private reply for a matching live comment. Meta may reject it if delivery occurs after the broadcast ends. This trigger requires the live_comments webhook and cannot use follow-ups.</p>}
          {triggerType === 'ANY_POST' && <p role="status" className="text-xs leading-relaxed text-muted-foreground">Meta documents comment events and private replies for Reels. Coverage still depends on your account permissions and active comment webhook subscription.</p>}
          {['POST_COMMENT', 'ANY_POST'].includes(triggerType) && <p className="text-xs leading-relaxed text-muted-foreground">Each comment can trigger one DM. A rule for the exact post takes priority over “Any post”; if multiple rules at the same priority match, the oldest automation handles it.</p>}
          {['DM', 'STORY_REPLY'].includes(triggerType) && <p className="text-xs leading-relaxed text-muted-foreground">If multiple active rules match the same message, the oldest automation handles it.</p>}
          {triggerType === 'POST_COMMENT' && <InstagramPostSelector accountId={automation.data.igAccountId} value={mediaId} onChange={setMediaId} onEligibilityChange={setSelectedMediaSupported} />}
          <div>
            <Label>Match rule</Label>
            <div className="mt-2 flex gap-2">
              {(['KEYWORDS', 'ANY'] as const).map((mode) => (
                <button key={mode} type="button" aria-pressed={matchMode === mode} onClick={() => setMatchMode(mode)} className={`rounded-full border px-3 py-1.5 text-sm ${matchMode === mode ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {mode === 'KEYWORDS' ? 'Specific keywords' : 'Any message/comment'}
                </button>
              ))}
            </div>
          </div>
          {matchMode === 'KEYWORDS' && <div><Label>Keywords</Label><div className="mt-1.5"><TagInput tags={keywords} onChange={setKeywords} max={keywordLimit} placeholder="Add a keyword" /></div></div>}
        </section>

        {supportsPublicCommentReply && (
          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-sm font-medium text-foreground">Reply under the comment</p><p className="text-xs text-muted-foreground">Choose up to 3 public replies to rotate.</p></div>
              <Toggle checked={replyToComment} onChange={setReplyToComment} label="Reply under the comment" />
            </div>
            {replyToComment && <div className="space-y-2">
              {publicReplies.map((reply, index) => <div key={index} className="flex gap-2"><Input aria-label={`Public reply ${index + 1}`} value={reply} maxLength={1000} onChange={(event) => setPublicReplies((items) => items.map((item, i) => i === index ? event.target.value : item))} />{publicReplies.length > 1 && <button type="button" aria-label="Remove public reply" onClick={() => setPublicReplies((items) => items.filter((_, i) => i !== index))} className="rounded-md px-2 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>}</div>)}
              {publicReplies.length < 3 && <Button variant="ghost" onClick={() => setPublicReplies((items) => [...items, ''])}><Plus className="h-4 w-4" /> Add reply</Button>}
            </div>}
          </section>
        )}

        <section className="space-y-4 border-t border-border pt-5">
          <h2 className="text-base font-semibold text-foreground">Direct message</h2>
          <div><Label htmlFor="edit-dm">Message</Label><Textarea id="edit-dm" value={dmText} maxLength={1000} onChange={(event) => setDmText(event.target.value)} className="mt-1.5" /></div>
          <div>
            <div className="mb-2 flex items-center gap-2"><Label>Buttons</Label><Badge tone="muted">Up to 3</Badge></div>
            <div className="space-y-2">
              {buttons.map((button, index) => <div key={index} className="flex gap-2"><Input aria-label={`Button ${index + 1} label`} value={button.title} maxLength={20} onChange={(event) => setButtons((items) => items.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} placeholder="Label" className="w-1/3" /><Input aria-label={`Button ${index + 1} URL`} value={button.url} onChange={(event) => setButtons((items) => items.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} placeholder="https://…" />{buttons.length > 1 && <button type="button" aria-label="Remove button" onClick={() => setButtons((items) => items.filter((_, i) => i !== index))} className="rounded-md px-2 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>}</div>)}
              {buttons.length < 3 && <Button variant="ghost" onClick={() => setButtons((items) => [...items, { title: '', url: '' }])}><Plus className="h-4 w-4" /> Add button</Button>}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium text-foreground">Track link clicks</p><p className="text-xs text-muted-foreground">Count clicks on your message buttons.</p></div><Toggle checked={trackClicks} onChange={setTrackClicks} label="Track link clicks" /></div>
        </section>

        <section className="space-y-3 border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4"><div><h2 className="text-base font-semibold text-foreground">Follow-ups</h2><p className="text-xs text-muted-foreground">For comment automations, each follow-up delay starts when the commenter replies. HeyLaunch sends it only within Instagram’s 24-hour window; no follow-up is sent if they never reply.</p></div>{!isPaid && <Badge tone="primary">Paid plan</Badge>}</div>
          {followUps.map((item, index) => <div key={index} className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap gap-2">
              <select aria-label={`Follow-up ${index + 1} condition`} value={item.condition} onChange={(event) => setFollowUps((items) => items.map((current, i) => i === index ? { ...current, condition: event.target.value } : current))} className="h-9 min-w-40 flex-1 rounded-md border border-input bg-background px-2 text-sm">
                {unavailableFollowUpConditions[item.condition] && <option value={item.condition} disabled>{unavailableFollowUpConditions[item.condition]}</option>}
                <option value="DELAY">After a delay</option><option value="LINK_NOT_CLICKED">If link not clicked</option><option value="NO_REPLY" disabled={['POST_COMMENT', 'ANY_POST'].includes(triggerType)}>If no reply (not available after a comment DM)</option>
              </select>
              <Input aria-label={`Follow-up ${index + 1} delay in minutes`} type="number" min={1} max={1439} value={item.delayMinutes} onChange={(event) => setFollowUps((items) => items.map((current, i) => i === index ? { ...current, delayMinutes: Number(event.target.value) } : current))} className="w-28" />
              <button type="button" aria-label={`Remove follow-up ${index + 1}`} onClick={() => setFollowUps((items) => items.filter((_, i) => i !== index))} className="rounded-md px-2 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>
            </div>
            <Input aria-label={`Follow-up ${index + 1} message`} value={item.text} maxLength={1000} onChange={(event) => setFollowUps((items) => items.map((current, i) => i === index ? { ...current, text: event.target.value } : current))} placeholder="Follow-up message" />
          </div>)}
          {followUps.some((item) => unavailableFollowUpConditions[item.condition]) && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">A saved follow-up uses a purchase or form event that HeyLaunch does not currently receive. It will be skipped. Choose a supported condition or remove the step.</p>}
          {['POST_COMMENT', 'ANY_POST'].includes(triggerType) && <p className="text-xs text-muted-foreground">Each step is scheduled from the commenter’s reply time, so a late reply can still start the follow-up sequence within the 24-hour window.</p>}
          {['POST_COMMENT', 'ANY_POST'].includes(triggerType) && followUps.some((item) => item.condition === 'NO_REPLY') && <p role="status" className="text-xs text-muted-foreground">Change “If no reply” to another condition. Instagram requires the commenter to respond before HeyLaunch can send a follow-up.</p>}
          {triggerType !== 'LIVE_COMMENT' && isPaid && followUps.length < 3 && <Button variant="ghost" onClick={() => setFollowUps((items) => [...items, { condition: 'LINK_NOT_CLICKED', delayMinutes: 60, text: '' }])}><Plus className="h-4 w-4" /> Add follow-up</Button>}
          {!isPaid && followUps.length === 0 && <p className="text-sm text-muted-foreground">Upgrade to add follow-ups.</p>}
        </section>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
          <Button variant="secondary" onClick={() => router.push(`/dashboard/automations/${id}`)}>Cancel</Button>
          <Button variant="accent" loading={save.isPending} onClick={submit}><Save className="h-4 w-4" /> Save changes</Button>
        </div>
      </Card>
      </div>

      <aside className="h-fit lg:sticky lg:top-6">
        <AutomationMessagePreview
          accountUsername={automation.data.igAccount?.username ?? 'yourbrand'}
          publicReply={supportsPublicCommentReply && replyToComment ? publicReplies.find((reply) => reply.trim()) : undefined}
          dmText={dmText}
          buttons={buttons}
        />
      </aside>
    </div>
  );
}
