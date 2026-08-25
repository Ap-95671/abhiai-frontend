const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080/api/v1";

export type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  attachments?: ConversationAttachment[];
};

export type ConversationDetail = ConversationSummary & {
  messages: ChatMessage[];
};

export type ChatExchange = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  conversation: ConversationSummary;
};

export type ConversationAttachment = {
  id: string;
  mediaId: string;
  filename: string;
  contentType: string;
  byteSize: number;
  kind: "IMAGE" | "DOCUMENT";
  processingStatus: "PENDING" | "READY" | "FAILED";
  processingError: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type AiCapabilities = {
  provider: string;
  model: string;
  configured: boolean;
  capabilities: Record<string, boolean>;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export type VerifiedStatus = "NONE" | "VERIFIED" | "ORGANIZATION" | "CREATOR" | "OFFICIAL";

export type SocialActor = {
  id: string;
  username: string;
  displayName: string;
  profilePicture: string | null;
  profileMediaId: string | null;
  verifiedStatus: VerifiedStatus;
};

export type NotificationType = "NEW_FOLLOWER" | "POST_LIKE" | "POST_REPLY" | "POST_REPOST" | "MENTION";

export type Mention = Omit<SocialActor, "id"> & { userId: string };

export type SocialNotification = {
  id: string;
  type: NotificationType;
  actor: SocialActor;
  entityType: "USER" | "POST";
  entityId: string;
  postId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

export type UserSearchResult = SocialActor & {
  bio: string | null;
  followerCount: number;
};

export type PostVisibility = "PUBLIC" | "FOLLOWERS" | "PRIVATE";
export type SearchSort = "RELEVANCE" | "RECENT" | "POPULAR";
export type PostSearchFilters = {
  user?: string;
  from?: string;
  to?: string;
  hasMedia?: boolean;
  sort?: SearchSort;
};
export type MediaKind = "IMAGE" | "VIDEO" | "DOCUMENT";
export type MediaProcessingStatus = "PENDING" | "COMPLETED" | "FAILED" | "NOT_REQUIRED";
export type MediaAsset = { id: string; originalFilename: string; contentType: string; kind: MediaKind; byteSize: number; processingStatus: MediaProcessingStatus; thumbnailAvailable: boolean; createdAt: string };

export type CommunityReference = {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
};

export type PollChoice = { id: string; text: string; position: number; voteCount: number };
export type Poll = { id: string; choices: PollChoice[]; totalVotes: number; expiresAt: string; expired: boolean; selectedChoiceId: string | null };
export type CreatePoll = { choices: string[]; durationHours: number };

export type Article = {
  id: string;
  author: SocialActor;
  title: string;
  summary: string;
  coverImageUrl: string | null;
  content: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByCurrentUser: boolean;
  publishedAt: string;
  updatedAt: string;
};
export type ArticleDraft = { title: string; summary: string; coverImageUrl: string | null; content: string };
export type ArticleComment = { id: string; author: SocialActor; content: string; createdAt: string; updatedAt: string };
export type CreatorDailyMetric = { date: string; impressions: number; uniquePostViewers: number; profileViews: number; uniqueProfileViewers: number; engagements: number; followerGrowth: number };
export type CreatorTopPost = { postId: string; textContent: string; impressions: number; uniqueViewers: number; engagements: number; engagementRate: number };
export type AudienceLocation = { location: string; count: number; percentage: number };
export type CreatorAnalytics = { days: number; from: string; to: string; impressions: number; uniquePostViewers: number; profileViews: number; uniqueProfileViewers: number; engagements: number; engagementRate: number; followerGrowth: number; totalFollowers: number; daily: CreatorDailyMetric[]; topPosts: CreatorTopPost[]; audienceLocations: AudienceLocation[] };
export type ReportTargetType = "POST" | "USER" | "COMMENT" | "MESSAGE" | "COMMUNITY";
export type ReportTargetContext = "POST_REPLY" | "ARTICLE_COMMENT" | "DIRECT_MESSAGE" | "GROUP_MESSAGE";
export type ReportReason = "SPAM" | "HARASSMENT" | "HATEFUL_CONTENT" | "VIOLENCE" | "NUDITY" | "IMPERSONATION" | "MISINFORMATION" | "OTHER";
export type ContentReport = { id: string; targetType: ReportTargetType; targetContext: ReportTargetContext | null; targetId: string; reason: ReportReason; details: string | null; status: "PENDING" | "REVIEWING" | "RESOLVED" | "DISMISSED"; createdAt: string };

export type PostSearchResult = {
  id: string;
  author: SocialActor;
  textContent: string;
  visibility: PostVisibility;
  replyCount: number;
  likeCount: number;
  repostCount: number;
  bookmarkCount: number;
  viewCount: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  media: MediaAsset[];
  community?: CommunityReference | null;
  poll: Poll | null;
};

export type PostViewResult = {
  postId: string;
  viewCount: number;
  counted: boolean;
};

export type StoryType = "TEXT" | "IMAGE" | "VIDEO";

export type Story = {
  id: string;
  author: SocialActor;
  type: StoryType;
  textContent: string | null;
  backgroundColor: string;
  media: MediaAsset | null;
  viewCount: number;
  reactionCount: number;
  viewedByCurrentUser: boolean;
  currentUserReaction: string | null;
  expiresAt: string;
  createdAt: string;
};

export type Hashtag = {
  id: string;
  normalizedTag: string;
  displayTag: string;
  postCount: number;
  createdAt: string;
};

export type ExploreResult = {
  trendingPosts: PostSearchResult[];
  trendingHashtags: Hashtag[];
  suggestedAccounts: UserSearchResult[];
  popularDiscussions: PostSearchResult[];
  recommendedMedia: PostSearchResult[];
  rankingSummary: string;
  rankingWindowDays: number;
  generatedAt: string;
};

export type DirectConversation = {
  id: string;
  participant: SocialActor;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  sender: SocialActor;
  content: string | null;
  deleted: boolean;
  readByRecipient: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type GroupRole = "OWNER" | "ADMIN" | "MEMBER";
export type GroupInvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export type GroupMember = {
  user: SocialActor;
  role: GroupRole;
  joinedAt: string;
};

export type GroupConversation = {
  id: string;
  name: string;
  imageUrl: string | null;
  owner: SocialActor;
  members: GroupMember[];
  memberCount: number;
  currentUserRole: GroupRole;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GroupInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  groupImageUrl: string | null;
  inviter: SocialActor;
  status: GroupInvitationStatus;
  createdAt: string;
  respondedAt: string | null;
};

export type GroupMessage = {
  id: string;
  conversationId: string;
  sender: SocialActor;
  content: string | null;
  deleted: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type CommunityPrivacy = "PUBLIC" | "PRIVATE";
export type CommunityRole = "OWNER" | "MEMBER";

export type Community = {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  owner: SocialActor;
  memberCount: number;
  privacy: CommunityPrivacy;
  joined: boolean;
  currentUserRole: CommunityRole | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = SocialActor & {
  bio: string | null;
  coverPicture: string | null;
  coverMediaId: string | null;
  location: string | null;
  website: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  updatedAt: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  showLikesOnProfile: boolean;
  accountPrivacy: "PUBLIC" | "PRIVATE";
};

export type BlockStatus = { userId: string; blockedByMe: boolean; blockedMe: boolean };
export type Mute = { id: string; type: "USER" | "KEYWORD" | "HASHTAG"; userId: string | null; username: string | null; term: string | null; createdAt: string };
export type FollowRequest = { id: string; requesterId: string; username: string; displayName: string; status: string; createdAt: string };

export type ProfileUpdate = {
  username: string;
  displayName: string;
  bio: string;
  profilePicture: string;
  coverPicture: string;
  profileMediaId: string | null;
  coverMediaId: string | null;
  location: string;
  website: string;
  dateOfBirth: string | null;
  showLikesOnProfile: boolean;
};

export type ProfileReply = {
  id: string;
  author: SocialActor;
  textContent: string;
  createdAt: string;
  updatedAt: string;
  post: PostSearchResult;
};

export type PostReply = {
  id: string;
  postId: string;
  author: SocialActor;
  textContent: string;
  createdAt: string;
  updatedAt: string;
};

type AuthTokenResponse = {
  accessToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
};

type ApiErrorPayload = {
  message?: string;
  validationErrors?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly validationErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    throw new ApiError(
      payload.message ?? "Something went wrong. Please try again.",
      response.status,
      payload.validationErrors ?? {},
    );
  }

  return response.json() as Promise<T>;
}

export const api = {
  async register(displayName: string, email: string, password: string): Promise<void> {
    await request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ displayName, email, password }),
    });
  },

  login(email: string, password: string): Promise<AuthTokenResponse> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  getConversations(accessToken: string): Promise<ConversationSummary[]> {
    return request("/conversations", {}, accessToken);
  },

  createConversation(accessToken: string, title?: string): Promise<ConversationSummary> {
    return request(
      "/conversations",
      { method: "POST", body: JSON.stringify({ title: title?.trim() || undefined }) },
      accessToken,
    );
  },

  getConversation(accessToken: string, conversationId: string): Promise<ConversationDetail> {
    return request(`/conversations/${conversationId}`, {}, accessToken);
  },

  renameConversation(
    accessToken: string,
    conversationId: string,
    title: string,
  ): Promise<ConversationSummary> {
    return request(
      `/conversations/${conversationId}`,
      { method: "PATCH", body: JSON.stringify({ title }) },
      accessToken,
    );
  },

  deleteConversation(accessToken: string, conversationId: string): Promise<void> {
    return request(`/conversations/${conversationId}`, { method: "DELETE" }, accessToken);
  },

  getNotifications(
    accessToken: string,
    page = 0,
    size = 20,
    unreadOnly = false,
  ): Promise<PageResponse<SocialNotification>> {
    return request(`/notifications?page=${page}&size=${size}&unreadOnly=${unreadOnly}`, {}, accessToken);
  },

  getUnreadNotificationCount(accessToken: string): Promise<{ unreadCount: number }> {
    return request("/notifications/unread-count", {}, accessToken);
  },

  markNotificationRead(
    accessToken: string,
    notificationId: string,
  ): Promise<SocialNotification> {
    return request(
      `/notifications/${notificationId}/read`,
      { method: "PATCH" },
      accessToken,
    );
  },

  markAllNotificationsRead(accessToken: string): Promise<{ updatedCount: number }> {
    return request("/notifications/read-all", { method: "PATCH" }, accessToken);
  },

  searchUsers(
    accessToken: string,
    query: string,
    page = 0,
    size = 20,
  ): Promise<PageResponse<UserSearchResult>> {
    const params = new URLSearchParams({ q: query, page: String(page), size: String(size) });
    return request(`/search/users?${params.toString()}`, {}, accessToken);
  },

  searchPosts(
    accessToken: string,
    query: string,
    filters: PostSearchFilters = {},
    page = 0,
    size = 20,
  ): Promise<PageResponse<PostSearchResult>> {
    const params = new URLSearchParams({ q: query, page: String(page), size: String(size) });
    if (filters.user) params.set("user", filters.user);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.hasMedia !== undefined) params.set("hasMedia", String(filters.hasMedia));
    if (filters.sort) params.set("sort", filters.sort);
    return request(`/search/posts?${params.toString()}`, {}, accessToken);
  },

  searchHashtags(
    accessToken: string,
    query: string,
    page = 0,
    size = 20,
  ): Promise<PageResponse<Hashtag>> {
    const params = new URLSearchParams({ q: query, page: String(page), size: String(size) });
    return request(`/search/hashtags?${params.toString()}`, {}, accessToken);
  },

  getExplore(accessToken: string, limit = 8): Promise<ExploreResult> {
    return request(`/explore?limit=${limit}`, {}, accessToken);
  },

  getDirectConversations(accessToken: string): Promise<DirectConversation[]> {
    return request("/direct-messages/conversations", {}, accessToken);
  },

  startDirectConversation(
    accessToken: string,
    recipientUsername: string,
  ): Promise<DirectConversation> {
    return request("/direct-messages/conversations", {
      method: "POST",
      body: JSON.stringify({ recipientUsername }),
    }, accessToken);
  },

  getDirectMessages(
    accessToken: string,
    conversationId: string,
    page = 0,
    size = 50,
  ): Promise<PageResponse<DirectMessage>> {
    return request(
      `/direct-messages/conversations/${conversationId}/messages?page=${page}&size=${size}`,
      {},
      accessToken,
    );
  },

  sendDirectMessage(
    accessToken: string,
    conversationId: string,
    content: string,
  ): Promise<DirectMessage> {
    return request(`/direct-messages/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }, accessToken);
  },

  markDirectConversationRead(
    accessToken: string,
    conversationId: string,
  ): Promise<{ updatedCount: number; readAt: string }> {
    return request(
      `/direct-messages/conversations/${conversationId}/read`,
      { method: "PATCH" },
      accessToken,
    );
  },

  deleteDirectMessage(
    accessToken: string,
    conversationId: string,
    messageId: string,
  ): Promise<DirectMessage> {
    return request(
      `/direct-messages/conversations/${conversationId}/messages/${messageId}`,
      { method: "DELETE" },
      accessToken,
    );
  },

  getGroups(accessToken: string): Promise<GroupConversation[]> {
    return request("/group-chats", {}, accessToken);
  },

  createGroup(accessToken: string, name: string, imageUrl?: string): Promise<GroupConversation> {
    return request("/group-chats", {
      method: "POST",
      body: JSON.stringify({ name, imageUrl: imageUrl?.trim() || null }),
    }, accessToken);
  },

  getGroup(accessToken: string, groupId: string): Promise<GroupConversation> {
    return request(`/group-chats/${groupId}`, {}, accessToken);
  },

  updateGroup(accessToken: string, groupId: string, name?: string, imageUrl?: string): Promise<GroupConversation> {
    return request(`/group-chats/${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({ name, imageUrl }),
    }, accessToken);
  },

  getGroupInvitations(accessToken: string): Promise<GroupInvitation[]> {
    return request("/group-chats/invitations/pending", {}, accessToken);
  },

  inviteGroupMember(accessToken: string, groupId: string, username: string): Promise<GroupInvitation> {
    return request(`/group-chats/${groupId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ username }),
    }, accessToken);
  },

  acceptGroupInvitation(accessToken: string, invitationId: string): Promise<GroupConversation> {
    return request(`/group-chats/invitations/${invitationId}/accept`, { method: "PATCH" }, accessToken);
  },

  declineGroupInvitation(accessToken: string, invitationId: string): Promise<GroupInvitation> {
    return request(`/group-chats/invitations/${invitationId}/decline`, { method: "PATCH" }, accessToken);
  },

  updateGroupMemberRole(accessToken: string, groupId: string, memberId: string, role: GroupRole): Promise<GroupConversation> {
    return request(`/group-chats/${groupId}/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }, accessToken);
  },

  removeGroupMember(accessToken: string, groupId: string, memberId: string): Promise<void> {
    return request(`/group-chats/${groupId}/members/${memberId}`, { method: "DELETE" }, accessToken);
  },

  leaveGroup(accessToken: string, groupId: string): Promise<void> {
    return request(`/group-chats/${groupId}/membership`, { method: "DELETE" }, accessToken);
  },

  getGroupMessages(accessToken: string, groupId: string, page = 0, size = 50): Promise<PageResponse<GroupMessage>> {
    return request(`/group-chats/${groupId}/messages?page=${page}&size=${size}`, {}, accessToken);
  },

  sendGroupMessage(accessToken: string, groupId: string, content: string): Promise<GroupMessage> {
    return request(`/group-chats/${groupId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }, accessToken);
  },

  deleteGroupMessage(accessToken: string, groupId: string, messageId: string): Promise<GroupMessage> {
    return request(`/group-chats/${groupId}/messages/${messageId}`, { method: "DELETE" }, accessToken);
  },

  getCommunities(accessToken: string, page = 0, size = 24): Promise<PageResponse<Community>> {
    return request(`/communities?page=${page}&size=${size}`, {}, accessToken);
  },

  getCommunity(accessToken: string, slug: string): Promise<Community> {
    return request(`/communities/${encodeURIComponent(slug)}`, {}, accessToken);
  },

  createCommunity(
    accessToken: string,
    payload: {
      name: string;
      slug: string;
      description: string;
      iconUrl: string | null;
      bannerUrl: string | null;
      privacy: CommunityPrivacy;
    },
  ): Promise<Community> {
    return request("/communities", {
      method: "POST",
      body: JSON.stringify(payload),
    }, accessToken);
  },

  joinCommunity(accessToken: string, slug: string): Promise<Community> {
    return request(`/communities/${encodeURIComponent(slug)}/membership`, { method: "POST" }, accessToken);
  },

  leaveCommunity(accessToken: string, slug: string): Promise<Community> {
    return request(`/communities/${encodeURIComponent(slug)}/membership`, { method: "DELETE" }, accessToken);
  },

  getCommunityPosts(
    accessToken: string,
    slug: string,
    page = 0,
    size = 20,
  ): Promise<PageResponse<PostSearchResult>> {
    return request(
      `/communities/${encodeURIComponent(slug)}/posts?page=${page}&size=${size}`,
      {},
      accessToken,
    );
  },

  createCommunityPost(
    accessToken: string,
    slug: string,
    textContent: string,
    visibility: PostVisibility = "PUBLIC",
    mediaIds: string[] = [],
  ): Promise<PostSearchResult> {
    return request(`/communities/${encodeURIComponent(slug)}/posts`, {
      method: "POST",
      body: JSON.stringify({ textContent, visibility, mediaIds }),
    }, accessToken);
  },

  getFeed(accessToken: string, page = 0, size = 20): Promise<PageResponse<PostSearchResult>> {
    return request(`/feed?page=${page}&size=${size}`, {}, accessToken);
  },

  getVideoFeed(accessToken: string, page = 0, size = 10): Promise<PageResponse<PostSearchResult>> {
    return request(`/videos/feed?page=${page}&size=${size}`, {}, accessToken);
  },

  recordVideoView(accessToken: string, postId: string): Promise<PostViewResult> {
    return request(`/videos/${postId}/views`, { method: "POST" }, accessToken);
  },

  getStories(accessToken: string, page = 0, size = 50): Promise<PageResponse<Story>> {
    return request(`/stories/feed?page=${page}&size=${size}`, {}, accessToken);
  },

  createStory(
    accessToken: string,
    textContent: string,
    mediaId: string | null,
    backgroundColor: string,
  ): Promise<Story> {
    return request("/stories", {
      method: "POST",
      body: JSON.stringify({ textContent: textContent.trim() || null, mediaId, backgroundColor }),
    }, accessToken);
  },

  recordStoryView(accessToken: string, storyId: string): Promise<{ storyId: string; viewCount: number; counted: boolean }> {
    return request(`/stories/${storyId}/views`, { method: "POST" }, accessToken);
  },

  setStoryReaction(accessToken: string, storyId: string, reaction: string | null): Promise<{ storyId: string; reaction: string | null; reactionCount: number }> {
    return request(`/stories/${storyId}/reaction`, reaction
      ? { method: "POST", body: JSON.stringify({ reaction }) }
      : { method: "DELETE" }, accessToken);
  },

  deleteStory(accessToken: string, storyId: string): Promise<void> {
    return request(`/stories/${storyId}`, { method: "DELETE" }, accessToken);
  },

  getTrendingHashtags(accessToken: string, page = 0, size = 20): Promise<PageResponse<Hashtag>> {
    return request(`/hashtags/trending?page=${page}&size=${size}`, {}, accessToken);
  },

  getHashtagPosts(accessToken: string, tag: string, page = 0, size = 20): Promise<PageResponse<PostSearchResult>> {
    return request(`/hashtags/${encodeURIComponent(tag.replace(/^#/, ""))}/posts?page=${page}&size=${size}`, {}, accessToken);
  },

  getPostMentions(accessToken: string, postId: string): Promise<Mention[]> {
    return request(`/posts/${postId}/mentions`, {}, accessToken);
  },

  createPost(accessToken: string, textContent: string, visibility: PostVisibility, mediaIds: string[] = [], poll?: CreatePoll): Promise<PostSearchResult> {
    return request("/posts", { method: "POST", body: JSON.stringify({ textContent, visibility, mediaIds, poll }) }, accessToken);
  },

  getPoll(accessToken: string, postId: string): Promise<Poll> {
    return request(`/posts/${postId}/poll`, {}, accessToken);
  },

  voteInPoll(accessToken: string, postId: string, choiceId: string): Promise<Poll> {
    return request(`/posts/${postId}/poll/votes`, { method: "POST", body: JSON.stringify({ choiceId }) }, accessToken);
  },

  getArticles(accessToken: string, page = 0, size = 12): Promise<PageResponse<Article>> {
    return request(`/articles?page=${page}&size=${size}`, {}, accessToken);
  },

  getArticle(accessToken: string, articleId: string): Promise<Article> {
    return request(`/articles/${articleId}`, {}, accessToken);
  },

  createArticle(accessToken: string, draft: ArticleDraft): Promise<Article> {
    return request("/articles", { method: "POST", body: JSON.stringify(draft) }, accessToken);
  },

  updateArticle(accessToken: string, articleId: string, draft: ArticleDraft): Promise<Article> {
    return request(`/articles/${articleId}`, { method: "PUT", body: JSON.stringify(draft) }, accessToken);
  },

  deleteArticle(accessToken: string, articleId: string): Promise<void> {
    return request(`/articles/${articleId}`, { method: "DELETE" }, accessToken);
  },

  setArticleLike(accessToken: string, articleId: string, liked: boolean): Promise<Article> {
    return request(`/articles/${articleId}/likes`, { method: liked ? "POST" : "DELETE" }, accessToken);
  },

  getArticleComments(accessToken: string, articleId: string): Promise<PageResponse<ArticleComment>> {
    return request(`/articles/${articleId}/comments?size=50`, {}, accessToken);
  },

  createArticleComment(accessToken: string, articleId: string, content: string): Promise<ArticleComment> {
    return request(`/articles/${articleId}/comments`, { method: "POST", body: JSON.stringify({ content }) }, accessToken);
  },

  shareArticle(accessToken: string, articleId: string): Promise<{ articleId: string; shareCount: number }> {
    return request(`/articles/${articleId}/shares`, { method: "POST" }, accessToken);
  },

  getCreatorAnalytics(accessToken: string, days = 30): Promise<CreatorAnalytics> {
    return request(`/creator/analytics?days=${days}`, {}, accessToken);
  },

  recordPostImpression(accessToken: string, postId: string): Promise<{ entityId: string; counted: boolean }> {
    return request(`/creator/analytics/posts/${postId}/impressions`, { method: "POST" }, accessToken);
  },

  recordProfileView(accessToken: string, username: string): Promise<{ entityId: string; counted: boolean }> {
    return request(`/creator/analytics/profiles/${encodeURIComponent(username)}/views`, { method: "POST" }, accessToken);
  },

  createReport(accessToken: string, targetType: ReportTargetType, targetId: string, reason: ReportReason, details: string, targetContext?: ReportTargetContext): Promise<ContentReport> {
    return request("/reports", { method: "POST", body: JSON.stringify({ targetType, targetContext: targetContext ?? null, targetId, reason, details: details.trim() || null }) }, accessToken);
  },

  getMyReports(accessToken: string, page = 0): Promise<PageResponse<ContentReport>> {
    return request(`/reports/mine?page=${page}&size=20`, {}, accessToken);
  },

  async uploadImage(accessToken: string, file: File): Promise<MediaAsset> {
    const body = new FormData(); body.append("file", file);
    const response = await fetch(`${API_BASE_URL}/media/images`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, body });
    if (!response.ok) { const payload=(await response.json().catch(()=>({}))) as ApiErrorPayload; throw new ApiError(payload.message ?? "Image upload failed.", response.status, payload.validationErrors ?? {}); }
    return response.json() as Promise<MediaAsset>;
  },

  async uploadAttachment(accessToken: string, file: File): Promise<MediaAsset> {
    const body = new FormData(); body.append("file", file);
    const response = await fetch(`${API_BASE_URL}/media`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, body });
    if (!response.ok) { const payload=(await response.json().catch(()=>({}))) as ApiErrorPayload; throw new ApiError(payload.message ?? "Attachment upload failed.", response.status, payload.validationErrors ?? {}); }
    return response.json() as Promise<MediaAsset>;
  },

  async getMediaBlob(accessToken: string, mediaId: string, thumbnail = false): Promise<Blob> {
    const response=await fetch(`${API_BASE_URL}/media/${mediaId}/${thumbnail ? "thumbnail" : "content"}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if(!response.ok) throw new ApiError("Image could not be loaded.",response.status); return response.blob();
  },

  deleteMedia(accessToken: string, mediaId: string): Promise<void> { return request(`/media/${mediaId}`, { method: "DELETE" }, accessToken); },

  deletePost(accessToken: string, postId: string): Promise<void> {
    return request(`/posts/${postId}`, { method: "DELETE" }, accessToken);
  },

  getLikeStatus(accessToken: string, postId: string): Promise<{ liked: boolean }> {
    return request(`/posts/${postId}/likes/status`, {}, accessToken);
  },

  setLike(accessToken: string, postId: string, liked: boolean): Promise<void> {
    return request(`/posts/${postId}/likes`, { method: liked ? "POST" : "DELETE" }, accessToken);
  },

  pinPost(accessToken: string, postId: string): Promise<PostSearchResult> {
    return request(`/posts/${postId}/pin`, { method: "POST" }, accessToken);
  },

  unpinPost(accessToken: string, postId: string): Promise<void> {
    return request(`/posts/${postId}/pin`, { method: "DELETE" }, accessToken);
  },

  getRepostStatus(accessToken: string, postId: string): Promise<{ reposted: boolean }> {
    return request(`/posts/${postId}/reposts/status`, {}, accessToken);
  },

  setRepost(accessToken: string, postId: string, reposted: boolean): Promise<void> {
    return request(`/posts/${postId}/reposts`, { method: reposted ? "POST" : "DELETE" }, accessToken);
  },

  getBookmarkStatus(accessToken: string, postId: string): Promise<{ bookmarked: boolean }> {
    return request(`/posts/${postId}/bookmarks/status`, {}, accessToken);
  },

  setBookmark(accessToken: string, postId: string, bookmarked: boolean): Promise<void> {
    return request(`/posts/${postId}/bookmarks`, { method: bookmarked ? "POST" : "DELETE" }, accessToken);
  },

  getReplies(accessToken: string, postId: string): Promise<PageResponse<PostReply>> {
    return request(`/posts/${postId}/replies?size=50`, {}, accessToken);
  },

  createReply(accessToken: string, postId: string, textContent: string): Promise<PostReply> {
    return request(`/posts/${postId}/replies`, { method: "POST", body: JSON.stringify({ textContent }) }, accessToken);
  },

  getCurrentProfile(accessToken: string): Promise<UserProfile> {
    return request("/users/me", {}, accessToken);
  },

  getProfile(accessToken: string, username: string): Promise<UserProfile> {
    return request(`/users/${encodeURIComponent(username)}`, {}, accessToken);
  },

  updateProfile(accessToken: string, profile: ProfileUpdate): Promise<UserProfile> {
    return request("/users/me/profile", { method: "PATCH", body: JSON.stringify(profile) }, accessToken);
  },

  updateAccountPrivacy(accessToken: string, privacy: "PUBLIC" | "PRIVATE"): Promise<UserProfile> {
    return request("/users/me/privacy", { method: "PATCH", body: JSON.stringify({ privacy }) }, accessToken);
  },

  getProfilePosts(accessToken: string, username: string, page = 0): Promise<PageResponse<PostSearchResult>> {
    return request(`/users/${encodeURIComponent(username)}/posts?page=${page}&size=20`, {}, accessToken);
  },

  getProfileReplies(accessToken: string, username: string, page = 0): Promise<PageResponse<ProfileReply>> {
    return request(`/users/${encodeURIComponent(username)}/replies?page=${page}&size=20`, {}, accessToken);
  },

  getProfileMedia(accessToken: string, username: string, page = 0): Promise<PageResponse<PostSearchResult>> {
    return request(`/users/${encodeURIComponent(username)}/media?page=${page}&size=20`, {}, accessToken);
  },

  getProfileLikes(accessToken: string, username: string, page = 0): Promise<PageResponse<PostSearchResult>> {
    return request(`/users/${encodeURIComponent(username)}/likes?page=${page}&size=20`, {}, accessToken);
  },

  getFollowStatus(accessToken: string, userId: string): Promise<{ following: boolean }> {
    return request(`/users/${userId}/follow-status`, {}, accessToken);
  },

  setFollowing(accessToken: string, userId: string, following: boolean): Promise<void> {
    return request(`/users/${userId}/follow`, { method: following ? "POST" : "DELETE" }, accessToken);
  },

  getBlockStatus(accessToken: string, userId: string): Promise<BlockStatus> {
    return request(`/users/${userId}/block-status`, {}, accessToken);
  },

  setBlocked(accessToken: string, userId: string, blocked: boolean): Promise<BlockStatus> {
    return request(`/users/${userId}/block`, { method: blocked ? "POST" : "DELETE" }, accessToken);
  },

  getMutes(accessToken: string): Promise<Mute[]> { return request("/mutes", {}, accessToken); },
  addUserMute(accessToken: string, userId: string): Promise<Mute> { return request("/mutes", { method: "POST", body: JSON.stringify({ type: "USER", userId }) }, accessToken); },
  removeMute(accessToken: string, id: string): Promise<void> { return request(`/mutes/${id}`, { method: "DELETE" }, accessToken); },
  getFollowRequests(accessToken: string): Promise<PageResponse<FollowRequest>> { return request("/follow-requests?size=50", {}, accessToken); },
  decideFollowRequest(accessToken: string, id: string, accept: boolean): Promise<void> { return request(`/follow-requests/${id}/${accept ? "accept" : "reject"}`, { method: "POST" }, accessToken); },

  sendMessage(accessToken: string, conversationId: string, content: string): Promise<ChatExchange> {
    return request(
      `/conversations/${conversationId}/messages`,
      { method: "POST", body: JSON.stringify({ content }) },
      accessToken,
    );
  },

  async generateImage(
    accessToken: string,
    conversationId: string,
    prompt: string,
    signal?: AbortSignal,
  ): Promise<ChatExchange> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
      signal,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      throw new ApiError(
        payload.message ?? (response.status === 503
          ? "Image generation is not configured on the backend."
          : "Image generation failed. Please try again."),
        response.status,
        payload.validationErrors ?? {},
      );
    }
    return response.json() as Promise<ChatExchange>;
  },

  async sendMessageStream(
    accessToken: string,
    conversationId: string,
    content: string,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal,
    options?: { attachmentIds?: string[]; externalProcessingAllowed?: boolean; webSearchAllowed?: boolean },
  ): Promise<ChatExchange> {
    const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages/stream`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        attachmentIds: options?.attachmentIds ?? [],
        externalProcessingAllowed: options?.externalProcessingAllowed ?? false,
        webSearchAllowed: options?.webSearchAllowed ?? false,
      }),
      signal,
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      throw new ApiError(
        payload.message ?? "Unable to start chat stream.",
        response.status,
        payload.validationErrors ?? {},
      );
    }
    if (!response.body) {
      throw new Error("Chat stream did not include a response body.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let eventName = "";
    let completed: ChatExchange | undefined;
    let streamError = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n")) >= 0) {
        const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        for (const line of event.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) {
            const data = line.slice(5).trimStart();
            if (eventName === "chunk") onChunk(data);
            if (eventName === "complete") completed = JSON.parse(data) as ChatExchange;
            if (eventName === "error") streamError = ((JSON.parse(data) as { message?: string }).message ?? "Chat generation failed");
          }
        }
        eventName = "";
      }
    }
    if (!completed) throw new Error(streamError || "Chat stream ended unexpectedly");
    return completed;
  },

  getAiCapabilities(accessToken: string): Promise<AiCapabilities> {
    return request("/ai/capabilities", {}, accessToken);
  },

  async uploadConversationAttachment(
    accessToken: string,
    conversationId: string,
    file: File,
  ): Promise<ConversationAttachment> {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(
      `${API_BASE_URL}/conversations/${conversationId}/attachments`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        body,
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      throw new ApiError(
        payload.message ?? (response.status === 413
          ? "This file is larger than the server upload limit."
          : response.status === 415
            ? "This file format is not supported."
            : "Conversation attachment upload failed. Check the storage configuration and try again."),
        response.status,
        payload.validationErrors ?? {},
      );
    }
    return response.json() as Promise<ConversationAttachment>;
  },

  deleteConversationAttachment(
    accessToken: string,
    conversationId: string,
    attachmentId: string,
  ): Promise<void> {
    return request(
      `/conversations/${conversationId}/attachments/${attachmentId}`,
      { method: "DELETE" },
      accessToken,
    );
  },
};
