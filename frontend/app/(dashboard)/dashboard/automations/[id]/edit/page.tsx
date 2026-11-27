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
import { ArrowLeft, Play, Plus, Save, Trash2, Sparkles, Languages, Check, Heart } from 'lucide-react';
import {
  AutomationLanguage,
  LANGUAGE_OPTIONS,
  PUBLIC_COMMENT_REPLIES,
  DM_BODY_TEMPLATES,
  STORY_MENTION_TEMPLATES,
  normalizeLanguage,
} from '../../../../../../lib/automation-templates';

type FollowUp = { id?: string; condition: string; delayMinutes: number; text: string };
type MessageButton = { title: string; url: string };

const triggers = [
  { value: 'POST_COMMENT', label: 'Comment on a post' },
  { value: 'ANY_POST', label: 'Comment on any post', paid: true },
  { value: 'STORY_REPLY', label: 'Story reply (replied to your story)', paid: true },
  { value: 'STORY_MENTION', label: 'Story mention (tagged @you in a story)', paid: true },
  { value: 'LIVE_COMMENT', label: 'Comment during a live broadcast', paid: true },
  { value: 'DM', label: 'Incoming DM', paid: true },
];
const paidTriggers = ['ANY_POST', 'STORY_REPLY', 'STORY_MENTION', 'LIVE_COMMENT', 'DM'];
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
  const [excludedKeywords, setExcludedKeywords] = useState<string[]>([]);
  const [replyToComment, setReplyToComment] = useState(false);
  const [autoLikeComment, setAutoLikeComment] = useState(false);
  const [language, setLanguage] = useState<AutomationLanguage>('TENGLISH');
  const [publicReplies, setPublicReplies] = useState<string[]>([]);
  const [askToFollow, setAskToFollow] = useState(false);
  const [collectEmail, setCollectEmail] = useState(false);
  const [dmText, setDmText] = useState('');
  const [buttons, setButtons] = useState<MessageButton[]>([]);
  const [trackClicks, setTrackClicks] = useState(true);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [error, setError] = useState('');
  const supportsPublicCommentReply = ['POST_COMMENT', 'ANY_POST'].includes(triggerType);

  const handleLanguageChange = (newLang: AutomationLanguage) => {
    setLanguage(newLang);
    if (!publicReplies.length || publicReplies.every((r) => Object.values(PUBLIC_COMMENT_REPLIES).flat().includes(r))) {
      setPublicReplies(PUBLIC_COMMENT_REPLIES[newLang].slice(0, 5));
    }
  };

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
    setLanguage(normalizeLanguage(current.language));
    
    const rawKeywords = Array.isArray(current.keywords) ? current.keywords : [];
    const positive = rawKeywords.filter((k: string) => typeof k === 'string' && !k.startsWith('-'));
    const negative = rawKeywords.filter((k: string) => typeof k === 'string' && k.startsWith('-')).map((k: string) => k.slice(1));
    setKeywords(positive);
    setExcludedKeywords(negative);

    setReplyToComment(!!current.replyToComment);
    setAutoLikeComment(Boolean(current.autoLikeComment));
    setPublicReplies(
      Array.isArray(current.publicReplies) && current.publicReplies.length > 0
        ? current.publicReplies
        : PUBLIC_COMMENT_REPLIES[normalizeLanguage(current.language)].slice(0, 5)
    );
    setAskToFollow(Boolean(current.askToFollow));
    setCollectEmail(Boolean(current.collectEmail));
    setDmText(typeof textBlock?.text === 'string' ? textBlock.text : '');
    setButtons(buttonBlocks.flatMap((block: any) => Array.isArray(block.buttons) ? block.buttons : []));
    setTrackClicks(current.trackClicks !== false);
    setFollowUps((current.followUps ?? []).map((item: any) => {
      const text = Array.isArray(item.dmBlocks) ? item.dmBlocks.find((block: any) => block?.type === 'text')?.text : '';
      return { id: item.id, condition: item.condition, delayMinutes: item.delayMinutes, text: typeof text === 'string' ? text : '' };
    }));
    setInitializedForId(id);
  }, [automation.data, id, initializedForId]);

  const [targetStatus, setTargetStatus] = useState<'DRAFT' | 'LIVE' | null>(null);

  const save = useMutation({
    mutationFn: (newStatus?: 'DRAFT' | 'LIVE') => {
      setTargetStatus(newStatus ?? null);
      const dmBlocks: any[] = [{ type: 'text', text: dmText.trim() }];
      const validButtons = buttons.filter((button) => button.title.trim() && button.url.trim());
      if (validButtons.length) dmBlocks.push({ type: 'buttons', buttons: validButtons });

      const formattedKeywords: string[] = [];
      for (const kw of keywords) {
        const trimmed = kw.trim();
        if (trimmed) formattedKeywords.push(trimmed);
      }
      for (const ex of excludedKeywords) {
        const trimmed = ex.trim();
        if (trimmed) formattedKeywords.push(`-${trimmed}`);
      }

      return automationApi.update(id, {
        name: name.trim(),
        ...(newStatus ? { status: newStatus } : {}),
        ...(triggerType === 'LIVE_COMMENT' && !liveCommentsEnabled && automation.data?.triggerType === 'LIVE_COMMENT' ? {} : { triggerType }),
        mediaId: triggerType === 'POST_COMMENT' && mediaId.trim() ? mediaId.trim() : null,
        matchMode,
        keywords: formattedKeywords,
        publicReplies: supportsPublicCommentReply && replyToComment ? publicReplies.filter((reply) => reply.trim()).slice(0, 25) : [],
        replyToComment: supportsPublicCommentReply && replyToComment,
        autoLikeComment: supportsPublicCommentReply && autoLikeComment,
        askToFollow,
        collectEmail,
        trackClicks,
        language,
        dmBlocks,
        followUps: followUps.map((item, index) => ({
          ...(item.id ? { id: item.id } : {}), order: index, condition: item.condition, delayMinutes: item.delayMinutes,
          dmBlocks: [{ type: 'text', text: item.text.trim() }],
        })),
      });
    },
    onSettled: () => setTargetStatus(null),
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

  function submit(newStatus?: 'DRAFT' | 'LIVE') {
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
    if (replyToComment && publicReplies.filter((reply) => reply.trim()).length > 25) return setError('Choose up to 25 public replies.');
    if (buttons.some((button) => (button.title.trim() && !button.url.trim()) || (!button.title.trim() && button.url.trim()))) {
      return setError('Each button needs both a label and a URL.');
    }
    if (followUps.some((item) => !item.text.trim())) return setError('Add a message or remove each empty follow-up.');
    if (['POST_COMMENT', 'ANY_POST'].includes(triggerType) && followUps.some((item) => item.condition === 'NO_REPLY')) return setError('A comment private reply cannot be followed by an unsolicited message. Choose another condition; the commenter must reply first.');
    save.mutate(newStatus);
  }

  if (automation.isLoading || initializedForId !== id) {
    return <div className="mx-auto max-w-3xl py-12 text-center text-sm text-muted-foreground">Loading automation…</div>;
  }
  if (automation.isError || !automation.data) {
    return <div role="alert" className="mx-auto max-w-3xl py-12 text-center text-sm text-destructive">Couldn’t load this automation. <Link className="underline" href="/dashboard/automations">Return to automations</Link></div>;
  }

  const keywordLimit = isPaid ? undefined : 1;
  const hasLegacyUnsupportedOptions = automation.data.matchMode === 'AI_INTENT' || !supportedTriggers.includes(automation.data.triggerType);

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
      {hasLegacyUnsupportedOptions && <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-foreground">This automation contains legacy trigger/matching options that are no longer supported. Saving will update it to standard keyword/trigger handling.</div>}

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
            <select
              id="trigger-type"
              value={triggerType}
              onChange={(event) => {
                const val = event.target.value;
                setTriggerType(val);
                if (val === 'STORY_MENTION') {
                  setMatchMode('ANY');
                  if (!dmText) {
                    setDmText(STORY_MENTION_TEMPLATES[language][0].text);
                  }
                }
              }}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              {triggers.map((trigger) => (
                <option key={trigger.value} value={trigger.value} disabled={!!trigger.paid && !isPaid || trigger.value === 'LIVE_COMMENT' && !liveCommentsEnabled && automation.data.triggerType !== 'LIVE_COMMENT'}>
                  {trigger.label}{trigger.paid && !isPaid ? ' (paid plan)' : trigger.value === 'LIVE_COMMENT' && !liveCommentsEnabled ? ' (not enabled)' : ''}
                </option>
              ))}
            </select>
          </div>
          {triggerType === 'LIVE_COMMENT' && <p role="status" className="text-xs leading-relaxed text-muted-foreground">HeyLaunch attempts one private reply for a matching live comment. Meta may reject it if delivery occurs after the broadcast ends. This trigger requires the live_comments webhook and cannot use follow-ups.</p>}
          {triggerType === 'ANY_POST' && <p role="status" className="text-xs leading-relaxed text-muted-foreground">Meta documents comment events and private replies for Reels. Coverage still depends on your account permissions and active comment webhook subscription.</p>}
          {triggerType === 'STORY_REPLY' && <div role="status" className="rounded-md border border-sky-500/30 bg-sky-500/10 p-3 text-xs leading-relaxed text-foreground"><strong>Instagram Stories note:</strong> Instagram Stories do not have public comment threads on Meta. Story automation activates when a viewer <strong>replies directly to your Story</strong> via DM within its active 24-hour window.</div>}
          {triggerType === 'STORY_MENTION' && (
            <div role="status" className="rounded-md border border-purple-500/30 bg-purple-500/10 p-3 text-xs leading-relaxed text-foreground">
              <strong>Instagram Story Mention note:</strong> Story mentions trigger automatically when someone tags your account (<code>@{automation.data.igAccount?.username ?? 'yourhandle'}</code>) in their Instagram Story. Stories expire after 24 hours and temporary media URLs are not permanently stored in accordance with Meta privacy policies.
            </div>
          )}
          {['POST_COMMENT', 'ANY_POST'].includes(triggerType) && <p className="text-xs leading-relaxed text-muted-foreground">Each comment can trigger one DM. A rule for the exact post takes priority over “Any post”; if multiple rules at the same priority match, the oldest automation handles it.</p>}
          {['DM', 'STORY_REPLY', 'STORY_MENTION'].includes(triggerType) && <p className="text-xs leading-relaxed text-muted-foreground">If multiple active rules match the same message, the oldest automation handles it.</p>}
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
          {matchMode === 'KEYWORDS' && (
            <div className="space-y-4">
              <div>
                <Label>Keywords to trigger response</Label>
                <div className="mt-1.5"><TagInput tags={keywords} onChange={setKeywords} max={keywordLimit} placeholder="Add a keyword (e.g. link, send, price)" /></div>
                <p className="mt-1 text-xs text-muted-foreground">Matches keywords in any language, Unicode script, Telugu, Hindi, or emojis.</p>
              </div>
              <div>
                <Label>Excluded keywords (Negative match)</Label>
                <div className="mt-1.5"><TagInput tags={excludedKeywords} onChange={setExcludedKeywords} placeholder="Add excluded keyword (e.g. spam, hate, bot)" /></div>
                <p className="mt-1 text-xs text-muted-foreground">If any of these words appear in the user’s comment or message, the automation will be skipped.</p>
              </div>
            </div>
          )}

          {/* Language Selection */}
          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Language & Tone</Label>
              </div>
              <span className="text-xs text-muted-foreground">Sets comment replies, DM & follow prompts</span>
            </div>
            <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
              {LANGUAGE_OPTIONS.map((lang) => {
                const active = language === lang.value;
                return (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => handleLanguageChange(lang.value)}
                    className={`flex flex-col text-left rounded-lg border p-3 transition-all ${
                      active
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                        : 'border-border hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground">{lang.label}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <span className="mt-1 text-[10px] text-primary font-medium">{lang.badge}</span>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{lang.description}</p>
                    <div className="mt-2 rounded bg-muted/60 px-2 py-1 text-[10px] text-foreground font-mono truncate">
                      &ldquo;{lang.previewExample}&rdquo;
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {supportsPublicCommentReply && (
          <section className="space-y-3 border-t border-border pt-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Reply under the comment</p>
                <p className="text-xs text-muted-foreground">Rotate variations to prevent Instagram spam limits.</p>
              </div>
              <Toggle checked={replyToComment} onChange={setReplyToComment} label="Reply under the comment" />
            </div>
            {replyToComment && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Variations ({publicReplies.length} of 25)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-7 text-xs"
                      onClick={() => setPublicReplies([...PUBLIC_COMMENT_REPLIES[language]])}
                    >
                      <Sparkles className="mr-1 h-3 w-3 text-primary" /> Select All 12 ({language === 'TENGLISH' ? 'Telugu' : language === 'TELUGU_ENGLISH' ? 'Telugu-Eng' : 'English'})
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 text-xs text-primary"
                      onClick={() => setPublicReplies([...PUBLIC_COMMENT_REPLIES[language].slice(0, 5)])}
                    >
                      Load 5
                    </Button>
                  </div>
                </div>

                {/* Template Pills for Quick Toggle */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    Tap any {language === 'TENGLISH' ? 'Telugu (English letters)' : language === 'TELUGU_ENGLISH' ? 'Telugu-English hybrid' : 'English'} template to toggle:
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                    {PUBLIC_COMMENT_REPLIES[language].map((template, idx) => {
                      const isSelected = publicReplies.includes(template);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (publicReplies.length > 1) {
                                setPublicReplies(publicReplies.filter((r) => r !== template));
                              }
                            } else {
                              setPublicReplies([...publicReplies, template]);
                            }
                          }}
                          className={`rounded-md px-2 py-1 text-[11px] transition-all text-left ${
                            isSelected
                              ? 'bg-primary/15 text-primary border border-primary/30 font-medium'
                              : 'bg-background border border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {template}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  {publicReplies.map((reply, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        aria-label={`Public reply ${index + 1}`}
                        value={reply}
                        maxLength={1000}
                        onChange={(event) =>
                          setPublicReplies((items) =>
                            items.map((item, i) => (i === index ? event.target.value : item))
                          )
                        }
                        placeholder={`Reply variation #${index + 1}`}
                      />
                      {publicReplies.length > 1 && (
                        <button
                          type="button"
                          aria-label="Remove public reply"
                          onClick={() => setPublicReplies((items) => items.filter((_, i) => i !== index))}
                          className="rounded-md px-2 text-muted-foreground hover:bg-muted"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {publicReplies.length < 25 && (
                    <Button variant="ghost" onClick={() => setPublicReplies((items) => [...items, ''])}>
                      <Plus className="h-4 w-4" /> Add reply variation ({publicReplies.length}/25)
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Auto-Like User's Comment (Algorithm Booster) */}
            <div className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
              <div className="flex items-start gap-3">
                <Heart className="mt-0.5 h-4 w-4 text-rose-500 fill-rose-500 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Auto-Like User&apos;s Comment</p>
                    <Badge tone="primary" className="text-[10px]">Algorithm Booster 🔥</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically gives a heart ❤️ to their comment. Notifies the user immediately and boosts post visibility in the Instagram algorithm.
                  </p>
                </div>
              </div>
              <Toggle checked={autoLikeComment} onChange={setAutoLikeComment} label="Auto-like comment" />
            </div>
          </section>
        )}

        <section className="space-y-4 border-t border-border pt-5">
          <h2 className="text-base font-semibold text-foreground">Direct message</h2>
          <div>
            <Label htmlFor="edit-dm">Message</Label>
            <Textarea id="edit-dm" value={dmText} maxLength={1000} onChange={(event) => setDmText(event.target.value)} className="mt-1.5" />
            
            {/* 1-Click Casual Templates */}
            <div className="mt-3 rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  1-Click {triggerType === 'STORY_MENTION' ? 'Story Mention' : language === 'TENGLISH' ? 'Telugu (English letters)' : language === 'TELUGU_ENGLISH' ? 'Telugu-English Hybrid' : 'English'} Templates
                </span>
                <span className="text-[10px] text-muted-foreground">Tap to replace message</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(triggerType === 'STORY_MENTION' ? STORY_MENTION_TEMPLATES[language] : DM_BODY_TEMPLATES[language]).map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setDmText(tpl.text)}
                    className={`rounded-lg border p-2.5 text-left text-xs transition-all ${
                      dmText === tpl.text
                        ? 'border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary/30'
                        : 'border-border bg-background text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold">
                      <span>{tpl.title}</span>
                      {dmText === tpl.text && <Check className="h-3 w-3 text-primary" />}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {tpl.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2"><Label>Buttons</Label><Badge tone="muted">Up to 3</Badge></div>
            <div className="space-y-2">
              {buttons.map((button, index) => <div key={index} className="flex gap-2"><Input aria-label={`Button ${index + 1} label`} value={button.title} maxLength={20} onChange={(event) => setButtons((items) => items.map((item, i) => i === index ? { ...item, title: event.target.value } : item))} placeholder="Label" className="w-1/3" /><Input aria-label={`Button ${index + 1} URL`} value={button.url} onChange={(event) => setButtons((items) => items.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} placeholder="https://…" />{buttons.length > 1 && <button type="button" aria-label="Remove button" onClick={() => setButtons((items) => items.filter((_, i) => i !== index))} className="rounded-md px-2 text-muted-foreground hover:bg-muted"><Trash2 className="h-4 w-4" /></button>}</div>)}
              {buttons.length < 3 && <Button variant="ghost" onClick={() => setButtons((items) => [...items, { title: '', url: '' }])}><Plus className="h-4 w-4" /> Add button</Button>}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium text-foreground">Track link clicks</p><p className="text-xs text-muted-foreground">Count clicks on your message buttons.</p></div><Toggle checked={trackClicks} onChange={setTrackClicks} label="Track link clicks" /></div>

          {/* Conversational Gating: Follow-first & Email Collection */}
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-4">
            <h3 className="text-sm font-semibold text-foreground">Audience Growth & Conversational Gating</h3>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Follow-First Verification</p>
                <p className="text-xs text-muted-foreground">Ask non-followers to follow your profile before unlocking link buttons. Followers receive the link immediately.</p>
              </div>
              <Toggle checked={askToFollow} onChange={setAskToFollow} label="Follow-first verification" />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border/40 pt-3">
              <div>
                <p className="text-sm font-medium text-foreground">First-Time Email Collection</p>
                <p className="text-xs text-muted-foreground">Ask the user for their email before sending the main link. If already in your Contacts, this step is skipped automatically.</p>
              </div>
              <Toggle checked={collectEmail} onChange={setCollectEmail} label="First-time email collection" />
            </div>
          </div>
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
          {automation.data?.status === 'DRAFT' ? (
            <>
              <Button
                variant="secondary"
                loading={save.isPending && targetStatus === 'DRAFT'}
                disabled={save.isPending}
                onClick={() => submit('DRAFT')}
              >
                Save as Draft
              </Button>
              <Button
                variant="accent"
                loading={save.isPending && targetStatus === 'LIVE'}
                disabled={save.isPending}
                onClick={() => submit('LIVE')}
              >
                <Play className="mr-1.5 h-4 w-4" /> Save &amp; Go Live
              </Button>
            </>
          ) : (
            <Button variant="accent" loading={save.isPending} onClick={() => submit()}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          )}
        </div>
      </Card>
      </div>

      <aside className="h-fit lg:sticky lg:top-6">
        <AutomationMessagePreview
          accountUsername={automation.data.igAccount?.username ?? 'yourbrand'}
          triggerType={triggerType}
          publicReply={supportsPublicCommentReply && replyToComment ? publicReplies.find((reply) => reply.trim()) : undefined}
          autoLikeComment={supportsPublicCommentReply && autoLikeComment}
          dmText={dmText}
          buttons={buttons}
          askToFollow={askToFollow}
          collectEmail={collectEmail}
          language={language}
        />
      </aside>
    </div>
  );
}
