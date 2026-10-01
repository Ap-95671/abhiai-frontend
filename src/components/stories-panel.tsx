/* eslint-disable @next/next/no-img-element -- blob-backed local previews cannot use next/image */
"use client";
import { usePageContext } from "./ai-character/abhiai-context";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { AuthenticatedImage } from "@/components/authenticated-image";
import { EmptyState } from "@/components/ui/empty-state";
import { AppIcon } from "@/components/ui/app-icon";
import { UserAvatar } from "@/components/ui/user-avatar";
import { api, ApiError, Story, UserProfile } from "@/lib/api";

type StoriesPanelProps = {
  presentation?: "page" | "feed";
  accessToken: string;
  onUnauthorized: () => void;
  onViewProfile: (username: string) => void;
};

const REACTIONS = ["❤️", "🔥", "😂", "👏", "😮"];
const BACKGROUNDS = ["#263B80", "#6D28D9", "#BE185D", "#047857", "#B45309", "#1F2937"];

function timeLeft(expiresAt: string) {
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes}m left`;
  return `${Math.ceil(minutes / 60)}h left`;
}

export function StoriesPanel({ accessToken, onUnauthorized, onViewProfile, presentation = "page" }: StoriesPanelProps) {
  const [creatingInFeed, setCreatingInFeed] = useState(false);
  const embedded = presentation === "feed";
  const [stories, setStories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [storyMode, setStoryMode] = useState<"text" | "image" | "video">("image");
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");

  const selected = selectedIndex === null ? null : stories[selectedIndex] ?? null;
  usePageContext(selected ? { pageType: "story", entityId: selected.id, title: `Story by @${selected.author.username}` } : embedded ? null : { pageType: "other", title: "Stories" }, selected ? 20 : 5);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [storyPage, currentProfile] = await Promise.all([
        api.getStories(accessToken),
        api.getCurrentProfile(accessToken),
      ]);
      setStories(storyPage.content);
      setProfile(currentProfile);
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError(loadError instanceof Error ? loadError.message : "Stories could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, onUnauthorized]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  useEffect(() => {
    if (!mediaFile) { queueMicrotask(() => setMediaPreviewUrl("")); return; }
    const url = URL.createObjectURL(mediaFile);
    queueMicrotask(() => setMediaPreviewUrl(url));
    return () => URL.revokeObjectURL(url);
  }, [mediaFile]);

  useEffect(() => {
    if (selectedIndex === null) return;
    const navigate = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowLeft") setSelectedIndex((index) => index === null ? null : Math.max(0, index - 1));
      if (event.key === "ArrowRight") setSelectedIndex((index) => index === null ? null : Math.min(stories.length - 1, index + 1));
    };
    document.addEventListener("keydown", navigate);
    return () => document.removeEventListener("keydown", navigate);
  }, [selectedIndex, stories.length]);

  useEffect(() => {
    if (!selected || selected.viewedByCurrentUser) return;
    let active = true;
    void api.recordStoryView(accessToken, selected.id).then((result) => {
      if (!active) return;
      setStories((current) => current.map((story) => story.id === selected.id
        ? { ...story, viewedByCurrentUser: true, viewCount: result.viewCount }
        : story));
    }).catch((viewError: unknown) => {
      if (viewError instanceof ApiError && viewError.status === 401) onUnauthorized();
    });
    return () => { active = false; };
  }, [accessToken, onUnauthorized, selected]);

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((storyMode === "text" ? !draft.trim() : !mediaFile) || isPublishing) return;
    if (!reviewing) { setReviewing(true); return; }
    setIsPublishing(true);
    setError("");
    let uploadedId = "";
    try {
      if (mediaFile) uploadedId = (await api.uploadAttachment(accessToken, mediaFile)).id;
      const story = await api.createStory(accessToken, draft, uploadedId || null, background);
      setStories((current) => [story, ...current]);
      setDraft("");
      setMediaFile(null);
      setStoryMode("image"); setReviewing(false);
    } catch (publishError) {
      if (uploadedId) await api.deleteMedia(accessToken, uploadedId).catch(() => undefined);
      if (publishError instanceof ApiError && publishError.status === 401) return onUnauthorized();
      setError(publishError instanceof Error ? publishError.message : "Your story could not be published.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function react(reaction: string) {
    if (!selected) return;
    const nextReaction = selected.currentUserReaction === reaction ? null : reaction;
    try {
      const result = await api.setStoryReaction(accessToken, selected.id, nextReaction);
      setStories((current) => current.map((story) => story.id === selected.id
        ? { ...story, currentUserReaction: result.reaction, reactionCount: result.reactionCount }
        : story));
    } catch (reactionError) {
      if (reactionError instanceof ApiError && reactionError.status === 401) return onUnauthorized();
      setError(reactionError instanceof Error ? reactionError.message : "Reaction could not be saved.");
    }
  }

  async function removeSelectedStory() {
    if (!selected || !window.confirm("Delete this story now?")) return;
    try {
      await api.deleteStory(accessToken, selected.id);
      setStories((current) => current.filter((story) => story.id !== selected.id));
      setSelectedIndex(null);
    } catch (deleteError) {
      if (deleteError instanceof ApiError && deleteError.status === 401) return onUnauthorized();
      setError(deleteError instanceof Error ? deleteError.message : "Story could not be deleted.");
    }
  }

  return (
    <section className={embedded ? "feed-stories" : "workspace-view"} aria-label={embedded ? "Stories" : undefined} aria-labelledby={embedded ? undefined : "stories-title"}>
      {embedded ? <div className="feed-story-strip" aria-label="Active stories">
        <button className="feed-story-item feed-create-story" aria-label="Your story" aria-expanded={creatingInFeed} onClick={() => setCreatingInFeed(current => !current)} type="button">
          <span className="feed-story-ring"><UserAvatar accessToken={accessToken} className="feed-story-avatar" displayName={profile?.displayName ?? "You"} profileMediaId={profile?.profileMediaId} profilePicture={profile?.profilePicture}/><span className="feed-story-plus"><AppIcon name="plus" /></span></span>
          <span>Your story</span>
        </button>
        {stories.map((story, index) => <button aria-label={`View ${story.author.displayName}'s story${story.viewedByCurrentUser ? "" : " (unseen)"}`} className={`feed-story-item${story.viewedByCurrentUser ? " viewed" : ""}`} key={story.id} onClick={() => setSelectedIndex(index)} type="button">
          <span className="feed-story-ring"><UserAvatar accessToken={accessToken} className="feed-story-avatar" displayName={story.author.displayName} profileMediaId={story.author.profileMediaId} profilePicture={story.author.profilePicture}/></span>
          <span>{story.author.displayName}</span>
        </button>)}
      </div> : <header className="workspace-header">
        <div><p className="eyebrow">24-hour moments</p><h1 id="stories-title">Stories</h1><p>Share something lightweight with the AbhiAI community.</p></div>
      </header>}
      <div className={embedded ? "feed-story-content" : "workspace-content stories-workspace"}>
        {(!embedded || creatingInFeed) && <form className={`story-composer${reviewing ? " story-reviewing" : ""}`} onSubmit={publish}>
          <h2 className="story-composer-title">{reviewing ? "Review your story" : "Create a story"}</h2>
          <div className="story-composer-preview" style={{ background }}>
            <span className="story-preview-label">Preview</span>
            {mediaPreviewUrl && storyMode === "image" ? <img alt="Story preview" src={mediaPreviewUrl}/> : mediaPreviewUrl && storyMode === "video" ? <video aria-label="Story video preview" controls muted playsInline src={mediaPreviewUrl}/> : <p>{draft || (storyMode === "text" ? "Start with a few words" : "Choose a photo or video")}</p>}
          </div>
          <div className="story-composer-fields">
            <div aria-label="Story type" className="story-type-picker" role="group">
              {(["image", "video", "text"] as const).map((mode) => <button aria-pressed={storyMode === mode} key={mode} onClick={() => { setStoryMode(mode); setMediaFile(null); setReviewing(false); }} type="button">{mode}</button>)}
            </div>
            <textarea maxLength={500} onChange={(event) => { setDraft(event.target.value); setReviewing(false); }} placeholder="Add text or a caption…" rows={3} value={draft} />
            {storyMode === "text" && <div className="story-color-picker" aria-label="Story background color">
              {BACKGROUNDS.map((color) => <button aria-label={`Use ${color}`} className={background === color ? "selected" : ""} key={color} onClick={() => { setBackground(color); setReviewing(false); }} style={{ background: color }} type="button" />)}
            </div>}
            <div className="story-composer-actions">
              {storyMode !== "text" && <label className="image-picker">＋ Choose {storyMode}<input accept={storyMode === "image" ? "image/jpeg,image/png,image/gif,image/webp" : "video/mp4,video/webm"} disabled={isPublishing} onChange={(event) => { setMediaFile(event.target.files?.[0] ?? null); setReviewing(false); event.target.value = ""; }} type="file" /></label>}
              {mediaFile && <button className="story-remove-media" onClick={() => { setMediaFile(null); setReviewing(false); }} type="button">Remove {mediaFile.name}</button>}
              <span>{draft.length}/500</span>
              {reviewing && <button type="button" onClick={() => setReviewing(false)}>Back to editing</button>}
              <button className="story-publish" disabled={(storyMode === "text" ? !draft.trim() : !mediaFile) || isPublishing} type="submit">{isPublishing ? "Sharing…" : reviewing ? "Share story" : "Review story"}</button>
            </div>
          </div>
        </form>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        {isLoading && <div className="feed-loading">Loading stories…</div>}
        {!embedded && !isLoading && stories.length === 0 && !error && <EmptyState variant="stories" compact description="Create a text, image, or video story. It will automatically expire after 24 hours." icon="story" title="No active stories yet" />}
        {!embedded && stories.length > 0 && <div className="story-rail" aria-label="Active stories">{stories.map((story, index) => (
          <button className={story.viewedByCurrentUser ? "story-card viewed" : "story-card"} key={story.id} onClick={() => setSelectedIndex(index)} style={{ background: story.backgroundColor }} type="button">
            <StoryPreview accessToken={accessToken} story={story} />
            <span className="story-card-shade" />
            <span className="story-card-author"><UserAvatar accessToken={accessToken} className="profile-avatar small-avatar" displayName={story.author.displayName} profileMediaId={story.author.profileMediaId} profilePicture={story.author.profilePicture}/><strong>{story.author.displayName}</strong><small>{timeLeft(story.expiresAt)}</small></span>
          </button>
        ))}</div>}
      </div>
      {selected && selectedIndex !== null && (
        <div className="story-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.author.displayName}'s story`} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedIndex(null); }}>
          <div className="story-viewer" style={{ background: selected.backgroundColor }}>
            <div className="story-progress"><span /></div>
            <header><button className="story-viewer-author" onClick={() => onViewProfile(selected.author.username)} type="button"><UserAvatar accessToken={accessToken} className="profile-avatar small-avatar" displayName={selected.author.displayName} profileMediaId={selected.author.profileMediaId} profilePicture={selected.author.profilePicture}/><span><strong>{selected.author.displayName}</strong><small>@{selected.author.username} · {timeLeft(selected.expiresAt)}</small></span></button>{profile?.id === selected.author.id && <button className="story-delete" onClick={() => void removeSelectedStory()} type="button">Delete</button>}<button className="story-close" onClick={() => setSelectedIndex(null)} type="button" aria-label="Close story">×</button></header>
            <StoryViewerMedia accessToken={accessToken} story={selected} />
            {selected.textContent && <p className="story-viewer-caption">{selected.textContent}</p>}
            <button aria-label="Previous story" className="story-previous" disabled={selectedIndex === 0} onClick={() => setSelectedIndex((index) => index === null ? null : Math.max(0, index - 1))} type="button">‹</button>
            <button aria-label="Next story" className="story-next" disabled={selectedIndex === stories.length - 1} onClick={() => setSelectedIndex((index) => index === null ? null : Math.min(stories.length - 1, index + 1))} type="button">›</button>
            <footer><span>{selected.viewCount} views · {selected.reactionCount} reactions</span><div>{REACTIONS.map((reaction) => <button className={selected.currentUserReaction === reaction ? "selected" : ""} key={reaction} onClick={() => void react(reaction)} type="button">{reaction}</button>)}</div></footer>
          </div>
        </div>
      )}
    </section>
  );
}

