export type PresenceStatus = "online" | "offline" | "busy";

export type ChannelTone = "purple" | "green" | "orange" | "red" | "violet" | "slate";

export type ChannelFilter = "all" | "unread" | "favorite";

export type DetailTab = "pinned" | "media" | "files";

export type ChatUser = {
  id: string;
  name: string;
  status: PresenceStatus;
  avatarUrl?: string;
};

export type ChatMetric = {
  label: string;
  value: string;
  tone: "blue" | "green" | "orange" | "purple";
};

export type ChatMessage = {
  id: string;
  author: ChatUser;
  sentAt: string;
  body: string;
  attachments?: MessageAttachmentItem[];
  canDelete?: boolean;
  canEdit?: boolean;
  editedAt?: string;
  isDeleted?: boolean;
  isForwarded?: boolean;
  isBot?: boolean;
  isPending?: boolean;
  isVoice?: boolean;
  reactions?: Array<{ emoji: string; count: number; reactedByMe?: boolean }>;
  metrics?: ChatMetric[];
  attachmentName?: string;
  isMine?: boolean;
  isLocal?: boolean;
  rawChannelId?: string;
  rawCreatedAt?: string;
  rawSenderId?: string | null;
  qrImageUrl?: string;
  qrReference?: string;
};

export type MessageAttachmentItem = {
  fileId: string;
  id: string;
  isAudio?: boolean;
  isImage?: boolean;
  isVideo?: boolean;
  mimeType?: string;
  name: string;
  previewUrl?: string;
  size?: string;
  tone: "green" | "red" | "slate";
  url?: string;
};

export type ChatChannel = {
  canManage?: boolean;
  createdBy?: string;
  departmentId?: string;
  id: string;
  name: string;
  description: string;
  tone: ChannelTone;
  unreadCount: number;
  isFavorite: boolean;
  isMember?: boolean;
  membershipStatus?: string;
  privateSessionMode?: boolean;
  memberCount: number;
  messages: ChatMessage[];
  relativeTime: string;
  slug?: string;
  type?: string;
};

export type DirectConversation = {
  id: string;
  user: ChatUser;
  lastMessage: string;
  relativeTime: string;
  unreadCount?: number;
};

export type PinnedMessage = {
  id: string;
  author: ChatUser;
  date: string;
  text: string;
};

export type MediaItem = {
  id: string;
  label: string;
  name: string;
  url?: string;
};

export type FileItem = {
  id: string;
  downloadUrl?: string;
  mimeType?: string;
  name: string;
  size: string;
  updatedAt: string;
  tone: "green" | "red" | "slate";
};

export type NotificationItem = {
  body: string;
  channelId?: string;
  createdAt: string;
  id: string;
  isRead: boolean;
  messageId?: string;
  title: string;
  type: string;
};
