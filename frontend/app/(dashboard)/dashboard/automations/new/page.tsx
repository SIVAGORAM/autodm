'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { automationApi, instagramApi } from '../../../../../services/api';
import { useAuthStore } from '../../../../../store/authStore';
import { InstagramPostSelector } from '../../../../../components/instagram-post-selector';
import { AutomationMessagePreview } from '../../../../../components/automation-message-preview';
import {
  Button, Card, Badge, Stepper, Toggle, TagInput, Input, Textarea, Label,
} from '../../../../../components/ui/primitives';
import {
  ArrowLeft, ArrowRight, MessageCircle, Film, Mail, Plus, Trash2, Check,
  UserCheck, AtSign, ShieldAlert, Sparkles,
} from 'lucide-react';

const STEPS = ['Trigger & Media', 'Keywords & Replies', 'Direct Message'];

type Btn = { title: string; url: string };
const paidTriggers = ['ANY_POST', 'STORY_REPLY', 'LIVE_COMMENT', 'DM'];

const triggerOptions = [
  { value: 'POST_COMMENT', label: 'Comment on a specific post / Reel', icon: MessageCircle, paid: false },
  { value: 'ANY_POST', label: 'Comment on any post / Reel', icon: MessageCircle, paid: true },
  { value: 'STORY_REPLY', label: 'Story reply', icon: Film, paid: true },
  { value: 'LIVE_COMMENT', label: 'Comment during a live broadcast', icon: MessageCircle, paid: true },
  { value: 'DM', label: 'Incoming direct message', icon: Mail, paid: true },
];

const DEFAULT_SUGGESTED_REPLIES = [
  'Sent! Check your DMs 📩',
  'Just sent you a DM with the link! ✨',
  'Check your inbox, it is waiting for you! 🚀',
  'Sent to your DMs! Let me know if you got it 🔥',
  'Done! Check your direct messages 📬',
];

