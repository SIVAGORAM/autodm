'use client';

import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { instagramApi } from '../services/api';
import { Button, Label } from './ui/primitives';

type InstagramMedia = { id: string; media_type: string; media_product_type?: string; caption?: string; timestamp?: string };

function supportsCommentAutomation(post: InstagramMedia): boolean {
  const mediaType = post.media_type?.toUpperCase();
  return mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM' || mediaType === 'VIDEO';
}

export function InstagramPostSelector({ accountId, value, onChange, onEligibilityChange }: {
  accountId: string;
  value: string;
  onChange: (value: string) => void;
  onEligibilityChange?: (supported: boolean) => void;
}) {
  const media = useInfiniteQuery({
    queryKey: ['ig-media', accountId],
    queryFn: async ({ pageParam }) => (await instagramApi.media(accountId, pageParam)).data.data as { media: InstagramMedia[]; nextCursor: string | null },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: false,
  });
  const posts = media.data?.pages.flatMap((page) => page.media) ?? [];
  const serverMessage = (media.error as { response?: { data?: { message?: unknown } } } | null)
    ?.response?.data?.message;
  const mediaErrorMessage = typeof serverMessage === 'string'
    ? serverMessage
    : 'Instagram posts could not be loaded. Please retry.';
  useEffect(() => {
    const selected = posts.find((post) => post.id === value);
    onEligibilityChange?.(!selected || supportsCommentAutomation(selected));
  }, [media.data, onEligibilityChange, value]);

  return (
    <div>
      <Label htmlFor="instagram-post-id">Post to watch <span className="text-destructive">(required)</span></Label>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={!accountId || media.isFetching} onClick={() => media.refetch()}>
          {media.isFetching ? 'Loading posts…' : media.isError ? 'Try loading posts again' : media.data ? 'Refresh recent posts' : 'Load recent posts'}
        </Button>
      {media.data && <span className="text-xs text-muted-foreground">Showing {posts.length} recent media items. Reel comment delivery has not been verified end to end in HeyLaunch.</span>}
      </div>
      {media.isError && <p role="alert" className="mt-2 text-sm text-destructive">{mediaErrorMessage}</p>}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Choose media published by your connected professional account. Instagram may identify a Reel as a video in this list. Meta’s current Webhooks and Private Replies guides document Reel comment events and replies. HeyLaunch has not yet verified a real Reel event and reply on an authorized staging account, so delivery remains unverified. For account-wide coverage, choose “Comment on any post.” Permissions and webhook delivery still apply.
      </p>
      {media.data && (
        <select
          id="instagram-post-id"
          aria-label="Choose an Instagram post"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Choose a post</option>
          {value && !posts.some((post) => post.id === value) && <option value={value}>Saved post ID (not in loaded posts)</option>}
          {posts.map((post) => {
            const caption = post.caption?.replace(/\s+/g, ' ').trim();
            const supported = supportsCommentAutomation(post);
            const mediaType = post.media_product_type?.toUpperCase() === 'REELS'
              ? 'Reel'
              : post.media_type?.toUpperCase() === 'VIDEO' ? 'Video / Reel' : post.media_type;
            const label = caption ? `${mediaType}: ${caption.slice(0, 72)}${caption.length > 72 ? '…' : ''}` : mediaType;
            const date = post.timestamp ? ` · ${new Date(post.timestamp).toLocaleDateString()}` : '';
            return <option key={post.id} value={post.id} disabled={!supported}>{label}{date}</option>;
          })}
        </select>
      )}
      {media.hasNextPage && <Button type="button" variant="secondary" className="mt-2" disabled={media.isFetchingNextPage} onClick={() => media.fetchNextPage()}>
        {media.isFetchingNextPage ? 'Loading older posts…' : 'Load older posts'}
      </Button>}
    </div>
  );
}
