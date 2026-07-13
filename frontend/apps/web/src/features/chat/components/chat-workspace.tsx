"use client";

import { Fragment, type ChangeEvent, type ClipboardEvent, type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { queryKeys } from "@webtui/api-client";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  NavigationRail,
  SegmentedControl,
  Skeleton,
  Toast,
  Tooltip,
  useTheme
} from "@webtui/ui";
import {
  Archive,
  Bell,
  Bot,
  CheckCircle2,
  Clock3,
  Cloud,
  Edit3,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  LogOut,
  MessageCircle,
  Mic,
  Monitor,
  MoreVertical,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Share2,
  Smartphone,
  Settings,
  ShieldCheck,
  Smile,
  Sparkles,
  StopCircle,
  Star,
  Sun,
  Ticket,
  Trash2,
  Users,
  Workflow,
  X,
  Zap
} from "@webtui/icons";
import { useAuth } from "@/features/auth/auth-provider";
import { useAuthStore } from "@/features/auth/auth-store";
import { api } from "@/lib/api";
import {
  mapAuthUser,
  type CreateChannelPayload,
  type CreateDepartmentPayload,
  useChatWorkspaceData
} from "../hooks/use-chat-workspace-data";
import type {
  ChannelFilter,
  ChatChannel,
  ChatMessage,
  ChatUser,
  DetailTab,
  FileItem,
  MediaItem,
  MessageAttachmentItem,
  NotificationItem,
  PinnedMessage
} from "../model/types";
import { useUploadStore, type UploadQueueItem } from "../stores/upload-store";
import { getCachedMediaUrl, resolveCachedMediaUrl } from "../model/media-cache";
import { buildChatTargets } from "../model/chat-targets";
import { buildDepartmentRows, departmentDescendantIds } from "../model/department-tree";
import type {
  AuthSession,
  AuthUser,
  Bot as BotRecord,
  ChannelMember,
  ContactRequest,
  Department,
  DepartmentMember,
  OrderServicesExpiringData,
  OrderServicesExpiringInput,
  OrderPaymentQRData,
  OrderWalletBalanceData,
  OrderWalletDepositQRData,
  WorkspaceMember
} from "@webtui/types";
import { AutomationPage } from "./automation-page";
import { parseChatRoute } from "@/lib/chat-route";

const railItems = [
  { id: "messages", label: "Tin nhắn", icon: MessageCircle },
  { id: "contacts", label: "Bạn bè", icon: Users },
  { id: "channels", label: "Kênh", icon: Hash },
  { id: "departments", label: "Phòng ban", icon: Archive },
  { id: "tickets", label: "Ticket", icon: Ticket },
  { id: "files", label: "File", icon: FileText },
  { id: "bots", label: "Bot", icon: Bot },
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "settings", label: "Cài đặt", icon: Settings }
] as const;

type RailItemId = (typeof railItems)[number]["id"];
type MessageSidebarTab = "conversations" | "channels";
type ContactsTab = "employees" | "friends" | "discover";
type ChatWorkspaceData = ReturnType<typeof useChatWorkspaceData>;

type ChannelHashStyle = CSSProperties & {
  "--channel-hash-bg": string;
  "--channel-hash-bg-soft": string;
  "--channel-hash-border": string;
  "--channel-hash-dark-bg": string;
  "--channel-hash-dark-border": string;
  "--channel-hash-dark-text": string;
  "--channel-hash-shadow": string;
  "--channel-hash-text": string;
};

const channelHashPalettes = [
  { bg: "#e0f2fe", bgSoft: "#f0f9ff", border: "#bae6fd", darkBg: "#083344", darkBorder: "#155e75", darkText: "#67e8f9", shadow: "rgb(14 165 233 / 22%)", text: "#0284c7" },
  { bg: "#dcfce7", bgSoft: "#f0fdf4", border: "#bbf7d0", darkBg: "#052e16", darkBorder: "#166534", darkText: "#86efac", shadow: "rgb(34 197 94 / 22%)", text: "#16a34a" },
  { bg: "#fef3c7", bgSoft: "#fffbeb", border: "#fde68a", darkBg: "#451a03", darkBorder: "#92400e", darkText: "#fcd34d", shadow: "rgb(245 158 11 / 24%)", text: "#d97706" },
  { bg: "#fee2e2", bgSoft: "#fef2f2", border: "#fecaca", darkBg: "#450a0a", darkBorder: "#991b1b", darkText: "#fca5a5", shadow: "rgb(239 68 68 / 24%)", text: "#dc2626" },
  { bg: "#f3e8ff", bgSoft: "#faf5ff", border: "#e9d5ff", darkBg: "#2e1065", darkBorder: "#6b21a8", darkText: "#d8b4fe", shadow: "rgb(168 85 247 / 24%)", text: "#9333ea" },
  { bg: "#fce7f3", bgSoft: "#fdf2f8", border: "#fbcfe8", darkBg: "#500724", darkBorder: "#9d174d", darkText: "#f9a8d4", shadow: "rgb(236 72 153 / 24%)", text: "#db2777" },
  { bg: "#e0e7ff", bgSoft: "#eef2ff", border: "#c7d2fe", darkBg: "#1e1b4b", darkBorder: "#4338ca", darkText: "#a5b4fc", shadow: "rgb(99 102 241 / 24%)", text: "#4f46e5" },
  { bg: "#ccfbf1", bgSoft: "#f0fdfa", border: "#99f6e4", darkBg: "#042f2e", darkBorder: "#0f766e", darkText: "#5eead4", shadow: "rgb(20 184 166 / 22%)", text: "#0d9488" }
] as const;

const channelHashPaletteBySlug: Record<string, (typeof channelHashPalettes)[number]> = {
  "ban-giam-doc": channelHashPalettes[4],
  "ban-giao-ca": channelHashPalettes[6],
  "gia-han": channelHashPalettes[2],
  "ke-toan": channelHashPalettes[1],
  "ky-thuat": channelHashPalettes[7],
  sale: channelHashPalettes[5],
  "server-alert": channelHashPalettes[3],
  "thong-bao": channelHashPalettes[0],
  ticket: channelHashPalettes[1]
};

function channelHashStyle(channel: ChatChannel): ChannelHashStyle {
  const key = normalizeChannelColorKey(channel.slug || channel.name || channel.id);
  const palette = channelHashPaletteBySlug[key] ?? channelHashPalettes[stableColorIndex(key || channel.id)];

  return {
    "--channel-hash-bg": palette.bg,
    "--channel-hash-bg-soft": palette.bgSoft,
    "--channel-hash-border": palette.border,
    "--channel-hash-dark-bg": palette.darkBg,
    "--channel-hash-dark-border": palette.darkBorder,
    "--channel-hash-dark-text": palette.darkText,
    "--channel-hash-shadow": palette.shadow,
    "--channel-hash-text": palette.text
  };
}

function normalizeChannelColorKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableColorIndex(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % channelHashPalettes.length;
}

function botComposerPlaceholder(channel?: ChatChannel | null) {
  switch (channel?.slug) {
    case "gia-han":
      return "Gia Hạn Bot: Email: khach@example.com · Số ngày: 7 · Loại dịch vụ: Tất cả";
    case "ke-toan":
      return "Thanh Toán Bot: Email: khach@example.com · Số tiền: 200000";
    case "ticket":
      return "Ticket Bot: mô tả lỗi, hoặc nhập “Tra ví email@example.com”";
    case "server-alert":
      return "Server Alert Bot: Server: vps-01 · Lỗi: mất ping/port timeout...";
    default:
      return "Nhập tin nhắn...";
  }
}
type ContactResult = {
  avatarUrl?: string | null;
  contactDirection?: "incoming" | "outgoing";
  contactRequestId?: string;
  contactStatus: "accepted" | "none" | "pending" | "rejected";
  email?: string;
  hasConversation: boolean;
  isWorkspaceMember: boolean;
  name: string;
  phoneNumber?: string | null;
  status?: string;
  userId: string;
  username?: string;
};

const channelFilters: Array<{ label: string; value: ChannelFilter }> = [
  { label: "Tất cả", value: "all" },
  { label: "Chưa đọc", value: "unread" },
  { label: "Yêu thích", value: "favorite" }
];

const detailTabs: Array<{ label: string; value: DetailTab }> = [
  { label: "Đã ghim", value: "pinned" },
  { label: "Ảnh", value: "media" },
  { label: "File", value: "files" }
];

const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "😡"] as const;

