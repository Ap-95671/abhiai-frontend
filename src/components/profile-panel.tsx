/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { api, ApiError, PageResponse, PostSearchResult, ProfileReply, ProfileUpdate, UserProfile } from "@/lib/api";
import { AuthenticatedImage } from "@/components/authenticated-image";
import { PostAttachment } from "@/components/post-attachment";
import { ReportButton } from "@/components/report-button";

type ProfilePanelProps = { accessToken: string; username?: string; onUnauthorized: () => void };
type ProfileTab = "posts" | "replies" | "media" | "likes";

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
function compact(value: number) { return new Intl.NumberFormat(undefined, { notation: "compact" }).format(value); }

export function ProfilePanel({ accessToken, username, onUnauthorized }: ProfilePanelProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [following, setFollowing] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [muteId, setMuteId] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProfileUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [postPage, setPostPage] = useState<PageResponse<PostSearchResult> | null>(null);
  const [replyPage, setReplyPage] = useState<PageResponse<ProfileReply> | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);

  const loadProfile = useCallback(async () => {
    setIsLoading(true); setError("");
    try {
      const current = await api.getCurrentProfile(accessToken);
      const viewed = !username || username.toLowerCase() === current.username.toLowerCase() ? current : await api.getProfile(accessToken, username);
      setCurrentUserId(current.id); setProfile(viewed);
      if (viewed.id !== current.id) void api.recordProfileView(accessToken, viewed.username).catch(() => undefined);
      setForm({ username: viewed.username, displayName: viewed.displayName, bio: viewed.bio ?? "", profilePicture: viewed.profilePicture ?? "", coverPicture: viewed.coverPicture ?? "", profileMediaId: viewed.profileMediaId, coverMediaId: viewed.coverMediaId, location: viewed.location ?? "", website: viewed.website ?? "", dateOfBirth: viewed.dateOfBirth, showLikesOnProfile: viewed.showLikesOnProfile });
      if (viewed.id !== current.id) {
        const [followStatus, blockStatus] = await Promise.all([
          api.getFollowStatus(accessToken, viewed.id), api.getBlockStatus(accessToken, viewed.id),
        ]);
        setFollowing(followStatus.following); setBlockedByMe(blockStatus.blockedByMe);
        const mutes = await api.getMutes(accessToken); setMuteId(mutes.find((item) => item.type === "USER" && item.userId === viewed.id)?.id ?? "");
      }
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) return onUnauthorized();
      setError(loadError instanceof Error ? loadError.message : "The profile could not be loaded.");
    } finally { setIsLoading(false); }
  }, [accessToken, onUnauthorized, username]);

  useEffect(() => { queueMicrotask(() => void loadProfile()); }, [loadProfile]);
  useEffect(()=>()=>{if(profilePreview)URL.revokeObjectURL(profilePreview);},[profilePreview]);
  useEffect(()=>()=>{if(coverPreview)URL.revokeObjectURL(coverPreview);},[coverPreview]);

  const loadContent = useCallback(async (tab: ProfileTab, page = 0, append = false) => {
    if (!profile) return;
    setIsLoadingContent(true); setError("");
    try {
      if (tab === "replies") {
        const next = await api.getProfileReplies(accessToken, profile.username, page);
        setReplyPage((current) => append && current ? { ...next, content: [...current.content, ...next.content] } : next);
        setPostPage(null);
      } else {
        const next = tab === "posts" ? await api.getProfilePosts(accessToken, profile.username, page)
          : tab === "media" ? await api.getProfileMedia(accessToken, profile.username, page)
          : await api.getProfileLikes(accessToken, profile.username, page);
        setPostPage((current) => append && current ? { ...next, content: [...current.content, ...next.content] } : next);
        setReplyPage(null);
      }
    } catch (contentError) {
      if (contentError instanceof ApiError && contentError.status === 401) return onUnauthorized();
      setError(contentError instanceof Error ? contentError.message : "Profile content could not be loaded.");
      setPostPage(null); setReplyPage(null);
    } finally { setIsLoadingContent(false); }
  }, [accessToken, onUnauthorized, profile]);

  useEffect(() => { if (profile) queueMicrotask(() => void loadContent(activeTab)); }, [activeTab, loadContent, profile]);

  async function toggleFollow() {
    if (!profile) return; setIsSaving(true); setError("");
    try { await api.setFollowing(accessToken, profile.id, !following); setFollowing(!following); setProfile((item) => item ? { ...item, followerCount: item.followerCount + (following ? -1 : 1) } : item); }
    catch (followError) { if (followError instanceof ApiError && followError.status === 401) return onUnauthorized(); setError(followError instanceof Error ? followError.message : "Follow status could not be updated."); }
    finally { setIsSaving(false); }
  }

  async function toggleBlock() {
    if (!profile) return;
    if (!blockedByMe && !window.confirm(`Block @${profile.username}? You will unfollow each other and neither account can interact.`)) return;
    setIsSaving(true); setError("");
    try {
      const status = await api.setBlocked(accessToken, profile.id, !blockedByMe);
      setBlockedByMe(status.blockedByMe); setFollowing(false);
    } catch (blockError) {
      if (blockError instanceof ApiError && blockError.status === 401) return onUnauthorized();
      setError(blockError instanceof Error ? blockError.message : "Block status could not be updated.");
    } finally { setIsSaving(false); }
  }

  async function toggleMute() { if (!profile) return; setIsSaving(true); setError(""); try { if (muteId) { await api.removeMute(accessToken, muteId); setMuteId(""); } else setMuteId((await api.addUserMute(accessToken, profile.id)).id); } catch (e) { setError(e instanceof Error ? e.message : "Mute status could not be updated."); } finally { setIsSaving(false); } }
  async function togglePrivacy() { if (!profile) return; setIsSaving(true); try { setProfile(await api.updateAccountPrivacy(accessToken, profile.accountPrivacy === "PUBLIC" ? "PRIVATE" : "PUBLIC")); } catch (e) { setError(e instanceof Error ? e.message : "Privacy could not be updated."); } finally { setIsSaving(false); } }

  async function togglePin(post: PostSearchResult) {
    if (!postPage) return;
    setIsSaving(true); setError("");
    try {
      if (post.pinned) await api.unpinPost(accessToken, post.id);
      else await api.pinPost(accessToken, post.id);
      const refreshed = await api.getProfilePosts(accessToken, profile!.username, 0);
      setPostPage(refreshed);
    } catch (pinError) {
      if (pinError instanceof ApiError && pinError.status === 401) return onUnauthorized();
      setError(pinError instanceof Error ? pinError.message : "Pinned post could not be updated.");
    } finally { setIsSaving(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form) return; setIsSaving(true); setError("");
    try {
      const profileAsset=profileFile?await api.uploadImage(accessToken,profileFile):null;
      const coverAsset=coverFile?await api.uploadImage(accessToken,coverFile):null;
      const updated = await api.updateProfile(accessToken, { ...form, profileMediaId: profileAsset?.id ?? form.profileMediaId, coverMediaId: coverAsset?.id ?? form.coverMediaId });
      setProfile(updated); setForm((current)=>current?{...current,profileMediaId:updated.profileMediaId,coverMediaId:updated.coverMediaId}:current); setProfileFile(null);setCoverFile(null);setEditing(false);
    }
    catch (saveError) { if (saveError instanceof ApiError && saveError.status === 401) return onUnauthorized(); setError(saveError instanceof Error ? saveError.message : "Your profile could not be saved."); }
    finally { setIsSaving(false); }
  }

  if (isLoading) return <section className="workspace-view"><div className="profile-loading">Loading profile…</div></section>;
  if (!profile) return <section className="workspace-view"><div className="workspace-content">{error && <p className="inline-error">{error}</p>}</div></section>;
  const ownProfile = profile.id === currentUserId;

  return <section className="workspace-view" aria-labelledby="profile-title">
    <div className="profile-cover">{profile.coverMediaId ? <AuthenticatedImage accessToken={accessToken} alt={`${profile.displayName} cover`} className="profile-cover-image" mediaId={profile.coverMediaId}/> : profile.coverPicture ? <img alt={`${profile.displayName} cover`} className="profile-cover-image" src={profile.coverPicture}/> : null}</div>
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-large-avatar">{profile.profileMediaId ? <AuthenticatedImage accessToken={accessToken} alt={profile.displayName} className="profile-avatar-image" mediaId={profile.profileMediaId}/> : profile.profilePicture ? <img alt={profile.displayName} className="profile-avatar-image" src={profile.profilePicture}/> : initials(profile.displayName)}</div>
        {ownProfile ? <div className="profile-actions"><button className="secondary-button" onClick={() => setEditing(!editing)} type="button">{editing ? "Cancel" : "Edit profile"}</button><button className="secondary-button" disabled={isSaving} onClick={() => void togglePrivacy()} type="button">{profile.accountPrivacy === "PRIVATE" ? "Make public" : "Make private"}</button></div> : <div className="profile-actions"><button className={following ? "secondary-button" : "primary-button"} disabled={isSaving || blockedByMe} onClick={() => void toggleFollow()} type="button">{following ? "Following" : "Follow"}</button><button className="secondary-button" disabled={isSaving} onClick={() => void toggleMute()} type="button">{muteId ? "Unmute" : "Mute"}</button><button className="secondary-button" disabled={isSaving} onClick={() => void toggleBlock()} type="button">{blockedByMe ? "Unblock" : "Block"}</button><ReportButton accessToken={accessToken} className="secondary-button" onUnauthorized={onUnauthorized} targetId={profile.id} targetType="USER"/></div>}
      </div>
      <h1 id="profile-title">{profile.displayName}{profile.verifiedStatus !== "NONE" && <span className="verified-badge">✓</span>}</h1>
      <p className="profile-username">@{profile.username}</p>
      <p className="profile-bio">{profile.bio || "Exploring and building with AbhiAI."}</p>
      <div className="profile-details">{profile.location && <span>⌖ {profile.location}</span>}{profile.website && <a href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`} rel="noreferrer" target="_blank">↗ {profile.website}</a>}<span>Joined {new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(profile.createdAt))}</span></div>
      <div className="profile-stats"><div><strong>{compact(profile.postCount)}</strong><span>Posts</span></div><div><strong>{compact(profile.followerCount)}</strong><span>Followers</span></div><div><strong>{compact(profile.followingCount)}</strong><span>Following</span></div></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {blockedByMe && <p className="profile-empty">You blocked this account. Their posts, messages, mentions, and notifications are hidden.</p>}
      {editing && form && <form className="profile-form" onSubmit={save}>
        <label>Display name<input maxLength={100} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required value={form.displayName}/></label>
        <label>Username<input maxLength={30} minLength={3} onChange={(event) => setForm({ ...form, username: event.target.value })} required value={form.username}/></label>
        <label className="full-field">Bio<textarea maxLength={160} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={3} value={form.bio}/></label>
        <label>Location<input maxLength={100} onChange={(event) => setForm({ ...form, location: event.target.value })} value={form.location}/></label>
        <label>Website<input maxLength={2048} onChange={(event) => setForm({ ...form, website: event.target.value })} value={form.website}/></label>
        <label>Profile photo<input accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event)=>{const file=event.target.files?.[0]??null;setProfileFile(file);setProfilePreview(file?URL.createObjectURL(file):"");}} type="file"/></label>
        <label>Cover photo<input accept="image/jpeg,image/png,image/gif,image/webp" onChange={(event)=>{const file=event.target.files?.[0]??null;setCoverFile(file);setCoverPreview(file?URL.createObjectURL(file):"");}} type="file"/></label>
        <label className="profile-privacy-toggle full-field"><input checked={form.showLikesOnProfile} onChange={(event) => setForm({ ...form, showLikesOnProfile: event.target.checked })} type="checkbox"/>Show my liked posts on my profile</label>
        {(profilePreview||coverPreview)&&<div className="profile-media-previews full-field">{profilePreview&&<img alt="New profile preview" className="avatar-preview" src={profilePreview}/>} {coverPreview&&<img alt="New cover preview" className="cover-preview" src={coverPreview}/>}</div>}
        <div className="profile-form-actions full-field"><button className="primary-button" disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Save changes"}</button></div>
      </form>}
      {!blockedByMe && <nav aria-label="Profile content" className="profile-tabs">
        {(["posts", "replies", "media", "likes"] as ProfileTab[]).map((tab) => <button aria-current={activeTab === tab ? "page" : undefined} className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)} type="button">{tab[0].toUpperCase() + tab.slice(1)}</button>)}
      </nav>}
      {!blockedByMe && <div aria-live="polite" className="profile-content">
        {isLoadingContent && !postPage && !replyPage ? <div aria-label={`Loading ${activeTab}`} className="feed-loading" role="status"><span/><span/></div>
          : activeTab === "replies" ? <>
            {replyPage?.content.length ? <div className="profile-content-list">{replyPage.content.map((reply) => <article className="profile-reply-card" key={reply.id}><p className="profile-reply-context">Replied to @{reply.post.author.username}</p><p>{reply.textContent}</p><small>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(reply.createdAt))}</small><div className="profile-parent-post"><strong>{reply.post.author.displayName}</strong><p>{reply.post.textContent}</p></div></article>)}</div> : !isLoadingContent && <p className="profile-empty">No visible replies yet.</p>}
            {replyPage && !replyPage.last && <button className="load-more-button" disabled={isLoadingContent} onClick={() => void loadContent(activeTab, replyPage.page + 1, true)} type="button">{isLoadingContent ? "Loading…" : "Load more"}</button>}
          </> : <>
            {postPage?.content.length ? <div className="profile-content-list">{postPage.content.map((post) => <article className={`social-post${post.pinned ? " pinned-profile-post" : ""}`} key={post.id}>{post.pinned && <p className="pinned-label">◆ Pinned post</p>}<div className="social-post-head"><span className="profile-avatar small-avatar">{initials(post.author.displayName)}</span><div className="author-button"><strong>{post.author.displayName}</strong><span>@{post.author.username} · {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(post.createdAt))}</span></div><span className="visibility-pill">{post.visibility.toLowerCase()}</span>{ownProfile && activeTab === "posts" && <button className="profile-pin-button" disabled={isSaving} onClick={() => void togglePin(post)} type="button">{post.pinned ? "Unpin" : "Pin"}</button>}</div><p className="social-post-content">{post.textContent}</p>{post.media.length > 0 && <div className={`post-media-grid count-${post.media.length}`}>{post.media.map((asset) => <PostAttachment accessToken={accessToken} asset={asset} key={asset.id}/>)}</div>}<div className="post-metrics"><span>{compact(post.likeCount)} likes</span><span>{compact(post.replyCount)} replies</span><span>{compact(post.repostCount)} reposts</span></div></article>)}</div> : !isLoadingContent && <p className="profile-empty">No visible {activeTab} yet.</p>}
            {postPage && !postPage.last && <button className="load-more-button" disabled={isLoadingContent} onClick={() => void loadContent(activeTab, postPage.page + 1, true)} type="button">{isLoadingContent ? "Loading…" : "Load more"}</button>}
          </>}
      </div>}
    </div>
  </section>;
}
