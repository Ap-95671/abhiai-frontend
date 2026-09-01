"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  api,
  ApiError,
  GroupConversation,
  GroupInvitation,
  GroupMember,
  GroupMessage,
  GroupRole,
  PageResponse,
} from "@/lib/api";
import { ReportButton } from "@/components/report-button";
import { EmptyState } from "@/components/ui/empty-state";

type GroupMessagesPanelProps = {
  accessToken: string;
  onUnauthorized: () => void;
  onViewProfile: (username: string) => void;
};

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function GroupAvatar({ group, small = false }: { group: Pick<GroupConversation, "name" | "imageUrl">; small?: boolean }) {
  return <span className={`group-avatar${small ? " small-avatar" : ""}`} aria-hidden="true">
    {/* Group images can come from any user-selected HTTPS host, so this intentionally avoids a fixed Next image allowlist. */}
    {group.imageUrl ? <img alt="" src={group.imageUrl} /> : initials(group.name)} {/* eslint-disable-line @next/next/no-img-element */}
  </span>;
}

export function GroupMessagesPanel({
  accessToken,
  onUnauthorized,
  onViewProfile,
}: GroupMessagesPanelProps) {
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [selected, setSelected] = useState<GroupConversation | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messagePage, setMessagePage] = useState<PageResponse<GroupMessage> | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [inviteUsername, setInviteUsername] = useState("");
  const [draft, setDraft] = useState("");
  const [editingGroup, setEditingGroup] = useState(false);
  const [editName, setEditName] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState("");

  const chronologicalMessages = useMemo(() => [...messages].reverse(), [messages]);
  const canManage = selected?.currentUserRole === "OWNER" || selected?.currentUserRole === "ADMIN";

  const handleError = useCallback((loadError: unknown, fallback: string) => {
    if (loadError instanceof ApiError && loadError.status === 401) {
      onUnauthorized();
      return;
    }
    setError(errorText(loadError, fallback));
  }, [onUnauthorized]);

  const refreshGroups = useCallback(async () => {
    try {
      const items = await api.getGroups(accessToken);
      setGroups(items);
      setSelected((current) => current
        ? items.find((item) => item.id === current.id) ?? null
        : current);
    } catch (loadError) {
      handleError(loadError, "Groups could not be loaded.");
    }
  }, [accessToken, handleError]);

  const refreshInvitations = useCallback(async () => {
    try {
      setInvitations(await api.getGroupInvitations(accessToken));
    } catch (loadError) {
      handleError(loadError, "Group invitations could not be loaded.");
    }
  }, [accessToken, handleError]);

  const loadHistory = useCallback(async (
    group: GroupConversation,
    nextPage = 0,
    append = false,
  ) => {
    setIsLoadingHistory(true);
    setError("");
    try {
      const [detail, result] = await Promise.all([
        api.getGroup(accessToken, group.id),
        api.getGroupMessages(accessToken, group.id, nextPage),
      ]);
      setSelected(detail);
      setMessages((current) => append ? [...current, ...result.content] : result.content);
      setMessagePage(result);
    } catch (loadError) {
      handleError(loadError, "Group message history could not be loaded.");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [accessToken, handleError]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      api.getGroups(accessToken),
      api.getGroupInvitations(accessToken),
      api.getCurrentProfile(accessToken),
    ]).then(([groupItems, invitationItems, profile]) => {
      if (!active) return;
      setGroups(groupItems);
      setInvitations(invitationItems);
      setCurrentUserId(profile.id);
    }).catch((loadError: unknown) => {
      if (active) handleError(loadError, "Groups could not be loaded.");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [accessToken, handleError]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    setIsBusy(true);
    setError("");
    try {
      const group = await api.createGroup(accessToken, newName.trim(), newImageUrl);
      setNewName("");
      setNewImageUrl("");
      await refreshGroups();
      await loadHistory(group);
    } catch (createError) {
      handleError(createError, "The group could not be created.");
    } finally {
      setIsBusy(false);
    }
  }

  async function respondToInvitation(invitation: GroupInvitation, accept: boolean) {
    setIsBusy(true);
    setError("");
    try {
      if (accept) {
        const group = await api.acceptGroupInvitation(accessToken, invitation.id);
        await Promise.all([refreshGroups(), refreshInvitations()]);
        await loadHistory(group);
      } else {
        await api.declineGroupInvitation(accessToken, invitation.id);
        await refreshInvitations();
      }
    } catch (responseError) {
      handleError(responseError, "The invitation could not be updated.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !editName.trim()) return;
    setIsBusy(true);
    setError("");
    try {
      const group = await api.updateGroup(
        accessToken,
        selected.id,
        editName.trim(),
        editImageUrl.trim(),
      );
      setSelected(group);
      setEditingGroup(false);
      await refreshGroups();
    } catch (updateError) {
      handleError(updateError, "Group details could not be saved.");
    } finally {
      setIsBusy(false);
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !inviteUsername.trim()) return;
    setIsBusy(true);
    setError("");
    try {
      await api.inviteGroupMember(accessToken, selected.id, inviteUsername.trim());
      setInviteUsername("");
    } catch (inviteError) {
      handleError(inviteError, "The member could not be invited.");
    } finally {
      setIsBusy(false);
    }
  }

  async function changeRole(member: GroupMember, role: GroupRole) {
    if (!selected) return;
    setIsBusy(true);
    setError("");
    try {
      const group = await api.updateGroupMemberRole(
        accessToken,
        selected.id,
        member.user.id,
        role,
      );
      setSelected(group);
      await refreshGroups();
    } catch (roleError) {
      handleError(roleError, "The member role could not be changed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function removeMember(member: GroupMember) {
    if (!selected) return;
    setIsBusy(true);
    setError("");
    try {
      await api.removeGroupMember(accessToken, selected.id, member.user.id);
      const group = await api.getGroup(accessToken, selected.id);
      setSelected(group);
      await refreshGroups();
    } catch (removeError) {
      handleError(removeError, "The member could not be removed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function leaveGroup() {
    if (!selected) return;
    setIsBusy(true);
    setError("");
    try {
      await api.leaveGroup(accessToken, selected.id);
      setSelected(null);
      setMessages([]);
      await refreshGroups();
    } catch (leaveError) {
      handleError(leaveError, "The group could not be left.");
    } finally {
      setIsBusy(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !draft.trim()) return;
    setIsBusy(true);
    setError("");
    try {
      const message = await api.sendGroupMessage(accessToken, selected.id, draft.trim());
      setMessages((current) => [message, ...current]);
      setDraft("");
      await refreshGroups();
    } catch (sendError) {
      handleError(sendError, "The group message could not be sent.");
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteMessage(message: GroupMessage) {
    if (!selected || message.deleted) return;
    setIsBusy(true);
    setError("");
    try {
      const deleted = await api.deleteGroupMessage(accessToken, selected.id, message.id);
      setMessages((current) => current.map((item) => item.id === deleted.id ? deleted : item));
      await refreshGroups();
    } catch (deleteError) {
      handleError(deleteError, "The group message could not be deleted.");
    } finally {
      setIsBusy(false);
    }
  }

  function beginEdit() {
    if (!selected) return;
    setEditName(selected.name);
    setEditImageUrl(selected.imageUrl ?? "");
    setEditingGroup(true);
  }

  return <div className="dm-workspace group-workspace">
    <aside className="dm-conversation-panel">
      <form className="group-create-form" onSubmit={createGroup}>
        <label htmlFor="group-name">Create a group</label>
        <input id="group-name" maxLength={100} onChange={(event) => setNewName(event.target.value)} placeholder="Group name" value={newName} />
        <input aria-label="Optional group image URL" maxLength={2048} onChange={(event) => setNewImageUrl(event.target.value)} placeholder="Image URL (optional)" type="url" value={newImageUrl} />
        <button disabled={isBusy || !newName.trim()} type="submit">Create group</button>
      </form>

      {invitations.length > 0 && <section className="group-invitations" aria-label="Pending group invitations">
        <h3>Invitations</h3>
        {invitations.map((invitation) => <article key={invitation.id}>
          <span><strong>{invitation.groupName}</strong><small>from @{invitation.inviter.username}</small></span>
          <div><button disabled={isBusy} onClick={() => void respondToInvitation(invitation, true)} type="button">Accept</button><button disabled={isBusy} onClick={() => void respondToInvitation(invitation, false)} type="button">Decline</button></div>
        </article>)}
      </section>}

      <div className="dm-list" aria-label="Group conversations">
        {isLoading && <p className="dm-empty">Loading groups…</p>}
        {!isLoading && groups.length === 0 && <p className="dm-empty">No groups yet. Create one or accept an invitation.</p>}
        {groups.map((group) => <button className={selected?.id === group.id ? "active" : ""} key={group.id} onClick={() => void loadHistory(group)} type="button">
          <GroupAvatar group={group} small />
          <span className="dm-list-copy"><strong>{group.name}</strong><small>{group.lastMessagePreview ?? `${group.memberCount} member${group.memberCount === 1 ? "" : "s"}`}</small></span>
          <span className="dm-list-meta">{group.lastMessageAt && <time>{timeLabel(group.lastMessageAt)}</time>}</span>
        </button>)}
      </div>
    </aside>

    <section className="dm-thread" aria-label={selected ? `${selected.name} group conversation` : "Group conversation"}>
      {error && <p className="inline-error dm-error" role="alert">{error}</p>}
      {!selected ? <EmptyState description="Select a group, create one, or accept a pending invitation." icon="community" title="Your groups" /> : <>
        <header className="dm-thread-header group-thread-header">
          <GroupAvatar group={selected} />
          <div><strong>{selected.name}</strong><p>{selected.memberCount} member{selected.memberCount === 1 ? "" : "s"} · {selected.currentUserRole.toLowerCase()}</p></div>
          <span className="group-header-actions">
            {canManage && <button onClick={beginEdit} type="button">Edit</button>}
            <button className="danger-link" disabled={isBusy} onClick={() => void leaveGroup()} type="button">Leave</button>
          </span>
        </header>

        {editingGroup && <form className="group-settings" onSubmit={saveGroup}>
          <input aria-label="Group name" maxLength={100} onChange={(event) => setEditName(event.target.value)} value={editName} />
          <input aria-label="Group image URL" maxLength={2048} onChange={(event) => setEditImageUrl(event.target.value)} placeholder="Image URL (blank removes it)" type="url" value={editImageUrl} />
          <button disabled={isBusy || !editName.trim()} type="submit">Save</button>
          <button onClick={() => setEditingGroup(false)} type="button">Cancel</button>
        </form>}

        <details className="group-members">
          <summary>Members and permissions</summary>
          {canManage && <form onSubmit={inviteMember}><input aria-label="Username to invite" maxLength={31} onChange={(event) => setInviteUsername(event.target.value)} placeholder="@username" value={inviteUsername} /><button disabled={isBusy || !inviteUsername.trim()} type="submit">Invite</button></form>}
          <div className="group-member-list">
            {selected.members.map((member) => {
              const isSelf = member.user.id === currentUserId;
              const actorCanRemove = selected.currentUserRole === "OWNER"
                ? member.role !== "OWNER"
                : selected.currentUserRole === "ADMIN" && member.role === "MEMBER";
              return <article key={member.user.id}>
                <button onClick={() => onViewProfile(member.user.username)} type="button">{member.user.displayName}<small>@{member.user.username}</small></button>
                <b>{member.role}</b>
                {selected.currentUserRole === "OWNER" && !isSelf && <select aria-label={`Role for ${member.user.displayName}`} disabled={isBusy} onChange={(event) => void changeRole(member, event.target.value as GroupRole)} value={member.role}>
                  <option value="MEMBER">Member</option><option value="ADMIN">Admin</option><option value="OWNER">Owner</option>
                </select>}
                {actorCanRemove && !isSelf && <button className="danger-link" disabled={isBusy} onClick={() => void removeMember(member)} type="button">Remove</button>}
              </article>;
            })}
          </div>
        </details>

        <div className="dm-history" aria-live="polite">
          {messagePage && !messagePage.last && <button className="dm-load-older" disabled={isLoadingHistory} onClick={() => void loadHistory(selected, messagePage.page + 1, true)} type="button">{isLoadingHistory ? "Loading…" : "Load older messages"}</button>}
          {isLoadingHistory && messages.length === 0 && <p className="dm-empty">Loading messages…</p>}
          {!isLoadingHistory && messages.length === 0 && <div className="dm-begin"><span>✦</span><p>This is the beginning of <strong>{selected.name}</strong>.</p></div>}
          {chronologicalMessages.map((message) => {
            const own = message.sender.id === currentUserId;
            const canDelete = own || canManage;
            return <article className={own ? "dm-message own" : "dm-message"} key={message.id}>
              {!own && <button className="group-message-author" onClick={() => onViewProfile(message.sender.username)} type="button">{message.sender.displayName}</button>}
              <div className={message.deleted ? "dm-bubble deleted" : "dm-bubble"}>{message.deleted ? "This message was deleted" : message.content}</div>
              <footer><time>{timeLabel(message.createdAt)}</time>{canDelete&&!message.deleted&&<button disabled={isBusy} onClick={() => void deleteMessage(message)} type="button">Delete</button>}{!own&&!message.deleted&&<ReportButton accessToken={accessToken} onUnauthorized={onUnauthorized} targetContext="GROUP_MESSAGE" targetId={message.id} targetType="MESSAGE"/>}</footer>
            </article>;
          })}
        </div>

        <form className="dm-composer" onSubmit={sendMessage}>
          <textarea aria-label={`Message ${selected.name}`} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a group message…" rows={1} value={draft} />
          <span>{draft.length}/2000</span>
          <button disabled={isBusy || !draft.trim()} type="submit">{isBusy ? "…" : "↑"}<span className="sr-only">Send group message</span></button>
        </form>
      </>}
    </section>
  </div>;
}
