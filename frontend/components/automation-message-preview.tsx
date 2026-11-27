'use client';

import { useState } from 'react';
import { Eye, MessageCircle, UserCheck, Mail, ExternalLink, ShieldCheck, Languages, Heart } from 'lucide-react';
import { Badge, Card, Input, Label } from './ui/primitives';
import {
  AutomationLanguage,
  getRandomFollowPrompt,
  getRandomEmailPrompt,
  getFollowButtons,
} from '../lib/automation-templates';

type PreviewButton = { title: string; url?: string };

function personalize(text: string, name: string, username: string) {
  const displayName = name.trim();
  const handle = username.trim().replace(/^@/, '');
  const firstName = displayName ? displayName.split(/\s+/)[0] : '';
  const values: Record<string, string> = {
    name: displayName || handle || 'there',
    first_name: firstName || handle || 'there',
    firstname: firstName || handle || 'there',
    username: handle || 'there',
  };
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (token, key: string) => {
    const normalized = key.toLowerCase();
    return Object.prototype.hasOwnProperty.call(values, normalized) ? values[normalized] : token;
  });
}

export function AutomationMessagePreview({
  accountUsername,
  triggerType,
  publicReply,
  autoLikeComment = false,
  dmText,
  buttons,
  askToFollow = false,
  collectEmail = false,
  language = 'ENGLISH',
}: {
  accountUsername?: string;
  triggerType?: string;
  publicReply?: string;
  autoLikeComment?: boolean;
  dmText: string;
  buttons: PreviewButton[];
  askToFollow?: boolean;
  collectEmail?: boolean;
  language?: AutomationLanguage;
}) {
  const [sampleName, setSampleName] = useState('Siva');
  const [sampleUsername, setSampleUsername] = useState('siva_creator');
  const visibleButtons = buttons.filter((button) => button.title.trim());
  const renderedMessage = personalize(dmText, sampleName, sampleUsername);
  const cleanUsername = accountUsername?.replace(/^@/, '') || 'yourbrand';

  const followPrompt = getRandomFollowPrompt(language, cleanUsername, sampleName);
  const followButtons = getFollowButtons(language, cleanUsername);
  const emailPrompt = getRandomEmailPrompt(language, sampleName);

  const langBadgeText =
    language === 'HINGLISH'
      ? 'Hinglish (Hindi in English)'
      : language === 'TENGLISH'
      ? 'Telugu (English Letters)'
      : language === 'TELUGU_ENGLISH'
      ? 'Telugu-English Hybrid'
      : 'English';

  return (
    <Card className="overflow-hidden border-border/80 shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Eye className="h-4 w-4 text-primary" aria-hidden /> Live Preview
        </div>
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Languages className="h-3 w-3" /> {langBadgeText}
          </span>
          <Badge tone="muted" className="text-[10px]">Instagram Simulation</Badge>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
            Sample recipient: <span className="text-foreground">{sampleName}</span> (@{sampleUsername})
          </summary>
          <div className="mt-3 grid gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-2.5">
            <div>
              <Label htmlFor="preview-sample-name" className="text-[11px]">Sample Name</Label>
              <Input
                id="preview-sample-name"
                value={sampleName}
                maxLength={80}
                onChange={(e) => setSampleName(e.target.value)}
                className="mt-1 h-8 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="preview-sample-username" className="text-[11px]">Sample Username</Label>
              <Input
                id="preview-sample-username"
                value={sampleUsername}
                maxLength={30}
                onChange={(e) => setSampleUsername(e.target.value.replace(/^@/, ''))}
                className="mt-1 h-8 text-xs"
              />
            </div>
          </div>
        </details>

        {/* Realistic Mobile DM Card Container */}
        <div className="mx-auto max-w-[290px] rounded-2xl border border-border bg-background p-3.5 shadow-sm">
          {/* Instagram Account Header */}
          <div className="mb-3 flex items-center gap-2.5 border-b border-border/60 pb-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-xs font-bold text-white shadow-xs">
              {cleanUsername.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-xs font-semibold text-foreground">@{cleanUsername}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Active now" />
              </div>
              <p className="text-[10px] text-muted-foreground">Instagram Direct</p>
            </div>
          </div>

          {/* Story Mention Event Simulation */}
          {triggerType === 'STORY_MENTION' && (
            <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-primary/20 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 p-2.5">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-500 p-0.5 shadow-xs">
                <div className="flex h-full w-full items-center justify-center rounded-[6px] bg-background text-[11px] font-bold text-foreground">
                  📷
                </div>
              </div>
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-foreground truncate">
                  @{sampleUsername} mentioned you
                </p>
                <p className="text-[10px] text-muted-foreground">In their Instagram story</p>
              </div>
            </div>
          )}

          {/* Comment & Auto-Like / Public Reply Simulation */}
          {(autoLikeComment || publicReply?.trim()) && (
            <div className="mb-3 space-y-2 rounded-lg border border-border/60 bg-muted/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground">
                    {sampleName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 text-xs">
                    <span className="font-semibold text-foreground">@{sampleUsername}</span>{' '}
                    <span className="text-muted-foreground">LINK please! 🔥</span>
                  </div>
                </div>
                {autoLikeComment && (
                  <span className="shrink-0 flex items-center text-rose-500" title="Liked by creator">
                    <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500 animate-pulse" />
                  </span>
                )}
              </div>

              {autoLikeComment && (
                <div className="flex items-center gap-1 pl-7 text-[10px] font-medium text-rose-600 dark:text-rose-400">
                  <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                  <span>Liked by @{cleanUsername}</span>
                </div>
              )}

              {publicReply?.trim() && (
                <div className="border-t border-border/40 pl-7 pt-1.5">
                  <div className="mb-0.5 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <MessageCircle className="h-2.5 w-2.5 text-primary" /> Creator Reply
                  </div>
                  <p className="text-xs leading-relaxed text-foreground">
                    &ldquo;{publicReply}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Follow-First Gate Step (if enabled) */}
          {askToFollow && (
            <div className="mb-3 space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                <UserCheck className="h-3.5 w-3.5" /> Follow-First Verification Prompt
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                &ldquo;{followPrompt}&rdquo;
              </p>
              <div className="mt-2 space-y-1">
                {followButtons.map((btn, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-center gap-1 rounded-md border border-amber-500/30 bg-background/80 px-2 py-1 text-center text-[10px] font-semibold text-foreground shadow-2xs"
                  >
                    <span>{btn.title}</span>
                    {btn.url && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email Collection Step (if enabled) */}
          {collectEmail && (
            <div className="mb-3 space-y-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-foreground">
              <div className="flex items-center gap-1.5 font-semibold text-sky-700 dark:text-sky-300">
                <Mail className="h-3.5 w-3.5" /> Email Capture Prompt
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                &ldquo;{emailPrompt}&rdquo;
              </p>
            </div>
          )}

          {/* Direct Message Bubble */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Main Direct Message</span>
              <span className="text-[9px] lowercase opacity-75">just now</span>
            </div>
            <div className="rounded-2xl rounded-bl-xs bg-primary px-3.5 py-2.5 text-xs leading-relaxed text-primary-foreground shadow-xs">
              {renderedMessage ? (
                <p className="whitespace-pre-line">{renderedMessage}</p>
              ) : (
                <span className="italic opacity-70">Your automated message will appear here…</span>
              )}

              {/* Action Buttons */}
              {visibleButtons.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {visibleButtons.map((button, index) => (
                    <div
                      key={`${button.title}-${index}`}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-3 py-1.5 text-center text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
                    >
                      <span>{button.title}</span>
                      <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" /> Meta API Compliant
            </span>
            <span>24h Window</span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Previews dynamic fields like <code className="rounded bg-muted px-1 text-[10px] font-mono">{"{{name}}"}</code> using recipient profile details provided by Meta during execution.
        </p>
      </div>
    </Card>
  );
}