export function ChatWorkspace() {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const routedRailItem = railItemFromRoute(pathname);
  const [activeRailItem, setActiveRailItem] = useState<RailItemId>(routedRailItem);
  const [messageSidebarTab, setMessageSidebarTab] = useState<MessageSidebarTab>(
    parseChatRoute(pathname)?.kind === "channel" ? "channels" : "conversations"
  );
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [detailTab, setDetailTab] = useState<DetailTab>("pinned");
  const [searchQuery, setSearchQuery] = useState("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [editingBody, setEditingBody] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchChannelId, setMessageSearchChannelId] = useState("");
  const [messageSearchSenderId, setMessageSearchSenderId] = useState("");
  const [messageSearchKind, setMessageSearchKind] = useState("");
  const [messageSearchDateFrom, setMessageSearchDateFrom] = useState("");
  const [messageSearchDateTo, setMessageSearchDateTo] = useState("");
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(true);
  const [favoriteChatIds, setFavoriteChatIds] = useState<Set<string>>(() => new Set());
  const [manuallyUnreadChatIds, setManuallyUnreadChatIds] = useState<Set<string>>(() => new Set());
  const [locallyReadChatIds, setLocallyReadChatIds] = useState<Set<string>>(() => new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const seenNotificationIdsRef = useRef<Set<string> | null>(null);
  const seenContactRequestIdsRef = useRef<Set<string> | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingPublishedRef = useRef(false);
  const currentUser = useMemo(() => mapAuthUser(user), [user]);
  const activeMessageSearchQuery = isMessageSearchOpen ? messageSearchQuery : "";
  const data = useChatWorkspaceData(currentUser, {
    friendSearchQuery,
    messageSearchFilters: {
      channelId: messageSearchChannelId,
      dateFrom: messageSearchDateFrom,
      dateTo: messageSearchDateTo,
      kind: messageSearchKind,
      senderId: messageSearchSenderId
    },
    messageSearchQuery: activeMessageSearchQuery,
    threadMessageId: threadMessageId ?? undefined
  });

  const visibleRailItems = railItems.filter((item) => canAccessRailItem(item.id, data.can));

  useEffect(() => setActiveRailItem(routedRailItem), [routedRailItem]);
  useEffect(() => {
    if (data.permissionsQuery.isLoading || canAccessRailItem(routedRailItem, data.can)) {
      return;
    }
    setActiveRailItem("messages");
    data.setWorkspaceSection();
  }, [data.can, data.permissionsQuery.isLoading, data.setWorkspaceSection, routedRailItem]);
  const selectedChannelMembersQuery = useQuery({
    enabled: Boolean(data.workspaceId && data.selectedChannelId && data.canAccessSelectedChannel),
    queryFn: () => api.channels.members(data.workspaceId, data.selectedChannelId),
    queryKey: queryKeys.channels.members(data.workspaceId, data.selectedChannelId)
  });
  const selectedChannelMembers = useMemo(
    () => (selectedChannelMembersQuery.data ?? []).filter((member) => member.status === "active" || member.status === "muted"),
    [selectedChannelMembersQuery.data]
  );
  const sidebarBotsQuery = useQuery({
    enabled: Boolean(data.workspaceId && data.can("bot.manage") && activeRailItem === "messages"),
    queryFn: () => api.bots.list(data.workspaceId),
    queryKey: queryKeys.integrations.bots(data.workspaceId)
  });
  const chatTargets = useMemo(() => {
    return buildChatTargets(data.channels, data.directConversations);
  }, [data.channels, data.directConversations]);
  const forwardTargets = useMemo(
    () => chatTargets.filter((target) => target.id !== data.selectedChannelId),
    [chatTargets, data.selectedChannelId]
  );
  const uploadQueue = useUploadStore();
  const queuedUploads = useMemo(
    () => uploadQueue.items.filter((item) => item.status === "queued" || item.status === "failed"),
    [uploadQueue.items]
  );

  const canCreateChannel = data.can("channel.create");
  const isDirectChat =
    data.selectedChannel?.type === "direct" || data.selectedChannelWithMessages?.type === "direct";
  const canSendMessage = data.can("message.send") || isDirectChat;
  const canUploadFile = data.can("file.upload") || isDirectChat;
  const canUseComposer = canSendMessage && (!uploadQueue.items.length || canUploadFile);

  const effectiveUnreadCount = (chatId: string, unreadCount = 0) => {
    if (manuallyUnreadChatIds.has(chatId)) {
      return Math.max(1, unreadCount);
    }
    return locallyReadChatIds.has(chatId) ? 0 : unreadCount;
  };

  const isFavoriteChat = (chatId: string, serverFavorite = false) =>
    serverFavorite || favoriteChatIds.has(chatId);

  const sidebarChannels = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return data.channels.filter((channel) => {
      if (channel.type === "direct") {
        return false;
      }

      const matchesFilter =
        channelFilter === "all" ||
        (channelFilter === "unread" && effectiveUnreadCount(channel.id, channel.unreadCount) > 0) ||
        (channelFilter === "favorite" && isFavoriteChat(channel.id, channel.isFavorite));

      return (
        matchesFilter &&
        (!normalizedQuery ||
          channel.name.toLowerCase().includes(normalizedQuery) ||
          channel.description.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [channelFilter, data.channels, favoriteChatIds, locallyReadChatIds, manuallyUnreadChatIds, searchQuery]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return data.directConversations.filter((conversation) => {
      const matchesFilter =
        channelFilter === "all" ||
        (channelFilter === "unread" && effectiveUnreadCount(conversation.id, conversation.unreadCount) > 0) ||
        (channelFilter === "favorite" && isFavoriteChat(conversation.id));
      const matchesQuery =
        !normalizedQuery ||
        conversation.user.name.toLowerCase().includes(normalizedQuery) ||
        conversation.lastMessage.toLowerCase().includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
  }, [channelFilter, data.directConversations, favoriteChatIds, locallyReadChatIds, manuallyUnreadChatIds, searchQuery]);

  const sidebarBots = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return (sidebarBotsQuery.data ?? []).filter((bot) =>
      !normalizedQuery ||
      bot.name.toLowerCase().includes(normalizedQuery) ||
      bot.slug.toLowerCase().includes(normalizedQuery) ||
      (bot.description ?? "").toLowerCase().includes(normalizedQuery)
    );
  }, [searchQuery, sidebarBotsQuery.data]);

  const sidebarConversationUnreadCount = data.directConversations.reduce(
    (total, conversation) => total + (effectiveUnreadCount(conversation.id, conversation.unreadCount) > 0 ? 1 : 0),
    0
  );
  const sidebarChannelUnreadCount = data.channels.reduce(
    (total, channel) => total + (effectiveUnreadCount(channel.id, channel.unreadCount) > 0 ? 1 : 0),
    0
  );

  const contactResults = useMemo(
    () =>
      buildContactResults({
        currentUserId: currentUser?.id,
        contacts: data.contacts,
        contactRequests: data.contactRequests,
        directConversations: data.directConversations,
        members: data.members,
        query: friendSearchQuery,
        searchUsers: data.searchUsers
      }),
    [currentUser?.id, data.contactRequests, data.contacts, data.directConversations, data.members, data.searchUsers, friendSearchQuery]
  );
  const pinnedMessageIds = useMemo(
    () => new Set(data.pinnedMessages.map((message) => message.id)),
    [data.pinnedMessages]
  );
  const pinnedMessages = useMemo(
    () =>
      data.pinnedMessages.map<PinnedMessage>((message) => ({
        author: message.author,
        date: message.sentAt,
        id: message.id,
        text: message.body
      })),
    [data.pinnedMessages]
  );
  const incomingContactRequests = useMemo(
    () => data.contactRequests.filter((request) => request.status === "pending" && request.direction === "incoming"),
    [data.contactRequests]
  );
  const notificationBadgeCount = data.unreadNotificationsCount + incomingContactRequests.length;
  const remoteTypingLabel = useMemo(() => {
    const userId = data.realtime.typingUserIds[0];
    if (!userId) {
      return "";
    }
    const directUser = data.directConversations.find((conversation) => conversation.user.id === userId)?.user;
    const member = data.members.find((item) => item.user_id === userId);
    const name = directUser?.name || member?.display_name || member?.username || member?.email || "Ai đó";
    const extra = data.realtime.typingUserIds.length - 1;
    return extra > 0 ? `${name} và ${extra} người khác đang soạn tin` : `${name} đang soạn tin`;
  }, [data.directConversations, data.members, data.realtime.typingUserIds]);

  useEffect(() => {
    const currentIds = new Set(data.notifications.map((notification) => notification.id));
    if (!seenNotificationIdsRef.current) {
      seenNotificationIdsRef.current = currentIds;
      return;
    }

    const newest = data.notifications.find(
      (notification) => !notification.isRead && !seenNotificationIdsRef.current?.has(notification.id)
    );
    data.notifications.forEach((notification) => seenNotificationIdsRef.current?.add(notification.id));
    if (!newest) {
      return;
    }

    setToast(`${newest.title}: ${newest.body}`);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(newest.title, { body: newest.body, tag: newest.id });
    }
  }, [data.notifications]);

  useEffect(() => {
    const currentIds = new Set(incomingContactRequests.map((request) => request.id));
    if (!seenContactRequestIdsRef.current) {
      seenContactRequestIdsRef.current = currentIds;
      return;
    }

    const newest = incomingContactRequests.find((request) => !seenContactRequestIdsRef.current?.has(request.id));
    incomingContactRequests.forEach((request) => seenContactRequestIdsRef.current?.add(request.id));
    if (newest) {
      const name = newest.user.display_name || newest.user.username || newest.user.email || "Một người dùng";
      setToast(`${name} vừa gửi lời mời kết bạn.`);
    }
  }, [incomingContactRequests]);

  useEffect(() => {
    if (!data.workspaceId || typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(`vpsttt:chat-preferences:${data.workspaceId}`);
      if (!stored) {
        setFavoriteChatIds(new Set());
        setManuallyUnreadChatIds(new Set());
        return;
      }
      const preferences = JSON.parse(stored) as { favorites?: string[]; unread?: string[] };
      setFavoriteChatIds(new Set(preferences.favorites ?? []));
      setManuallyUnreadChatIds(new Set(preferences.unread ?? []));
    } catch {
      setFavoriteChatIds(new Set());
      setManuallyUnreadChatIds(new Set());
    }
  }, [data.workspaceId]);

  useEffect(() => {
    setLocallyReadChatIds((current) => {
      const next = new Set(current);
      let changed = false;
      for (const chatId of current) {
        const channel = data.channels.find((item) => item.id === chatId);
        const conversation = data.directConversations.find((item) => item.id === chatId);
        if ((channel && channel.unreadCount === 0) || (conversation && !conversation.unreadCount)) {
          next.delete(chatId);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [data.channels, data.directConversations]);
  const selectedChatChannel = useMemo(() => {
    if (!data.selectedChannelWithMessages) {
      return null;
    }
    const directConversation = data.directConversations.find(
      (conversation) => conversation.id === data.selectedChannelWithMessages?.id
    );
    if (!directConversation) {
      return {
        ...data.selectedChannelWithMessages,
        memberCount: selectedChannelMembersQuery.data ? selectedChannelMembers.length : data.selectedChannelWithMessages.memberCount
      };
    }
    return {
      ...data.selectedChannelWithMessages,
      description: "Tin nhắn riêng",
      memberCount: 2,
      name: directConversation.user.name
    };
  }, [data.directConversations, data.selectedChannelWithMessages, selectedChannelMembers, selectedChannelMembersQuery.data]);
  const composerPlaceholder = botComposerPlaceholder(selectedChatChannel);

  const selectedRailLabel = railItems.find((item) => item.id === activeRailItem)?.label ?? "Tin nhắn";
  const panelTitle =
    activeRailItem === "contacts"
      ? "Bạn bè"
      : activeRailItem === "channels"
        ? "Kênh"
        : activeRailItem === "departments"
          ? "Phòng ban"
        : activeRailItem === "files"
          ? "Tệp tin"
          : activeRailItem === "settings"
            ? "Cài đặt"
            : "Tin nhắn";

  async function handleCreateChannel(input: CreateChannelPayload) {
    if (!canCreateChannel) {
      setToast("Tài khoản hiện tại chưa có quyền tạo kênh.");
      return;
    }

    data.createChannelMutation.mutate(input, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không tạo được kênh."),
      onSuccess: () => {
        setChannelFilter("all");
        setIsCreateChannelOpen(false);
        setToast("Đã tạo kênh mới.");
      }
    });
  }

  function handleChannelSelect(channelId: string) {
    const channel = data.channels.find((item) => item.id === channelId);
    if (channel?.privateSessionMode) {
      data.openPrivateSessionMutation.mutate(channelId, {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không mở được phiên làm việc riêng tư.")
      });
      return;
    }
    setMessageSidebarTab(data.directConversations.some((conversation) => conversation.id === channelId) ? "conversations" : "channels");
    data.setSelectedChannelId(channelId);
    if (manuallyUnreadChatIds.has(channelId)) {
      const nextUnread = new Set(manuallyUnreadChatIds);
      nextUnread.delete(channelId);
      setManuallyUnreadChatIds(nextUnread);
      persistChatPreferences(favoriteChatIds, nextUnread);
    }
    setThreadMessageId(null);
    setIsMessageSearchOpen(false);
    setMessageSearchQuery("");
    setMessageSearchChannelId("");
    setMessageSearchSenderId("");
    setMessageSearchKind("");
    setMessageSearchDateFrom("");
    setMessageSearchDateTo("");
    setActiveRailItem("messages");
  }

  function handleMessageSidebarTabChange(tab: MessageSidebarTab) {
    setMessageSidebarTab(tab);
    setSearchQuery("");
    setChannelFilter("all");
  }

  function handleRailSelect(itemId: RailItemId) {
    if (!canAccessRailItem(itemId, data.can)) {
      setToast("Tài khoản của bạn chỉ được sử dụng các chức năng trao đổi trong workspace.");
      return;
    }
    setActiveRailItem(itemId);
    data.setWorkspaceSection(itemId === "messages" ? undefined : itemId);
  }

  function handleToggleMessageSearch() {
    setIsMessageSearchOpen((current) => {
      if (current) {
        setMessageSearchQuery("");
        setMessageSearchChannelId("");
        setMessageSearchSenderId("");
        setMessageSearchKind("");
        setMessageSearchDateFrom("");
        setMessageSearchDateTo("");
      }
      return !current;
    });
  }

  function handleToggleNotifications() {
    const willOpen = !isNotificationsOpen;
    setIsNotificationsOpen(willOpen);
    if (willOpen && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  function handleCloseMessageSearch() {
    setIsMessageSearchOpen(false);
    setMessageSearchQuery("");
    setMessageSearchChannelId("");
    setMessageSearchSenderId("");
    setMessageSearchKind("");
    setMessageSearchDateFrom("");
    setMessageSearchDateTo("");
  }

  function persistChatPreferences(favorites: Set<string>, unread: Set<string>) {
    if (!data.workspaceId || typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      `vpsttt:chat-preferences:${data.workspaceId}`,
      JSON.stringify({ favorites: [...favorites], unread: [...unread] })
    );
  }

  function handleToggleFavorite(chatId: string) {
    const next = new Set(favoriteChatIds);
    const serverFavorite = data.channels.find((channel) => channel.id === chatId)?.isFavorite ?? false;
    const isCurrentlyFavorite = serverFavorite || next.has(chatId);
    if (isCurrentlyFavorite) {
      next.delete(chatId);
    } else {
      next.add(chatId);
    }
    setFavoriteChatIds(next);
    persistChatPreferences(next, manuallyUnreadChatIds);
    setToast(isCurrentlyFavorite ? "Đã bỏ khỏi danh sách yêu thích." : "Đã thêm vào danh sách yêu thích.");
  }

  function handleMarkUnread(chatId: string) {
    const next = new Set(manuallyUnreadChatIds).add(chatId);
    setManuallyUnreadChatIds(next);
    setLocallyReadChatIds((current) => {
      const updated = new Set(current);
      updated.delete(chatId);
      return updated;
    });
    persistChatPreferences(favoriteChatIds, next);
    setToast("Đã đánh dấu cuộc trò chuyện là chưa đọc.");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length && !canUploadFile) {
      setToast("Tài khoản hiện tại chưa có quyền upload file.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (files.length) {
      uploadQueue.addFiles(files);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function handleComposerPaste(event: ClipboardEvent<HTMLInputElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item, index) => {
        const file = item.getAsFile();
        if (!file) {
          return null;
        }

        if (file.name) {
          return file;
        }

        const extension = file.type.includes("jpeg") ? "jpg" : file.type.includes("webp") ? "webp" : "png";
        return new File([file], `anh-dan-${Date.now()}-${index}.${extension}`, {
          type: file.type || "image/png"
        });
      })
      .filter(Boolean) as File[];

    if (!imageFiles.length) {
      return;
    }

    event.preventDefault();

    if (!canUploadFile) {
      setToast("Tài khoản hiện tại chưa có quyền gửi ảnh.");
      return;
    }

    uploadQueue.addFiles(imageFiles);
    setToast(`${imageFiles.length} ảnh đã được thêm vào tin nhắn.`);
  }

  function handleEmojiSelect(emoji: string) {
    handleDraftChange(`${draft}${emoji}`);
    setIsEmojiPickerOpen(false);
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    const isTyping = Boolean(value.trim());
    if (isTyping && !typingPublishedRef.current) {
      data.realtime.publishTyping(true);
      typingPublishedRef.current = true;
    } else if (!isTyping && typingPublishedRef.current) {
      data.realtime.publishTyping(false);
      typingPublishedRef.current = false;
    }
    if (isTyping) {
      typingStopTimerRef.current = setTimeout(() => {
        data.realtime.publishTyping(false);
        typingPublishedRef.current = false;
        typingStopTimerRef.current = null;
      }, 1_400);
    }
  }

  function handleContactPrimaryAction(contact: ContactResult) {
    if (contact.contactStatus === "none" || contact.contactStatus === "rejected") {
      data.sendContactRequestMutation.mutate(contact.userId, {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không gửi được lời mời kết bạn."),
        onSuccess: () => setToast(`Đã gửi lời mời kết bạn đến ${contact.name}.`)
      });
      return;
    }

    if (contact.contactStatus === "pending" && contact.contactDirection === "incoming" && contact.contactRequestId) {
      data.acceptContactRequestMutation.mutate(contact.contactRequestId, {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không đồng ý được lời mời kết bạn."),
        onSuccess: () => {
          setToast(`Bạn và ${contact.name} đã là bạn bè.`);
          void openAcceptedContact(contact);
        }
      });
      return;
    }

    if (contact.contactStatus === "pending") {
      setToast("Lời mời kết bạn đang chờ phản hồi.");
      return;
    }

    void openAcceptedContact(contact);
  }

  function handleContactSecondaryAction(contact: ContactResult) {
    if (contact.contactStatus !== "pending" || !contact.contactRequestId) {
      return;
    }

    if (contact.contactDirection === "incoming") {
      data.rejectContactRequestMutation.mutate(contact.contactRequestId, {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không từ chối được lời mời kết bạn."),
        onSuccess: () => setToast(`Đã từ chối lời mời từ ${contact.name}.`)
      });
      return;
    }

    data.cancelContactRequestMutation.mutate(contact.contactRequestId, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không hủy được lời mời kết bạn."),
      onSuccess: () => setToast(`Đã hủy lời mời kết bạn đến ${contact.name}.`)
    });
  }

  async function openAcceptedContact(contact: ContactResult) {
    if (!data.workspaceId) {
      setToast(
        data.workspacesQuery.isLoading || data.workspacesQuery.isFetching
          ? "Đang khởi tạo workspace cho tài khoản, vui lòng chờ trong giây lát."
          : "Workspace mặc định chưa sẵn sàng. Vui lòng tải lại trang để hệ thống tự đồng bộ."
      );
      return;
    }

    handleStartDirectConversation(contact.userId);
  }

  async function handleToggleRecording() {
    if (isRecording) {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    if (!canUploadFile) {
      setToast("Tài khoản hiện tại chưa có quyền upload file ghi âm.");
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setToast("Trình duyệt hiện tại chưa hỗ trợ ghi âm.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      const preferredMimeType = preferredVoiceMimeType();
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { audioBitsPerSecond: 64_000, mimeType: preferredMimeType })
        : new MediaRecorder(stream, { audioBitsPerSecond: 64_000 });
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || preferredMimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const extension = voiceFileExtension(mimeType);
        const durationSeconds = Math.max(
          1,
          Math.round((Date.now() - (recordingStartedAtRef.current ?? Date.now())) / 1000)
        );
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: mimeType });
        if (file.size > 0) {
          uploadQueue.addVoice(file, durationSeconds);
          setToast("Đã ghi âm xong. Nhấn Gửi để gửi tin nhắn thoại.");
        } else {
          setToast("Không thu được âm thanh. Vui lòng kiểm tra micro và thử lại.");
        }
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recordingStartedAtRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setRecordingSeconds(0);
        setIsRecording(false);
      };

      recorder.onerror = () => {
        setToast("Ghi âm bị gián đoạn. Vui lòng thử lại.");
      };

      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không bật được micro.");
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      recordingStartedAtRef.current = null;
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }

  useEffect(() => {
    if (!isRecording) {
      return;
    }
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && recordingSeconds >= 300 && mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setToast("Tin nhắn thoại đã đạt giới hạn 5 phút và được dừng tự động.");
    }
  }, [isRecording, recordingSeconds]);

  useEffect(
    () => () => {
      if (typingStopTimerRef.current) {
        clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      data.realtime.publishTyping(false);
      typingPublishedRef.current = false;
    },
    [data.realtime.publishTyping]
  );

  function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();

    if (!body && !queuedUploads.length) {
      return;
    }

    if (!canUseComposer) {
      setToast(queuedUploads.length ? "Bạn cần quyền gửi tin nhắn và upload file." : "Bạn cần quyền gửi tin nhắn.");
      return;
    }

    data.sendMessageMutation.mutate(
      { body, uploads: queuedUploads },
      {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không gửi được nội dung."),
        onSuccess: (result) => {
          setDraft("");
          data.realtime.publishTyping(false);
          typingPublishedRef.current = false;
          uploadQueue.clearAttached();
          if (result.failedUploadNames.length) {
            setToast(`Tin nhắn đã gửi, ${result.failedUploadNames.length} file cần thử lại.`);
          }
        }
      }
    );
  }

  function handleDownload(file: FileItem) {
    data.downloadMutation.mutate(file, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không tải được file."),
      onSuccess: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  function handleDownloadAttachment(attachment: MessageAttachmentItem) {
    handleDownload({
      id: attachment.fileId,
      mimeType: attachment.mimeType,
      name: attachment.name,
      size: attachment.size ?? "",
      tone: attachment.tone,
      updatedAt: ""
    });
  }

  function handleOpenNotification(notification: NotificationItem) {
    data.markNotificationReadMutation.mutate(notification.id, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không đánh dấu được thông báo.")
    });

    if (notification.channelId) {
      data.setSelectedChannelId(notification.channelId);
      setActiveRailItem("messages");
    }

    if (notification.messageId) {
      setThreadMessageId(notification.messageId);
    }

    setIsNotificationsOpen(false);
  }

  function handleMarkAllNotificationsRead() {
    data.markAllNotificationsReadMutation.mutate(undefined, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không đánh dấu được thông báo."),
      onSuccess: () => setToast("Đã đánh dấu tất cả thông báo là đã đọc.")
    });
  }

  function handleAcceptIncomingRequest(request: ContactRequest) {
    data.acceptContactRequestMutation.mutate(request.id, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không đồng ý được lời mời kết bạn."),
      onSuccess: () => {
        setToast(`Bạn và ${request.user.display_name || request.user.username} đã là bạn bè.`);
        setIsNotificationsOpen(false);
        void openAcceptedContact(contactResultFromRequest(request, data));
      }
    });
  }

  function handleRejectIncomingRequest(request: ContactRequest) {
    data.rejectContactRequestMutation.mutate(request.id, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không từ chối được lời mời kết bạn."),
      onSuccess: () => setToast(`Đã từ chối lời mời từ ${request.user.display_name || request.user.username}.`)
    });
  }

  function handleStartDirectConversation(userId: string, workspaceId?: string) {
    if (!userId) {
      return;
    }

    data.createDirectConversationMutation.mutate(workspaceId ? { participantId: userId, workspaceId } : userId, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không tạo được hội thoại riêng."),
      onSuccess: (conversation) => {
        const channelId = conversation.channel_id ?? conversation.id;
        if (channelId) {
          data.setSelectedChannelId(channelId, workspaceId, "direct");
        }
        setThreadMessageId(null);
        setActiveRailItem("messages");
        setToast("Đã mở hội thoại riêng.");
      }
    });
  }

  function handleStartEdit(message: ChatMessage) {
    if (!message.canEdit) {
      setToast("Bạn không có quyền sửa tin nhắn này.");
      return;
    }

    setEditingMessageId(message.id);
    setEditingBody(message.body);
  }

  function handleSubmitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = editingBody.trim();

    if (!editingMessageId || !body) {
      return;
    }

    data.editMessageMutation.mutate(
      {
        body,
        messageId: editingMessageId
      },
      {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không sửa được tin nhắn."),
        onSuccess: () => {
          setEditingBody("");
          setEditingMessageId(null);
          setToast("Đã cập nhật tin nhắn.");
        }
      }
    );
  }

  function handleDeleteMessage(message: ChatMessage) {
    if (!message.canDelete) {
      setToast("Bạn không có quyền xóa tin nhắn này.");
      return;
    }

    data.deleteMessageMutation.mutate(
      { messageId: message.id },
      {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không xóa được tin nhắn."),
        onSuccess: () => {
          if (threadMessageId === message.id) {
            setThreadMessageId(null);
          }
          setToast("Đã xóa tin nhắn.");
        }
      }
    );
  }

  function handleToggleReaction(message: ChatMessage, emoji: string) {
    const reaction = message.reactions?.find((item) => item.emoji === emoji);

    data.toggleReactionMutation.mutate(
      {
        emoji,
        messageId: message.id,
        reactedByMe: reaction?.reactedByMe
      },
      {
        onError: (error) => setToast(error instanceof Error ? error.message : "Không cập nhật được reaction.")
      }
    );
  }

  function handleToggleMessagePin(message: ChatMessage, isPinned: boolean) {
    const mutation = isPinned ? data.unpinMessageMutation : data.pinMessageMutation;

    mutation.mutate(message.id, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không cập nhật được tin ghim."),
      onSuccess: () => setToast(isPinned ? "Đã bỏ ghim tin nhắn." : "Đã ghim tin nhắn.")
    });
  }

  function handleOpenThread(messageId: string) {
    setThreadMessageId(messageId);
  }

  function handleLoadOlderMessages() {
    data.loadOlderMessages().catch((error: unknown) =>
      setToast(error instanceof Error ? error.message : "Không tải được tin nhắn cũ.")
    );
  }

  return (
    <main
      className={`chat-app-shell chat-app-shell--zalo${activeRailItem === "messages" ? "" : " chat-app-shell--section"}${activeRailItem === "messages" && data.selectedChannel && !data.canAccessSelectedChannel ? " chat-app-shell--no-detail" : ""}${activeRailItem === "messages" && isDetailPanelOpen ? " chat-app-shell--detail-open" : " chat-app-shell--detail-closed"}`}
      aria-label="Màn hình chat WebTui"
    >
      <NavigationRail
        activeId={activeRailItem}
        ariaLabel="Điều hướng chính"
        brandLogoAlt="WebTui Chat"
        brandLogoSrc="/brand/logo_webtui.png"
        items={visibleRailItems}
        onSelect={(itemId) => handleRailSelect(itemId as RailItemId)}
        profile={currentUser}
      />

      <section className="channel-panel" aria-label="Kênh và hội thoại">
        <header className="panel-heading">
          <div>
            <p>{panelTitle}</p>
          </div>
          <div className="panel-heading__actions">
            <Tooltip label="Thông báo">
              <Button
                aria-label="Thông báo"
                className={isNotificationsOpen ? "notification-button notification-button--active" : "notification-button"}
                onClick={handleToggleNotifications}
                size="sm"
                variant="icon"
              >
                <Bell size={18} />
                {notificationBadgeCount ? <span>{notificationBadgeCount}</span> : null}
              </Button>
            </Tooltip>
            <Tooltip label={canCreateChannel ? "Tạo kênh" : "Thiếu quyền tạo kênh"}>
              <Button
                aria-label="Tạo kênh"
                disabled={!data.workspaceId || !canCreateChannel || data.createChannelMutation.isPending}
                onClick={() => setIsCreateChannelOpen((current) => !current)}
                size="sm"
                variant="icon"
              >
                <Plus size={18} />
              </Button>
            </Tooltip>
            <Tooltip label={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}>
              <Button
                aria-label={theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
                onClick={toggleTheme}
                size="sm"
                variant="icon"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </Button>
            </Tooltip>
            <Tooltip label="Đăng xuất">
              <Button aria-label="Đăng xuất" onClick={logout} size="sm" variant="icon">
                <LogOut size={18} />
              </Button>
            </Tooltip>
          </div>
        </header>

        {isNotificationsOpen ? (
          <NotificationDropdown
            contactRequests={incomingContactRequests}
            isLoading={data.notificationsQuery.isLoading || data.contactRequestsQuery.isLoading}
            isMutatingContactRequest={data.acceptContactRequestMutation.isPending || data.rejectContactRequestMutation.isPending}
            isMarkingAllRead={data.markAllNotificationsReadMutation.isPending}
            notifications={data.notifications}
            onAcceptContactRequest={handleAcceptIncomingRequest}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onOpenNotification={handleOpenNotification}
            onOpenContacts={() => {
              handleRailSelect("contacts");
              setIsNotificationsOpen(false);
            }}
            onRejectContactRequest={handleRejectIncomingRequest}
          />
        ) : null}

        {isCreateChannelOpen ? (
          <CreateChannelForm
            isPending={data.createChannelMutation.isPending}
            onCancel={() => setIsCreateChannelOpen(false)}
            onSubmit={handleCreateChannel}
          />
        ) : null}

        {activeRailItem === "messages" ? (
          <>
            <div className="message-sidebar-tabs" aria-label="Loại danh sách tin nhắn" role="tablist">
              <button
                aria-controls="message-sidebar-conversations"
                aria-selected={messageSidebarTab === "conversations"}
                className={messageSidebarTab === "conversations" ? "message-sidebar-tab message-sidebar-tab--active" : "message-sidebar-tab"}
                onClick={() => handleMessageSidebarTabChange("conversations")}
                role="tab"
                type="button"
              >
                <MessageCircle size={17} />
                <span>Hội thoại</span>
                <b className={sidebarConversationUnreadCount ? "message-sidebar-tab__count message-sidebar-tab__count--unread" : "message-sidebar-tab__count"}>
                  {sidebarConversationUnreadCount || data.directConversations.length}
                </b>
              </button>
              <button
                aria-controls="message-sidebar-channels"
                aria-selected={messageSidebarTab === "channels"}
                className={messageSidebarTab === "channels" ? "message-sidebar-tab message-sidebar-tab--active" : "message-sidebar-tab"}
                onClick={() => handleMessageSidebarTabChange("channels")}
                role="tab"
                type="button"
              >
                <Hash size={17} />
                <span>Kênh & Bot</span>
                <b className={sidebarChannelUnreadCount ? "message-sidebar-tab__count message-sidebar-tab__count--unread" : "message-sidebar-tab__count"}>
                  {sidebarChannelUnreadCount || data.channels.length}
                </b>
              </button>
            </div>

            <div className="channel-search">
              <Input
                aria-label={messageSidebarTab === "conversations" ? "Tìm kiếm hội thoại" : "Tìm kiếm kênh hoặc bot"}
                leftAddon={<Search size={17} />}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={messageSidebarTab === "conversations" ? "Tìm hội thoại..." : "Tìm kênh hoặc bot..."}
                value={searchQuery}
              />
            </div>

            <SegmentedControl
              aria-label="Bộ lọc hội thoại"
              className="channel-filter-tabs"
              onValueChange={setChannelFilter}
              options={channelFilters}
              value={channelFilter}
            />

            {messageSidebarTab === "conversations" ? (
              <div className="message-sidebar-tab-content" id="message-sidebar-conversations" role="tabpanel">
                <div className="list-section conversations">
                  <span className="section-label">Hội thoại gần đây</span>
                  {data.directConversationsQuery.isLoading ? (
                    <PanelSkeleton />
                  ) : filteredConversations.length ? (
                    filteredConversations.map((item) => {
                      const unreadCount = effectiveUnreadCount(item.id, item.unreadCount);
                      return (
                        <button
                          className={`conversation-row${item.id === data.selectedChannelId ? " conversation-row--active" : ""}${unreadCount ? " conversation-row--unread" : ""}`}
                          key={item.id}
                          onClick={() => handleChannelSelect(item.id)}
                          type="button"
                        >
                          <Avatar name={item.user.name} size="md" src={item.user.avatarUrl} status={item.user.status} />
                          <span className="conversation-row__body">
                            <strong>{item.user.name}</strong>
                            <small>{item.lastMessage}</small>
                          </span>
                          <span className="conversation-row__meta">
                            <time>{item.relativeTime}</time>
                            {unreadCount ? <Badge className="conversation-row__unread-badge" tone="red">{unreadCount}</Badge> : null}
                            <Tooltip label={isFavoriteChat(item.id) ? "Bỏ yêu thích" : "Yêu thích"}>
                              <span
                                aria-label={isFavoriteChat(item.id) ? "Bỏ yêu thích" : "Yêu thích"}
                                className={isFavoriteChat(item.id) ? "pin-action pin-action--active" : "pin-action"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleFavorite(item.id);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleToggleFavorite(item.id);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <Star size={15} />
                              </span>
                            </Tooltip>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="conversation-empty">
                      <EmptyState
                        description={channelFilter === "all" ? "Tìm bạn bè, gửi lời mời và bắt đầu nhắn tin riêng như Zalo." : "Không có hội thoại nào phù hợp với bộ lọc hiện tại."}
                        title={channelFilter === "unread" ? "Không có tin chưa đọc" : channelFilter === "favorite" ? "Chưa có hội thoại yêu thích" : "Chưa có hội thoại"}
                      />
                      {channelFilter === "all" ? (
                        <Button onClick={() => handleRailSelect("contacts")} size="sm" variant="secondary">
                          <Users size={15} />
                          Tìm bạn bè
                        </Button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="message-sidebar-tab-content" id="message-sidebar-channels" role="tabpanel">
                <div className="list-section channels-section">
                  <span className="section-label">Kênh của bạn</span>
                  {data.workspacesQuery.isLoading || data.channelsQuery.isLoading ? (
                    <PanelSkeleton />
                  ) : sidebarChannels.length ? (
                    sidebarChannels.map((channel) => {
                      const unreadCount = effectiveUnreadCount(channel.id, channel.unreadCount);
                      return (
                        <button
                          className={`channel-row${channel.id === data.selectedChannelId ? " channel-row--active" : ""}${unreadCount ? " channel-row--unread" : ""}`}
                          key={channel.id}
                          onClick={() => handleChannelSelect(channel.id)}
                          type="button"
                        >
                          <span className={`channel-hash channel-hash--${channel.tone}`} style={channelHashStyle(channel)}>#</span>
                          <span className="channel-row__body">
                            <strong>{channel.name}</strong>
                            <small>{channel.description}</small>
                          </span>
                          <span className="channel-row__meta">
                            <time>{channel.relativeTime}</time>
                            {unreadCount ? <Badge className="conversation-row__unread-badge" tone="red">{unreadCount}</Badge> : null}
                            <Tooltip label={isFavoriteChat(channel.id, channel.isFavorite) ? "Bỏ yêu thích" : "Yêu thích"}>
                              <span
                                aria-label={isFavoriteChat(channel.id, channel.isFavorite) ? "Bỏ yêu thích" : "Yêu thích"}
                                className={isFavoriteChat(channel.id, channel.isFavorite) ? "pin-action pin-action--active" : "pin-action"}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleFavorite(channel.id);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    handleToggleFavorite(channel.id);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <Star size={15} />
                              </span>
                            </Tooltip>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <EmptyState
                      description={channelFilter === "all" ? "Kênh dùng cho nhóm, bot và thông báo chung." : "Không có kênh nào phù hợp với bộ lọc hiện tại."}
                      title={channelFilter === "unread" ? "Không có kênh chưa đọc" : channelFilter === "favorite" ? "Chưa có kênh yêu thích" : "Chưa có kênh"}
                    />
                  )}
                </div>

                {channelFilter === "all" && data.can("bot.manage") ? (
                  <div className="list-section sidebar-bots-section">
                    <span className="section-label">Bot workspace</span>
                    {sidebarBotsQuery.isLoading ? (
                      <PanelSkeleton />
                    ) : sidebarBots.length ? (
                      sidebarBots.map((bot) => (
                        <button className="sidebar-bot-row" key={bot.id} onClick={() => handleRailSelect("bots")} type="button">
                          <span className="sidebar-bot-row__avatar">
                            {bot.avatar_url ? <img alt="" src={bot.avatar_url} /> : <Bot size={20} />}
                            <i />
                          </span>
                          <span className="sidebar-bot-row__body">
                            <strong>{bot.name}</strong>
                            <small>{bot.description || `@${bot.slug}`}</small>
                          </span>
                          <span className="sidebar-bot-row__status">{bot.status === "active" ? "Bật" : "Tắt"}</span>
                        </button>
                      ))
                    ) : (
                      <button className="sidebar-bot-row sidebar-bot-row--module" onClick={() => handleRailSelect("bots")} type="button">
                        <span className="sidebar-bot-row__avatar"><Bot size={20} /></span>
                        <span className="sidebar-bot-row__body">
                          <strong>Quản lý bot</strong>
                          <small>Tạo bot đầu tiên cho workspace</small>
                        </span>
                        <span className="sidebar-bot-row__arrow">›</span>
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <SidebarContextPanel
            onOpenMessages={() => handleRailSelect("messages")}
          />
        )}
      </section>

      <section
        className="chat-main"
        aria-label={
          activeRailItem === "messages"
            ? data.selectedChannelWithMessages
              ? `Nội dung kênh ${data.selectedChannelWithMessages.name}`
              : "Nội dung kênh"
            : selectedRailLabel
        }
      >
        {activeRailItem !== "messages" ? (
          <WorkspaceSectionPage
            activeRailItem={activeRailItem}
            canManageBots={data.can("bot.manage")}
            canManageCronjobs={data.can("cronjob.manage")}
            canUseOrderBot={data.can("order.view")}
            canUseOrderBilling={data.can("order.billing")}
            canManageWebhooks={data.can("webhook.manage")}
            channels={data.channels.filter((channel) => channel.type !== "direct")}
            contacts={contactResults}
            currentUser={currentUser}
            departments={data.departments}
            files={data.files}
            friendSearchQuery={friendSearchQuery}
            isCreatingDirectConversation={
              data.createDirectConversationMutation.isPending ||
              data.sendContactRequestMutation.isPending ||
              data.acceptContactRequestMutation.isPending ||
              data.rejectContactRequestMutation.isPending ||
              data.cancelContactRequestMutation.isPending
            }
            isLoadingChannels={data.channelsQuery.isLoading}
            isLoadingContacts={
              data.contactsQuery.isLoading ||
              data.contactRequestsQuery.isLoading ||
              data.membersQuery.isLoading ||
              data.searchUsersQuery.isFetching
            }
            isLoadingFiles={data.filesQuery.isLoading}
            isLoadingDepartments={data.permissionsQuery.isLoading || data.departmentsQuery.isLoading}
            isMutatingChannelMembership={
              data.requestChannelJoinMutation.isPending ||
              data.inviteChannelMemberMutation.isPending ||
              data.approveChannelJoinMutation.isPending ||
              data.rejectChannelJoinMutation.isPending
            }
            joinRequestsByChannelId={data.joinRequestsByChannelId}
            onChannelSelect={handleChannelSelect}
            onApproveChannelJoin={(channelId, userId) =>
              data.approveChannelJoinMutation.mutate({ channelId, userId }, {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không phê duyệt được yêu cầu."),
                onSuccess: () => setToast("Đã phê duyệt thành viên vào kênh.")
              })
            }
            onDownloadFile={handleDownload}
            onInviteChannelMember={(channelId, userId) =>
              data.inviteChannelMemberMutation.mutate({ channelId, userId }, {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không mời được thành viên."),
                onSuccess: () => setToast("Đã thêm thành viên vào kênh.")
              })
            }
            onRejectChannelJoin={(channelId, userId) =>
              data.rejectChannelJoinMutation.mutate({ channelId, userId }, {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không từ chối được yêu cầu."),
                onSuccess: () => setToast("Đã từ chối yêu cầu tham gia.")
              })
            }
            onRequestChannelJoin={(channelId) =>
              data.requestChannelJoinMutation.mutate(channelId, {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không gửi được yêu cầu tham gia."),
                onSuccess: () => setToast("Đã gửi yêu cầu tham gia kênh.")
              })
            }
            onCreateDepartment={(input) =>
              data.createDepartmentMutation.mutate(input, {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không tạo được phòng ban."),
                onSuccess: () => setToast("Đã tạo phòng ban mới.")
              })
            }
            onFriendSearchChange={setFriendSearchQuery}
            onProfileSubmit={(input) =>
              data.updateProfileMutation.mutate(input, {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không cập nhật được hồ sơ."),
                onSuccess: () => setToast("Đã cập nhật hồ sơ.")
              })
            }
            onSecondaryContactAction={handleContactSecondaryAction}
            onStartConversation={handleContactPrimaryAction}
            onThemeToggle={toggleTheme}
            theme={theme}
            canManageDepartments={data.can("workspace.manage")}
            isCreatingDepartment={data.createDepartmentMutation.isPending}
            isUpdatingProfile={data.updateProfileMutation.isPending}
            workspaceId={data.workspaceId}
            workspaceMembers={data.members}
          />
        ) : data.workspacesQuery.isError ? (
          <ErrorState
            action={
              <Button onClick={() => void data.workspacesQuery.refetch()} size="sm" variant="secondary">
                Thử tải lại
              </Button>
            }
            description="Không thể kết nối dữ liệu tài khoản. Hãy kiểm tra mạng và thử lại."
            title="Không tải được dữ liệu chat"
          />
        ) : selectedChatChannel && !data.canAccessSelectedChannel ? (
          <ChannelAccessView
            channel={selectedChatChannel}
            isPending={data.requestChannelJoinMutation.isPending}
            onRequestJoin={() =>
              data.requestChannelJoinMutation.mutate(selectedChatChannel.id, {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không gửi được yêu cầu tham gia."),
                onSuccess: () => setToast("Đã gửi yêu cầu. Vui lòng chờ chủ kênh phê duyệt.")
              })
            }
          />
        ) : selectedChatChannel ? (
          <>
            <ChatHeader
              channel={selectedChatChannel}
              isDetailPanelOpen={isDetailPanelOpen}
              isFavorite={isFavoriteChat(selectedChatChannel.id, selectedChatChannel.isFavorite)}
              isMembersLoading={selectedChannelMembersQuery.isLoading}
              isSearchOpen={isMessageSearchOpen}
              members={selectedChannelMembers}
              onMarkUnread={() => handleMarkUnread(selectedChatChannel.id)}
              onToggleDetailPanel={() => setIsDetailPanelOpen((current) => !current)}
              onToggleFavorite={() => handleToggleFavorite(selectedChatChannel.id)}
              onToggleSearch={handleToggleMessageSearch}
            />
            {isMessageSearchOpen ? (
              <div className="message-toolbar">
                <div className="message-toolbar__search">
                  <Input
                    aria-label="Tìm tin nhắn"
                    autoFocus
                    leftAddon={<Search size={17} />}
                    onChange={(event) => setMessageSearchQuery(event.target.value)}
                    placeholder="Tìm tin nhắn..."
                    value={messageSearchQuery}
                  />
                  <div className="message-search-filters">
                    <select aria-label="Lọc theo kênh" onChange={(event) => setMessageSearchChannelId(event.target.value)} value={messageSearchChannelId}>
                      <option value="">Tất cả kênh</option>
                      {chatTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                    </select>
                    <select aria-label="Lọc theo người gửi" onChange={(event) => setMessageSearchSenderId(event.target.value)} value={messageSearchSenderId}>
                      <option value="">Tất cả người gửi</option>
                      {data.members.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.username || member.email}</option>)}
                    </select>
                    <select aria-label="Lọc theo loại nội dung" onChange={(event) => setMessageSearchKind(event.target.value)} value={messageSearchKind}>
                      <option value="">Mọi nội dung</option>
                      <option value="text">Văn bản</option>
                      <option value="file">File</option>
                      <option value="system">Hệ thống</option>
                      <option value="bot">Bot</option>
                      <option value="event">Sự kiện</option>
                    </select>
                    <label>Từ ngày<input onChange={(event) => setMessageSearchDateFrom(event.target.value)} type="date" value={messageSearchDateFrom} /></label>
                    <label>Đến ngày<input onChange={(event) => setMessageSearchDateTo(event.target.value)} type="date" value={messageSearchDateTo} /></label>
                  </div>
                </div>
                <Tooltip label="Đóng tìm kiếm">
                  <Button aria-label="Đóng tìm kiếm" onClick={handleCloseMessageSearch} type="button" variant="icon">
                    <X size={18} />
                  </Button>
                </Tooltip>
              </div>
            ) : null}
            {data.messagesQuery.isError ? (
              <ErrorState
                action={
                  <Button onClick={() => void data.messagesQuery.refetch()} size="sm" variant="secondary">
                    Thử tải lại
                  </Button>
                }
                className="chat-load-error"
                description="Kết nối có thể bị gián đoạn hoặc phiên truy cập vừa hết hạn."
                title="Không tải được tin nhắn"
              />
            ) : data.messagesQuery.isLoading ? (
              <TimelineSkeleton />
            ) : (
              <MessageTimeline
                currentUserId={currentUser.id}
                editingBody={editingBody}
                editingMessageId={editingMessageId}
                hasOlderMessages={data.hasOlderMessages}
                isEditingPending={data.editMessageMutation.isPending}
                isLoadingOlderMessages={data.isLoadingOlderMessages}
                messages={selectedChatChannel.messages}
                onCancelEdit={() => {
                  setEditingBody("");
                  setEditingMessageId(null);
                }}
                onChangeEditingBody={setEditingBody}
                onDeleteMessage={handleDeleteMessage}
                onDownloadAttachment={handleDownloadAttachment}
                onForwardMessage={setForwardingMessageId}
                onResolveAttachment={data.downloadAttachment}
                onLoadOlderMessages={handleLoadOlderMessages}
                onOpenThread={handleOpenThread}
                onSearchResultSelect={(message) => {
                  if (message.rawChannelId && message.rawChannelId !== data.selectedChannelId) {
                    data.setSelectedChannelId(message.rawChannelId);
                  }
                  setThreadMessageId(message.id);
                  handleCloseMessageSearch();
                }}
                onStartEdit={handleStartEdit}
                onSubmitEdit={handleSubmitEdit}
                onTogglePin={handleToggleMessagePin}
                onToggleReaction={handleToggleReaction}
                pinnedMessageIds={pinnedMessageIds}
                readMembers={selectedChannelMembers}
                searchQuery={activeMessageSearchQuery}
                searchResults={data.messageSearchResults}
              />
            )}
            {!canSendMessage ? (
              <div className="permission-note">Tài khoản hiện tại chưa có quyền gửi tin nhắn trong cuộc trò chuyện này.</div>
            ) : null}
            <div className="composer-wrap">
              {uploadQueue.items.length ? (
                <UploadQueue
                  disabled={data.sendMessageMutation.isPending}
                  items={uploadQueue.items}
                  onRemove={uploadQueue.remove}
                  onRetry={uploadQueue.retry}
                />
              ) : null}
              {remoteTypingLabel ? <TypingDots label={remoteTypingLabel} /> : null}
              <form className="composer" onSubmit={handleSendMessage}>
                {isRecording ? (
                  <div className="recording-status" role="status">
                    <span /> Đang ghi {formatRecordingTime(recordingSeconds)}
                  </div>
                ) : null}
                <Tooltip className="composer-leading-tooltip" label="Thêm nội dung">
                  <Button aria-label="Thêm nội dung" type="button" variant="icon">
                    <Plus size={20} />
                  </Button>
                </Tooltip>
                <div className="composer-input-group">
                  <input
                    aria-label="Nhập tin nhắn"
                    disabled={data.sendMessageMutation.isPending || !canSendMessage}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    onPaste={handleComposerPaste}
                    placeholder={composerPlaceholder}
                    value={draft}
                  />
                </div>
                <Tooltip label="Biểu cảm">
                  <span className="composer-action-wrap">
                    <Button
                      aria-label="Biểu cảm"
                      onClick={() => setIsEmojiPickerOpen((current) => !current)}
                      type="button"
                      variant="icon"
                    >
                      <Smile size={20} />
                    </Button>
                    {isEmojiPickerOpen ? <EmojiPicker onSelect={handleEmojiSelect} /> : null}
                  </span>
                </Tooltip>
                <Tooltip label={canUploadFile ? "Gửi hình ảnh" : "Thiếu quyền upload ảnh"}>
                  <Button
                    aria-label="Gửi hình ảnh"
                    disabled={data.sendMessageMutation.isPending || !canUploadFile}
                    onClick={() => imageInputRef.current?.click()}
                    type="button"
                    variant="icon"
                  >
                    <ImageIcon size={20} />
                  </Button>
                </Tooltip>
                <Tooltip label={canUploadFile ? "Đính kèm file" : "Thiếu quyền upload file"}>
                  <Button
                    aria-label="Đính kèm file"
                    disabled={data.sendMessageMutation.isPending || !canUploadFile}
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    variant="icon"
                  >
                    <Paperclip size={20} />
                  </Button>
                </Tooltip>
                <Tooltip label={isRecording ? "Dừng ghi âm" : "Gửi tin nhắn thoại"}>
                  <Button
                    aria-label={isRecording ? "Dừng ghi âm" : "Gửi tin nhắn thoại"}
                    className={isRecording ? "record-button record-button--active" : "record-button"}
                    disabled={data.sendMessageMutation.isPending || !canUploadFile}
                    onClick={handleToggleRecording}
                    type="button"
                    variant="icon"
                  >
                    {isRecording ? <StopCircle size={20} /> : <Mic size={20} />}
                  </Button>
                </Tooltip>
                <input className="visually-hidden" multiple onChange={handleFileChange} ref={fileInputRef} type="file" />
                <input
                  accept="image/*"
                  className="visually-hidden"
                  multiple
                  onChange={handleFileChange}
                  ref={imageInputRef}
                  type="file"
                />
                <Button
                  aria-label="Gửi tin nhắn"
                  className="send-button"
                  disabled={data.sendMessageMutation.isPending || !canUseComposer || (!draft.trim() && !queuedUploads.length)}
                  type="submit"
                >
                  <Send size={19} />
                  <span>Gửi</span>
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="chat-empty-state">
            <span>
              <MessageCircle size={36} />
            </span>
            <h2>Chọn một cuộc trò chuyện</h2>
            <p>Chọn hội thoại, kênh hoặc tìm bạn bè để bắt đầu nhắn tin.</p>
          </div>
        )}
      </section>

      {activeRailItem === "messages" && isDetailPanelOpen && (!data.selectedChannel || data.canAccessSelectedChannel) ? (
        <RightDetailPanel
          activeTab={detailTab}
          files={data.files}
          isLoading={data.filesQuery.isLoading}
          isSendingThread={data.sendThreadMessageMutation.isPending}
          isThreadLoading={data.threadQuery.isLoading}
          mediaItems={data.mediaItems}
          onClose={() => setIsDetailPanelOpen(false)}
          onCloseThread={() => setThreadMessageId(null)}
          onFileSelect={handleDownload}
          onResolveMedia={data.downloadAttachment}
          onSendThread={(body) =>
            data.sendThreadMessageMutation.mutate(body, {
              onError: (error) => setToast(error instanceof Error ? error.message : "Không gửi được trả lời."),
              onSuccess: () => setToast("Đã gửi trả lời trong luồng.")
            })
          }
          onTabChange={setDetailTab}
          pinnedMessages={pinnedMessages}
          threadMessages={data.threadMessages}
          threadMessageId={threadMessageId}
        />
      ) : null}

      {forwardingMessageId ? (
        <ForwardMessageDialog
          channels={forwardTargets}
          isPending={data.forwardMessageMutation.isPending}
          onCancel={() => setForwardingMessageId(null)}
          onSubmit={(targetChannelId) =>
            data.forwardMessageMutation.mutate(
              { messageId: forwardingMessageId, targetChannelId },
              {
                onError: (error) => setToast(error instanceof Error ? error.message : "Không chuyển tiếp được tin nhắn."),
                onSuccess: () => {
                  setForwardingMessageId(null);
                  setToast("Đã chuyển tiếp tin nhắn.");
                }
              }
            )
          }
        />
      ) : null}

      {toast ? (
        <div className="toast-stack">
          <Toast tone="success">
            {toast}
            <Button onClick={() => setToast(null)} size="sm" variant="ghost">
              Đóng
            </Button>
          </Toast>
        </div>
      ) : null}
    </main>
  );
}

function SidebarContextPanel({
  onOpenMessages
}: {
  onOpenMessages: () => void;
}) {
  return (
    <div className="sidebar-context-panel">
      <Button onClick={onOpenMessages} size="sm" variant="secondary">
        <MessageCircle size={15} />
        Quay lại tin nhắn
      </Button>
    </div>
  );
}

function WorkspaceSectionPage({
  activeRailItem,
  canManageBots,
  canManageCronjobs,
  canManageDepartments,
  canManageWebhooks,
  canUseOrderBilling,
  canUseOrderBot,
  channels,
  contacts,
  currentUser,
  departments,
  files,
  friendSearchQuery,
  isCreatingDirectConversation,
  isCreatingDepartment,
  isLoadingChannels,
  isLoadingContacts,
  isLoadingDepartments,
  isLoadingFiles,
  isMutatingChannelMembership,
  isUpdatingProfile,
  joinRequestsByChannelId,
  onApproveChannelJoin,
  onChannelSelect,
  onCreateDepartment,
  onDownloadFile,
  onInviteChannelMember,
  onRejectChannelJoin,
  onRequestChannelJoin,
  onFriendSearchChange,
  onProfileSubmit,
  onSecondaryContactAction,
  onStartConversation,
  onThemeToggle,
  theme,
  workspaceId,
  workspaceMembers
}: {
  activeRailItem: RailItemId;
  canManageBots: boolean;
  canManageCronjobs: boolean;
  canManageDepartments: boolean;
  canManageWebhooks: boolean;
  canUseOrderBilling: boolean;
  canUseOrderBot: boolean;
  channels: ChatChannel[];
  contacts: ContactResult[];
  currentUser: ChatUser;
  departments: Department[];
  files: FileItem[];
  friendSearchQuery: string;
  isCreatingDirectConversation: boolean;
  isCreatingDepartment: boolean;
  isLoadingChannels: boolean;
  isLoadingContacts: boolean;
  isLoadingDepartments: boolean;
  isLoadingFiles: boolean;
  isMutatingChannelMembership: boolean;
  isUpdatingProfile: boolean;
  joinRequestsByChannelId: Map<string, ChannelMember[]>;
  onApproveChannelJoin: (channelId: string, userId: string) => void;
  onChannelSelect: (channelId: string) => void;
  onCreateDepartment: (input: CreateDepartmentPayload) => void;
  onDownloadFile: (file: FileItem) => void;
  onInviteChannelMember: (channelId: string, userId: string) => void;
  onRejectChannelJoin: (channelId: string, userId: string) => void;
  onRequestChannelJoin: (channelId: string) => void;
  onFriendSearchChange: (value: string) => void;
  onProfileSubmit: (input: {
    avatar_url?: string | null;
    display_name?: string;
    phone_number?: string | null;
  }) => void;
  onSecondaryContactAction: (contact: ContactResult) => void;
  onStartConversation: (contact: ContactResult) => void;
  onThemeToggle: () => void;
  theme: "dark" | "light";
  workspaceId?: string;
  workspaceMembers: WorkspaceMember[];
}) {
  if (activeRailItem === "contacts") {
    return (
      <ContactsPage
        contacts={contacts}
        isCreatingDirectConversation={isCreatingDirectConversation}
        isLoading={isLoadingContacts}
        onSearchChange={onFriendSearchChange}
        onSecondaryAction={onSecondaryContactAction}
        onStartConversation={onStartConversation}
        query={friendSearchQuery}
        workspaceId={workspaceId}
      />
    );
  }

  if (activeRailItem === "channels") {
    return (
      <ChannelsDirectoryPage
        channels={channels}
        isLoading={isLoadingChannels}
        isMutatingMembership={isMutatingChannelMembership}
        joinRequestsByChannelId={joinRequestsByChannelId}
        onApproveJoin={onApproveChannelJoin}
        onChannelSelect={onChannelSelect}
        onInviteMember={onInviteChannelMember}
        onRejectJoin={onRejectChannelJoin}
        onRequestJoin={onRequestChannelJoin}
        workspaceMembers={workspaceMembers}
      />
    );
  }

  if (activeRailItem === "departments") {
    return (
      <DepartmentsPage
        canManage={canManageDepartments}
        channels={channels}
        departments={departments}
        isCreating={isCreatingDepartment}
        isLoading={isLoadingDepartments}
        onCreate={onCreateDepartment}
        workspaceId={workspaceId}
        workspaceMembers={workspaceMembers}
      />
    );
  }

  if (activeRailItem === "files") {
    return <FilesPage files={files} isLoading={isLoadingFiles} onDownloadFile={onDownloadFile} />;
  }

  if (activeRailItem === "settings") {
    return (
      <SettingsPage
        currentUser={currentUser}
        isUpdatingProfile={isUpdatingProfile}
        onProfileSubmit={onProfileSubmit}
        onThemeToggle={onThemeToggle}
        theme={theme}
      />
    );
  }

  if (activeRailItem === "bots") {
    return (
      <BotsPage
        canBillOrder={canUseOrderBilling}
        canManage={canManageBots}
        canUseOrder={canUseOrderBot}
        channels={channels}
        workspaceId={workspaceId}
      />
    );
  }

  if (activeRailItem === "automation") {
    return (
      <AutomationPage
        canManageCronjobs={canManageCronjobs}
        canManageWebhooks={canManageWebhooks}
        channels={channels}
        workspaceId={workspaceId}
      />
    );
  }

  return <OperationalPage activeRailItem={activeRailItem} />;
}

function ContactsPage({
  contacts,
  isCreatingDirectConversation,
  isLoading,
  onSearchChange,
  onSecondaryAction,
  onStartConversation,
  query,
  workspaceId
}: {
  contacts: ContactResult[];
  isCreatingDirectConversation: boolean;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onSecondaryAction: (contact: ContactResult) => void;
  onStartConversation: (contact: ContactResult) => void;
  query: string;
  workspaceId?: string;
}) {
  const isSearching = query.trim().length >= 2;
  const [activeTab, setActiveTab] = useState<ContactsTab>("employees");
  const employeeContacts = contacts.filter((contact) => contact.isWorkspaceMember);
  const friendContacts = contacts.filter((contact) => contact.contactStatus === "accepted");
  const discoverContacts = contacts.filter(
    (contact) => !contact.isWorkspaceMember && contact.contactStatus !== "accepted"
  );
  const visibleContacts = activeTab === "employees"
    ? employeeContacts
    : activeTab === "friends"
      ? friendContacts
      : discoverContacts;
  const tabItems: Array<{ count: number; label: string; value: ContactsTab }> = [
    { count: employeeContacts.length, label: "Nhân viên hệ thống", value: "employees" },
    { count: friendContacts.length, label: "Bạn bè", value: "friends" },
    { count: discoverContacts.length, label: "Người lạ", value: "discover" }
  ];

  return (
    <div className="workspace-page contacts-page">
      <nav aria-label="Phân loại danh bạ" className="contacts-tabs">
        {tabItems.map((tab) => (
          <button
            aria-current={activeTab === tab.value ? "page" : undefined}
            className={activeTab === tab.value ? "contacts-tabs__item contacts-tabs__item--active" : "contacts-tabs__item"}
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            type="button"
          >
            <span>{tab.label}</span>
            <strong>{tab.count}</strong>
          </button>
        ))}
      </nav>

      <section className="zalo-search-panel">
        <div className="zalo-search-panel__icon">
          <Search size={22} />
        </div>
        <div>
          <strong>{activeTab === "employees" ? "Tìm nhân viên" : activeTab === "friends" ? "Tìm trong bạn bè" : "Tìm người để kết bạn"}</strong>
          <Input
            aria-label="Tìm người dùng bằng tên, số điện thoại hoặc email"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nhập email, số điện thoại hoặc tên"
            value={query}
          />
        </div>
      </section>

      {isLoading ? (
        <PanelSkeleton />
      ) : visibleContacts.length ? (
        <div className="workspace-data-table-shell">
          <table className="workspace-data-table contacts-data-table">
            <thead>
              <tr>
                <th scope="col">Liên hệ</th>
                <th scope="col">Số điện thoại</th>
                <th scope="col">Phân loại</th>
                <th scope="col">Trạng thái</th>
                <th className="workspace-data-table__actions-heading" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleContacts.map((contact) => (
                <tr key={contact.userId}>
                  <td>
                    <div className="workspace-data-table__identity">
                      <Avatar name={contact.name} size="md" src={contact.avatarUrl ?? undefined} />
                      <span>
                        <strong>{contact.name}</strong>
                        <small>{contact.email ?? contact.username ?? "Chưa có email"}</small>
                      </span>
                    </div>
                  </td>
                  <td>{contact.phoneNumber || "Chưa có số điện thoại"}</td>
                  <td>
                    <Badge tone={contact.isWorkspaceMember ? "blue" : "slate"}>
                      {contact.isWorkspaceMember ? "Nhân viên hệ thống" : "Ngoài workspace"}
                    </Badge>
                  </td>
                  <td>
                    <Badge tone={contact.contactStatus === "accepted" ? "green" : contact.contactStatus === "pending" ? "orange" : "blue"}>
                      {contactBadgeLabel(contact)}
                    </Badge>
                  </td>
                  <td>
                    <div className="workspace-data-table__actions">
                      <Button
                        disabled={
                          isCreatingDirectConversation ||
                          (contact.contactStatus === "pending" && contact.contactDirection === "outgoing")
                        }
                        onClick={() => onStartConversation(contact)}
                        size="sm"
                        variant={contact.contactStatus === "pending" && contact.contactDirection === "outgoing" ? "secondary" : "primary"}
                      >
                        <MessageCircle size={16} />
                        {contactActionLabel(contact)}
                      </Button>
                      {contact.contactStatus === "pending" && contact.contactRequestId ? (
                        <Button
                          disabled={isCreatingDirectConversation}
                          onClick={() => onSecondaryAction(contact)}
                          size="sm"
                          variant="ghost"
                        >
                          {contact.contactDirection === "incoming" ? "Từ chối" : "Hủy lời mời"}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          description={
            !workspaceId
              ? "Đang chuẩn bị dữ liệu để mở hội thoại riêng."
              : activeTab === "discover" && !isSearching
                ? "Nhập ít nhất 2 ký tự để tìm người dùng ngoài workspace và gửi lời mời kết bạn."
                : isSearching
                  ? "Không tìm thấy người dùng phù hợp với từ khóa này trong nhóm đang chọn."
                  : activeTab === "friends"
                    ? "Bạn chưa có bạn bè trong danh bạ."
                    : "Workspace chưa có nhân viên nào khác."
          }
          title={!workspaceId ? "Đang chuẩn bị" : activeTab === "discover" && !isSearching ? "Tìm người lạ để kết bạn" : isSearching ? "Không có kết quả" : "Chưa có liên hệ"}
        />
      )}
    </div>
  );
}

function contactActionLabel(contact: ContactResult): string {
  if (contact.contactStatus === "accepted") {
    return contact.hasConversation ? "Mở chat" : "Nhắn tin";
  }
  if (contact.contactStatus === "pending" && contact.contactDirection === "incoming") {
    return "Đồng ý";
  }
  if (contact.contactStatus === "pending") {
    return "Đang chờ";
  }
  return "Gửi lời mời";
}

function contactBadgeLabel(contact: ContactResult): string {
  if (contact.contactStatus === "accepted") {
    return "Bạn bè";
  }
  if (contact.contactStatus === "pending" && contact.contactDirection === "incoming") {
    return "Lời mời đến";
  }
  if (contact.contactStatus === "pending") {
    return "Đã gửi lời mời";
  }
  return "Có thể kết bạn";
}

function ChannelsDirectoryPage({
  channels,
  isLoading,
  isMutatingMembership,
  joinRequestsByChannelId,
  onApproveJoin,
  onChannelSelect,
  onInviteMember,
  onRejectJoin,
  onRequestJoin,
  workspaceMembers
}: {
  channels: ChatChannel[];
  isLoading: boolean;
  isMutatingMembership: boolean;
  joinRequestsByChannelId: Map<string, ChannelMember[]>;
  onApproveJoin: (channelId: string, userId: string) => void;
  onChannelSelect: (channelId: string) => void;
  onInviteMember: (channelId: string, userId: string) => void;
  onRejectJoin: (channelId: string, userId: string) => void;
  onRequestJoin: (channelId: string) => void;
  workspaceMembers: WorkspaceMember[];
}) {
  return (
    <div className="workspace-page">
      {isLoading ? (
        <PanelSkeleton />
      ) : channels.length ? (
        <div className="workspace-data-table-shell">
          <table className="workspace-data-table channels-data-table">
            <thead>
              <tr>
                <th scope="col">Kênh</th>
                <th scope="col">Mô tả</th>
                <th scope="col">Thành viên</th>
                <th scope="col">Chưa đọc</th>
                <th scope="col">Trạng thái</th>
                <th className="workspace-data-table__actions-heading" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id}>
                  <td>
                    <div className="workspace-data-table__identity">
                      <span className={`channel-hash channel-hash--${channel.tone}`} style={channelHashStyle(channel)}>
                        <Hash size={18} />
                      </span>
                      <span><strong>{channel.name}</strong></span>
                    </div>
                  </td>
                  <td className="workspace-data-table__description">{channel.description || "Chưa có mô tả"}</td>
                  <td>{channel.memberCount}</td>
                  <td>
                    <Badge tone={channel.unreadCount ? "red" : "slate"}>{channel.unreadCount}</Badge>
                  </td>
                  <td>
                    <Badge tone={channel.isMember ? "green" : channel.membershipStatus === "invited" ? "orange" : "slate"}>
                      {channel.isMember ? "Đã tham gia" : channel.membershipStatus === "invited" ? "Chờ duyệt" : "Chưa tham gia"}
                    </Badge>
                  </td>
                  <td>
                    <div className="workspace-data-table__actions workspace-data-table__actions--stacked">
                      {channel.isMember ? (
                        <Button onClick={() => onChannelSelect(channel.id)} size="sm">
                          <MessageCircle size={16} /> Mở kênh
                        </Button>
                      ) : channel.membershipStatus === "invited" ? (
                        <Button disabled size="sm" variant="secondary">Đang chờ duyệt</Button>
                      ) : (
                        <Button disabled={isMutatingMembership} onClick={() => onRequestJoin(channel.id)} size="sm" variant="secondary">
                          <Users size={16} /> Yêu cầu tham gia
                        </Button>
                      )}
                      {channel.canManage ? (
                        <ChannelMembershipManager
                          channel={channel}
                          isPending={isMutatingMembership}
                          joinRequests={joinRequestsByChannelId.get(channel.id) ?? []}
                          onApprove={onApproveJoin}
                          onInvite={onInviteMember}
                          onReject={onRejectJoin}
                          workspaceMembers={workspaceMembers}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState description="Tạo kênh ở panel bên trái khi tài khoản có quyền." title="Chưa có kênh" />
      )}
    </div>
  );
}

function ChannelMembershipManager({
  channel,
  isPending,
  joinRequests,
  onApprove,
  onInvite,
  onReject,
  workspaceMembers
}: {
  channel: ChatChannel;
  isPending: boolean;
  joinRequests: ChannelMember[];
  onApprove: (channelId: string, userId: string) => void;
  onInvite: (channelId: string, userId: string) => void;
  onReject: (channelId: string, userId: string) => void;
  workspaceMembers: WorkspaceMember[];
}) {
  const [userId, setUserId] = useState("");

  return (
    <details className="channel-membership-manager">
      <summary>Quản lý thành viên {joinRequests.length ? `(${joinRequests.length} chờ duyệt)` : ""}</summary>
      <div className="channel-invite-row">
        <select aria-label={`Chọn thành viên mời vào ${channel.name}`} onChange={(event) => setUserId(event.target.value)} value={userId}>
          <option value="">Chọn thành viên workspace</option>
          {workspaceMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name || member.username || member.email || member.user_id}
            </option>
          ))}
        </select>
        <Button disabled={isPending || !userId} onClick={() => { onInvite(channel.id, userId); setUserId(""); }} size="sm" type="button">
          Mời vào kênh
        </Button>
      </div>
      {joinRequests.length ? (
        <div className="channel-join-requests">
          {joinRequests.map((request) => (
            <article key={request.user_id}>
              <span><strong>{request.display_name || request.username || request.email || "Người dùng"}</strong><small>Yêu cầu tham gia</small></span>
              <Button disabled={isPending} onClick={() => onApprove(channel.id, request.user_id)} size="sm">Duyệt</Button>
              <Button disabled={isPending} onClick={() => onReject(channel.id, request.user_id)} size="sm" variant="ghost">Từ chối</Button>
            </article>
          ))}
        </div>
      ) : <small>Chưa có yêu cầu tham gia mới.</small>}
    </details>
  );
}

function DepartmentsPage({
  canManage,
  channels,
  departments,
  isCreating,
  isLoading,
  onCreate,
  workspaceId,
  workspaceMembers
}: {
  canManage: boolean;
  channels: ChatChannel[];
  departments: Department[];
  isCreating: boolean;
  isLoading: boolean;
  onCreate: (input: CreateDepartmentPayload) => void;
  workspaceId?: string;
  workspaceMembers: WorkspaceMember[];
}) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [query, setQuery] = useState("");
  const [coverageFilter, setCoverageFilter] = useState<"all" | "missing-lead" | "empty" | "no-channel">("all");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState<"lead" | "member">("member");
  const [channelId, setChannelId] = useState("");
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: "error" | "success" } | null>(null);

  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId) ?? null;
  const departmentRows = useMemo(() => buildDepartmentRows(departments), [departments]);
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleRows = departmentRows.filter(({ department }) => {
    const matchesQuery = !normalizedQuery ||
      `${department.name} ${department.slug} ${department.description ?? ""}`.toLocaleLowerCase("vi").includes(normalizedQuery);
    const matchesCoverage = coverageFilter === "all" ||
      (coverageFilter === "missing-lead" && !department.lead_count) ||
      (coverageFilter === "empty" && !department.member_count) ||
      (coverageFilter === "no-channel" && !department.channel_count);
    return matchesQuery && matchesCoverage;
  });
  const invalidParentIds = useMemo(
    () => selectedDepartment ? departmentDescendantIds(departments, selectedDepartment.id) : new Set<string>(),
    [departments, selectedDepartment]
  );

  const membersQuery = useQuery({
    enabled: Boolean(workspaceId && selectedDepartmentId),
    queryFn: () => api.departments.members(workspaceId ?? "", selectedDepartmentId),
    queryKey: workspaceId && selectedDepartmentId
      ? queryKeys.departments.members(workspaceId, selectedDepartmentId)
      : ["departments", "members", "none"]
  });
  const departmentMembers = membersQuery.data ?? [];
  const memberIds = new Set(departmentMembers.map((member) => member.user_id));
  const assignableMembers = workspaceMembers.filter((member) => !memberIds.has(member.user_id));
  const assignedChannels = channels.filter((channel) => channel.departmentId === selectedDepartmentId);
  const assignableChannels = channels.filter((channel) => channel.departmentId !== selectedDepartmentId);

  const updateMutation = useMutation({
    mutationFn: (input: { departmentId: string; description: string; name: string; parentId: string; slug: string }) =>
      api.departments.update(workspaceId ?? "", input.departmentId, {
        description: input.description,
        name: input.name,
        parent_id: input.parentId,
        slug: input.slug
      }),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không cập nhật được phòng ban."), tone: "error" }),
    onSuccess: async (department) => {
      setEditName(department.name);
      setEditSlug(department.slug);
      setEditDescription(department.description ?? "");
      setEditParentId(department.parent_id ?? "");
      setFeedback({ message: "Đã cập nhật thông tin phòng ban.", tone: "success" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.departments.all(workspaceId ?? "") });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (departmentId: string) => api.departments.delete(workspaceId ?? "", departmentId),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không xóa được phòng ban."), tone: "error" }),
    onSuccess: async () => {
      setSelectedDepartmentId("");
      setIsDeleteConfirming(false);
      setFeedback({ message: "Đã xóa phòng ban. Các phòng ban con được đưa về cấp gốc.", tone: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.departments.all(workspaceId ?? "") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId ?? "") })
      ]);
    }
  });
  const upsertMemberMutation = useMutation({
    mutationFn: (input: { departmentId: string; role: "lead" | "member"; userId: string }) =>
      api.departments.addMember(workspaceId ?? "", input.departmentId, input.userId, input.role),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không cập nhật được thành viên phòng ban."), tone: "error" }),
    onSuccess: async (_member, input) => {
      setMemberUserId("");
      setFeedback({ message: "Đã cập nhật thành viên phòng ban.", tone: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.departments.members(workspaceId ?? "", input.departmentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.departments.all(workspaceId ?? "") })
      ]);
    }
  });
  const removeMemberMutation = useMutation({
    mutationFn: (input: { departmentId: string; userId: string }) =>
      api.departments.removeMember(workspaceId ?? "", input.departmentId, input.userId),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không xóa được thành viên khỏi phòng ban."), tone: "error" }),
    onSuccess: async (_result, input) => {
      setFeedback({ message: "Đã xóa thành viên khỏi phòng ban.", tone: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.departments.members(workspaceId ?? "", input.departmentId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.departments.all(workspaceId ?? "") })
      ]);
    }
  });
  const assignChannelMutation = useMutation({
    mutationFn: (input: { channelId: string; departmentId: string }) =>
      api.channels.update(workspaceId ?? "", input.channelId, { department_id: input.departmentId }),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không cập nhật được kênh của phòng ban."), tone: "error" }),
    onSuccess: async () => {
      setChannelId("");
      setFeedback({ message: "Đã cập nhật kênh của phòng ban.", tone: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId ?? "") }),
        queryClient.invalidateQueries({ queryKey: queryKeys.departments.all(workspaceId ?? "") })
      ]);
    }
  });

  const isMutating = updateMutation.isPending || deleteMutation.isPending || upsertMemberMutation.isPending || removeMemberMutation.isPending || assignChannelMutation.isPending;
  const assignedChannelCount = channels.filter((channel) => channel.departmentId).length;
  const missingLeadCount = departments.filter((department) => !department.lead_count).length;
  const selectedLeadCount = departmentMembers.filter((member) => member.role === "lead").length;

  function openDepartment(department: Department) {
    setSelectedDepartmentId(department.id);
    setEditName(department.name);
    setEditSlug(department.slug);
    setEditDescription(department.description ?? "");
    setEditParentId(department.parent_id ?? "");
    setIsDeleteConfirming(false);
    setFeedback(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      return;
    }
    onCreate({
      description: description.trim(),
      name: cleanName,
      parent_id: parentId || undefined,
      slug: slugify(slug || cleanName)
    });
    setName("");
    setSlug("");
    setDescription("");
    setParentId("");
    setIsFormOpen(false);
  }

  return (
    <div className="workspace-page departments-page">
      <header className="workspace-page__header">
        <div>
          <h1>Phòng ban</h1>
        </div>
        <Button disabled={!canManage} onClick={() => setIsFormOpen((current) => !current)} size="sm">
          <Plus size={16} /> Tạo phòng ban
        </Button>
      </header>

      <section className="department-overview-grid">
        <article>
          <span><Users size={18} /></span>
          <div><strong>{departments.length}</strong><small>Tổng phòng ban</small></div>
        </article>
        <article>
          <span><ShieldCheck size={18} /></span>
          <div><strong>{missingLeadCount}</strong><small>Chưa có trưởng phòng</small></div>
        </article>
        <article>
          <span><Hash size={18} /></span>
          <div><strong>{assignedChannelCount}/{channels.length}</strong><small>Kênh đã gán phòng ban</small></div>
        </article>
        <article>
          <span><ShieldCheck size={18} /></span>
          <div><strong>{workspaceMembers.length}</strong><small>Thành viên workspace</small></div>
        </article>
      </section>

      {isFormOpen ? (
        <form className="department-create-form" onSubmit={handleSubmit}>
          <label>Tên phòng ban<input onChange={(event) => { setName(event.target.value); setSlug((current) => current || slugify(event.target.value)); }} placeholder="Ví dụ: Kinh doanh" required value={name} /></label>
          <label>Slug<input onChange={(event) => setSlug(event.target.value)} placeholder="kinh-doanh" required value={slug} /></label>
          <label>Thuộc phòng ban<select onChange={(event) => setParentId(event.target.value)} value={parentId}><option value="">Không có phòng ban cha</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="department-create-form__description">Mô tả<textarea onChange={(event) => setDescription(event.target.value)} placeholder="Chức năng của phòng ban" value={description} /></label>
          <div><Button disabled={isCreating || !name.trim() || !slug.trim()} size="sm" type="submit">{isCreating ? "Đang tạo..." : "Tạo phòng ban"}</Button><Button onClick={() => setIsFormOpen(false)} size="sm" type="button" variant="ghost">Hủy</Button></div>
        </form>
      ) : null}

      {canManage ? (
        <div className="department-toolbar">
          <Input
            aria-label="Tìm phòng ban"
            leftAddon={<Search size={17} />}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo tên, slug hoặc mô tả..."
            value={query}
          />
          <select
            aria-label="Lọc trạng thái phân công phòng ban"
            className="department-coverage-filter"
            onChange={(event) => setCoverageFilter(event.target.value as typeof coverageFilter)}
            value={coverageFilter}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="missing-lead">Chưa có trưởng phòng</option>
            <option value="empty">Chưa có nhân sự</option>
            <option value="no-channel">Chưa có kênh</option>
          </select>
          <Badge tone="blue">{departments.length} phòng ban</Badge>
        </div>
      ) : null}

      {feedback ? (
        <div className={`department-feedback department-feedback--${feedback.tone}`} role="status">
          <span>{feedback.message}</span>
          <button aria-label="Đóng thông báo" onClick={() => setFeedback(null)} type="button"><X size={15} /></button>
        </div>
      ) : null}

      {isLoading ? (
        <PanelSkeleton />
      ) : !canManage ? (
        <EmptyState description="Bạn cần quyền quản lý workspace để xem và tạo phòng ban." title="Không có quyền quản lý phòng ban" />
      ) : visibleRows.length ? (
        <div className="workspace-data-table-shell">
          <table className="workspace-data-table departments-data-table">
            <thead>
              <tr>
                <th scope="col">Phòng ban</th>
                <th scope="col">Mô tả</th>
                <th scope="col">Trưởng phòng</th>
                <th scope="col">Nhân sự</th>
                <th scope="col">Kênh</th>
                <th scope="col">Cấp</th>
                <th className="workspace-data-table__actions-heading" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ department, depth }) => (
                <tr className={department.id === selectedDepartmentId ? "workspace-data-table__row--active" : undefined} key={department.id}>
                  <td>
                    <div className="workspace-data-table__identity" style={{ paddingLeft: `${Math.min(depth, 4) * 14}px` }}>
                      <span className="department-table-icon"><Users size={17} /></span>
                      <span>
                        <strong>{department.name}</strong>
                        <small>#{department.slug}{department.parent_id ? ` · ${departmentName(departments, department.parent_id)}` : " · cấp gốc"}</small>
                      </span>
                    </div>
                  </td>
                  <td className="workspace-data-table__description">{department.description || "Chưa có mô tả"}</td>
                  <td>
                    <Badge tone={department.lead_count ? "green" : "orange"}>
                      {department.lead_count ?? 0}
                    </Badge>
                  </td>
                  <td>{department.member_count ?? 0}</td>
                  <td>{department.channel_count ?? 0}</td>
                  <td>{department.parent_id ? <Badge tone="slate">Cấp {depth + 1}</Badge> : <Badge tone="blue">Gốc</Badge>}</td>
                  <td>
                    <div className="workspace-data-table__actions">
                      <Button onClick={() => openDepartment(department)} size="sm" variant="secondary">Quản lý</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : query.trim() || coverageFilter !== "all" ? (
        <EmptyState description="Thử từ khóa hoặc trạng thái phân công khác." title="Không tìm thấy phòng ban phù hợp" />
      ) : (
        <EmptyState description="Tạo phòng ban đầu tiên để tổ chức thành viên theo đội nhóm." title="Chưa có phòng ban" />
      )}

      {selectedDepartment ? (
        <section className="department-detail-panel">
          <header>
            <div>
              <span className="workspace-page__eyebrow">Chi tiết phòng ban</span>
              <h2>{selectedDepartment.name}</h2>
              <div className="department-detail-badges">
                <Badge tone="blue">{selectedLeadCount} trưởng phòng</Badge>
                <Badge tone="slate">{assignedChannels.length} kênh</Badge>
              </div>
              <p>#{selectedDepartment.slug} · {departmentMembers.length} thành viên · {assignedChannels.length} kênh</p>
            </div>
            <Button aria-label="Đóng chi tiết phòng ban" onClick={() => setSelectedDepartmentId("")} variant="icon"><X size={18} /></Button>
          </header>

          <div className="department-detail-grid">
            <form
              className="department-editor"
              onSubmit={(event) => {
                event.preventDefault();
                if (!editName.trim()) return;
                updateMutation.mutate({
                  departmentId: selectedDepartment.id,
                  description: editDescription.trim(),
                  name: editName.trim(),
                  parentId: editParentId,
                  slug: slugify(editSlug)
                });
              }}
            >
              <h3>Thông tin</h3>
              <label>Tên phòng ban<input onChange={(event) => setEditName(event.target.value)} required value={editName} /></label>
              <label>Slug<input onChange={(event) => setEditSlug(event.target.value)} required value={editSlug} /></label>
              <label>
                Phòng ban cấp trên
                <select onChange={(event) => setEditParentId(event.target.value)} value={editParentId}>
                  <option value="">Không có · cấp gốc</option>
                  {departments
                    .filter((department) => !invalidParentIds.has(department.id))
                    .map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
              <label>Mô tả<textarea onChange={(event) => setEditDescription(event.target.value)} value={editDescription} /></label>
              <div className="department-editor__actions">
                <Button disabled={isMutating || !editName.trim() || !editSlug.trim()} size="sm" type="submit">Lưu thay đổi</Button>
                {!isDeleteConfirming ? (
                  <Button disabled={isMutating} onClick={() => setIsDeleteConfirming(true)} size="sm" type="button" variant="ghost">Xóa phòng ban</Button>
                ) : (
                  <span className="department-delete-confirm">
                    <strong>Xác nhận xóa?</strong>
                    <Button disabled={isMutating} onClick={() => deleteMutation.mutate(selectedDepartment.id)} size="sm" type="button">Xóa</Button>
                    <Button disabled={isMutating} onClick={() => setIsDeleteConfirming(false)} size="sm" type="button" variant="ghost">Hủy</Button>
                  </span>
                )}
              </div>
            </form>

            <div className="department-members-manager">
              <h3>Thành viên</h3>
              <div className="department-member-add">
                <select aria-label="Chọn thành viên workspace" onChange={(event) => setMemberUserId(event.target.value)} value={memberUserId}>
                  <option value="">Chọn thành viên</option>
                  {assignableMembers.map((member) => (
                    <option key={member.user_id} value={member.user_id}>{workspaceMemberName(member)}</option>
                  ))}
                </select>
                <select aria-label="Vai trò phòng ban" onChange={(event) => setMemberRole(event.target.value as "lead" | "member")} value={memberRole}>
                  <option value="member">Thành viên</option>
                  <option value="lead">Trưởng phòng</option>
                </select>
                <Button
                  disabled={isMutating || !memberUserId}
                  onClick={() => upsertMemberMutation.mutate({ departmentId: selectedDepartment.id, role: memberRole, userId: memberUserId })}
                  size="sm"
                  type="button"
                >
                  Thêm
                </Button>
              </div>
              {membersQuery.isLoading ? <Skeleton style={{ height: 90 }} /> : membersQuery.isError ? (
                <ErrorState
                  action={<Button onClick={() => void membersQuery.refetch()} size="sm" variant="secondary">Thử lại</Button>}
                  description="Không tải được danh sách thành viên phòng ban."
                  title="Lỗi dữ liệu thành viên"
                />
              ) : departmentMembers.length ? (
                <div className="department-member-list">
                  {departmentMembers.map((member: DepartmentMember) => (
                    <article key={member.user_id}>
                      <Avatar name={departmentMemberName(member)} size="sm" />
                      <span><strong>{departmentMemberName(member)}</strong><small>{member.email || member.username}</small></span>
                      <select
                        aria-label={`Vai trò của ${departmentMemberName(member)}`}
                        disabled={isMutating}
                        onChange={(event) => upsertMemberMutation.mutate({
                          departmentId: selectedDepartment.id,
                          role: event.target.value as "lead" | "member",
                          userId: member.user_id
                        })}
                        value={member.role}
                      >
                        <option value="member">Thành viên</option>
                        <option value="lead">Trưởng phòng</option>
                      </select>
                      <Button
                        aria-label={`Xóa ${departmentMemberName(member)} khỏi phòng ban`}
                        disabled={isMutating}
                        onClick={() => removeMemberMutation.mutate({ departmentId: selectedDepartment.id, userId: member.user_id })}
                        size="sm"
                        variant="ghost"
                      >
                        Xóa
                      </Button>
                    </article>
                  ))}
                </div>
              ) : <EmptyState description="Thêm người trong workspace và gán vai trò trưởng phòng hoặc thành viên." title="Chưa có thành viên" />}
            </div>

            <div className="department-channel-manager">
              <h3>Kênh của phòng ban</h3>
              <div className="department-channel-add">
                <select aria-label="Chọn kênh để gán" onChange={(event) => setChannelId(event.target.value)} value={channelId}>
                  <option value="">Chọn kênh</option>
                  {assignableChannels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                </select>
                <Button
                  disabled={isMutating || !channelId}
                  onClick={() => assignChannelMutation.mutate({ channelId, departmentId: selectedDepartment.id })}
                  size="sm"
                  type="button"
                >
                  Gán kênh
                </Button>
              </div>
              {assignedChannels.length ? (
                <div className="department-channel-list">
                  {assignedChannels.map((channel) => (
                    <article key={channel.id}>
                      <span className={`channel-hash channel-hash--${channel.tone}`} style={channelHashStyle(channel)}>#</span>
                      <span><strong>{channel.name}</strong><small>{channel.description}</small></span>
                      <Button
                        disabled={isMutating}
                        onClick={() => assignChannelMutation.mutate({ channelId: channel.id, departmentId: "" })}
                        size="sm"
                        variant="ghost"
                      >
                        Bỏ khỏi phòng ban
                      </Button>
                    </article>
                  ))}
                </div>
              ) : <small>Chưa có kênh nào được gán cho phòng ban.</small>}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function departmentName(departments: Department[], departmentId: string) {
  return departments.find((department) => department.id === departmentId)?.name ?? "phòng ban đã xóa";
}

function workspaceMemberName(member: WorkspaceMember) {
  return member.display_name || member.username || member.email || member.user_id;
}

function departmentMemberName(member: DepartmentMember) {
  return member.display_name || member.username || member.email || member.user_id;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function FilesPage({
  files,
  isLoading,
  onDownloadFile
}: {
  files: FileItem[];
  isLoading: boolean;
  onDownloadFile: (file: FileItem) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleFiles = normalizedQuery
    ? files.filter((file) => `${file.name} ${file.mimeType ?? ""}`.toLocaleLowerCase("vi").includes(normalizedQuery))
    : files;

  return (
    <div className="workspace-page">
      <div className="directory-toolbar">
        <Input
          aria-label="Tìm file"
          leftAddon={<Search size={17} />}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên hoặc loại file..."
          value={query}
        />
        <Badge tone="blue">{files.length} file</Badge>
      </div>

      {isLoading ? (
        <PanelSkeleton />
      ) : visibleFiles.length ? (
        <div className="workspace-data-table-shell">
          <table className="workspace-data-table files-data-table">
            <thead>
              <tr>
                <th scope="col">Tệp</th>
                <th scope="col">Loại nội dung</th>
                <th scope="col">Kích thước</th>
                <th scope="col">Cập nhật</th>
                <th className="workspace-data-table__actions-heading" scope="col">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleFiles.map((file) => (
                <tr key={file.id}>
                  <td>
                    <div className="workspace-data-table__identity">
                      <span className={`file-icon file-icon--${file.tone}`}><FileText size={18} /></span>
                      <span><strong>{file.name}</strong></span>
                    </div>
                  </td>
                  <td className="workspace-data-table__description">{file.mimeType || "Không xác định"}</td>
                  <td>{file.size}</td>
                  <td>{file.updatedAt}</td>
                  <td>
                    <div className="workspace-data-table__actions">
                      <Button onClick={() => onDownloadFile(file)} size="sm" variant="secondary">
                        Tải xuống
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : query.trim() ? (
        <EmptyState description="Thử một tên file hoặc loại nội dung khác." title="Không tìm thấy file" />
      ) : (
        <EmptyState description="Chưa có file được chia sẻ trong các cuộc trò chuyện." title="Chưa có file" />
      )}
    </div>
  );
}

function SettingsPage({
  currentUser,
  isUpdatingProfile,
  onProfileSubmit,
  onThemeToggle,
  theme
}: {
  currentUser: ChatUser;
  isUpdatingProfile: boolean;
  onProfileSubmit: (input: {
    avatar_url?: string | null;
    display_name?: string;
    phone_number?: string | null;
  }) => void;
  onThemeToggle: () => void;
  theme: "dark" | "light";
}) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const currentSessionId = useAuthStore((state) => state.sessionId);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarValue, setAvatarValue] = useState(currentUser.avatarUrl ?? "");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [sessionActionError, setSessionActionError] = useState<string | null>(null);

  useEffect(() => setAvatarValue(currentUser.avatarUrl ?? ""), [currentUser.avatarUrl]);

  const sessionsQuery = useQuery({
    queryFn: () => api.auth.sessions(),
    queryKey: queryKeys.auth.sessions
  });
  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.auth.revokeSession(sessionId),
    onError: (error) => setSessionActionError(error instanceof Error ? error.message : "Không thu hồi được phiên đăng nhập."),
    onSuccess: async (_, sessionId) => {
      setSessionActionError(null);
      if (sessionId === currentSessionId) {
        logout();
        return;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.sessions });
    }
  });
  const revokeAllSessionsMutation = useMutation({
    mutationFn: () => api.auth.revokeAllSessions(),
    onError: (error) => setSessionActionError(error instanceof Error ? error.message : "Không thu hồi được các phiên đăng nhập."),
    onSuccess: () => logout()
  });
  const sessions = useMemo(
    () => [...(sessionsQuery.data ?? [])].sort((left, right) => {
      if (left.id === currentSessionId) return -1;
      if (right.id === currentSessionId) return 1;
      if (Boolean(left.revoked_at) !== Boolean(right.revoked_at)) return left.revoked_at ? 1 : -1;
      return new Date(right.last_seen_at || right.created_at || 0).getTime() - new Date(left.last_seen_at || left.created_at || 0).getTime();
    }),
    [currentSessionId, sessionsQuery.data]
  );
  const activeSessionCount = sessions.filter((session) => !session.revoked_at).length;

  async function handleAvatarFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setAvatarError("Vui lòng chọn file ảnh.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError("Ảnh đại diện không được vượt quá 8 MB.");
      return;
    }
    try {
      setAvatarValue(await resizeAvatarFile(file));
      setAvatarError(null);
    } catch {
      setAvatarError("Không đọc được ảnh đã chọn.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onProfileSubmit({
      avatar_url: formValue(form, "avatar_url") || null,
      display_name: formValue(form, "display_name"),
      phone_number: formValue(form, "phone_number") || null
    });
  }

  return (
    <div className="workspace-page settings-page">
      <div className="settings-grid">
        <section className="settings-card settings-card--profile">
          <div className="settings-card__heading">
            <div>
              <h2>Hồ sơ cá nhân</h2>
            </div>
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              Tên hiển thị
              <input defaultValue={currentUser.name} name="display_name" placeholder="Tên của bạn" />
            </label>
            <div className="avatar-upload-field">
              <span>Ảnh đại diện</span>
              <div>
                <Avatar name={currentUser.name} size="lg" src={avatarValue || undefined} />
                <span>
                  <Button onClick={() => avatarInputRef.current?.click()} size="sm" type="button" variant="secondary">
                    <ImageIcon size={16} /> Chọn ảnh từ máy
                  </Button>
                  <small>JPG, PNG hoặc WebP · tối đa 8 MB</small>
                </span>
              </div>
              <input
                accept="image/*"
                className="visually-hidden"
                onChange={handleAvatarFile}
                ref={avatarInputRef}
                type="file"
              />
              <input name="avatar_url" onChange={(event) => setAvatarValue(event.target.value)} placeholder="Hoặc dán URL ảnh..." value={avatarValue} />
              {avatarError ? <small className="profile-form__error">{avatarError}</small> : null}
            </div>
            <label>
              Số điện thoại
              <input name="phone_number" placeholder="Số điện thoại nội bộ" />
            </label>
            <Button disabled={isUpdatingProfile} size="sm" type="submit">
              {isUpdatingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
            </Button>
          </form>
        </section>
        <section className="settings-card settings-card--privacy">
          <div>
            <ShieldCheck size={22} />
            <h2>Quyền riêng tư</h2>
          </div>
          <p>Tài khoản của bạn được bảo vệ trong phiên làm việc hiện tại.</p>
        </section>
        <section className="settings-card settings-card--appearance">
          <div>
            {theme === "dark" ? <Moon size={22} /> : <Sun size={22} />}
            <h2>Giao diện</h2>
          </div>
          <p>Chế độ hiện tại: {theme === "dark" ? "tối" : "sáng"}.</p>
          <Button onClick={onThemeToggle} size="sm" variant="secondary">
            Chuyển chế độ
          </Button>
        </section>
        <section className="settings-card settings-card--sessions">
          <div className="sessions-heading">
            <span className="sessions-heading__icon"><ShieldCheck size={22} /></span>
            <div>
              <h2>Phiên đăng nhập</h2>
            </div>
            <span className="sessions-count"><strong>{activeSessionCount}</strong> phiên đang hoạt động</span>
            <Button
              className="sessions-logout-all"
              disabled={revokeAllSessionsMutation.isPending || !activeSessionCount}
              onClick={() => {
                if (window.confirm("Đăng xuất khỏi tất cả thiết bị? Bạn sẽ cần đăng nhập lại.")) {
                  revokeAllSessionsMutation.mutate();
                }
              }}
              size="sm"
              variant="secondary"
            >
              <LogOut size={16} />
              {revokeAllSessionsMutation.isPending ? "Đang đăng xuất..." : "Đăng xuất tất cả thiết bị"}
            </Button>
          </div>
          {sessionsQuery.isLoading ? (
            <div className="session-list session-list--loading">
              <Skeleton style={{ height: 116 }} />
              <Skeleton style={{ height: 116 }} />
            </div>
          ) : sessionsQuery.isError ? (
            <ErrorState
              action={<Button onClick={() => void sessionsQuery.refetch()} size="sm" variant="secondary">Thử lại</Button>}
              description="Không tải được danh sách thiết bị."
              title="Lỗi phiên đăng nhập"
            />
          ) : sessions.length ? (
            <div className="workspace-data-table-shell">
              <table className="workspace-data-table sessions-data-table">
                <thead>
                  <tr>
                    <th scope="col">Thiết bị</th>
                    <th scope="col">Địa chỉ IP</th>
                    <th scope="col">Hoạt động</th>
                    <th scope="col">Hết hạn</th>
                    <th scope="col">Trạng thái</th>
                    <th className="workspace-data-table__actions-heading" scope="col">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session: AuthSession) => {
                    const isCurrent = session.id === currentSessionId;
                    const isRevoked = Boolean(session.revoked_at);
                    const isMobile = isMobileSession(session);
                    return (
                      <tr className={isCurrent ? "workspace-data-table__row--current" : isRevoked ? "workspace-data-table__row--revoked" : undefined} key={session.id}>
                        <td>
                          <div className="workspace-data-table__identity session-table__device">
                            <span className="session-device-icon" aria-hidden="true">
                              {isMobile ? <Smartphone size={19} /> : <Monitor size={19} />}
                            </span>
                            <span>
                              <strong>{session.device_name || sessionDeviceLabel(session)}</strong>
                              <small title={session.user_agent ?? undefined}>{session.user_agent || "Không có thông tin trình duyệt"}</small>
                            </span>
                          </div>
                        </td>
                        <td>{session.ip_address || "Không xác định"}</td>
                        <td>{formatRelativeSessionDate(session.last_seen_at || session.created_at)}</td>
                        <td>{session.expires_at ? formatSessionDate(session.expires_at) : "Không xác định"}</td>
                        <td>
                          <Badge tone={isCurrent ? "green" : isRevoked ? "slate" : "blue"}>
                            {isCurrent ? "Thiết bị này" : isRevoked ? "Đã thu hồi" : "Đang hoạt động"}
                          </Badge>
                        </td>
                        <td>
                          <div className="workspace-data-table__actions">
                            {!isCurrent && !isRevoked ? (
                              <Button
                                disabled={revokeSessionMutation.isPending || revokeAllSessionsMutation.isPending}
                                onClick={() => {
                                  if (window.confirm(`Thu hồi phiên trên ${session.device_name || sessionDeviceLabel(session)}?`)) {
                                    revokeSessionMutation.mutate(session.id);
                                  }
                                }}
                                size="sm"
                                variant="secondary"
                              >
                                {revokeSessionMutation.isPending && revokeSessionMutation.variables === session.id ? "Đang thu hồi..." : "Thu hồi phiên"}
                              </Button>
                            ) : <span className="session-table__no-action">—</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState description="Các thiết bị đăng nhập sẽ xuất hiện tại đây." title="Chưa có phiên đăng nhập" />}
          {sessionActionError ? <p className="session-action-error" role="alert">{sessionActionError}</p> : null}
        </section>
      </div>
    </div>
  );
}

function formatSessionDate(value?: string | null) {
  if (!value) {
    return "Không rõ thời gian";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}

function formatRelativeSessionDate(value?: string | null) {
  if (!value) {
    return "Không rõ";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return formatSessionDate(value);
  }
  const difference = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(difference / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return formatSessionDate(value);
}

function isMobileSession(session: AuthSession) {
  return /android|iphone|ipad|mobile/i.test(`${session.device_name ?? ""} ${session.user_agent ?? ""}`);
}

function sessionDeviceLabel(session: AuthSession) {
  if (isMobileSession(session)) {
    return "Thiết bị di động";
  }
  if (/windows/i.test(session.user_agent ?? "")) return "Máy tính Windows";
  if (/macintosh|mac os/i.test(session.user_agent ?? "")) return "Máy tính Mac";
  if (/linux/i.test(session.user_agent ?? "")) return "Máy tính Linux";
  return "Trình duyệt web";
}

type OrderBotResult =
  | { data: OrderWalletBalanceData; kind: "wallet" }
  | { data: OrderWalletDepositQRData; kind: "deposit" }
  | { data: OrderPaymentQRData; kind: "order-payment" }
  | { data: OrderServicesExpiringData; kind: "expiring" };

const orderServiceTypeOptions: Array<{ label: string; value: NonNullable<OrderServicesExpiringInput["service_type"]> }> = [
  { label: "Tất cả", value: "all" },
  { label: "VPS", value: "vps" },
  { label: "Proxy", value: "proxy" },
  { label: "Hosting", value: "hosting" },
  { label: "S3", value: "s3" },
  { label: "Domain", value: "domain" }
];

function BotsPage({
  canBillOrder,
  canManage,
  canUseOrder,
  channels,
  workspaceId
}: {
  canBillOrder: boolean;
  canManage: boolean;
  canUseOrder: boolean;
  channels: ChatChannel[];
  workspaceId?: string;
}) {
  const queryClient = useQueryClient();
  const [selectedBotId, setSelectedBotId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [targetChannelId, setTargetChannelId] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [orderEmail, setOrderEmail] = useState("");
  const [orderUserId, setOrderUserId] = useState("");
  const [orderDepositAmount, setOrderDepositAmount] = useState("200000");
  const [orderIntentCode, setOrderIntentCode] = useState("");
  const [orderExpiringDays, setOrderExpiringDays] = useState("7");
  const [orderServiceType, setOrderServiceType] = useState<OrderServicesExpiringInput["service_type"]>("all");
  const [orderResult, setOrderResult] = useState<OrderBotResult | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; tone: "error" | "success" } | null>(null);
  const availableChannels = useMemo(() => channels.filter((channel) => channel.isMember), [channels]);

  const orderStatusQuery = useQuery({
    enabled: Boolean(workspaceId && canUseOrder),
    queryFn: () => api.orderBot.status(workspaceId as string),
    queryKey: queryKeys.orderBot.status(workspaceId ?? "")
  });
  const botsQuery = useQuery({
    enabled: Boolean(workspaceId && canManage),
    queryFn: () => api.bots.list(workspaceId as string),
    queryKey: queryKeys.integrations.bots(workspaceId ?? "")
  });
  const bots: BotRecord[] = botsQuery.data ?? [];
  const selectedBot = bots.find((bot) => bot.id === selectedBotId) ?? bots[0];

  async function privateOrderChannel(slug: "ticket" | "gia-han" | "ke-toan") {
    const source = channels.find((channel) => channel.slug === slug);
    if (!source) {
      throw new Error(`Không tìm thấy kênh #${slug}.`);
    }
    if (!source.privateSessionMode) {
      return source.id;
    }
    const session = await api.channels.openPrivateSession(workspaceId as string, source.id);
    return session.id;
  }

  useEffect(() => {
    if (bots.length && !bots.some((bot) => bot.id === selectedBotId)) {
      setSelectedBotId(bots[0].id);
    }
  }, [bots, selectedBotId]);

  useEffect(() => {
    if (availableChannels.length && !availableChannels.some((channel) => channel.id === targetChannelId)) {
      setTargetChannelId(availableChannels[0].id);
    }
  }, [availableChannels, targetChannelId]);

  const installationsQuery = useQuery({
    enabled: Boolean(workspaceId && canManage && selectedBot?.id),
    queryFn: () => api.bots.installations(workspaceId as string, selectedBot?.id ?? ""),
    queryKey: queryKeys.integrations.botInstallations(workspaceId ?? "", selectedBot?.id ?? "")
  });
  const createBotMutation = useMutation({
    mutationFn: (input: { description?: string; name: string; slug: string }) => api.bots.create(workspaceId as string, input),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không tạo được bot."), tone: "error" }),
    onSuccess: async (bot) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.integrations.bots(workspaceId ?? "") });
      setSelectedBotId(bot.id);
      setCreateName("");
      setCreateSlug("");
      setCreateDescription("");
      setIsCreateOpen(false);
      setFeedback({ message: `Đã tạo ${bot.name}.`, tone: "success" });
    }
  });
  const installBotMutation = useMutation({
    mutationFn: ({ botId, channelId }: { botId: string; channelId: string }) =>
      api.bots.install(workspaceId as string, botId, { channel_id: channelId, config: {} }),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không cài được bot vào kênh."), tone: "error" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.botInstallations(workspaceId ?? "", selectedBot?.id ?? "")
      });
      const channel = availableChannels.find((item) => item.id === targetChannelId);
      setFeedback({ message: `Đã kết nối bot với #${channel?.name ?? "kênh"}.`, tone: "success" });
    }
  });
  const sendBotMessageMutation = useMutation({
    mutationFn: ({ botId, body, channelId }: { botId: string; body: string; channelId: string }) =>
      api.bots.sendMessage(workspaceId as string, botId, {
        body,
        channel_id: channelId,
        metadata: { source: "bot-console" }
      }),
    onError: (error) => setFeedback({ message: errorMessage(error, "Bot chưa gửi được tin nhắn."), tone: "error" }),
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(workspaceId ?? "", input.channelId) });
      setTestMessage("");
      setFeedback({ message: "Bot đã gửi tin nhắn thử nghiệm.", tone: "success" });
    }
  });

  const orderWalletMutation = useMutation({
    mutationFn: async () => api.orderBot.walletBalance(workspaceId as string, {
      ...buildOrderLookup(orderEmail, orderUserId),
      channel_id: await privateOrderChannel("ticket")
    }),
    onMutate: () => setFeedback(null),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không tra được ví khách hàng."), tone: "error" }),
    onSuccess: async (result) => {
      setOrderResult({ data: result.data, kind: "wallet" });
      if (result.bot_message?.channel_id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(workspaceId ?? "", result.bot_message.channel_id) });
      }
      setFeedback({ message: "CSKH Bot đã tra ví và gửi kết quả vào kênh ticket.", tone: "success" });
    }
  });
  const orderDepositMutation = useMutation({
    mutationFn: async () => api.orderBot.depositQr(workspaceId as string, {
      ...buildOrderEmail(orderEmail),
      amount: parsePositiveInt(orderDepositAmount),
      expires_minutes: 1440,
      channel_id: await privateOrderChannel("ke-toan")
    }),
    onMutate: () => setFeedback(null),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không tạo được QR nạp ví."), tone: "error" }),
    onSuccess: async (result) => {
      setOrderResult({ data: result.data, kind: "deposit" });
      if (result.bot_message?.channel_id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(workspaceId ?? "", result.bot_message.channel_id) });
      }
      setFeedback({ message: "Thanh Toán Bot đã tạo QR và gửi vào kênh kế toán.", tone: "success" });
    }
  });
  const orderPaymentMutation = useMutation({
    mutationFn: async () => api.orderBot.orderPaymentQr(workspaceId as string, {
      intent_code: orderIntentCode.trim(),
      channel_id: await privateOrderChannel("ke-toan")
    }),
    onMutate: () => setFeedback(null),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không tạo được QR thanh toán đơn hàng."), tone: "error" }),
    onSuccess: async (result) => {
      setOrderResult({ data: result.data, kind: "order-payment" });
      if (result.bot_message?.channel_id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(workspaceId ?? "", result.bot_message.channel_id) });
      }
      setFeedback({ message: "Thanh Toán Bot đã tạo QR cho đơn hàng.", tone: "success" });
    }
  });
  const orderExpiringMutation = useMutation({
    mutationFn: async () => api.orderBot.expiringServices(workspaceId as string, {
      ...buildOrderLookup(orderEmail, orderUserId),
      days: parsePositiveInt(orderExpiringDays),
      include_expired: false,
      service_type: orderServiceType,
      channel_id: await privateOrderChannel("gia-han")
    }),
    onMutate: () => setFeedback(null),
    onError: (error) => setFeedback({ message: errorMessage(error, "Không kiểm tra được dịch vụ sắp hết hạn."), tone: "error" }),
    onSuccess: async (result) => {
      setOrderResult({ data: result.data, kind: "expiring" });
      if (result.bot_message?.channel_id) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(workspaceId ?? "", result.bot_message.channel_id) });
      }
      setFeedback({ message: "Gia Hạn Bot đã gửi danh sách dịch vụ cần chú ý.", tone: "success" });
    }
  });

  function handleCreateBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = createName.trim();
    const slug = slugify(createSlug || createName);
    if (!name || slug.length < 3 || !workspaceId) {
      setFeedback({ message: "Tên bot và slug từ 3 ký tự là bắt buộc.", tone: "error" });
      return;
    }
    createBotMutation.mutate({ description: createDescription.trim() || undefined, name, slug });
  }

  const activeBots = bots.filter((bot) => bot.status === "active").length;
  const installations = installationsQuery.data ?? [];
  const orderConfigured = orderStatusQuery.data?.configured ?? false;
  const orderBusy = orderWalletMutation.isPending || orderDepositMutation.isPending || orderPaymentMutation.isPending || orderExpiringMutation.isPending;

  return (
    <div className="workspace-page bot-page">
      <header className="workspace-page__header bot-page__header">
        <div>
          <h1>Bot</h1>
        </div>
        {canManage ? (
          <Button onClick={() => setIsCreateOpen((current) => !current)} size="sm">
            {isCreateOpen ? <X size={16} /> : <Plus size={16} />}
            {isCreateOpen ? "Đóng" : "Tạo bot"}
          </Button>
        ) : null}
      </header>

      <section className="bot-hero">
        <div className="bot-hero__copy">
          <Badge tone="blue"><Sparkles size={13} /> Bot workspace</Badge>
          <h2>Tự động hóa thông báo, cảnh báo và chăm sóc nội bộ</h2>
          <div className="bot-hero__stats">
            <span><strong>{bots.length}</strong> tổng bot</span>
            <span><strong>{activeBots}</strong> đang hoạt động</span>
            <span><strong>{installations.length}</strong> kết nối đã chọn</span>
          </div>
        </div>
        <div className="bot-animation" aria-hidden="true">
          <span className="bot-animation__orbit bot-animation__orbit--one"><i /></span>
          <span className="bot-animation__orbit bot-animation__orbit--two"><i /></span>
          <span className="bot-animation__signal bot-animation__signal--one" />
          <span className="bot-animation__signal bot-animation__signal--two" />
          <span className="bot-animation__core"><Bot size={44} /><b /></span>
          <Sparkles className="bot-animation__spark bot-animation__spark--one" size={18} />
          <Zap className="bot-animation__spark bot-animation__spark--two" size={17} />
        </div>
      </section>

      {!canManage ? (
        <section className="bot-permission-state">
          <ShieldCheck size={30} />
          <div>
            <h2>Cần quyền quản lý bot</h2>
            <p>Liên hệ quản trị viên workspace để được cấp quyền <code>bot.manage</code>.</p>
          </div>
        </section>
      ) : null}

      {canManage && isCreateOpen ? (
        <form className="bot-create-form" onSubmit={handleCreateBot}>
          <header>
            <span><Bot size={20} /></span>
            <div><strong>Tạo bot mới</strong><small>Bot sẽ sẵn sàng để kết nối với kênh sau khi tạo.</small></div>
          </header>
          <label>Tên bot<input autoFocus onChange={(event) => {
            setCreateName(event.target.value);
            setCreateSlug((current) => current || slugify(event.target.value));
          }} placeholder="Ví dụ: Server Alert Bot" value={createName} /></label>
          <label>Slug<input onChange={(event) => setCreateSlug(slugify(event.target.value))} placeholder="server-alert-bot" value={createSlug} /></label>
          <label className="bot-create-form__description">Mô tả<textarea onChange={(event) => setCreateDescription(event.target.value)} placeholder="Bot dùng để làm gì?" value={createDescription} /></label>
          <Button disabled={createBotMutation.isPending} size="sm" type="submit">
            {createBotMutation.isPending ? "Đang tạo..." : "Tạo bot"}
          </Button>
        </form>
      ) : null}

      {feedback ? (
        <div className={`bot-feedback bot-feedback--${feedback.tone}`} role="status">
          <span>{feedback.tone === "success" ? <CheckCircle2 size={17} /> : <Info size={17} />}{feedback.message}</span>
          <button aria-label="Đóng thông báo" onClick={() => setFeedback(null)} type="button"><X size={15} /></button>
        </div>
      ) : null}

      {canUseOrder ? (
        <section className="order-bot-panel">
          <header>
            <div>
              <Badge tone={orderConfigured ? "blue" : "red"}>{orderConfigured ? "Đã khai báo API" : "Thiếu API key"}</Badge>
              <h2>VPSTTT Order CSKH</h2>
              <p>Tra ví, tạo QR nạp ví và kiểm tra dịch vụ sắp hết hạn từ hệ thống order.</p>
              {orderConfigured ? <small>Trạng thái này chỉ xác nhận URL và API key đã được nhập; kết nối thật được kiểm tra khi thực hiện tra cứu.</small> : null}
            </div>
            <Button disabled={orderStatusQuery.isFetching} onClick={() => void orderStatusQuery.refetch()} size="sm" variant="secondary">
              <Cloud size={15} /> Tải lại cấu hình
            </Button>
          </header>
          <div className="order-bot-grid">
            <div className="order-bot-card order-bot-card--lookup">
              <strong>Khách hàng</strong>
              <label>Email<input onChange={(event) => setOrderEmail(event.target.value)} placeholder="khach@example.com" value={orderEmail} /></label>
              <label>User ID<input onChange={(event) => setOrderUserId(event.target.value.replace(/\D/g, ""))} placeholder="8075" value={orderUserId} /></label>
              <Button disabled={!orderConfigured || orderBusy || !hasOrderLookup(orderEmail, orderUserId)} onClick={() => orderWalletMutation.mutate()} size="sm" type="button">
                <Search size={15} /> Tra ví
              </Button>
            </div>

            <div className="order-bot-card">
              <strong>Dịch vụ sắp hết hạn</strong>
              <label>Số ngày<input onChange={(event) => setOrderExpiringDays(event.target.value.replace(/\D/g, ""))} value={orderExpiringDays} /></label>
              <label>Loại dịch vụ<select onChange={(event) => setOrderServiceType(event.target.value as OrderServicesExpiringInput["service_type"])} value={orderServiceType}>
                {orderServiceTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select></label>
              <Button disabled={!orderConfigured || orderBusy || !hasOrderLookup(orderEmail, orderUserId)} onClick={() => orderExpiringMutation.mutate()} size="sm" type="button" variant="secondary">
                <Clock3 size={15} /> Gửi Gia Hạn Bot
              </Button>
            </div>

            <div className="order-bot-card">
              <strong>QR nạp ví</strong>
              <label>Số tiền<input onChange={(event) => setOrderDepositAmount(event.target.value.replace(/\D/g, ""))} value={orderDepositAmount} /></label>
              <small>QR mặc định hết hạn sau 24 giờ và gửi vào kênh kế toán.</small>
              <Button disabled={!canBillOrder || !orderConfigured || orderBusy || !orderEmail.trim() || parsePositiveInt(orderDepositAmount) < 1000} onClick={() => orderDepositMutation.mutate()} size="sm" type="button" variant="secondary">
                <FileText size={15} /> Tạo QR
              </Button>
              {!canBillOrder ? <small>Bạn cần quyền order.billing để tạo QR.</small> : null}
            </div>

            <div className="order-bot-card">
              <strong>QR đơn hàng</strong>
              <label>Intent code<input onChange={(event) => setOrderIntentCode(event.target.value)} placeholder="QOIABCD1234EFGH5678" value={orderIntentCode} /></label>
              <small>Tạo lại QR theo đúng số tiền của Quick Order; không nhận số tiền nhập tay.</small>
              <Button disabled={!canBillOrder || !orderStatusQuery.data?.quick_order_configured || orderBusy || orderIntentCode.trim().length < 6} onClick={() => orderPaymentMutation.mutate()} size="sm" type="button" variant="secondary">
                <FileText size={15} /> Tạo QR đơn hàng
              </Button>
              {!orderStatusQuery.data?.quick_order_configured ? <small>Cần cấu hình ORDER_QUICK_ORDER_KEY.</small> : null}
            </div>
          </div>
          {orderResult ? <OrderBotResultView result={orderResult} /> : null}
        </section>
      ) : null}

      {canManage ? (
        <div className="bot-workspace-grid">
          <section className="bot-catalog">
            <header>
              <div><h2>Bot trong workspace</h2><p>Chọn một bot để cấu hình và gửi thử.</p></div>
              <Badge tone={activeBots ? "green" : "slate"}>{activeBots} hoạt động</Badge>
            </header>
            {botsQuery.isLoading ? (
              <div className="bot-card-grid"><Skeleton style={{ height: 150 }} /><Skeleton style={{ height: 150 }} /></div>
            ) : botsQuery.isError ? (
              <ErrorState action={<Button onClick={() => void botsQuery.refetch()} size="sm" variant="secondary">Thử lại</Button>} description="Không tải được danh sách bot." title="Lỗi dữ liệu bot" />
            ) : bots.length ? (
              <div className="bot-card-grid">
                {bots.map((bot) => (
                  <button className={bot.id === selectedBot?.id ? "bot-card bot-card--active" : "bot-card"} key={bot.id} onClick={() => setSelectedBotId(bot.id)} type="button">
                    <span className="bot-card__avatar">{bot.avatar_url ? <img alt="" src={bot.avatar_url} /> : <Bot size={23} />}</span>
                    <span className="bot-card__body"><strong>{bot.name}</strong><small>@{bot.slug}</small><p>{bot.description || "Chưa có mô tả cho bot này."}</p></span>
                    <span className={bot.status === "active" ? "bot-status bot-status--active" : "bot-status"}><i />{bot.status === "active" ? "Hoạt động" : bot.status}</span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState action={<Button onClick={() => setIsCreateOpen(true)} size="sm"><Plus size={15} />Tạo bot đầu tiên</Button>} description="Tạo Ticket Bot, Server Alert Bot hoặc Gia Hạn Bot để bắt đầu." title="Chưa có bot" />
            )}
          </section>

          <aside className="bot-control-panel">
            {selectedBot ? (
              <>
                <header>
                  <span className="bot-control-panel__avatar">{selectedBot.avatar_url ? <img alt="" src={selectedBot.avatar_url} /> : <Bot size={26} />}</span>
                  <div><h2>{selectedBot.name}</h2><p>Cập nhật {formatSessionDate(selectedBot.updated_at)}</p></div>
                </header>
                <section>
                  <div className="bot-section-title"><span><Zap size={16} /></span><div><strong>Kết nối kênh</strong><small>{installations.length} cài đặt hiện có</small></div></div>
                  <div className="bot-channel-action">
                    <select aria-label="Chọn kênh cài bot" onChange={(event) => setTargetChannelId(event.target.value)} value={targetChannelId}>
                      {availableChannels.map((channel) => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}
                    </select>
                    <Button disabled={!targetChannelId || installBotMutation.isPending} onClick={() => selectedBot && installBotMutation.mutate({ botId: selectedBot.id, channelId: targetChannelId })} size="sm" variant="secondary">
                      {installBotMutation.isPending ? "Đang nối..." : "Kết nối"}
                    </Button>
                  </div>
                  {!availableChannels.length ? <small>Bạn cần tham gia ít nhất một kênh trước khi cài bot.</small> : null}
                </section>
                <section>
                  <div className="bot-section-title"><span><MessageCircle size={16} /></span><div><strong>Gửi thử tin nhắn</strong><small>Kiểm tra bot trực tiếp trong kênh đã chọn.</small></div></div>
                  <form className="bot-test-form" onSubmit={(event) => {
                    event.preventDefault();
                    if (selectedBot && targetChannelId && testMessage.trim()) {
                      sendBotMessageMutation.mutate({ botId: selectedBot.id, body: testMessage.trim(), channelId: targetChannelId });
                    }
                  }}>
                    <textarea onChange={(event) => setTestMessage(event.target.value)} placeholder="Nhập nội dung bot sẽ gửi..." value={testMessage} />
                    <Button disabled={!targetChannelId || !testMessage.trim() || sendBotMessageMutation.isPending} size="sm" type="submit">
                      <Send size={15} />{sendBotMessageMutation.isPending ? "Đang gửi..." : "Gửi thử"}
                    </Button>
                  </form>
                </section>
              </>
            ) : (
              <EmptyState description="Chọn hoặc tạo một bot để bắt đầu cấu hình." title="Chưa chọn bot" />
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function OrderBotResultView({ result }: { result: OrderBotResult }) {
  if (result.kind === "wallet") {
    const services = result.data.services ?? {};
    return (
      <div className="order-bot-result">
        <strong>Ví khách hàng</strong>
        <span>{orderCustomerLabel(result.data.name, result.data.email, result.data.user_id)}</span>
        <b>{formatOrderMoney(result.data.balance_vnd ?? result.data.balance ?? result.data.money ?? 0)}</b>
        <small>{formatOrderServiceMap(services) || "Chưa có thống kê dịch vụ."}</small>
      </div>
    );
  }
  if (result.kind === "deposit") {
    const bank = result.data.bank ?? {};
    return (
      <div className="order-bot-result">
        <strong>QR nạp ví</strong>
        <span>{orderCustomerLabel(result.data.name, result.data.email, result.data.user_id)}</span>
        <b>{formatOrderMoney(result.data.amount ?? 0)}</b>
        <small>{result.data.reference ? `Mã: ${result.data.reference}` : "Đã tạo yêu cầu nạp ví."}</small>
        <small>{bank.transfer_content || result.data.transfer_content ? `Nội dung CK: ${bank.transfer_content || result.data.transfer_content}` : null}</small>
        {result.data.qr_url ? <BrandedQRCode alt="Mã QR nạp ví" className="order-bot-result__qr" src={result.data.qr_url} /> : null}
        {result.data.qr_url ? <a href={result.data.qr_url} rel="noreferrer" target="_blank">Mở QR kích thước đầy đủ</a> : null}
      </div>
    );
  }
  if (result.kind === "order-payment") {
    return (
      <div className="order-bot-result">
        <strong>QR thanh toán đơn hàng</strong>
        <span>{result.data.external_order_id || `Intent #${result.data.intent_id ?? "—"}`}</span>
        <b>{formatOrderMoney(result.data.amount ?? 0)}</b>
        <small>{result.data.reference ? `Mã: ${result.data.reference}` : "QR theo số tiền được chốt từ Order."}</small>
        {result.data.qr_url ? <BrandedQRCode alt="Mã QR thanh toán đơn hàng" className="order-bot-result__qr" src={result.data.qr_url} /> : null}
        {result.data.qr_url ? <a href={result.data.qr_url} rel="noreferrer" target="_blank">Mở QR kích thước đầy đủ</a> : null}
      </div>
    );
  }
  const summary = result.data.summary ?? {};
  const items = result.data.items ?? [];
  return (
    <div className="order-bot-result">
      <strong>Dịch vụ sắp hết hạn</strong>
      <span>{orderCustomerLabel(result.data.user?.name, result.data.user?.email, result.data.user?.user_id)}</span>
      <b>{summary.total ?? items.length} dịch vụ</b>
      <small>Hết hạn: {summary.expired ?? 0} · Sắp hết hạn: {summary.expiring ?? 0} · Auto-renew tắt: {summary.auto_renew_off ?? 0}</small>
      {items.slice(0, 3).map((item) => (
        <small key={`${item.service_type_key}-${item.service_id}-${item.expires_at}`}>
          {item.service_type || item.service_type_key || "Dịch vụ"} #{item.service_id} · {item.days_remaining ?? 0} ngày · {item.expires_at || "chưa rõ hạn"}
        </small>
      ))}
    </div>
  );
}

function hasOrderLookup(email: string, userId: string) {
  return Boolean(email.trim() || parsePositiveInt(userId) > 0);
}

function buildOrderLookup(email: string, userId: string) {
  const payload: { email?: string; user_id?: number } = {};
  if (email.trim()) payload.email = email.trim();
  const parsedUserId = parsePositiveInt(userId);
  if (parsedUserId > 0) payload.user_id = parsedUserId;
  return payload;
}

function buildOrderEmail(email: string) {
  return { email: email.trim() };
}

function parsePositiveInt(value: string | number | undefined) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function orderCustomerLabel(name?: string, email?: string, userId?: number) {
  return [name, email, userId ? `#${userId}` : ""].filter(Boolean).join(" · ") || "Không rõ khách hàng";
}

function formatOrderMoney(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

function formatOrderServiceMap(services: Record<string, number>) {
  return Object.entries(services)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key.toUpperCase()} ${value}`)
    .join(" · ");
}

function resizeAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxSize = 320;
      const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(source);
        reject(new Error("Canvas is not available"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(source);
      resolve(canvas.toDataURL("image/jpeg", 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("Image could not be loaded"));
    };
    image.src = source;
  });
}

function OperationalPage({ activeRailItem }: { activeRailItem: RailItemId }) {
  const pageConfig: Partial<Record<RailItemId, { icon: typeof Ticket; title: string }>> = {
    automation: {
      icon: Workflow,
      title: "Automation"
    },
    bots: {
      icon: Bot,
      title: "Bot"
    },
    tickets: {
      icon: Ticket,
      title: "Ticket"
    }
  };
  const config = pageConfig[activeRailItem] ?? {
    icon: Archive,
    title: "Chức năng"
  };
  const Icon = config.icon;

  return (
    <div className="workspace-page">
      <section className="operational-empty">
        <Badge tone="orange">Sắp có</Badge>
        <Icon size={42} />
        <h2>{config.title} đang được hoàn thiện</h2>
        <p>WebTui Chat sẽ mở phần này khi quy trình sử dụng đã sẵn sàng cho người dùng.</p>
      </section>
    </div>
  );
}

function CreateChannelForm({
  isPending,
  onCancel,
  onSubmit
}: {
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (input: CreateChannelPayload) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"public" | "private">("public");

  function handleNameChange(value: string) {
    setName(value);
    setSlug((current) => current || slugify(value));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanSlug = slugify(slug || name);

    if (!cleanName || !cleanSlug) {
      return;
    }

    onSubmit({
      description: description.trim(),
      name: cleanName,
      slug: cleanSlug,
      type
    });
  }

  return (
    <form className="channel-create-form" onSubmit={handleSubmit}>
      <Input
        aria-label="Tên kênh"
        onChange={(event) => handleNameChange(event.target.value)}
        placeholder="Tên kênh"
        required
        value={name}
      />
      <Input
        aria-label="Slug kênh"
        onChange={(event) => setSlug(slugify(event.target.value))}
        placeholder="slug-kenh"
        required
        value={slug}
      />
      <Input
        aria-label="Mô tả kênh"
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Mô tả ngắn"
        value={description}
      />
      <div className="channel-create-form__footer">
        <select aria-label="Loại kênh" onChange={(event) => setType(event.target.value as "public" | "private")} value={type}>
          <option value="public">Công khai</option>
          <option value="private">Riêng tư</option>
        </select>
        <Button disabled={isPending} size="sm" type="submit">
          Tạo
        </Button>
        <Button onClick={onCancel} size="sm" variant="ghost">
          Hủy
        </Button>
      </div>
    </form>
  );
}

const quickEmojis = [
  "😀", "😃", "😄", "😁", "😆", "🥹", "😂", "🤣", "😊", "😍", "🥰", "😘",
  "😎", "🤓", "🧐", "🤩", "🥳", "😇", "🙂", "🙃", "😉", "😌", "😋", "🤗",
  "🤔", "🤭", "🫢", "😮", "😲", "😴", "🥱", "😢", "😭", "😤", "😡", "🤯",
  "👍", "👎", "👏", "🙌", "🙏", "🤝", "💪", "✌️", "👌", "🤞", "🫶", "👀",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💯", "✨", "🔥",
  "✅", "❌", "❓", "⚠️", "🎉", "🎊", "🎁", "🏆", "🚀", "💡", "📌", "💬"
];

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="emoji-picker" aria-label="Chọn biểu cảm">
      {quickEmojis.map((emoji) => (
        <button key={emoji} onClick={() => onSelect(emoji)} type="button">
          {emoji}
        </button>
      ))}
    </div>
  );
}

function TypingDots({ label }: { label: string }) {
  return (
    <div className="typing-dots" aria-label={label}>
      <small>{label}</small>
      <span />
      <span />
      <span />
    </div>
  );
}

function ChatHeader({
  channel,
  isDetailPanelOpen = false,
  isFavorite = false,
  isMembersLoading = false,
  isSearchOpen,
  members = [],
  onMarkUnread,
  onToggleDetailPanel,
  onToggleFavorite,
  onToggleSearch
}: {
  channel: ChatChannel;
  isDetailPanelOpen?: boolean;
  isFavorite?: boolean;
  isMembersLoading?: boolean;
  isSearchOpen: boolean;
  members?: ChannelMember[];
  onMarkUnread?: () => void;
  onToggleDetailPanel?: () => void;
  onToggleFavorite?: () => void;
  onToggleSearch: () => void;
}) {
  const [openPopover, setOpenPopover] = useState<"members" | "more" | null>(null);

  useEffect(() => setOpenPopover(null), [channel.id]);

  return (
    <header className="chat-header">
      <div className="chat-title">
        <span className={`channel-hash channel-hash--${channel.tone}`} style={channelHashStyle(channel)}>#</span>
        <div>
          <h1>{channel.name}</h1>
          <p>{channel.description}</p>
        </div>
      </div>
      <div className="chat-actions">
        <div className="chat-header-control">
          <Tooltip label="Thành viên">
            <Button
              aria-expanded={openPopover === "members"}
              aria-label={`Xem ${channel.memberCount} thành viên`}
              className={openPopover === "members" ? "member-count chat-action-active" : "member-count"}
              onClick={() => setOpenPopover((current) => current === "members" ? null : "members")}
              size="sm"
              variant="ghost"
            >
              <Users size={18} /> {channel.memberCount}
            </Button>
          </Tooltip>
          {openPopover === "members" ? (
            <div className="chat-header-popover chat-members-popover" role="dialog" aria-label="Danh sách thành viên">
              <header>
                <div>
                  <strong>Thành viên</strong>
                  <small>{channel.memberCount} người trong cuộc trò chuyện</small>
                </div>
                <button aria-label="Đóng danh sách thành viên" onClick={() => setOpenPopover(null)} type="button"><X size={16} /></button>
              </header>
              <div className="chat-members-list">
                {isMembersLoading ? <Skeleton style={{ height: 84 }} /> : members.length ? members.map((member) => {
                  const name = member.display_name || member.username || member.email || "Thành viên";
                  return (
                    <article key={member.user_id}>
                      <Avatar name={name} size="sm" src={member.avatar_url ?? undefined} />
                      <span>
                        <strong>{name}</strong>
                        <small>{member.status === "active" ? "Đang hoạt động" : member.status || "Thành viên"}</small>
                      </span>
                    </article>
                  );
                }) : <p>Chưa tải được danh sách thành viên.</p>}
              </div>
            </div>
          ) : null}
        </div>
        <Tooltip label="Tìm kiếm">
          <Button
            aria-label={isSearchOpen ? "Đóng tìm kiếm" : "Tìm kiếm"}
            className={isSearchOpen ? "chat-action-active" : undefined}
            onClick={() => {
              setOpenPopover(null);
              onToggleSearch();
            }}
            type="button"
            variant="icon"
          >
            <Search size={19} />
          </Button>
        </Tooltip>
        <Tooltip label={isDetailPanelOpen ? "Ẩn thông tin cuộc trò chuyện" : "Hiện thông tin cuộc trò chuyện"}>
          <Button
            aria-label={isDetailPanelOpen ? "Ẩn thông tin cuộc trò chuyện" : "Hiện thông tin cuộc trò chuyện"}
            className={isDetailPanelOpen ? "chat-action-active" : undefined}
            disabled={!onToggleDetailPanel}
            onClick={() => {
              setOpenPopover(null);
              onToggleDetailPanel?.();
            }}
            variant="icon"
          >
            <Info size={19} />
          </Button>
        </Tooltip>
        <div className="chat-header-control">
          <Tooltip label="Tùy chọn khác">
            <Button
              aria-expanded={openPopover === "more"}
              aria-label="Tùy chọn khác"
              className={openPopover === "more" ? "chat-action-active" : undefined}
              onClick={() => setOpenPopover((current) => current === "more" ? null : "more")}
              variant="icon"
            >
              <MoreVertical size={19} />
            </Button>
          </Tooltip>
          {openPopover === "more" ? (
            <div className="chat-header-popover chat-more-menu" role="menu">
              <button onClick={() => { onToggleFavorite?.(); setOpenPopover(null); }} role="menuitem" type="button">
                <Star fill={isFavorite ? "currentColor" : "none"} size={17} />
                {isFavorite ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"}
              </button>
              <button onClick={() => { onMarkUnread?.(); setOpenPopover(null); }} role="menuitem" type="button">
                <MessageCircle size={17} />
                Đánh dấu chưa đọc
              </button>
            </div>
          ) : null}
        </div>
        {!isDetailPanelOpen && onToggleDetailPanel ? (
          <Tooltip label="Mở bảng thông tin">
            <Button
              aria-label="Mở bảng thông tin cuộc trò chuyện"
              className="chat-panel-open-button"
              onClick={() => {
                setOpenPopover(null);
                onToggleDetailPanel();
              }}
              variant="icon"
            >
              <PanelRightOpen size={19} />
            </Button>
          </Tooltip>
        ) : null}
      </div>
    </header>
  );
}

function ChannelAccessView({
  channel,
  isPending,
  onRequestJoin
}: {
  channel: ChatChannel;
  isPending: boolean;
  onRequestJoin: () => void;
}) {
  const isWaiting = channel.membershipStatus === "invited";

  return (
    <div className="channel-access-view">
      <ChatHeader channel={channel} isSearchOpen={false} onToggleSearch={() => undefined} />
      <section>
        <span><ShieldCheck size={30} /></span>
        <h2>{isWaiting ? "Yêu cầu đang chờ phê duyệt" : "Bạn chưa tham gia kênh này"}</h2>
        <p>
          {isWaiting
            ? "Chủ kênh cần phê duyệt trước khi bạn có thể xem và gửi tin nhắn."
            : "Nội dung kênh chỉ hiển thị cho thành viên đã được chủ kênh phê duyệt."}
        </p>
        <Button disabled={isPending || isWaiting} onClick={onRequestJoin}>
          {isPending ? "Đang gửi..." : isWaiting ? "Đang chờ duyệt" : "Yêu cầu tham gia kênh"}
        </Button>
      </section>
    </div>
  );
}

function NotificationDropdown({
  contactRequests,
  isLoading,
  isMutatingContactRequest,
  isMarkingAllRead,
  notifications,
  onAcceptContactRequest,
  onMarkAllRead,
  onOpenContacts,
  onOpenNotification,
  onRejectContactRequest
}: {
  contactRequests: ContactRequest[];
  isLoading: boolean;
  isMutatingContactRequest: boolean;
  isMarkingAllRead: boolean;
  notifications: NotificationItem[];
  onAcceptContactRequest: (request: ContactRequest) => void;
  onMarkAllRead: () => void;
  onOpenContacts: () => void;
  onOpenNotification: (notification: NotificationItem) => void;
  onRejectContactRequest: (request: ContactRequest) => void;
}) {
  const unreadNotificationCount = notifications.filter((item) => !item.isRead).length;
  const totalUnreadCount = unreadNotificationCount + contactRequests.length;

  return (
    <section className="notification-dropdown" aria-label="Thông báo">
      <header>
        <div>
          <strong>Thông báo</strong>
          <span>{totalUnreadCount} chưa đọc</span>
        </div>
        <Button disabled={isMarkingAllRead || !notifications.length} onClick={onMarkAllRead} size="sm" variant="secondary">
          Đánh dấu đã đọc
        </Button>
      </header>
      {contactRequests.length ? (
        <div className="notification-list">
          {contactRequests.map((request) => (
            <article className="notification-row notification-row--unread contact-request-row" key={request.id}>
              <span />
              <div>
                <strong>{request.user.display_name || request.user.username}</strong>
                <p>Đã gửi lời mời kết bạn. Đồng ý để mở hội thoại riêng.</p>
                <small>{request.user.email}</small>
                <div className="contact-request-row__actions">
                  <Button disabled={isMutatingContactRequest} onClick={() => onAcceptContactRequest(request)} size="sm" variant="primary">
                    Đồng ý
                  </Button>
                  <Button disabled={isMutatingContactRequest} onClick={() => onRejectContactRequest(request)} size="sm" variant="ghost">
                    Từ chối
                  </Button>
                  <Button onClick={onOpenContacts} size="sm" variant="secondary">
                    Xem danh bạ
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {isLoading ? (
        <PanelSkeleton />
      ) : notifications.length ? (
        <div className="notification-list">
          {notifications.map((notification) => (
            <button
              className={notification.isRead ? "notification-row" : "notification-row notification-row--unread"}
              key={notification.id}
              onClick={() => onOpenNotification(notification)}
              type="button"
            >
              <span />
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
                <small>
                  {notification.type} - {notification.createdAt}
                </small>
              </div>
            </button>
          ))}
        </div>
      ) : !contactRequests.length ? (
        <EmptyState description="Bạn chưa có thông báo mới." title="Chưa có thông báo" />
      ) : null}
    </section>
  );
}

function UploadQueue({
  disabled,
  items,
  onRemove,
  onRetry
}: {
  disabled: boolean;
  items: UploadQueueItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const labels: Record<UploadQueueItem["status"], string> = {
    attached: "Đã gắn",
    failed: "Lỗi",
    queued: "Chờ gửi",
    uploading: "Đang tải"
  };

  const imageCount = items.filter((item) => item.isImage).length;

  return (
    <div className={imageCount ? "upload-queue upload-queue--media" : "upload-queue"} aria-label="Hàng đợi upload">
      {imageCount ? (
        <header className="upload-queue__header">
          <strong>{imageCount} ảnh</strong>
          <span>{items.length > imageCount ? `${items.length - imageCount} file khác` : "Sẵn sàng gửi"}</span>
        </header>
      ) : null}
      {items.map((item) => (
        <article className={`upload-queue__item upload-queue__item--${item.status}${item.isAudio ? " upload-queue__item--audio" : ""}`} key={item.id}>
          {item.isImage && item.previewUrl ? (
            <img alt={item.name} className="upload-queue__thumb" src={item.previewUrl} />
          ) : item.isAudio && item.previewUrl ? (
            <VoiceMessagePlayer id={`preview-${item.id}`} source={item.previewUrl} />
          ) : (
            <span className="upload-queue__icon">
              {item.isAudio ? <Mic size={16} /> : item.status === "attached" ? <CheckCircle2 size={16} /> : <Cloud size={16} />}
            </span>
          )}
          <div>
            <strong>{item.isAudio ? "Tin nhắn thoại" : item.name}</strong>
            <small>
              {item.durationSeconds ? `${formatVoiceTime(item.durationSeconds)} · ` : ""}{formatFileSize(item.size)} - {item.error ?? labels[item.status]}
            </small>
            {item.status === "uploading" ? <i /> : null}
          </div>
          {item.status === "failed" ? (
            <button disabled={disabled} onClick={() => onRetry(item.id)} type="button">
              Thử lại
            </button>
          ) : null}
          {item.status === "queued" || item.status === "failed" ? (
            <button aria-label={`Xóa ${item.name}`} disabled={disabled} onClick={() => onRemove(item.id)} type="button">
              <X size={15} />
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ForwardMessageDialog({
  channels,
  isPending,
  onCancel,
  onSubmit
}: {
  channels: Array<{ id: string; name: string }>;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (channelId: string) => void;
}) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");

  return (
    <div className="forward-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()} role="presentation">
      <section aria-labelledby="forward-dialog-title" aria-modal="true" className="forward-dialog" role="dialog">
        <div>
          <h2 id="forward-dialog-title">Chuyển tiếp tin nhắn</h2>
          <p>Chọn cuộc trò chuyện hoặc kênh mà bạn đang là thành viên.</p>
        </div>
        <label>
          Nơi nhận
          <select autoFocus onChange={(event) => setChannelId(event.target.value)} value={channelId}>
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
          </select>
        </label>
        {!channels.length ? <p>Bạn chưa có kênh đích phù hợp.</p> : null}
        <div className="forward-dialog__actions">
          <Button disabled={isPending} onClick={onCancel} variant="secondary">Hủy</Button>
          <Button disabled={isPending || !channelId} onClick={() => onSubmit(channelId)}>
            {isPending ? "Đang chuyển..." : "Chuyển tiếp"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function MessageTimeline({
  currentUserId,
  editingBody,
  editingMessageId,
  hasOlderMessages,
  isEditingPending,
  isLoadingOlderMessages,
  messages,
  onCancelEdit,
  onChangeEditingBody,
  onDeleteMessage,
  onDownloadAttachment,
  onForwardMessage,
  onResolveAttachment,
  onLoadOlderMessages,
  onOpenThread,
  onSearchResultSelect,
  onStartEdit,
  onSubmitEdit,
  onTogglePin,
  onToggleReaction,
  pinnedMessageIds,
  readMembers,
  searchQuery,
  searchResults
}: {
  currentUserId: string;
  editingBody: string;
  editingMessageId: string | null;
  hasOlderMessages: boolean;
  isEditingPending: boolean;
  isLoadingOlderMessages: boolean;
  messages: ChatMessage[];
  onCancelEdit: () => void;
  onChangeEditingBody: (value: string) => void;
  onDeleteMessage: (message: ChatMessage) => void;
  onDownloadAttachment: (attachment: MessageAttachmentItem) => void;
  onForwardMessage: (messageId: string) => void;
  onResolveAttachment: (fileId: string) => Promise<Blob>;
  onLoadOlderMessages: () => void;
  onOpenThread: (messageId: string) => void;
  onSearchResultSelect: (message: ChatMessage) => void;
  onStartEdit: (message: ChatMessage) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePin: (message: ChatMessage, isPinned: boolean) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  pinnedMessageIds: Set<string>;
  readMembers: ChannelMember[];
  searchQuery: string;
  searchResults: ChatMessage[];
}) {
  const lastMessageId = messages.at(-1)?.id;
  const bottomRef = useRef<HTMLDivElement>(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const messageOrderById = useMemo(() => new Map(messages.map((message, index) => [message.id, index])), [messages]);
  const lastOwnReceipt = useMemo(
    () => resolveLastOwnMessageReceipt(messages, readMembers, currentUserId, messageOrderById),
    [currentUserId, messageOrderById, messages, readMembers]
  );

  useEffect(() => {
    if (!lastMessageId) {
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? "smooth" : "auto", block: "end" });
    const timeout = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [lastMessageId, messages.length]);

  if (!messages.length) {
    return (
      <div className="message-timeline">
        {hasOlderMessages ? (
          <Button disabled={isLoadingOlderMessages} onClick={onLoadOlderMessages} size="sm" variant="secondary">
            {isLoadingOlderMessages ? "Đang tải..." : "Tải tin nhắn cũ"}
          </Button>
        ) : null}
        <EmptyState description="Tin nhắn mới sẽ xuất hiện tại đây." title="Kênh này chưa có tin nhắn" />
      </div>
    );
  }

  return (
    <div className="message-timeline">
      {hasOlderMessages ? (
        <Button className="load-older-button" disabled={isLoadingOlderMessages} onClick={onLoadOlderMessages} size="sm" variant="secondary">
          {isLoadingOlderMessages ? "Đang tải..." : "Tải tin nhắn cũ"}
        </Button>
      ) : null}

      {searchQuery.trim().length >= 2 ? (
        <section className="message-search-results">
          <header>
            <strong>Kết quả tìm kiếm</strong>
            <span>{searchResults.length} tin nhắn</span>
          </header>
          {searchResults.length ? (
            searchResults.map((message) => (
              <button key={message.id} onClick={() => onSearchResultSelect(message)} type="button">
                <Avatar name={message.author.name} size="sm" />
                <span>
                  <strong>{message.author.name}</strong>
                  <small>{message.body}</small>
                </span>
              </button>
            ))
          ) : (
            <EmptyState description="Không có tin nhắn nào khớp từ khóa hiện tại." title="Không tìm thấy" />
          )}
        </section>
      ) : null}

      {messages.map((message) => (
        <article
          className={`${message.isMine ? "message-row message-row--local" : "message-row"}${isImageOnlyMessage(message) ? " message-row--media-only" : ""}`}
          key={message.id}
        >
          <Avatar name={message.author.name} src={message.author.avatarUrl} status={message.author.status} />
          <div className="message-row__content">
            <header>
              <strong>{message.author.name}</strong>
              {message.isBot ? <Badge tone="blue">BOT</Badge> : null}
              <span>{message.sentAt}</span>
              {message.isForwarded ? <span>Đã chuyển tiếp</span> : null}
              {message.editedAt ? <span>Đã sửa {message.editedAt}</span> : null}
              {message.isPending ? <Badge tone="blue">Đang gửi</Badge> : null}
              <div className="message-actions">
                {!message.isDeleted ? (
                  <Tooltip label={pinnedMessageIds.has(message.id) ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}>
                    <button
                      aria-label={pinnedMessageIds.has(message.id) ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn"}
                      className={pinnedMessageIds.has(message.id) ? "message-pin-button message-pin-button--active" : "message-pin-button"}
                      onClick={() => onTogglePin(message, pinnedMessageIds.has(message.id))}
                      type="button"
                    >
                      <Pin size={15} />
                    </button>
                  </Tooltip>
                ) : null}
                {message.canEdit ? (
                  <Tooltip label="Sửa tin nhắn">
                    <button aria-label="Sửa tin nhắn" onClick={() => onStartEdit(message)} type="button">
                      <Edit3 size={15} />
                    </button>
                  </Tooltip>
                ) : null}
                {message.canDelete ? (
                  <Tooltip label="Xóa tin nhắn">
                    <button aria-label="Xóa tin nhắn" onClick={() => onDeleteMessage(message)} type="button">
                      <Trash2 size={15} />
                    </button>
                  </Tooltip>
                ) : null}
                {!message.isDeleted && !message.isPending ? (
                  <Tooltip label="Chuyển tiếp tin nhắn">
                    <button aria-label="Chuyển tiếp tin nhắn" onClick={() => onForwardMessage(message.id)} type="button">
                      <Share2 size={15} />
                    </button>
                  </Tooltip>
                ) : null}
                <Tooltip label="Mở luồng trả lời">
                  <button aria-label="Mở luồng trả lời" onClick={() => onOpenThread(message.id)} type="button">
                    <Reply size={15} />
                  </button>
                </Tooltip>
              </div>
            </header>
            {editingMessageId === message.id ? (
              <form className="message-edit-form" onSubmit={onSubmitEdit}>
                <input
                  aria-label="Nội dung sửa"
                  autoFocus
                  onChange={(event) => onChangeEditingBody(event.target.value)}
                  value={editingBody}
                />
                <Button disabled={isEditingPending || !editingBody.trim()} size="sm" type="submit">
                  Lưu
                </Button>
                <Button disabled={isEditingPending} onClick={onCancelEdit} size="sm" variant="ghost">
                  Hủy
                </Button>
              </form>
            ) : shouldRenderMessageBody(message) ? (
              <MessageBody body={message.qrImageUrl ? stripDisplayedQRURL(message.body) : message.body} />
            ) : null}
            {message.isVoice && !message.attachments?.some((attachment) => attachment.isAudio) ? (
              <div className="attachment-audio"><span className="attachment-media-loading">Đang tải tin nhắn thoại...</span></div>
            ) : null}
            {message.qrImageUrl ? (
              <a
                aria-label="Mở mã QR thanh toán"
                className="message-payment-qr"
                href={message.qrImageUrl}
                rel="noreferrer"
                target="_blank"
              >
                <BrandedQRCode
                  alt={`Mã QR thanh toán${message.qrReference ? ` ${message.qrReference}` : ""}`}
                  src={message.qrImageUrl}
                />
                <span>
                  <strong>Quét mã QR để thanh toán</strong>
                  <small>{message.qrReference ? `Mã tham chiếu: ${message.qrReference}` : "Nhấn để mở ảnh QR kích thước đầy đủ"}</small>
                </span>
              </a>
            ) : null}
            {message.attachments?.length ? (
              <div className="attachment-list">
                {message.attachments.map((attachment) =>
                  attachment.isAudio || attachment.isImage || attachment.isVideo ? (
                    <AttachmentMedia
                      attachment={attachment}
                      key={attachment.id}
                      onDownload={onDownloadAttachment}
                      onResolve={onResolveAttachment}
                    />
                  ) : (
                    <button
                      className="attachment-chip"
                      key={attachment.id}
                      onClick={() => onDownloadAttachment(attachment)}
                      type="button"
                    >
                      <span className={`file-icon file-icon--${attachment.tone}`}>
                        <FileText size={16} />
                      </span>
                      <span>
                        <strong>{attachment.name}</strong>
                        <small>{attachment.size ?? attachment.mimeType ?? "File đính kèm"}</small>
                      </span>
                    </button>
                  )
                )}
              </div>
            ) : null}
            {message.reactions?.length ? (
              <div className="reaction-pill">
                {message.reactions.map((reaction) => (
                  <button
                    className={reaction.reactedByMe ? "reaction-pill__item reaction-pill__item--active" : "reaction-pill__item"}
                    key={reaction.emoji}
                    onClick={() => onToggleReaction(message, reaction.emoji)}
                    type="button"
                  >
                    {reaction.emoji} {reaction.count}
                  </button>
                ))}
              </div>
            ) : null}
            {lastOwnReceipt?.messageId === message.id ? (
              <span className={`message-read-status message-read-status--${lastOwnReceipt.tone}`}>
                <span aria-hidden="true">✓✓</span>
                {lastOwnReceipt.label}
              </span>
            ) : null}
            {!message.isDeleted ? (
              <div className="message-reaction-control">
                <button
                  aria-expanded={reactionPickerMessageId === message.id}
                  aria-label="Thả cảm xúc"
                  className="reaction-add-button"
                  onClick={() => setReactionPickerMessageId((current) => current === message.id ? null : message.id)}
                  type="button"
                >
                  <Smile size={15} />
                </button>
                {reactionPickerMessageId === message.id ? (
                  <div className="message-reaction-picker" role="menu" aria-label="Chọn cảm xúc">
                    {quickReactions.map((emoji) => (
                      <button
                        aria-label={`Thả cảm xúc ${emoji}`}
                        key={emoji}
                        onClick={() => {
                          onToggleReaction(message, emoji);
                          setReactionPickerMessageId(null);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </article>
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}

type MessageReceipt = {
  label: "Đã nhận" | "Đã xem";
  messageId: string;
  tone: "delivered" | "seen";
};

function resolveLastOwnMessageReceipt(
  messages: ChatMessage[],
  readMembers: ChannelMember[],
  currentUserId: string,
  messageOrderById: Map<string, number>
): MessageReceipt | null {
  const message = [...messages].reverse().find((item) => item.isMine && !item.isDeleted && !item.isPending && !item.isLocal);
  if (!message) {
    return null;
  }

  const messageIndex = messageOrderById.get(message.id) ?? -1;
  const messageCreatedAt = parseDateMs(message.rawCreatedAt);
  const hasReader = readMembers.some((member) => {
    if (!member.user_id || member.user_id === currentUserId) {
      return false;
    }
    return memberHasReadMessage(member, messageIndex, messageCreatedAt, messageOrderById);
  });

  return {
    label: hasReader ? "Đã xem" : "Đã nhận",
    messageId: message.id,
    tone: hasReader ? "seen" : "delivered"
  };
}

function memberHasReadMessage(
  member: ChannelMember,
  messageIndex: number,
  messageCreatedAt: number | null,
  messageOrderById: Map<string, number>
) {
  const readMessageId = member.last_read_message_id ?? "";
  const readMessageIndex = readMessageId ? messageOrderById.get(readMessageId) : undefined;
  if (typeof readMessageIndex === "number" && messageIndex >= 0) {
    return readMessageIndex >= messageIndex;
  }

  const readAt = parseDateMs(member.last_read_at);
  return Boolean(readAt && messageCreatedAt && readAt >= messageCreatedAt);
}

function parseDateMs(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function MessageBody({ body }: { body: string }) {
  const blocks = body.split("```");
  return (
    <div className="message-body">
      {blocks.map((block, index) =>
        index % 2 === 1 ? (
          <pre key={`${index}-${block.slice(0, 12)}`}><code>{stripCodeLanguage(block)}</code></pre>
        ) : (
          <Fragment key={`${index}-${block.slice(0, 12)}`}>{renderInlineMarkdown(block)}</Fragment>
        )
      )}
    </div>
  );
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/gi;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > cursor) {
      nodes.push(value.slice(cursor, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${match.index}-${token}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(<code key={`${match.index}-${token}`}>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/i.exec(token);
      nodes.push(link ? <a href={link[2]} key={`${match.index}-${token}`} rel="noreferrer noopener" target="_blank">{link[1]}</a> : token);
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }
  return nodes;
}

function stripCodeLanguage(block: string) {
  const normalized = block.replace(/^\r?\n/, "");
  const firstNewline = normalized.indexOf("\n");
  if (firstNewline > 0 && /^[a-z0-9_+-]{1,20}\r?$/i.test(normalized.slice(0, firstNewline))) {
    return normalized.slice(firstNewline + 1).replace(/\r?\n$/, "");
  }
  return normalized.replace(/\r?\n$/, "");
}

function AttachmentMedia({
  attachment,
  onDownload,
  onResolve
}: {
  attachment: MessageAttachmentItem;
  onDownload: (attachment: MessageAttachmentItem) => void;
  onResolve: (fileId: string) => Promise<Blob>;
}) {
  const directSource = attachment.previewUrl ?? attachment.url;
  const [resolvedSource, setResolvedSource] = useState<string | undefined>(directSource ?? getCachedMediaUrl(attachment.fileId));

  useEffect(() => {
    if (directSource) {
      setResolvedSource(directSource);
      return undefined;
    }

    let disposed = false;
    void resolveCachedMediaUrl(attachment.fileId, () => onResolve(attachment.fileId))
      .then((url) => {
        if (disposed) {
          return;
        }
        setResolvedSource(url);
      })
      .catch(() => setResolvedSource(undefined));

    return () => {
      disposed = true;
    };
  }, [attachment.fileId, directSource, onResolve]);

  if (attachment.isAudio) {
    return resolvedSource
      ? <VoiceMessagePlayer id={attachment.id} source={resolvedSource} />
      : <div className="attachment-audio"><span className="attachment-media-loading">Đang tải tin nhắn thoại...</span></div>;
  }

  if (attachment.isVideo) {
    return (
      <div className="attachment-video">
        {resolvedSource ? (
          <video controls playsInline preload="metadata" src={resolvedSource}>
            Trình duyệt của bạn không hỗ trợ phát video.
          </video>
        ) : <span className="attachment-media-loading">Đang tải video...</span>}
        <button disabled={!resolvedSource} onClick={() => onDownload(attachment)} type="button">{attachment.name}</button>
      </div>
    );
  }

  return (
    <button className="attachment-image" disabled={!resolvedSource} onClick={() => onDownload(attachment)} type="button">
      {resolvedSource ? <img alt={attachment.name} decoding="async" loading="lazy" src={resolvedSource} /> : <span className="attachment-media-loading">Đang tải ảnh...</span>}
      <span>{attachment.name}</span>
    </button>
  );
}

const voiceWaveformHeights = [8, 14, 10, 20, 13, 24, 16, 10, 21, 14, 26, 18, 10, 20, 13, 24, 16, 9, 18, 12, 23, 16, 10, 21, 14, 25, 17, 10, 20, 13, 22, 15];

function VoiceMessagePlayer({ id, source }: { id: string; source: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setPlaybackRate(1);
  }, [source]);

  useEffect(() => {
    const pauseOtherPlayer = (event: Event) => {
      const activeId = (event as CustomEvent<string>).detail;
      if (activeId !== id) {
        audioRef.current?.pause();
      }
    };
    window.addEventListener("webtui:voice-play", pauseOtherPlayer);
    return () => window.removeEventListener("webtui:voice-play", pauseOtherPlayer);
  }, [id]);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      window.dispatchEvent(new CustomEvent("webtui:voice-play", { detail: id }));
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  }

  function cyclePlaybackRate() {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  }

  return (
    <div className={isPlaying ? "voice-message voice-message--playing" : "voice-message"}>
      <button
        aria-label={isPlaying ? "Tạm dừng tin nhắn thoại" : "Phát tin nhắn thoại"}
        className="voice-message__play"
        onClick={() => void togglePlayback()}
        type="button"
      >
        <span className={isPlaying ? "voice-message__pause-icon" : "voice-message__play-icon"} />
      </button>
      <div className="voice-message__timeline">
        <div className="voice-message__waveform" aria-hidden="true">
          {voiceWaveformHeights.map((height, index) => (
            <i
              className={index / voiceWaveformHeights.length <= progress ? "voice-message__bar voice-message__bar--played" : "voice-message__bar"}
              key={`${id}-${index}`}
              style={{ height }}
            />
          ))}
        </div>
        <input
          aria-label="Tua tin nhắn thoại"
          max={duration || 1}
          min="0"
          onChange={(event) => {
            const nextTime = Number(event.target.value);
            setCurrentTime(nextTime);
            if (audioRef.current) audioRef.current.currentTime = nextTime;
          }}
          step="0.01"
          type="range"
          value={currentTime}
        />
      </div>
      <time>{formatVoiceTime(isPlaying ? currentTime : duration)}</time>
      <button aria-label="Đổi tốc độ phát" className="voice-message__rate" onClick={cyclePlaybackRate} type="button">
        {playbackRate}x
      </button>
      <audio
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() => {
          setCurrentTime(0);
          setIsPlaying(false);
        }}
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        preload="metadata"
        ref={audioRef}
        src={source}
      >
        Trình duyệt của bạn không hỗ trợ phát tin nhắn thoại.
      </audio>
    </div>
  );
}

function formatVoiceTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function shouldRenderMessageBody(message: ChatMessage): boolean {
  if (!message.body.trim()) {
    return false;
  }

  if (message.isVoice) {
    return false;
  }

  const attachments = message.attachments ?? [];
  const hasOnlyImages = attachments.length > 0 && attachments.every((attachment) => attachment.isImage);
  const hasOnlyAudio = attachments.length > 0 && attachments.every((attachment) => attachment.isAudio);
  if (hasOnlyAudio && /^Đã gửi(?: \d+)? tin nhắn thoại$/.test(message.body.trim())) {
    return false;
  }
  if (!hasOnlyImages) {
    return true;
  }

  return !/^Đã gửi(?: \d+)? ảnh$/.test(message.body.trim());
}

function isImageOnlyMessage(message: ChatMessage): boolean {
  const attachments = message.attachments ?? [];
  return attachments.length > 0 && attachments.every((attachment) => attachment.isImage) && !shouldRenderMessageBody(message);
}

function formatRecordingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function preferredVoiceMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  return [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/webm"
  ].find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? "";
}

function voiceFileExtension(mimeType: string) {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("ogg")) return "ogg";
  if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
  if (normalized.includes("mpeg")) return "mp3";
  if (normalized.includes("wav")) return "wav";
  return "webm";
}

function MediaGalleryThumbnail({
  item,
  onResolve
}: {
  item: MediaItem;
  onResolve: (fileId: string) => Promise<Blob>;
}) {
  const [source, setSource] = useState(item.url ?? getCachedMediaUrl(item.id));

  useEffect(() => {
    if (item.url) {
      setSource(item.url);
      return undefined;
    }
    let disposed = false;
    void resolveCachedMediaUrl(item.id, () => onResolve(item.id))
      .then((url) => {
        if (!disposed) {
          setSource(url);
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [item.id, item.url, onResolve]);

  return (
    <span
      aria-label={item.label}
      className={source ? "media-file-thumb media-file-thumb--loaded" : "media-file-thumb"}
      role="img"
      style={source ? { backgroundImage: `url(${source})` } : undefined}
    >
      {!source ? <ImageIcon size={18} /> : null}
    </span>
  );
}

function RightDetailPanel({
  activeTab,
  files,
  isLoading,
  isSendingThread,
  isThreadLoading,
  mediaItems,
  onClose,
  onCloseThread,
  onFileSelect,
  onResolveMedia,
  onSendThread,
  onTabChange,
  pinnedMessages,
  threadMessageId,
  threadMessages
}: {
  activeTab: DetailTab;
  files: FileItem[];
  isLoading: boolean;
  isSendingThread: boolean;
  isThreadLoading: boolean;
  mediaItems: MediaItem[];
  onClose: () => void;
  onCloseThread: () => void;
  onFileSelect: (file: FileItem) => void;
  onResolveMedia: (fileId: string) => Promise<Blob>;
  onSendThread: (body: string) => void;
  onTabChange: (tab: DetailTab) => void;
  pinnedMessages: PinnedMessage[];
  threadMessageId: string | null;
  threadMessages: ChatMessage[];
}) {
  const [threadDraft, setThreadDraft] = useState("");

  function handleThreadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = threadDraft.trim();
    if (!body || isSendingThread) {
      return;
    }
    onSendThread(body);
    setThreadDraft("");
  }

  return (
    <aside className={threadMessageId ? "detail-panel detail-panel--thread-open" : "detail-panel"} aria-label="Thông tin kênh">
      {threadMessageId ? (
        <section className="thread-panel">
          <header>
            <div>
              <h2>Luồng trả lời</h2>
              <span>{threadMessages.length} tin nhắn</span>
            </div>
            <Button aria-label="Đóng luồng trả lời" onClick={onCloseThread} size="sm" variant="icon">
              <X size={18} />
            </Button>
          </header>
          {isThreadLoading ? (
            <PanelSkeleton />
          ) : threadMessages.length ? (
            <div className="thread-list">
              {threadMessages.map((message) => (
                <article key={message.id}>
                  <Avatar name={message.author.name} size="sm" src={message.author.avatarUrl} />
                  <div>
                    <strong>{message.author.name}</strong>
                    <small>{message.sentAt}</small>
                    <MessageBody body={message.body} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState description="Luồng này chưa có tin nhắn." title="Luồng trống" />
          )}
          <form className="thread-composer" onSubmit={handleThreadSubmit}>
            <input
              aria-label="Trả lời trong luồng"
              onChange={(event) => setThreadDraft(event.target.value)}
              placeholder="Trả lời trong luồng..."
              value={threadDraft}
            />
            <Button aria-label="Gửi trả lời" disabled={isSendingThread || !threadDraft.trim()} size="sm" type="submit" variant="icon">
              <Send size={17} />
            </Button>
          </form>
        </section>
      ) : null}

      <div className="detail-tabs">
        <SegmentedControl aria-label="Tab thông tin kênh" onValueChange={onTabChange} options={detailTabs} value={activeTab} />
        <Tooltip label="Ẩn bảng thông tin">
          <Button aria-label="Ẩn bảng thông tin" onClick={onClose} variant="icon">
            <PanelRightClose size={18} />
          </Button>
        </Tooltip>
      </div>

      {activeTab === "pinned" ? (
        <section className="detail-section">
          <header>
            <h2>Tin nhắn đã ghim</h2>
          </header>
          {pinnedMessages.length ? (
            pinnedMessages.map((item) => (
              <article className="pinned-card" key={item.id}>
                <Avatar name={item.author.name} size="sm" />
                <div>
                  <strong>{item.author.name}</strong>
                  <small>{item.date}</small>
                  <p>{item.text}</p>
                </div>
                <Pin size={16} />
              </article>
            ))
          ) : (
            <EmptyState description="Kênh này chưa có tin nhắn được ghim." title="Chưa có tin ghim" />
          )}
        </section>
      ) : null}

      {activeTab === "media" ? (
        <section className="detail-section">
          <header>
            <h2>Ảnh & Hình ảnh</h2>
          </header>
          {isLoading ? (
            <PanelSkeleton />
          ) : mediaItems.length ? (
            <div className="media-grid">
              {mediaItems.map((item) => (
                <MediaGalleryThumbnail item={item} key={item.id} onResolve={onResolveMedia} />
              ))}
            </div>
          ) : (
            <EmptyState description="Chưa có ảnh nào được chia sẻ." title="Chưa có ảnh" />
          )}
        </section>
      ) : null}

      {activeTab === "files" ? (
        <section className="detail-section">
          <header>
            <h2>File gần đây</h2>
          </header>
          {isLoading ? (
            <PanelSkeleton />
          ) : files.length ? (
            files.map((file) => (
              <button className="file-row" key={file.id} onClick={() => onFileSelect(file)} type="button">
                <span className={`file-icon file-icon--${file.tone}`}>
                  <FileText size={18} />
                </span>
                <span>
                  <strong>{file.name}</strong>
                  <small>
                    {file.size} - {file.updatedAt}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <EmptyState description="Chưa có file nào được chia sẻ." title="Chưa có file" />
          )}
        </section>
      ) : null}
    </aside>
  );
}

function PanelSkeleton() {
  return (
    <div className="panel-skeleton">
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="message-timeline">
      <Skeleton style={{ height: 58 }} />
      <Skeleton style={{ height: 72 }} />
      <Skeleton style={{ height: 58 }} />
    </div>
  );
}

function formatFileSize(size: number): string {
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function contactResultFromRequest(request: ContactRequest, data: ChatWorkspaceData): ContactResult {
  const member = data.members.find((item) => item.user_id === request.user.id);
  const name = request.user.display_name || request.user.username || request.user.email || memberName(member) || request.user.id;

  return {
    avatarUrl: request.user.avatar_url ?? member?.avatar_url,
    contactDirection: request.direction,
    contactRequestId: request.id,
    contactStatus: "accepted",
    email: request.user.email ?? member?.email,
    hasConversation: data.directConversations.some((conversation) => conversation.user.id === request.user.id),
    isWorkspaceMember: Boolean(member),
    name,
    phoneNumber: request.user.phone_number ?? memberPhone(member),
    status: member?.status ?? request.user.status,
    userId: request.user.id,
    username: request.user.username ?? member?.username
  };
}

function buildContactResults({
  contacts,
  contactRequests,
  currentUserId,
  directConversations,
  members,
  query,
  searchUsers
}: {
  contacts: ContactRequest[];
  contactRequests: ContactRequest[];
  currentUserId?: string;
  directConversations: ChatWorkspaceData["directConversations"];
  members: WorkspaceMember[];
  query: string;
  searchUsers: AuthUser[];
}): ContactResult[] {
  const conversationUserIds = new Set(directConversations.map((conversation) => conversation.user.id));
  const memberByUserId = new Map(members.map((member) => [member.user_id, member]));
  const acceptedByUserId = new Map(contacts.map((contact) => [contact.user.id, contact]));
  const requestByUserId = new Map(contactRequests.map((request) => [request.user.id, request]));
  const statusFor = (userId: string) => {
    const accepted = acceptedByUserId.get(userId);
    const request = requestByUserId.get(userId);
    const activeRequest = accepted ?? request;

    return {
      contactDirection: activeRequest?.direction,
      contactRequestId: activeRequest?.id,
      contactStatus:
        accepted?.status === "accepted"
          ? ("accepted" as const)
          : request?.status === "pending"
            ? ("pending" as const)
            : request?.status === "rejected"
              ? ("rejected" as const)
              : ("none" as const)
    };
  };

  if (query.trim().length >= 2) {
    return searchUsers.map((user) => {
      const member = memberByUserId.get(user.id);
      const contactState = statusFor(user.id);

      return {
        avatarUrl: user.avatar_url ?? member?.avatar_url,
        ...contactState,
        email: user.email ?? member?.email,
        hasConversation: conversationUserIds.has(user.id),
        isWorkspaceMember: Boolean(member),
        name: user.display_name || user.username || user.email || memberName(member) || user.id,
        phoneNumber: user.phone_number ?? memberPhone(member),
        status: member?.status ?? user.status,
        userId: user.id,
        username: user.username ?? member?.username
      };
    });
  }

  const results: ContactResult[] = [];
  const seenUserIds = new Set<string>();

  const pushResult = (result: ContactResult) => {
    if (!result.userId || result.userId === currentUserId || seenUserIds.has(result.userId)) {
      return;
    }
    seenUserIds.add(result.userId);
    results.push(result);
  };

  for (const request of [...contacts, ...contactRequests]) {
    const user = request.user;
    const member = memberByUserId.get(user.id);
    pushResult({
      avatarUrl: user.avatar_url ?? member?.avatar_url,
      ...statusFor(user.id),
      email: user.email ?? member?.email,
      hasConversation: conversationUserIds.has(user.id),
      isWorkspaceMember: Boolean(member),
      name: user.display_name || user.username || user.email || memberName(member) || user.id,
      phoneNumber: user.phone_number ?? memberPhone(member),
      status: member?.status ?? user.status,
      userId: user.id,
      username: user.username ?? member?.username
    });
  }

  for (const member of members) {
    pushResult({
      avatarUrl: member.avatar_url,
      ...statusFor(member.user_id),
      email: member.email,
      hasConversation: conversationUserIds.has(member.user_id),
      isWorkspaceMember: true,
      name: memberName(member),
      phoneNumber: memberPhone(member),
      status: member.status,
      userId: member.user_id,
      username: member.username
    });
  }

  return results;
}

function memberName(member?: WorkspaceMember): string {
  return member?.display_name || member?.username || member?.email || member?.user_id || "";
}

function formValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function memberPhone(member?: WorkspaceMember): string {
  if (!member) {
    return "";
  }

  const extendedMember = member as WorkspaceMember & {
    mobile?: string | null;
    phone?: string | null;
    phone_number?: string | null;
  };

  return extendedMember.phone || extendedMember.phone_number || extendedMember.mobile || "";
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function railItemFromRoute(pathname: string): RailItemId {
  const section = parseChatRoute(pathname)?.sectionRef;
  return railItems.some((item) => item.id === section) ? section as RailItemId : "messages";
}

function BrandedQRCode({ alt, className = "", src }: { alt: string; className?: string; src: string }) {
  return (
    <span className={`branded-qr${className ? ` ${className}` : ""}`}>
      <img alt={alt} className="branded-qr__image" src={src} />
      <span className="branded-qr__logo" aria-hidden="true">
        <img alt="" src="/brand/vpsttt-logo.png" />
      </span>
    </span>
  );
}

function stripDisplayedQRURL(body: string) {
  return body
    .split("\n")
    .filter((line) => !/^\s*QR\s*:\s*https?:\/\/\S+\s*$/i.test(line))
    .join("\n")
    .trim();
}

function canAccessRailItem(itemId: RailItemId, can: (permission: string) => boolean) {
  switch (itemId) {
    case "departments":
      return can("workspace.manage");
    case "tickets":
    case "files":
      return can("admin.view");
    case "bots":
      return can("bot.manage");
    case "automation":
      return can("webhook.manage") || can("cronjob.manage") || can("module.manage");
    default:
      return true;
  }
}