export default function NewAutomationPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user) as any;
  const isPaid = ['CREATOR', 'PRO', 'AGENCY'].includes(user?.plan);

  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');
  const [selectedIgAccountId, setSelectedIgAccountId] = useState('');
  const [selectedMediaSupported, setSelectedMediaSupported] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('POST_COMMENT');
  const [mediaId, setMediaId] = useState('');
  const [matchMode, setMatchMode] = useState<'KEYWORDS' | 'ANY'>('KEYWORDS');
  const [keywordRule, setKeywordRule] = useState<'WHOLE_WORD' | 'EXACT' | 'CONTAINS'>('WHOLE_WORD');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]);
  const [replyToComment, setReplyToComment] = useState(true);
  const [publicReplies, setPublicReplies] = useState<string[]>(DEFAULT_SUGGESTED_REPLIES);
  const [dmText, setDmText] = useState('');
  const [buttons, setButtons] = useState<Btn[]>([{ title: '', url: '' }]);
  const [askToFollow, setAskToFollow] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [trackClicks, setTrackClicks] = useState(true);
  const [followUps, setFollowUps] = useState<{ condition: string; delayMinutes: number; text: string }[]>([]);

  const accountsQ = useQuery({
    queryKey: ['ig-accounts'],
    queryFn: async () => (await instagramApi.accounts()).data.data as { id: string; username: string; isActive: boolean; webhookFields?: string[] }[],
  });
  const loginOptionsQ = useQuery({
    queryKey: ['instagram-login-options'],
    queryFn: async () => (await instagramApi.loginOptions()).data.data as { liveCommentsEnabled?: boolean },
  });

  const liveCommentsEnabled = loginOptionsQ.data?.liveCommentsEnabled === true;
  const activeAccounts = (accountsQ.data ?? []).filter((account) => account.isActive);
  const igAccountId = activeAccounts.some((account) => account.id === selectedIgAccountId)
    ? selectedIgAccountId
    : activeAccounts[0]?.id ?? '';
  const selectedAccount = activeAccounts.find((account) => account.id === igAccountId);
  const supportsPublicCommentReply = ['POST_COMMENT', 'ANY_POST'].includes(triggerType);

  const create = useMutation({
    mutationFn: (status: 'DRAFT' | 'LIVE') => {
      const dmBlocks: any[] = [{ type: 'text', text: dmText }];
      const validBtns = buttons.filter((b) => b.title.trim() && b.url.trim());
      if (validBtns.length) dmBlocks.push({ type: 'buttons', buttons: validBtns });

      // Combine positive keywords and negative/excluded keywords
      const formattedKeywords: string[] = [];
      for (const kw of keywords) {
        const trimmed = kw.trim();
        if (!trimmed) continue;
        if (keywordRule === 'EXACT' && !trimmed.startsWith('"')) {
          formattedKeywords.push(`"${trimmed}"`);
        } else if (keywordRule === 'CONTAINS' && !trimmed.startsWith('*')) {
          formattedKeywords.push(`*${trimmed}*`);
        } else {
          formattedKeywords.push(trimmed);
        }
      }
      for (const ex of excludedKeywords) {
        const trimmed = ex.trim();
        if (trimmed) formattedKeywords.push(`-${trimmed}`);
      }

      return automationApi.create({
        igAccountId,
        name,
        triggerType,
        mediaId: triggerType === 'POST_COMMENT' && mediaId ? mediaId : null,
        matchMode,
        keywords: formattedKeywords,
        publicReplies: supportsPublicCommentReply && replyToComment
          ? publicReplies.map((r) => r.trim()).filter(Boolean).slice(0, 10)
          : [],
        replyToComment: supportsPublicCommentReply && replyToComment,
        askToFollow,
        collectEmail,
        trackClicks,
        dmBlocks,
        status,
        followUps: followUps
          .filter((f) => f.text.trim())
          .map((f, i) => ({
            order: i,
            condition: f.condition,
            delayMinutes: f.delayMinutes,
            dmBlocks: [{ type: 'text', text: f.text }],
          })),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automations'] });
      router.push('/dashboard/automations');
    },
    onError: (e: any) =>
      setErr(e.response?.data?.message ?? 'Could not save automation. Please check your fields and try again.'),
  });

  // Step Validation
  function validate(s: number): string | null {
    if (s === 0) {
      if (accountsQ.isLoading) return 'Loading your Instagram accounts. Please wait a moment.';
      if (accountsQ.isError) return 'Could not load your Instagram accounts. Refresh this page and try again.';
      if (!igAccountId) return 'Connect an active professional Instagram account before creating an automation.';
      if (!name.trim()) return 'Give your automation a descriptive name.';
      if (triggerType === 'POST_COMMENT' && !mediaId.trim()) return 'Choose a specific post or Reel to watch.';
      if (triggerType === 'POST_COMMENT' && !selectedMediaSupported) return 'The chosen media does not support comment automation.';
      if (!isPaid && paidTriggers.includes(triggerType)) return 'That trigger requires an upgraded plan.';
    }
    if (s === 1) {
      if (matchMode === 'KEYWORDS' && keywords.length === 0) return 'Add at least one trigger keyword (e.g. GUIDE or LINK).';
      if (!isPaid && keywords.length > 1) return 'Free plan allows one keyword. Upgrade to add multiple keywords.';
    }
    if (s === 2) {
      if (!dmText.trim()) return 'Write the direct message that will be sent.';
      const bad = buttons.find((b) => (b.title.trim() && !b.url.trim()) || (!b.title.trim() && b.url.trim()));
      if (bad) return 'Each button requires both a label and a valid URL.';
      if (triggerType === 'LIVE_COMMENT' && followUps.some((item) => item.text.trim())) {
        return 'Live comment automations cannot use follow-ups. Instagram permits private replies only while the broadcast is live.';
      }
      if (['POST_COMMENT', 'ANY_POST'].includes(triggerType) && followUps.some((item) => item.condition === 'NO_REPLY')) {
        return 'Comment private replies cannot send follow-ups unless the user replies back first.';
      }
    }
    return null;
  }

  const next = () => {
    const e = validate(step);
    if (e) return setErr(e);
    setErr('');
    setStep((s) => Math.min(s + 1, 3));
  };
  const back = () => {
    setErr('');
    setStep((s) => Math.max(s - 1, 0));
  };

  const keywordCap = isPaid ? undefined : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/automations')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to automations
        </button>
        <Stepper steps={STEPS} current={step} />
      </div>

      {err && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-xs">
          {err}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: Form Card */}
        <Card className="p-6">
          {/* STEP 0: Trigger & Media */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="ig-account">Instagram Professional Account</Label>
                {accountsQ.isLoading ? (
                  <p className="mt-1.5 text-sm text-muted-foreground" role="status">Loading accounts…</p>
                ) : accountsQ.isError ? (
                  <div className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                    Couldn’t load accounts. Refresh the page and try again.
                  </div>
                ) : activeAccounts.length === 0 ? (
                  <div className="mt-1.5 rounded-md border border-border p-4 text-sm text-muted-foreground bg-muted/20">
                    Connect an active Instagram business/creator account to get started.{' '}
                    <Link href="/dashboard/instagram" className="font-semibold text-primary underline underline-offset-4">Connect Account</Link>
                  </div>
                ) : activeAccounts.length === 1 ? (
                  <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    @{activeAccounts[0].username}
                  </div>
                ) : (
                  <select
                    id="ig-account"
                    value={igAccountId}
                    onChange={(e) => setSelectedIgAccountId(e.target.value)}
                    className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    {activeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>@{account.username}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <Label htmlFor="name">Automation Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Free Template Delivery"
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label>Trigger: When someone…</Label>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                  {triggerOptions
                    .filter((option) => option.value !== 'LIVE_COMMENT' || liveCommentsEnabled)
                    .map((o) => {
                      const locked = o.paid && !isPaid;
                      const active = triggerType === o.value;
                      const Icon = o.icon;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => !locked && setTriggerType(o.value)}
                          aria-pressed={active}
                          className={`flex items-center gap-3 rounded-lg border p-3.5 text-left text-sm transition-all ${
                            active
                              ? 'border-primary ring-2 ring-primary/20 bg-primary/10 text-foreground font-medium'
                              : 'border-border text-muted-foreground hover:bg-muted/60'
                          } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-primary' : ''}`} />
                          <span className="flex-1 text-xs sm:text-sm">{o.label}</span>
                          {locked && <Badge tone="primary">Paid</Badge>}
                        </button>
                      );
                    })}
                </div>
              </div>

              {triggerType === 'POST_COMMENT' && (
                <div className="pt-2">
                  <InstagramPostSelector
                    accountId={igAccountId}
                    value={mediaId}
                    onChange={setMediaId}
                    onEligibilityChange={setSelectedMediaSupported}
                  />
                </div>
              )}

              {triggerType === 'ANY_POST' && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Watches comments on all existing and newly published Feed Posts and Reels on @{selectedAccount?.username ?? 'your account'}.
                </p>
              )}

              {triggerType === 'STORY_REPLY' && (
                <div className="rounded-lg border border-purple-500/25 bg-purple-500/10 p-4 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold text-purple-700 dark:text-purple-300">
                    <Film className="h-4 w-4" /> Instagram Story Reply Automation
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Watches for incoming replies or reactions sent to any of your active 24-hour Stories.
                    <span className="block mt-1 font-medium text-foreground">
                      Platform Note: Instagram Stories do not have public comment threads; all viewer responses arrive as direct messages and are processed through the official Meta Messaging API.
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: Keywords & Replies */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label>Trigger Match Mode</Label>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMatchMode('KEYWORDS')}
                    className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                      matchMode === 'KEYWORDS'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Specific Keywords
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatchMode('ANY')}
                    className={`rounded-lg border px-4 py-2 text-xs font-semibold transition-all ${
                      matchMode === 'ANY'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Any Comment
                  </button>
                </div>
              </div>

              {matchMode === 'KEYWORDS' && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/15 p-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="keywords-input">Trigger Keywords</Label>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span>Matching:</span>
                        <select
                          value={keywordRule}
                          onChange={(e) => setKeywordRule(e.target.value as any)}
                          className="rounded border border-input bg-background px-1.5 py-0.5 text-xs text-foreground"
                        >
                          <option value="WHOLE_WORD">Whole word (recommended)</option>
                          <option value="EXACT">Exact phrase match</option>
                          <option value="CONTAINS">Contains substring</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-1.5">
                      <TagInput
                        tags={keywords}
                        onChange={setKeywords}
                        max={keywordCap}
                        placeholder="Type keyword and press Enter (e.g. GUIDE, LINK, 🔥)"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Works across English, Telugu, Hindi, and emoji reactions (e.g. 🔥, 🚀). Case-insensitive.
                    </p>
                  </div>

                  {/* Excluded Keywords */}
                  <div className="border-t border-border/60 pt-3">
                    <div className="flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label htmlFor="excluded-keywords" className="text-xs">Excluded / Negative Keywords (Anti-Spam)</Label>
                    </div>
                    <div className="mt-1.5">
                      <TagInput
                        tags={excludedKeywords}
                        onChange={setExcludedKeywords}
                        placeholder="e.g. scam, fake, refund, unsubscribe"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      If a comment contains any of these words, HeyLaunch ignores it to avoid spam interactions.
                    </p>
                  </div>
                </div>
              )}

              {/* Public Comment Replies */}
              {supportsPublicCommentReply && (
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Public Comment Replies</p>
                      <p className="text-xs text-muted-foreground">
                        Automatically rotates replies to protect your account from Instagram spam limits.
                      </p>
                    </div>
                    <Toggle checked={replyToComment} onChange={setReplyToComment} label="Reply publicly" />
                  </div>

                  {replyToComment && (
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">
                          Variations ({publicReplies.length} of 10)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 text-xs text-primary"
                          onClick={() => setPublicReplies([...DEFAULT_SUGGESTED_REPLIES])}
                        >
                          <Sparkles className="mr-1 h-3 w-3" /> Load 5 Suggested
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {publicReplies.map((r, i) => (
                          <div key={i} className="flex gap-2">
                            <Input
                              value={r}
                              onChange={(e) =>
                                setPublicReplies((p) => p.map((x, j) => (j === i ? e.target.value : x)))
                              }
                              placeholder={`Variation ${i + 1} (e.g. Sent! Check your DMs 📩)`}
                              className="text-xs"
                            />
                            {publicReplies.length > 1 && (
                              <button
                                type="button"
                                aria-label="Remove variation"
                                onClick={() => setPublicReplies((p) => p.filter((_, j) => j !== i))}
                                className="rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}

                        {publicReplies.length < 10 && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-8 text-xs font-medium"
                            onClick={() => setPublicReplies((p) => [...p, ''])}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add variation
                          </Button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        ⚠️ HeyLaunch sends the private DM first. Only when delivery succeeds will the public reply be posted.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: The DM */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="dm-message">Direct Message Text</Label>
                <Textarea
                  id="dm-message"
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                  placeholder="Hey {{first_name}}! Thanks for commenting on my post. Here is the link you requested 👇"
                  className="mt-1.5 min-h-[110px]"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Personalize:</span>
                  {['{{first_name}}', '{{name}}', '{{username}}'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setDmText((t) => (t ? t + ' ' + tag : tag))}
                      className="rounded border border-border bg-muted/60 px-2 py-0.5 text-xs font-mono font-medium text-foreground hover:bg-background"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive Buttons */}
              <div className="rounded-lg border border-border p-4">
                <Label>Interactive Buttons <span className="text-muted-foreground font-normal">(up to 3)</span></Label>
                <div className="mt-2 space-y-2.5">
                  {buttons.map((b, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={b.title}
                        maxLength={20}
                        onChange={(e) =>
                          setButtons((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                        }
                        placeholder="Button Title (max 20)"
                        className="w-1/3 text-xs"
                      />
                      <Input
                        value={b.url}
                        onChange={(e) =>
                          setButtons((p) => p.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                        }
                        placeholder="https://example.com/guide"
                        className="flex-1 text-xs"
                      />
                      {buttons.length > 1 && (
                        <button
                          type="button"
                          aria-label="Remove button"
                          onClick={() => setButtons((p) => p.filter((_, j) => j !== i))}
                          className="rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {buttons.length < 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 text-xs font-medium"
                      onClick={() => setButtons((p) => [...p, { title: '', url: '' }])}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add button
                    </Button>
                  )}
                </div>
              </div>

              {/* Workflows: Follow-First & Email Collection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                  <div className="flex items-start gap-3">
                    <UserCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Follow-First Verification</p>
                      <p className="text-xs text-muted-foreground">
                        Checks if user follows your account before delivering the link. Prompts them to follow first.
                      </p>
                    </div>
                  </div>
                  <Toggle checked={askToFollow} onChange={setAskToFollow} label="Require follower status" />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                  <div className="flex items-start gap-3">
                    <AtSign className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Email Collection</p>
                      <p className="text-xs text-muted-foreground">
                        Collects commenter&apos;s email address with consent. Captured emails appear in Contacts.
                      </p>
                    </div>
                  </div>
                  <Toggle checked={collectEmail} onChange={setCollectEmail} label="Collect email" />
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Track Link Clicks</p>
                    <p className="text-xs text-muted-foreground">
                      Track clicks and attribution analytics when users tap your DM buttons.
                    </p>
                  </div>
                  <Toggle checked={trackClicks} onChange={setTrackClicks} label="Track link clicks" />
                </div>
              </div>

              {/* Follow-Ups */}
              <div className="rounded-lg border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Automated Follow-ups {!isPaid && <Badge tone="primary">Paid</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Follow-ups are permitted by Meta within 24 hours only when the user replies to your message.
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  {followUps.map((f, i) => (
                    <div key={i} className="space-y-2 rounded-md border border-border bg-muted/20 p-2.5">
                      <div className="flex gap-2">
                        <select
                          value={f.condition}
                          onChange={(e) =>
                            setFollowUps((p) => p.map((x, j) => (j === i ? { ...x, condition: e.target.value } : x)))
                          }
                          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="DELAY">After a delay</option>
                          <option value="LINK_NOT_CLICKED">If link not clicked</option>
                          <option value="NO_REPLY" disabled={['POST_COMMENT', 'ANY_POST'].includes(triggerType)}>
                            If no reply (inbound message triggers only)
                          </option>
                        </select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min={1}
                            max={1439}
                            value={f.delayMinutes}
                            onChange={(e) =>
                              setFollowUps((p) =>
                                p.map((x, j) => (j === i ? { ...x, delayMinutes: Number(e.target.value) } : x))
                              )
                            }
                            className="h-8 w-20 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">min</span>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove follow-up"
                          onClick={() => setFollowUps((p) => p.filter((_, j) => j !== i))}
                          className="rounded-md px-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <Input
                        value={f.text}
                        onChange={(e) =>
                          setFollowUps((p) => p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                        }
                        placeholder="Follow-up message text"
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}

                  {isPaid && followUps.length < 3 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 text-xs font-medium"
                      onClick={() => setFollowUps((p) => [...p, { condition: 'LINK_NOT_CLICKED', delayMinutes: 60, text: '' }])}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add follow-up
                    </Button>
                  )}
                  {!isPaid && <p className="text-xs text-muted-foreground">Upgrade to Pro to enable follow-up sequences.</p>}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground">Review Automation Settings</h2>
              <dl className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-4 text-xs">
                <ReviewItem label="Name" value={name} />
                <ReviewItem label="Account" value={selectedAccount ? `@${selectedAccount.username}` : ''} />
                <ReviewItem label="Trigger" value={triggerOptions.find((o) => o.value === triggerType)?.label ?? triggerType} />
                <ReviewItem label="Match" value={matchMode === 'KEYWORDS' ? keywords.join(', ') || 'None' : 'Any comment'} />
                {excludedKeywords.length > 0 && (
                  <ReviewItem label="Excluded" value={excludedKeywords.join(', ')} />
                )}
                <ReviewItem
                  label="Buttons"
                  value={buttons.filter((b) => b.title && b.url).map((b) => b.title).join(', ') || 'None'}
                />
                <ReviewItem label="Follow-First" value={askToFollow ? 'Enabled ✅' : 'Disabled'} />
                <ReviewItem label="Collect Email" value={collectEmail ? 'Enabled ✉️' : 'Disabled'} />
                {supportsPublicCommentReply && replyToComment && (
                  <ReviewItem label="Public Replies" value={`${publicReplies.filter(Boolean).length} variations configured`} />
                )}
              </dl>
              <p className="text-xs text-muted-foreground">
                Check the live preview on the right. When ready, click Confirm &amp; Launch to start automating.
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
            <Button variant="ghost" onClick={back} disabled={step === 0}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </Button>
            {step < 3 ? (
              <Button onClick={next}>
                Next <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="secondary" loading={create.isPending} onClick={() => create.mutate('DRAFT')}>
                  Save Draft
                </Button>
                <Button variant="accent" loading={create.isPending} onClick={() => create.mutate('LIVE')}>
                  <Check className="mr-1.5 h-4 w-4" /> Confirm &amp; Launch
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Phone Live Preview */}
        <div className="lg:sticky lg:top-6 h-fit">
          <AutomationMessagePreview
            accountUsername={selectedAccount?.username ?? 'yourbrand'}
            publicReply={replyToComment ? publicReplies.find((r) => r.trim()) : undefined}
            dmText={dmText}
            buttons={buttons.filter((b) => b.title.trim())}
            askToFollow={askToFollow}
            collectEmail={collectEmail}
          />
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 font-medium text-muted-foreground">{label}:</dt>
      <dd className="font-semibold text-foreground">{value || '—'}</dd>
    </div>
  );
}
