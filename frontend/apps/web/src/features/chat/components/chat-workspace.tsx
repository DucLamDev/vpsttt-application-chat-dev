"use client";

import { type ChangeEvent, type ClipboardEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Cloud,
  Edit3,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  LogOut,
  MessageCircle,
  Mic,
  MoreVertical,
  Moon,
  Paperclip,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  StopCircle,
  Sun,
  Ticket,
  Trash2,
  Users,
  Workflow,
  X
} from "@webtui/icons";
import { useAuth } from "@/features/auth/auth-provider";
import {
  mapAuthUser,
  type CreateChannelPayload,
  type CreateDepartmentPayload,
  type CreateWorkspacePayload,
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
import type { AuthUser, ChannelMember, ContactRequest, Department, WorkspaceMember } from "@webtui/types";

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
type ChatWorkspaceData = ReturnType<typeof useChatWorkspaceData>;
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

export function ChatWorkspace() {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeRailItem, setActiveRailItem] = useState<RailItemId>("messages");
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
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const autoWorkspaceStartedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const seenNotificationIdsRef = useRef<Set<string> | null>(null);
  const seenContactRequestIdsRef = useRef<Set<string> | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingPublishedRef = useRef(false);
  const currentUser = useMemo(() => mapAuthUser(user), [user]);
  const activeMessageSearchQuery = isMessageSearchOpen ? messageSearchQuery : "";
  const data = useChatWorkspaceData(currentUser, {
    friendSearchQuery,
    messageSearchQuery: activeMessageSearchQuery,
    threadMessageId: threadMessageId ?? undefined
  });
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

  const sidebarChannels = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return data.channels.filter((channel) => {
      if (channel.type === "direct") {
        return false;
      }

      return (
        !normalizedQuery ||
        channel.name.toLowerCase().includes(normalizedQuery) ||
        channel.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [data.channels, searchQuery]);

  const filteredConversations = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return data.directConversations;
    }

    return data.directConversations.filter(
      (conversation) =>
        conversation.user.name.toLowerCase().includes(normalizedQuery) ||
        conversation.lastMessage.toLowerCase().includes(normalizedQuery)
    );
  }, [data.directConversations, searchQuery]);

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
  const selectedChatChannel = useMemo(() => {
    if (!data.selectedChannelWithMessages) {
      return null;
    }
    const directConversation = data.directConversations.find(
      (conversation) => conversation.id === data.selectedChannelWithMessages?.id
    );
    if (!directConversation) {
      return data.selectedChannelWithMessages;
    }
    return {
      ...data.selectedChannelWithMessages,
      description: "Tin nhắn riêng",
      memberCount: 2,
      name: directConversation.user.name
    };
  }, [data.directConversations, data.selectedChannelWithMessages]);

  const selectedRailLabel = railItems.find((item) => item.id === activeRailItem)?.label ?? "Tin nhắn";
  const panelTitle =
    activeRailItem === "contacts"
      ? "Danh bạ"
      : activeRailItem === "channels"
        ? "Kênh"
        : activeRailItem === "departments"
          ? "Phòng ban"
        : activeRailItem === "files"
          ? "Tệp tin"
          : activeRailItem === "settings"
            ? "Cài đặt"
            : "Tin nhắn";
  const panelSubtitle =
    activeRailItem === "messages"
      ? "Hội thoại riêng và kênh"
      : activeRailItem === "contacts"
        ? "Tìm bạn bè để nhắn tin"
        : selectedRailLabel;

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
    data.setSelectedChannelId(channelId);
    data.markChannelRead(channelId, data.messages.at(-1)?.id);
    setThreadMessageId(null);
    setIsMessageSearchOpen(false);
    setMessageSearchQuery("");
    setActiveRailItem("messages");
  }

  function handleToggleMessageSearch() {
    setIsMessageSearchOpen((current) => {
      if (current) {
        setMessageSearchQuery("");
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
  }

  function handleToggleFavorite() {
    setToast("Tính năng yêu thích kênh đang được hoàn thiện.");
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

  function buildDefaultWorkspacePayload(): CreateWorkspacePayload {
    const baseName =
      currentUser?.name && currentUser.name !== "Bạn"
        ? `Dữ liệu trò chuyện của ${currentUser.name}`
        : "Dữ liệu trò chuyện";
    const baseSlug = slugify(
      user?.username || user?.email || currentUser?.id || `workspace-${Date.now().toString(36)}`
    );

    return {
      description: "Dữ liệu nền để đồng bộ hội thoại và kênh.",
      name: baseName,
      slug: `${baseSlug || "workspace"}-${Date.now().toString(36).slice(-5)}`
    };
  }

  function handleCreateDefaultWorkspace(options: { silent?: boolean } = {}) {
    data.createWorkspaceMutation.mutate(buildDefaultWorkspacePayload(), {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không chuẩn bị được dữ liệu."),
      onSuccess: () => {
        if (!options.silent) {
          setToast("Đã chuẩn bị không gian làm việc.");
        }
      }
    });
  }

  useEffect(() => {
    if (
      autoWorkspaceStartedRef.current ||
      data.workspaceId ||
      data.workspacesQuery.isLoading ||
      data.createWorkspaceMutation.isPending
    ) {
      return;
    }
    autoWorkspaceStartedRef.current = true;
    handleCreateDefaultWorkspace({ silent: true });
  }, [data.createWorkspaceMutation.isPending, data.workspaceId, data.workspacesQuery.isLoading]);

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
      try {
        const workspace = await data.createWorkspaceMutation.mutateAsync(buildDefaultWorkspacePayload());
        handleStartDirectConversation(contact.userId, workspace.id);
      } catch (error) {
        setToast(error instanceof Error ? error.message : "Không chuẩn bị được dữ liệu để mở hội thoại.");
      }
      return;
    }

    handleStartDirectConversation(contact.userId);
  }

  async function handleToggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const extension = mimeType.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: mimeType });
        uploadQueue.addFiles([file]);
        recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setIsRecording(false);
      };

      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không bật được micro.");
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
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
          setToast(
            result.failedUploadNames.length
              ? `Tin nhắn đã gửi, ${result.failedUploadNames.length} file cần thử lại.`
              : "Tin nhắn đã được gửi."
          );
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
          data.setSelectedChannelId(channelId, workspaceId);
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
      className={`chat-app-shell chat-app-shell--zalo${activeRailItem === "messages" ? "" : " chat-app-shell--section"}${activeRailItem === "messages" && data.selectedChannel && !data.canAccessSelectedChannel ? " chat-app-shell--no-detail" : ""}`}
      aria-label="Màn hình chat WebTui"
    >
      <NavigationRail
        activeId={activeRailItem}
        ariaLabel="Điều hướng chính"
        items={[...railItems]}
        onSelect={(itemId) => setActiveRailItem(itemId as RailItemId)}
        profile={currentUser}
      />

      <section className="channel-panel" aria-label="Kênh và hội thoại">
        <header className="panel-heading">
          <div>
            <p>{panelTitle}</p>
            <span>{panelSubtitle}</span>
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
              setActiveRailItem("contacts");
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
            <div className="channel-search">
              <Input
                aria-label="Tìm kiếm kênh hoặc hội thoại"
                leftAddon={<Search size={17} />}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm kiếm..."
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

            <div className="list-section conversations">
              <span className="section-label">Hội thoại</span>
              {data.directConversationsQuery.isLoading || data.createWorkspaceMutation.isPending ? (
                <PanelSkeleton />
              ) : filteredConversations.length ? (
                filteredConversations.map((item) => (
                  <button
                    className={item.id === data.selectedChannelId ? "conversation-row conversation-row--active" : "conversation-row"}
                    key={item.id}
                    onClick={() => handleChannelSelect(item.id)}
                    type="button"
                  >
                    <Avatar name={item.user.name} size="md" src={item.user.avatarUrl} status={item.user.status} />
                    <span>
                      <strong>{item.user.name}</strong>
                      <small>{item.lastMessage}</small>
                    </span>
                    <em>{item.relativeTime}</em>
                    {item.unreadCount ? <Badge tone="red">{item.unreadCount}</Badge> : null}
                  </button>
                ))
              ) : (
                <div className="conversation-empty">
                  <EmptyState description="Tìm bạn bè, gửi lời mời và bắt đầu nhắn tin riêng như Zalo." title="Chưa có hội thoại" />
                  <Button onClick={() => setActiveRailItem("contacts")} size="sm" variant="secondary">
                    <Users size={15} />
                    Tìm bạn bè
                  </Button>
                </div>
              )}
            </div>

            <div className="list-section channels-section">
              <span className="section-label">Kênh & bot</span>
              {data.workspacesQuery.isLoading || data.channelsQuery.isLoading ? (
                <PanelSkeleton />
              ) : sidebarChannels.length ? (
                sidebarChannels.map((channel) => (
                  <button
                    className={channel.id === data.selectedChannelId ? "channel-row channel-row--active" : "channel-row"}
                    key={channel.id}
                    onClick={() => handleChannelSelect(channel.id)}
                    type="button"
                  >
                    <span className={`channel-hash channel-hash--${channel.tone}`}>#</span>
                    <span className="channel-row__body">
                      <strong>{channel.name}</strong>
                      <small>{channel.description}</small>
                    </span>
                    {channel.unreadCount ? <Badge tone="red">{channel.unreadCount}</Badge> : null}
                    <Tooltip label={channel.isFavorite ? "Bỏ yêu thích" : "Yêu thích"}>
                      <span
                        className={channel.isFavorite ? "pin-action pin-action--active" : "pin-action"}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleToggleFavorite();
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <Pin size={15} />
                      </span>
                    </Tooltip>
                  </button>
                ))
              ) : (
                <EmptyState
                  description="Kênh dùng cho nhóm, bot và thông báo chung."
                  title="Chưa có kênh"
                />
              )}
            </div>
          </>
        ) : (
          <SidebarContextPanel
            activeRailItem={activeRailItem}
            onOpenMessages={() => setActiveRailItem("messages")}
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
            canCreateChannel={canCreateChannel}
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
              isSearchOpen={isMessageSearchOpen}
              onToggleSearch={handleToggleMessageSearch}
            />
            {isMessageSearchOpen ? (
              <div className="message-toolbar">
                <Input
                  aria-label="Tìm tin nhắn"
                  autoFocus
                  leftAddon={<Search size={17} />}
                  onChange={(event) => setMessageSearchQuery(event.target.value)}
                  placeholder="Tìm tin nhắn..."
                  value={messageSearchQuery}
                />
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
                <Tooltip label="Thêm nội dung">
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
                    placeholder="Nhập tin nhắn..."
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

      {activeRailItem === "messages" && (!data.selectedChannel || data.canAccessSelectedChannel) ? (
        <RightDetailPanel
          activeTab={detailTab}
          files={data.files}
          isLoading={data.filesQuery.isLoading}
          isSendingThread={data.sendThreadMessageMutation.isPending}
          isThreadLoading={data.threadQuery.isLoading}
          mediaItems={data.mediaItems}
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
  activeRailItem,
  onOpenMessages
}: {
  activeRailItem: RailItemId;
  onOpenMessages: () => void;
}) {
  const config: Record<RailItemId, { description: string; title: string }> = {
    automation: {
      description: "Tự động hóa và webhook cho nhóm làm việc.",
      title: "Automation"
    },
    bots: {
      description: "Bot hỗ trợ kênh, thông báo và quy trình nội bộ.",
      title: "Bot"
    },
    channels: {
      description: "Không gian nhóm và kênh dùng chung.",
      title: "Kênh"
    },
    contacts: {
      description: "Tìm bạn bè bằng email, số điện thoại hoặc tên đăng nhập.",
      title: "Bạn bè"
    },
    departments: {
      description: "Tổ chức thành viên theo nhóm và phòng ban trong workspace.",
      title: "Phòng ban"
    },
    files: {
      description: "File và hình ảnh được chia sẻ gần đây.",
      title: "File"
    },
    messages: {
      description: "Hội thoại riêng và kênh đang hoạt động.",
      title: "Tin nhắn"
    },
    settings: {
      description: "Hồ sơ, giao diện và quyền riêng tư.",
      title: "Cài đặt"
    },
    tickets: {
      description: "Theo dõi yêu cầu hỗ trợ và sự cố nội bộ.",
      title: "Ticket"
    }
  };
  const current = config[activeRailItem];

  return (
    <div className="sidebar-context-panel">
      <div>
        <span className="section-label">Đang xem</span>
        <h2>{current.title}</h2>
        <p>{current.description}</p>
      </div>
      <Button onClick={onOpenMessages} size="sm" variant="secondary">
        <MessageCircle size={15} />
        Quay lại tin nhắn
      </Button>
    </div>
  );
}

function WorkspaceSectionPage({
  activeRailItem,
  canManageDepartments,
  canCreateChannel,
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
  canManageDepartments: boolean;
  canCreateChannel: boolean;
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
        canCreateChannel={canCreateChannel}
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
        departments={departments}
        isCreating={isCreatingDepartment}
        isLoading={isLoadingDepartments}
        onCreate={onCreateDepartment}
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

  return (
    <div className="workspace-page contacts-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">Danh bạ</span>
          <h1>Bạn bè</h1>
          <p>Tìm người dùng bằng email, tên đăng nhập hoặc số điện thoại, gửi lời mời kết bạn rồi nhắn tin riêng.</p>
        </div>
        <Badge tone="blue">{contacts.length} liên hệ</Badge>
      </header>

      <section className="zalo-search-panel">
        <div className="zalo-search-panel__icon">
          <Search size={22} />
        </div>
        <div>
          <strong>Tìm bạn bè</strong>
          <Input
            aria-label="Tìm bạn bè bằng số điện thoại hoặc email"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Nhập email, số điện thoại hoặc tên"
            value={query}
          />
        </div>
      </section>

      {isLoading ? (
        <PanelSkeleton />
      ) : contacts.length ? (
        <div className="contact-list">
          {contacts.map((contact) => {
            return (
              <article className="contact-card" key={contact.userId}>
                <Avatar name={contact.name} size="lg" src={contact.avatarUrl ?? undefined} />
                <div className="contact-card__body">
                  <div>
                    <strong>{contact.name}</strong>
                    <span>{contact.email ?? contact.username ?? "Chưa có email"}</span>
                  </div>
                  <div className="contact-card__meta">
                    <Badge tone={contact.contactStatus === "accepted" ? "green" : contact.contactStatus === "pending" ? "orange" : "blue"}>
                      {contactBadgeLabel(contact)}
                    </Badge>
                    <span>{contact.phoneNumber || "Chưa có số điện thoại"}</span>
                  </div>
                </div>
                <div className="contact-card__actions">
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
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          description={
            !workspaceId
              ? "Đang chuẩn bị dữ liệu để mở hội thoại riêng."
              : isSearching
                ? "Không tìm thấy người dùng phù hợp với từ khóa này."
                : "Nhập email, tên đăng nhập hoặc số điện thoại để tìm bạn bè."
          }
          title={!workspaceId ? "Đang chuẩn bị" : isSearching ? "Không có kết quả" : "Tìm bạn bè để bắt đầu"}
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
  canCreateChannel,
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
  canCreateChannel: boolean;
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
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">Kênh & bot</span>
          <h1>Kênh</h1>
          <p>Kênh dùng cho nhóm, bot và thông báo chung.</p>
        </div>
        <Badge tone={canCreateChannel ? "green" : "orange"}>{canCreateChannel ? "Có thể tạo kênh" : "Chỉ xem"}</Badge>
      </header>

      {isLoading ? (
        <PanelSkeleton />
      ) : channels.length ? (
        <div className="workspace-grid-list">
          {channels.map((channel) => (
            <article className="workspace-tile" key={channel.id}>
              <span className={`channel-hash channel-hash--${channel.tone}`}>
                <Hash size={20} />
              </span>
              <strong>{channel.name}</strong>
              <p>{channel.description}</p>
              <small>{channel.memberCount} thành viên · {channel.unreadCount} chưa đọc</small>
              {channel.isMember ? (
                <Button onClick={() => onChannelSelect(channel.id)} size="sm">
                  <MessageCircle size={16} /> Mở kênh
                </Button>
              ) : channel.membershipStatus === "invited" ? (
                <Button disabled size="sm" variant="secondary">Đang chờ chủ kênh duyệt</Button>
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
            </article>
          ))}
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
  departments,
  isCreating,
  isLoading,
  onCreate
}: {
  canManage: boolean;
  departments: Department[];
  isCreating: boolean;
  isLoading: boolean;
  onCreate: (input: CreateDepartmentPayload) => void;
}) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");

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
          <span className="workspace-page__eyebrow">Tổ chức</span>
          <h1>Phòng ban</h1>
          <p>Tạo nhóm phòng ban và cấu trúc phòng ban con cho workspace.</p>
        </div>
        <Button disabled={!canManage} onClick={() => setIsFormOpen((current) => !current)} size="sm">
          <Plus size={16} /> Tạo phòng ban
        </Button>
      </header>

      {isFormOpen ? (
        <form className="department-create-form" onSubmit={handleSubmit}>
          <label>Tên phòng ban<input onChange={(event) => { setName(event.target.value); setSlug((current) => current || slugify(event.target.value)); }} placeholder="Ví dụ: Kinh doanh" required value={name} /></label>
          <label>Slug<input onChange={(event) => setSlug(event.target.value)} placeholder="kinh-doanh" required value={slug} /></label>
          <label>Thuộc phòng ban<select onChange={(event) => setParentId(event.target.value)} value={parentId}><option value="">Không có phòng ban cha</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label className="department-create-form__description">Mô tả<textarea onChange={(event) => setDescription(event.target.value)} placeholder="Chức năng của phòng ban" value={description} /></label>
          <div><Button disabled={isCreating || !name.trim() || !slug.trim()} size="sm" type="submit">{isCreating ? "Đang tạo..." : "Tạo phòng ban"}</Button><Button onClick={() => setIsFormOpen(false)} size="sm" type="button" variant="ghost">Hủy</Button></div>
        </form>
      ) : null}

      {isLoading ? (
        <PanelSkeleton />
      ) : !canManage ? (
        <EmptyState description="Bạn cần quyền quản lý workspace để xem và tạo phòng ban." title="Không có quyền quản lý phòng ban" />
      ) : departments.length ? (
        <div className="department-grid">
          {departments.map((department) => (
            <article key={department.id}>
              <span><Users size={19} /></span>
              <div><strong>{department.name}</strong><small>#{department.slug}</small><p>{department.description || "Chưa có mô tả"}</p></div>
              {department.parent_id ? <Badge tone="slate">Phòng ban con</Badge> : <Badge tone="blue">Phòng ban</Badge>}
            </article>
          ))}
        </div>
      ) : (
        <EmptyState description="Tạo phòng ban đầu tiên để tổ chức thành viên theo đội nhóm." title="Chưa có phòng ban" />
      )}
    </div>
  );
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
  return (
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">Tệp tin</span>
          <h1>File</h1>
          <p>File, hình ảnh và tài liệu gần đây.</p>
        </div>
        <Badge tone="blue">{files.length} file</Badge>
      </header>

      {isLoading ? (
        <PanelSkeleton />
      ) : files.length ? (
        <div className="file-directory">
          {files.map((file) => (
            <article className="file-directory__item" key={file.id}>
              <span className={`file-icon file-icon--${file.tone}`}>
                <FileText size={20} />
              </span>
              <div>
                <strong>{file.name}</strong>
                <small>{file.size} · {file.updatedAt}</small>
              </div>
              <Button onClick={() => onDownloadFile(file)} size="sm" variant="secondary">
                Tải xuống
              </Button>
            </article>
          ))}
        </div>
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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarValue, setAvatarValue] = useState(currentUser.avatarUrl ?? "");
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => setAvatarValue(currentUser.avatarUrl ?? ""), [currentUser.avatarUrl]);

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
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">Tài khoản</span>
          <h1>Cài đặt</h1>
          <p>Quản lý hồ sơ cá nhân, quyền riêng tư và giao diện hiển thị.</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card settings-card--profile">
          <div>
            <Avatar name={currentUser.name} size="lg" src={avatarValue || undefined} status={currentUser.status} />
            <h2>Hồ sơ cá nhân</h2>
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
        <section className="settings-card">
          <div>
            <ShieldCheck size={22} />
            <h2>Quyền riêng tư</h2>
          </div>
          <p>Tài khoản của bạn được bảo vệ trong phiên làm việc hiện tại.</p>
        </section>
        <section className="settings-card">
          <div>
            {theme === "dark" ? <Moon size={22} /> : <Sun size={22} />}
            <h2>Giao diện</h2>
          </div>
          <p>Chế độ hiện tại: {theme === "dark" ? "tối" : "sáng"}.</p>
          <Button onClick={onThemeToggle} size="sm" variant="secondary">
            Chuyển chế độ
          </Button>
        </section>
      </div>
    </div>
  );
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
  const pageConfig: Partial<Record<RailItemId, { description: string; icon: typeof Ticket; title: string }>> = {
    automation: {
      description: "Tự động hóa các tác vụ lặp lại, kết nối webhook và quy trình nội bộ.",
      icon: Workflow,
      title: "Automation"
    },
    bots: {
      description: "Quản lý trợ lý tự động cho kênh, thông báo và các luồng hỗ trợ nội bộ.",
      icon: Bot,
      title: "Bot"
    },
    tickets: {
      description: "Theo dõi yêu cầu hỗ trợ, sự cố và công việc cần xử lý.",
      icon: Ticket,
      title: "Ticket"
    }
  };
  const config = pageConfig[activeRailItem] ?? {
    description: "Màn hình này đang được hoàn thiện cho quy trình làm việc nội bộ.",
    icon: Archive,
    title: "Chức năng"
  };
  const Icon = config.icon;

  return (
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">Đang hoàn thiện</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <Badge tone="orange">Sắp có</Badge>
      </header>
      <section className="operational-empty">
        <Icon size={42} />
        <h2>Tính năng đang được hoàn thiện</h2>
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
  isSearchOpen,
  onToggleSearch
}: {
  channel: ChatChannel;
  isSearchOpen: boolean;
  onToggleSearch: () => void;
}) {
  return (
    <header className="chat-header">
      <div className="chat-title">
        <span className={`channel-hash channel-hash--${channel.tone}`}>#</span>
        <div>
          <h1>{channel.name}</h1>
          <p>{channel.description}</p>
        </div>
      </div>
      <div className="chat-actions">
        <span className="member-count">
          <Users size={18} /> {channel.memberCount}
        </span>
        <Tooltip label="Tìm kiếm">
          <Button
            aria-label={isSearchOpen ? "Đóng tìm kiếm" : "Tìm kiếm"}
            className={isSearchOpen ? "chat-action-active" : undefined}
            onClick={onToggleSearch}
            type="button"
            variant="icon"
          >
            <Search size={19} />
          </Button>
        </Tooltip>
        <Tooltip label="Thông tin kênh">
          <Button aria-label="Thông tin kênh" variant="icon">
            <Info size={19} />
          </Button>
        </Tooltip>
        <Tooltip label="Tùy chọn khác">
          <Button aria-label="Tùy chọn khác" variant="icon">
            <MoreVertical size={19} />
          </Button>
        </Tooltip>
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
        <article className={`upload-queue__item upload-queue__item--${item.status}`} key={item.id}>
          {item.isImage && item.previewUrl ? (
            <img alt={item.name} className="upload-queue__thumb" src={item.previewUrl} />
          ) : (
            <span className="upload-queue__icon">
              {item.status === "attached" ? <CheckCircle2 size={16} /> : <Cloud size={16} />}
            </span>
          )}
          <div>
            <strong>{item.name}</strong>
            <small>
              {formatFileSize(item.size)} - {item.error ?? labels[item.status]}
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

function MessageTimeline({
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
  onResolveAttachment,
  onLoadOlderMessages,
  onOpenThread,
  onSearchResultSelect,
  onStartEdit,
  onSubmitEdit,
  onTogglePin,
  onToggleReaction,
  pinnedMessageIds,
  searchQuery,
  searchResults
}: {
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
  onResolveAttachment: (fileId: string) => Promise<Blob>;
  onLoadOlderMessages: () => void;
  onOpenThread: (messageId: string) => void;
  onSearchResultSelect: (message: ChatMessage) => void;
  onStartEdit: (message: ChatMessage) => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>) => void;
  onTogglePin: (message: ChatMessage, isPinned: boolean) => void;
  onToggleReaction: (message: ChatMessage, emoji: string) => void;
  pinnedMessageIds: Set<string>;
  searchQuery: string;
  searchResults: ChatMessage[];
}) {
  const lastMessageId = messages.at(-1)?.id;
  const bottomRef = useRef<HTMLDivElement>(null);

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
              <span>{message.sentAt}</span>
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
              <p>{message.body}</p>
            ) : null}
            {message.attachments?.length ? (
              <div className="attachment-list">
                {message.attachments.map((attachment) =>
                  attachment.isAudio || attachment.isImage ? (
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
            {!message.isDeleted ? (
              <button
                aria-label="Thả cảm xúc"
                className="reaction-add-button"
                onClick={() => onToggleReaction(message, "👍")}
                type="button"
              >
                <Smile size={15} />
              </button>
            ) : null}
          </div>
        </article>
      ))}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
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
    return (
      <div className="attachment-audio">
        <span className="attachment-audio__mic"><Mic size={17} /></span>
        {resolvedSource ? (
          <audio controls preload="metadata" src={resolvedSource}>
            Trình duyệt của bạn không hỗ trợ phát tin nhắn thoại.
          </audio>
        ) : <span className="attachment-media-loading">Đang tải voice...</span>}
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

function shouldRenderMessageBody(message: ChatMessage): boolean {
  if (!message.body.trim()) {
    return false;
  }

  const attachments = message.attachments ?? [];
  const hasOnlyImages = attachments.length > 0 && attachments.every((attachment) => attachment.isImage);
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
                    <p>{message.body}</p>
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
        <Tooltip label="Cấu hình panel">
          <Button aria-label="Cấu hình panel" variant="icon">
            <Settings size={18} />
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
