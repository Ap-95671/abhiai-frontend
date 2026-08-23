"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { AuthenticatedImage } from "@/components/authenticated-image";
import { api, ApiError, Story, UserProfile } from "@/lib/api";

type StoriesPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewProfile: (username: string) => void;
};

const REACTIONS = ["❤️", "🔥", "😂", "👏", "😮"];
const BACKGROUNDS = ["#263B80", "#6D28D9", "#BE185D", "#047857", "#B45309", "#1F2937"];

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function timeLeft(expiresAt: string) {
  const minutes = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes}m left`;
  return `${Math.ceil(minutes / 60)}h left`;
}

export function StoriesPanel({ accessToken, onUnauthorized, onViewProfile }: StoriesPanelProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");

  const selected = selectedIndex === null ? null : stories[selectedIndex] ?? null;

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
    if ((!draft.trim() && !mediaFile) || isPublishing) return;
    setIsPublishing(true);
    setError("");
    let uploadedId = "";
    try {
      if (mediaFile) uploadedId = (await api.uploadAttachment(accessToken, mediaFile)).id;
      const story = await api.createStory(accessToken, draft, uploadedId || null, background);
      setStories((current) => [story, ...current]);
      setDraft("");
      setMediaFile(null);
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
    <section className="workspace-view" aria-labelledby="stories-title">
      <header className="workspace-header">
        <div><p className="eyebrow">24-hour moments</p><h1 id="stories-title">Stories</h1><p>Share something lightweight with the AbhiAI community.</p></div>
      </header>
      <div className="workspace-content stories-workspace">
        <form className="story-composer" onSubmit={publish}>
          <div className="story-composer-preview" style={{ background }}>
            {mediaFile ? <span>{mediaFile.type.startsWith("video/") ? "▶ Video ready" : "▧ Image ready"}</span> : <p>{draft || "Your story preview"}</p>}
          </div>
          <div className="story-composer-fields">
            <textarea maxLength={500} onChange={(event) => setDraft(event.target.value)} placeholder="Add text or a caption…" rows={3} value={draft} />
            <div className="story-color-picker" aria-label="Story background color">
              {BACKGROUNDS.map((color) => <button aria-label={`Use ${color}`} className={background === color ? "selected" : ""} key={color} onClick={() => setBackground(color)} style={{ background: color }} type="button" />)}
            </div>
            <div className="story-composer-actions">
              <label className="image-picker">＋ Image or video<input accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm" disabled={isPublishing} onChange={(event) => { setMediaFile(event.target.files?.[0] ?? null); event.target.value = ""; }} type="file" /></label>
              {mediaFile && <button className="story-remove-media" onClick={() => setMediaFile(null)} type="button">Remove {mediaFile.name}</button>}
              <span>{draft.length}/500</span>
              <button className="story-publish" disabled={(!draft.trim() && !mediaFile) || isPublishing} type="submit">{isPublishing ? "Sharing…" : "Share story"}</button>
            </div>
          </div>
        </form>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {isLoading && <div className="feed-loading">Loading stories…</div>}
        {!isLoading && stories.length === 0 && !error && <div className="feature-empty-state compact"><span className="empty-state-icon">◌</span><h2>No active stories yet</h2><p>Create a text, image, or video story. It will automatically expire after 24 hours.</p></div>}
        {stories.length > 0 && <div className="story-rail" aria-label="Active stories">{stories.map((story, index) => (
          <button className={story.viewedByCurrentUser ? "story-card viewed" : "story-card"} key={story.id} onClick={() => setSelectedIndex(index)} style={{ background: story.backgroundColor }} type="button">
            <StoryPreview accessToken={accessToken} story={story} />
            <span className="story-card-shade" />
            <span className="story-card-author"><span className="profile-avatar small-avatar">{initials(story.author.displayName)}</span><strong>{story.author.displayName}</strong><small>{timeLeft(story.expiresAt)}</small></span>
          </button>
        ))}</div>}
      </div>
      {selected && selectedIndex !== null && (
        <div className="story-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`${selected.author.displayName}'s story`}>
          <div className="story-viewer" style={{ background: selected.backgroundColor }}>
            <div className="story-progress"><span /></div>
            <header><button className="story-viewer-author" onClick={() => onViewProfile(selected.author.username)} type="button"><span className="profile-avatar small-avatar">{initials(selected.author.displayName)}</span><span><strong>{selected.author.displayName}</strong><small>@{selected.author.username} · {timeLeft(selected.expiresAt)}</small></span></button>{profile?.id === selected.author.id && <button className="story-delete" onClick={() => void removeSelectedStory()} type="button">Delete</button>}<button className="story-close" onClick={() => setSelectedIndex(null)} type="button" aria-label="Close story">×</button></header>
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