function StoryPreview({ accessToken, story }: { accessToken: string; story: Story }) {
  if (story.type === "IMAGE" && story.media) return <AuthenticatedImage accessToken={accessToken} alt="Story preview" className="story-preview-image" mediaId={story.media.id} thumbnail />;
  if (story.type === "VIDEO") return <span className="story-video-preview">▶</span>;
  return <span className="story-text-preview">{story.textContent}</span>;
}

function StoryViewerMedia({ accessToken, story }: { accessToken: string; story: Story }) {
  const [videoUrl, setVideoUrl] = useState("");
  const videoMediaId = useMemo(() => story.type === "VIDEO" ? story.media?.id : undefined, [story]);
  useEffect(() => {
    if (!videoMediaId) { queueMicrotask(() => setVideoUrl("")); return; }
    let active = true;
    let url = "";
    void api.getMediaBlob(accessToken, videoMediaId).then((blob) => {
      if (!active) return;
      url = URL.createObjectURL(blob);
      setVideoUrl(url);
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [accessToken, videoMediaId]);
  if (story.type === "IMAGE" && story.media) return <AuthenticatedImage accessToken={accessToken} alt={story.textContent ?? "Story image"} className="story-viewer-image" mediaId={story.media.id} />;
  if (story.type === "VIDEO") return videoUrl ? <video autoPlay className="story-viewer-video" controls playsInline src={videoUrl} /> : <div className="story-viewer-loading">Loading video…</div>;
  return <div className="story-viewer-text">{story.textContent}</div>;
}
