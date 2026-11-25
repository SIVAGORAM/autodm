'use client';

import { useState } from 'react';
import { Eye, MessageCircle, UserCheck, Mail, ExternalLink, ShieldCheck } from 'lucide-react';
import { Badge, Card, Input, Label } from './ui/primitives';

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
  publicReply,
  dmText,
  buttons,
  askToFollow = false,
  collectEmail = false,
}: {
  accountUsername?: string;
  publicReply?: string;
  dmText: string;
  buttons: PreviewButton[];
  askToFollow?: boolean;
  collectEmail?: boolean;
}) {
  const [sampleName, setSampleName] = useState('Asha Rao');
  const [sampleUsername, setSampleUsername] = useState('asha_creator');
  const visibleButtons = buttons.filter((button) => button.title.trim());
  const renderedMessage = personalize(dmText, sampleName, sampleUsername);
  const cleanUsername = accountUsername?.replace(/^@/, '') || 'yourbrand';

  return (
    <Card className="overflow-hidden border-border/80 shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Eye className="h-4 w-4 text-primary" aria-hidden /> Live Preview
        </div>
        <Badge tone="muted" className="text-[10px]">Instagram Simulation</Badge>
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

          {/* Public Comment Reply Preview (if configured) */}
          {publicReply?.trim() && (
            <div className="mb-3 rounded-lg border border-border/60 bg-muted/40 p-2.5">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageCircle className="h-2.5 w-2.5 text-primary" /> Public Comment Reply
              </div>
              <p className="text-xs leading-relaxed text-foreground">
                &ldquo;{publicReply}&rdquo;
              </p>
            </div>
          )}

          {/* Follow-First Notice (if enabled) */}
          {askToFollow && (
            <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
              <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <span className="font-semibold">Follow Verification:</span> If commenter doesn&apos;t follow @{cleanUsername}, they are prompted to follow first.
              </div>
            </div>
          )}

          {/* Direct Message Bubble */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Direct Message</span>
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

          {/* Email Collection Prompt (if enabled) */}
          {collectEmail && (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-xs text-sky-700 dark:text-sky-300">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div>
                <span className="font-semibold">Email Capture:</span> Asks for email address with consent before saving to Contacts.
              </div>
            </div>
          )}

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
