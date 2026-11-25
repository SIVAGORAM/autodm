'use client';

import { useEffect, useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { instagramApi } from '../services/api';
import { Button, Label, Input } from './ui/primitives';
import { Film, Image as ImageIcon, Layers, Search, ExternalLink, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';

export type InstagramMedia = {
  id: string;
  media_type: string;
  media_product_type?: string;
  caption?: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
};

function supportsCommentAutomation(post: InstagramMedia): boolean {
  const mediaType = post.media_type?.toUpperCase();
  return mediaType === 'IMAGE' || mediaType === 'CAROUSEL_ALBUM' || mediaType === 'VIDEO';
}

function getMediaCategory(post: InstagramMedia): 'REEL' | 'CAROUSEL' | 'POST' {
  if (post.media_product_type?.toUpperCase() === 'REELS' || post.media_type?.toUpperCase() === 'VIDEO') {
    return 'REEL';
  }
  if (post.media_type?.toUpperCase() === 'CAROUSEL_ALBUM') {
    return 'CAROUSEL';
  }
  return 'POST';
}

export function InstagramPostSelector({
  accountId,
  value,
  onChange,
  onEligibilityChange,
}: {
  accountId: string;
  value: string;
  onChange: (value: string) => void;
  onEligibilityChange?: (supported: boolean) => void;
}) {
  const [activeTab, setActiveTab] = useState<'ALL' | 'POSTS' | 'REELS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const mediaQuery = useInfiniteQuery({
    queryKey: ['ig-media', accountId],
    queryFn: async ({ pageParam }) =>
      (await instagramApi.media(accountId, pageParam)).data.data as {
        media: InstagramMedia[];
        nextCursor: string | null;
      },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!accountId,
  });

  const allPosts = useMemo(
    () => mediaQuery.data?.pages.flatMap((page) => page.media) ?? [],
    [mediaQuery.data],
  );

  const selectedPost = useMemo(
    () => allPosts.find((post) => post.id === value),
    [allPosts, value],
  );

  useEffect(() => {
    onEligibilityChange?.(!selectedPost || supportsCommentAutomation(selectedPost));
  }, [selectedPost, onEligibilityChange]);

  const filteredPosts = useMemo(() => {
    return allPosts.filter((post) => {
      const category = getMediaCategory(post);
      if (activeTab === 'POSTS' && category === 'REEL') return false;
      if (activeTab === 'REELS' && category !== 'REEL') return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const caption = (post.caption || '').toLowerCase();
        if (!caption.includes(query) && !post.id.includes(query)) return false;
      }
      return true;
    });
  }, [allPosts, activeTab, searchQuery]);

  const serverMessage = (mediaQuery.error as { response?: { data?: { message?: unknown } } } | null)
    ?.response?.data?.message;
  const mediaErrorMessage =
    typeof serverMessage === 'string'
      ? serverMessage
      : 'Instagram media could not be loaded. Please ensure your account permissions are active and retry.';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="instagram-media-search">
          Select Post or Reel <span className="text-destructive">*</span>
        </Label>
        {mediaQuery.data && (
          <span className="text-xs text-muted-foreground font-medium">
            {allPosts.length} items loaded
          </span>
        )}
      </div>

      {/* Account not ready */}
      {!accountId && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Select a connected Instagram account above to load your posts and Reels.
        </div>
      )}

      {/* Error Banner */}
      {mediaQuery.isError && (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{mediaErrorMessage}</span>
          <Button
            type="button"
            variant="ghost"
            className="ml-auto h-7 text-xs"
            onClick={() => mediaQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {accountId && (
        <div className="space-y-3">
          {/* Controls Bar: Tabs, Search, and Refresh */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'ALL'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Media
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('POSTS')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'POSTS'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ImageIcon className="h-3 w-3" />
                Posts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('REELS')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeTab === 'REELS'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Film className="h-3 w-3" />
                Reels
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  id="instagram-media-search"
                  placeholder="Search caption…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={mediaQuery.isFetching}
                onClick={() => mediaQuery.refetch()}
                className="h-8 px-2 text-xs"
                title="Refresh media from Instagram"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${mediaQuery.isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Loading Skeleton */}
          {mediaQuery.isLoading && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="animate-pulse rounded-lg border border-border bg-muted/40 p-2">
                  <div className="aspect-square rounded-md bg-muted" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-muted" />
                  <div className="mt-1 h-2 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          )}

          {/* Media Grid */}
          {!mediaQuery.isLoading && filteredPosts.length > 0 && (
            <div className="grid max-h-[380px] grid-cols-2 gap-3 overflow-y-auto rounded-lg border border-border bg-muted/10 p-2 sm:grid-cols-3 md:grid-cols-4">
              {filteredPosts.map((post) => {
                const isSelected = post.id === value;
                const supported = supportsCommentAutomation(post);
                const category = getMediaCategory(post);
                const imageUrl = post.thumbnail_url || post.media_url;
                const formattedDate = post.timestamp
                  ? new Date(post.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';

                return (
                  <div
                    key={post.id}
                    onClick={() => supported && onChange(post.id)}
                    className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border transition-all ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card hover:border-muted-foreground/40 hover:shadow-xs'
                    } ${!supported ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {/* Media Thumbnail Container */}
                    <div className="relative aspect-square w-full overflow-hidden bg-muted">
                      {imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={imageUrl}
                          alt={post.caption?.slice(0, 50) || 'Instagram post'}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            // If direct image fails to load, fallback to styled icon
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : null}

                      {/* Fallback Icon when image not available */}
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        {category === 'REEL' ? (
                          <Film className="h-8 w-8 opacity-40" />
                        ) : category === 'CAROUSEL' ? (
                          <Layers className="h-8 w-8 opacity-40" />
                        ) : (
                          <ImageIcon className="h-8 w-8 opacity-40" />
                        )}
                      </div>

                      {/* Media Category Badge */}
                      <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                        {category === 'REEL' ? (
                          <>
                            <Film className="h-2.5 w-2.5" /> Reel
                          </>
                        ) : category === 'CAROUSEL' ? (
                          <>
                            <Layers className="h-2.5 w-2.5" /> Carousel
                          </>
                        ) : (
                          <>
                            <ImageIcon className="h-2.5 w-2.5" /> Post
                          </>
                        )}
                      </div>

                      {/* Selected Checkmark Badge */}
                      {isSelected && (
                        <div className="absolute right-1.5 top-1.5 rounded-full bg-primary p-0.5 text-primary-foreground shadow-sm">
                          <CheckCircle2 className="h-4 w-4 fill-primary text-background" />
                        </div>
                      )}
                    </div>

                    {/* Info Card */}
                    <div className="flex flex-1 flex-col justify-between p-2 text-xs">
                      <p className="line-clamp-2 leading-tight text-foreground" title={post.caption}>
                        {post.caption?.trim() || <span className="italic text-muted-foreground">No caption</span>}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{formattedDate}</span>
                        {post.permalink && (
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center text-muted-foreground hover:text-primary"
                            title="View on Instagram"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty Search Results */}
          {!mediaQuery.isLoading && filteredPosts.length === 0 && allPosts.length > 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No media matching &ldquo;{searchQuery}&rdquo; in {activeTab.toLowerCase()}.
            </div>
          )}

          {/* Pagination */}
          {mediaQuery.hasNextPage && (
            <div className="text-center pt-1">
              <Button
                type="button"
                variant="secondary"
                disabled={mediaQuery.isFetchingNextPage}
                onClick={() => mediaQuery.fetchNextPage()}
                className="h-8 text-xs font-medium"
              >
                {mediaQuery.isFetchingNextPage ? 'Loading older posts…' : 'Load more posts & reels'}
              </Button>
            </div>
          )}

          {/* Selected Post Confirmation Card */}
          {selectedPost && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {(selectedPost.thumbnail_url || selectedPost.media_url) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={selectedPost.thumbnail_url || selectedPost.media_url}
                    alt="Selected media"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">Selected:</span>
                  <span className="font-medium text-foreground">
                    {getMediaCategory(selectedPost) === 'REEL' ? '🎬 Instagram Reel' : '📸 Instagram Post'}
                  </span>
                </div>
                <p className="truncate text-muted-foreground mt-0.5">
                  {selectedPost.caption?.trim() || `ID: ${selectedPost.id}`}
                </p>
              </div>
              {selectedPost.permalink && (
                <a
                  href={selectedPost.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  View post ↗
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
