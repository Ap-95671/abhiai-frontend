"use client";

/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { PostAttachment } from "@/components/post-attachment";
import { RichPostText } from "@/components/rich-post-text";
import { ReportButton } from "@/components/report-button";
import {
  api,
  ApiError,
  Community,
  MediaAsset,
  PageResponse,
  PostSearchResult,
  UserProfile,
} from "@/lib/api";

import styles from "./communities-panel.module.css";

type CommunityPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewHashtag: (tag: string) => void;
  onViewProfile: (username: string) => void;
};

type CommunityFilter = "discover" | "joined";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function relativeDate(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d` : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

function memberLabel(count: number) {
  return `${new Intl.NumberFormat().format(count)} ${count === 1 ? "member" : "members"}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CommunityIcon({ community, large = false }: { community: Pick<Community, "iconUrl" | "name">; large?: boolean }) {
  return (
    <span className={`${styles.communityIcon} ${large ? styles.communityIconLarge : ""}`} aria-hidden="true">
      {community.iconUrl ? (
        // Community art can come from a user-selected HTTPS host, so it cannot use a fixed Next image allowlist.
        <img alt="" src={community.iconUrl} />
      ) : initials(community.name)}
    </span>
  );
}

export function CommunityPanel({
  accessToken,
  onUnauthorized,
  onViewHashtag,
  onViewProfile,
}: CommunityPanelProps) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityPage, setCommunityPage] = useState<PageResponse<Community> | null>(null);
  const [selected, setSelected] = useState<Community | null>(null);
  const [posts, setPosts] = useState<PostSearchResult[]>([]);
  const [postPage, setPostPage] = useState<PageResponse<PostSearchResult> | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<CommunityFilter>("discover");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCommunity, setIsLoadingCommunity] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const handleError = useCallback((caught: unknown, fallback: string) => {
    if (caught instanceof ApiError && caught.status === 401) {
      onUnauthorized();
      return;
    }
    setError(errorMessage(caught, fallback));
  }, [onUnauthorized]);

  const loadCommunities = useCallback(async (page = 0, append = false) => {
    if (append) setIsLoadingMore(true);
    else setIsLoading(true);
    try {
      const result = await api.getCommunities(accessToken, page);
      setCommunities((current) => append ? [...current, ...result.content] : result.content);
      setCommunityPage(result);
      setSelected((current) => {
        if (!current) return current;
        const refreshed = result.content.find((community) => community.id === current.id);
        return refreshed ? { ...current, ...refreshed } : current;
      });
    } catch (caught) {
      handleError(caught, "Communities could not be loaded.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [accessToken, handleError]);

  const openCommunity = useCallback(async (community: Pick<Community, "slug">, page = 0, append = false) => {
    setIsLoadingCommunity(true);
    setError("");
    try {
      const [detail, feed] = await Promise.all([
        api.getCommunity(accessToken, community.slug),
        api.getCommunityPosts(accessToken, community.slug, page),
      ]);
      setSelected(detail);
      setPosts((current) => append ? [...current, ...feed.content] : feed.content);
      setPostPage(feed);
      setCommunities((current) => current.map((item) => item.id === detail.id ? detail : item));
    } catch (caught) {
      handleError(caught, "This community could not be opened.");
    } finally {
      setIsLoadingCommunity(false);
    }
  }, [accessToken, handleError]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.getCommunities(accessToken),
      api.getCurrentProfile(accessToken),
    ]).then(([result, currentProfile]) => {
      if (!active) return;
      setCommunities(result.content);
      setCommunityPage(result);
      setProfile(currentProfile);
    }).catch((caught: unknown) => {
      if (active) handleError(caught, "Communities could not be loaded.");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [accessToken, handleError]);

  const visibleCommunities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return communities.filter((community) => {
      if (filter === "joined" && !community.joined) return false;
      if (!query) return true;
      return community.name.toLowerCase().includes(query)
        || community.slug.toLowerCase().includes(query)
        || community.description.toLowerCase().includes(query);
    });
  }, [communities, filter, search]);

  function updateName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function createCommunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSlug = slugify(slug || name);
    if (!name.trim() || !normalizedSlug || isBusy) return;
    setIsBusy(true);
    setError("");
    try {
      const created = await api.createCommunity(accessToken, {
        name: name.trim(),
        slug: normalizedSlug,
        description: description.trim(),
        iconUrl: iconUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        privacy: "PUBLIC",
      });
      setCommunities((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setName("");
      setSlug("");
      setSlugEdited(false);
      setDescription("");
      setIconUrl("");
      setBannerUrl("");
      setShowCreate(false);
      await openCommunity(created);
    } catch (caught) {
      handleError(caught, "The community could not be created.");
    } finally {
      setIsBusy(false);
    }
  }

  async function toggleMembership() {
    if (!selected || selected.currentUserRole === "OWNER" || isBusy) return;
    if (selected.joined && !window.confirm(`Leave ${selected.name}?`)) return;
    setIsBusy(true);
    setError("");
    try {
      const updated = selected.joined
        ? await api.leaveCommunity(accessToken, selected.slug)
        : await api.joinCommunity(accessToken, selected.slug);
      setSelected(updated);
      setCommunities((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (caught) {
      handleError(caught, selected.joined ? "The community could not be left." : "The community could not be joined.");
    } finally {
      setIsBusy(false);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim() || !selected.joined || isBusy) return;
    setIsBusy(true);
    setError("");
    const uploaded: MediaAsset[] = [];
    try {
      for (const file of attachments) uploaded.push(await api.uploadAttachment(accessToken, file));
      const post = await api.createCommunityPost(
        accessToken,
        selected.slug,
        draft.trim(),
        "PUBLIC",
        uploaded.map((asset) => asset.id),
      );
      setPosts((current) => [post, ...current]);
      setPostPage((current) => current ? { ...current, totalElements: current.totalElements + 1 } : current);
      setDraft("");
      setAttachments([]);
    } catch (caught) {
      await Promise.allSettled(uploaded.map((asset) => api.deleteMedia(accessToken, asset.id)));
      handleError(caught, "Your community post could not be published.");
    } finally {
      setIsBusy(false);
    }
  }

  function chooseAttachments(files: FileList | null) {
    const chosen = Array.from(files ?? []);
    if (attachments.length + chosen.length > 4) {
      setError("A community post can contain at most 4 attachments.");
      return;
    }
    setAttachments((current) => [...current, ...chosen]);
  }

  return (
    <section className="workspace-view" aria-labelledby="communities-title">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Find your people</p>
          <h1 id="communities-title">Communities</h1>
          <p>Join focused spaces, exchange ideas, and build knowledge together.</p>
        </div>
        <button className="primary-button" onClick={() => setShowCreate((current) => !current)} type="button">
          {showCreate ? "Close" : "+ Create community"}
        </button>
      </header>

      <div className={`workspace-content ${styles.workspace}`}>
        {error && <p className="inline-error" role="alert">{error}</p>}

        {showCreate && (
          <form className={styles.createPanel} onSubmit={createCommunity}>
            <div className={styles.createIntro}>
              <span className={styles.spark}>✦</span>
              <div><p className="eyebrow">New space</p><h2>Start a community</h2><p>Choose a clear identity so the right people can find it.</p></div>
            </div>
            <label>Name<input autoFocus maxLength={100} onChange={(event) => updateName(event.target.value)} placeholder="AI Builders India" required value={name} /></label>
            <label>Slug<div className={styles.slugField}><span>c/</span><input maxLength={60} onChange={(event) => { setSlugEdited(true); setSlug(slugify(event.target.value)); }} placeholder="ai-builders-india" required value={slug} /></div></label>
            <label className={styles.wideField}>Description<textarea maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="What should people discuss and build here?" required rows={3} value={description} /></label>
            <label>Icon URL <small>optional</small><input maxLength={2048} onChange={(event) => setIconUrl(event.target.value)} placeholder="https://…" type="url" value={iconUrl} /></label>
            <label>Banner URL <small>optional</small><input maxLength={2048} onChange={(event) => setBannerUrl(event.target.value)} placeholder="https://…" type="url" value={bannerUrl} /></label>
            <div className={styles.createFooter}><span>◎ Public community</span><button className="primary-button" disabled={isBusy || !name.trim() || !slug} type="submit">{isBusy ? "Creating…" : "Create community"}</button></div>
          </form>
        )}

        <div className={styles.communityLayout}>
          <aside className={styles.directory} aria-label="Community directory">
            <div className={styles.directoryHeading}><div><span>Directory</span><strong>{communityPage?.totalElements ?? communities.length} communities</strong></div><button aria-label="Refresh communities" disabled={isLoading} onClick={() => void loadCommunities()} type="button">↻</button></div>
            <div className={styles.filters} role="group" aria-label="Community filters">
              <button className={filter === "discover" ? styles.active : ""} onClick={() => setFilter("discover")} type="button">Discover</button>
              <button className={filter === "joined" ? styles.active : ""} onClick={() => setFilter("joined")} type="button">Joined</button>
            </div>
            <label className={styles.searchField}><span aria-hidden="true">⌕</span><span className="sr-only">Search communities</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search communities" type="search" value={search} /></label>

            <div className={styles.communityList}>
              {isLoading && <p className={styles.listMessage}>Loading communities…</p>}
              {!isLoading && visibleCommunities.length === 0 && <p className={styles.listMessage}>{filter === "joined" ? "You have not joined a community yet." : "No communities match your search."}</p>}
              {visibleCommunities.map((community) => (
                <button className={selected?.id === community.id ? styles.selectedCard : ""} key={community.id} onClick={() => void openCommunity(community)} type="button">
                  <CommunityIcon community={community} />
                  <span className={styles.cardCopy}><strong>{community.name}</strong><small>c/{community.slug}</small><span>{memberLabel(community.memberCount)}</span></span>
                  {community.joined && <span className={styles.joinedDot} title="Joined">✓</span>}
                </button>
              ))}
            </div>
            {communityPage && !communityPage.last && <button className={styles.moreCommunities} disabled={isLoadingMore} onClick={() => void loadCommunities(communityPage.page + 1, true)} type="button">{isLoadingMore ? "Loading…" : "Show more"}</button>}
          </aside>

          <main className={styles.communityMain}>
            {!selected ? (
              <div className={styles.welcomeState}>
                <div className={styles.orbit} aria-hidden="true"><span>✦</span><i /><i /></div>
                <p className="eyebrow">Shared interests, stronger ideas</p>
                <h2>There is a community for what you are building.</h2>
                <p>Browse the directory, join a space, and contribute to its conversation.</p>
                <button className="primary-button" onClick={() => setShowCreate(true)} type="button">Create your first community</button>
              </div>
            ) : (
              <>
                <section className={styles.communityHero}>
                  <div className={styles.banner}>
                    {selected.bannerUrl ? (
                      // Community art can come from a user-selected HTTPS host, so it cannot use a fixed Next image allowlist.
                      <img alt="" src={selected.bannerUrl} />
                    ) : <span aria-hidden="true" />}
                  </div>
                  <div className={styles.heroBody}>
                    <CommunityIcon community={selected} large />
                    <div className={styles.heroCopy}><h2>{selected.name}</h2><p>c/{selected.slug} · {memberLabel(selected.memberCount)}</p></div>
                    {selected.currentUserRole === "OWNER" ? <button className={styles.ownerButton} disabled type="button">Owner</button> : <div className={styles.heroActions}><button className={selected.joined ? styles.leaveButton : styles.joinButton} disabled={isBusy} onClick={() => void toggleMembership()} type="button">{isBusy ? "Working…" : selected.joined ? "Leave" : "Join community"}</button><ReportButton accessToken={accessToken} className={styles.reportButton} onUnauthorized={onUnauthorized} targetId={selected.id} targetType="COMMUNITY"/></div>}
                  </div>
                  <div className={styles.aboutRow}><p>{selected.description}</p><div><span>Owned by</span><button onClick={() => onViewProfile(selected.owner.username)} type="button">@{selected.owner.username}</button><small>Created {new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(new Date(selected.createdAt))}</small></div></div>
                </section>

                {selected.joined ? (
                  <form className={styles.composer} onSubmit={publish}>
                    <span className={styles.profileAvatar} aria-hidden="true">{profile ? initials(profile.displayName) : "A"}</span>
                    <textarea maxLength={1000} onChange={(event) => setDraft(event.target.value)} placeholder={`Share something with ${selected.name}…`} rows={3} value={draft} />
                    {attachments.length > 0 && <div className={styles.attachments}>{attachments.map((file, index) => <span key={`${file.name}-${file.lastModified}`}><b>{file.name}</b><button aria-label={`Remove ${file.name}`} onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">×</button></span>)}</div>}
                    <div className={styles.composerFooter}><label>＋ Media<input accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,application/pdf" disabled={attachments.length >= 4 || isBusy} multiple onChange={(event) => { chooseAttachments(event.target.files); event.target.value = ""; }} type="file" /></label><span>{draft.length}/1000</span><button disabled={!draft.trim() || isBusy} type="submit">{isBusy ? "Publishing…" : "Publish"}</button></div>
                  </form>
                ) : <div className={styles.joinPrompt}><span aria-hidden="true">◇</span><div><strong>Join to take part</strong><p>You can read this public feed now. Join the community when you are ready to publish.</p></div></div>}

                <section className={styles.feed} aria-labelledby="community-feed-title">
                  <div className={styles.feedHeading}><div><p className="eyebrow">Community feed</p><h3 id="community-feed-title">Latest discussions</h3></div><span>{postPage?.totalElements ?? posts.length} posts</span></div>
                  {isLoadingCommunity && posts.length === 0 && <p className={styles.feedMessage}>Loading the conversation…</p>}
                  {!isLoadingCommunity && posts.length === 0 && <div className={styles.emptyFeed}><span aria-hidden="true">✎</span><h3>Start the first discussion</h3><p>{selected.joined ? "Share a question, an insight, or something you are building." : "Join this community to start its first discussion."}</p></div>}
                  {posts.map((post) => (
                    <article className={styles.post} key={post.id}>
                      <header><button onClick={() => onViewProfile(post.author.username)} type="button"><span className={styles.postAvatar}>{initials(post.author.displayName)}</span></button><button className={styles.author} onClick={() => onViewProfile(post.author.username)} type="button"><strong>{post.author.displayName}</strong><span>@{post.author.username} · {relativeDate(post.createdAt)}</span></button>{post.community && <span className={styles.communityPill}>c/{post.community.slug}</span>}<span className={styles.publicPill}>Public</span></header>
                      <RichPostText className={styles.postContent} onViewHashtag={onViewHashtag} onViewProfile={onViewProfile} text={post.textContent} />
                      {post.media?.length > 0 && <div className="post-media-grid">{post.media.map((asset) => <PostAttachment accessToken={accessToken} asset={asset} key={asset.id} />)}</div>}
                      <footer><span>♡ {post.likeCount}</span><span>↩ {post.replyCount}</span><span>↻ {post.repostCount}</span><time>{relativeDate(post.createdAt)}</time></footer>
                    </article>
                  ))}
                  {postPage && !postPage.last && <button className={styles.morePosts} disabled={isLoadingCommunity} onClick={() => void openCommunity(selected, postPage.page + 1, true)} type="button">{isLoadingCommunity ? "Loading…" : "Load more discussions"}</button>}
                </section>
              </>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
