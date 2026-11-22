'use client';

import { useState } from 'react';
import { Eye, MessageCircle } from 'lucide-react';
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
}: {
  accountUsername?: string;
  publicReply?: string;
  dmText: string;
  buttons: PreviewButton[];
}) {
  const [sampleName, setSampleName] = useState('Asha Rao');
  const [sampleUsername, setSampleUsername] = useState('asha');
  const visibleButtons = buttons.filter((button) => button.title.trim());
  const renderedMessage = personalize(dmText, sampleName, sampleUsername);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Eye className="h-4 w-4 text-primary" aria-hidden /> Message preview
        </div>
        <Badge tone="muted">Preview only</Badge>
      </div>

      <div className="space-y-4 p-4">
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Sample recipient: {sampleName || 'there'} (@{sampleUsername.replace(/^@/, '') || 'there'})
          </summary>
          <div className="mt-3 grid gap-3">
            <div>
              <Label htmlFor="preview-sample-name" className="text-xs">Sample name</Label>
              <Input id="preview-sample-name" value={sampleName} maxLength={80} onChange={(event) => setSampleName(event.target.value)} className="mt-1 h-9" />
            </div>
            <div>
              <Label htmlFor="preview-sample-username" className="text-xs">Sample username</Label>
              <Input id="preview-sample-username" value={sampleUsername} maxLength={30} onChange={(event) => setSampleUsername(event.target.value.replace(/^@/, ''))} className="mt-1 h-9" />
            </div>
          </div>
        </details>

        <div className="mx-auto max-w-[280px] rounded-2xl border border-border bg-background p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden>
              {(accountUsername?.replace(/^@/, '') || 'Y').slice(0, 1).toUpperCase()}
            </div>
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">@{accountUsername?.replace(/^@/, '') || 'yourbrand'}</span>
          </div>

          {publicReply?.trim() && (
            <div className="mb-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Public reply</p>
              <p className="rounded-xl bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">{publicReply}</p>
            </div>
          )}

          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Direct message</p>
          <div className="rounded-2xl rounded-bl-sm bg-primary px-3 py-2.5 text-sm leading-relaxed text-primary-foreground">
            {renderedMessage || <span className="opacity-70">Your message will appear here.</span>}
            {visibleButtons.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {visibleButtons.map((button, index) => (
                  <div key={`${button.title}-${index}`} className="rounded-lg border border-white/20 bg-background/15 px-2.5 py-1.5 text-center text-xs font-semibold">
                    {button.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <MessageCircle className="h-3 w-3" aria-hidden /> Example conversation
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          This is a preview only. Personalization uses the recipient details available when Instagram delivers the trigger.
        </p>
      </div>
    </Card>
  );
}
