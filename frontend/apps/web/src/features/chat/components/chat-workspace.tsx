"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  Wifi,
  WifiOff,
  Workflow,
  X
} from "@webtui/icons";
import { useAuth } from "@/features/auth/auth-provider";
import { useApiStatus } from "../../platform/hooks/use-api-status";
import {
  mapAuthUser,
  type CreateChannelPayload,
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
import type { RealtimeConnectionStatus } from "../stores/realtime-store";
import { useUploadStore, type UploadQueueItem } from "../stores/upload-store";
import type { AuthUser, ContactRequest, WorkspaceMember } from "@webtui/types";

const railItems = [
  { id: "messages", label: "Tin nhắn", icon: MessageCircle },
  { id: "contacts", label: "Bạn bè", icon: Users },
  { id: "channels", label: "Kênh", icon: Hash },
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
  const [threadMessageId, setThreadMessageId] = useState<string | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const autoWorkspaceStartedRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const apiStatus = useApiStatus();
  const currentUser = useMemo(() => mapAuthUser(user), [user]);
  const data = useChatWorkspaceData(currentUser, {
    friendSearchQuery,
    messageSearchQuery,
    threadMessageId: threadMessageId ?? undefined
  });
  const uploadQueue = useUploadStore();
  const queuedUploads = useMemo(
    () => uploadQueue.items.filter((item) => item.status === "queued" || item.status === "failed"),
    [uploadQueue.items]
  );

  const canCreateChannel = data.can("channel.create");
  const canSendMessage = data.can("message.send");
  const canUploadFile = data.can("file.upload");
  const canUseComposer = canSendMessage && (!uploadQueue.items.length || canUploadFile);

  const filteredChannels = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return data.channels.filter((channel) => {
      const matchesQuery =
        !normalizedQuery ||
        channel.name.toLowerCase().includes(normalizedQuery) ||
        channel.description.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        channelFilter === "all" ||
        (channelFilter === "unread" && channel.unreadCount > 0) ||
        (channelFilter === "favorite" && channel.isFavorite);

      return matchesQuery && matchesFilter;
    });
  }, [channelFilter, data.channels, searchQuery]);

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

  const selectedRailLabel = railItems.find((item) => item.id === activeRailItem)?.label ?? "Workspace";
  const panelTitle =
    activeRailItem === "contacts"
      ? "Danh bạ"
      : activeRailItem === "channels"
        ? "Kênh"
        : activeRailItem === "files"
          ? "Tệp tin"
          : activeRailItem === "settings"
            ? "Cài đặt"
            : "Tin nhắn";
  const panelSubtitle = data.selectedWorkspace?.name ?? "Chưa có workspace";

  async function handleCreateChannel(input: CreateChannelPayload) {
    if (!canCreateChannel) {
      setToast("Tài khoản hiện tại chưa có quyền tạo kênh.");
      return;
    }

    data.createChannelMutation.mutate(input, {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không tạo được kênh."),
      onSuccess: () => {
        setIsCreateChannelOpen(false);
        setToast("Đã tạo kênh mới từ API.");
      }
    });
  }

  function handleChannelSelect(channelId: string) {
    data.setSelectedChannelId(channelId);
    data.markChannelRead(channelId, data.messages.at(-1)?.id);
    setThreadMessageId(null);
    setActiveRailItem("messages");
  }

  function handleToggleFavorite() {
    setToast("Backend chưa có endpoint cập nhật kênh yêu thích.");
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

  function handleEmojiSelect(emoji: string) {
    setDraft((current) => `${current}${emoji}`);
    setIsEmojiPickerOpen(false);
  }

  function buildDefaultWorkspacePayload(): CreateWorkspacePayload {
    const baseName =
      currentUser?.name && currentUser.name !== "Bạn"
        ? `Workspace của ${currentUser.name}`
        : "Workspace nội bộ";
    const baseSlug = slugify(
      user?.username || user?.email || currentUser?.id || `workspace-${Date.now().toString(36)}`
    );

    return {
      description: "Workspace được tạo từ giao diện WebTui Chat.",
      name: baseName,
      slug: `${baseSlug || "workspace"}-${Date.now().toString(36).slice(-5)}`
    };
  }

  function handleCreateDefaultWorkspace() {
    data.createWorkspaceMutation.mutate(buildDefaultWorkspacePayload(), {
      onError: (error) => setToast(error instanceof Error ? error.message : "Không tạo được workspace."),
      onSuccess: () => setToast("Đã tạo workspace. Bạn có thể tạo kênh hoặc thêm bạn bè để nhắn tin.")
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
    handleCreateDefaultWorkspace();
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
        setToast(error instanceof Error ? error.message : "Không tạo được workspace cá nhân để mở hội thoại.");
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
      setIsRecording(true);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Không bật được micro.");
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }

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
          uploadQueue.clearAttached();
          setToast(
            result.failedUploadNames.length
              ? `Tin nhắn đã gửi, ${result.failedUploadNames.length} file cần thử lại.`
              : "Nội dung đã được gửi qua API."
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
        setToast("Đã mở hội thoại riêng từ API.");
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
    <main className="chat-app-shell chat-app-shell--zalo" aria-label="Màn hình chat WebTui">
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
                onClick={() => setIsNotificationsOpen((current) => !current)}
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
            isLoading={data.notificationsQuery.isLoading}
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

        <div className={`api-status-pill api-status-pill--${apiStatus.status}`}>
          <span />
          <strong>{apiStatus.label}</strong>
        </div>

        <div className="workspace-switcher">
          <label htmlFor="workspace-select">Workspace</label>
          <select
            disabled={!data.workspaces.length}
            id="workspace-select"
            onChange={(event) => data.setWorkspaceId(event.target.value)}
            value={data.workspaceId}
          >
            {data.workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>

        {!data.workspaceId ? (
          <div className="workspace-quickstart">
            <strong>Chưa có workspace</strong>
            <span>Tạo workspace để thêm bạn bè, tạo kênh và mở hội thoại riêng.</span>
            <Button
              disabled={data.createWorkspaceMutation.isPending}
              onClick={handleCreateDefaultWorkspace}
              size="sm"
              variant="primary"
            >
              <Plus size={15} />
              Tạo workspace
            </Button>
          </div>
        ) : null}

        {isCreateChannelOpen ? (
          <CreateChannelForm
            isPending={data.createChannelMutation.isPending}
            onCancel={() => setIsCreateChannelOpen(false)}
            onSubmit={handleCreateChannel}
          />
        ) : null}

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
          {data.directConversationsQuery.isLoading ? (
            <PanelSkeleton />
          ) : filteredConversations.length ? (
            filteredConversations.map((item) => (
              <button className="conversation-row" key={item.id} onClick={() => handleChannelSelect(item.id)} type="button">
                <Avatar name={item.user.name} size="sm" status={item.user.status} />
                <span>
                  <strong>{item.user.name}</strong>
                  <small>{item.lastMessage}</small>
                </span>
                <em>{item.relativeTime}</em>
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
          ) : filteredChannels.length ? (
            filteredChannels.map((channel) => (
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
              description={
                data.selectedWorkspace ? "Workspace này chưa có kênh. Kênh dùng cho nhóm, bot và thông báo chung." : "Tài khoản chưa có workspace."
              }
              title="Chưa có kênh"
            />
          )}
        </div>
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
            apiStatus={apiStatus.status}
            canCreateChannel={canCreateChannel}
            channels={data.channels}
            contacts={contactResults}
            currentUser={currentUser}
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
            onChannelSelect={handleChannelSelect}
            onDownloadFile={handleDownload}
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
            isUpdatingProfile={data.updateProfileMutation.isPending}
            workspaceId={data.workspaceId}
            workspaceName={data.selectedWorkspace?.name}
          />
        ) : data.workspacesQuery.isError || data.channelsQuery.isError ? (
          <ErrorState
            description="Kiểm tra quyền truy cập hoặc trạng thái backend production."
            title="Không tải được dữ liệu chat"
          />
        ) : selectedChatChannel ? (
          <>
            <ChatHeader
              channel={selectedChatChannel}
            />
            <div className="message-toolbar">
              <Input
                aria-label="Tìm tin nhắn"
                leftAddon={<Search size={17} />}
                onChange={(event) => setMessageSearchQuery(event.target.value)}
                placeholder="Tìm tin nhắn trong workspace..."
                value={messageSearchQuery}
              />
              <PresenceStatusPill onlineCount={data.presenceByUserId.size} />
              <RealtimeStatusPill status={data.realtime.status} />
            </div>
            {data.messagesQuery.isLoading ? (
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
                onLoadOlderMessages={handleLoadOlderMessages}
                onOpenThread={handleOpenThread}
                onSearchResultSelect={(message) => {
                  if (message.rawChannelId && message.rawChannelId !== data.selectedChannelId) {
                    data.setSelectedChannelId(message.rawChannelId);
                  }
                  setThreadMessageId(message.id);
                }}
                onStartEdit={handleStartEdit}
                onSubmitEdit={handleSubmitEdit}
                onTogglePin={handleToggleMessagePin}
                onToggleReaction={handleToggleReaction}
                pinnedMessageIds={pinnedMessageIds}
                searchQuery={messageSearchQuery}
                searchResults={data.messageSearchResults}
              />
            )}
            {!canSendMessage ? (
              <div className="permission-note">Tài khoản hiện tại chưa có quyền gửi tin nhắn trong workspace này.</div>
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
              {draft.trim() ? <TypingDots label="Bạn đang nhập tin nhắn" /> : null}
              <form className="composer" onSubmit={handleSendMessage}>
                <Tooltip label="Thêm nội dung">
                  <Button aria-label="Thêm nội dung" type="button" variant="icon">
                    <Plus size={20} />
                  </Button>
                </Tooltip>
                <div className="composer-input-group">
                  <input
                    aria-label="Nhập tin nhắn"
                    disabled={data.sendMessageMutation.isPending || !canSendMessage}
                    onChange={(event) => setDraft(event.target.value)}
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
            <p>Tạo workspace, chọn kênh hoặc tìm bạn bè để bắt đầu nhắn tin.</p>
          </div>
        )}
      </section>

      {activeRailItem === "messages" ? (
        <RightDetailPanel
          activeTab={detailTab}
          files={data.files}
          isLoading={data.filesQuery.isLoading}
          isThreadLoading={data.threadQuery.isLoading}
          mediaItems={data.mediaItems}
          onCloseThread={() => setThreadMessageId(null)}
          onFileSelect={handleDownload}
          onTabChange={setDetailTab}
          pinnedMessages={pinnedMessages}
          threadMessages={data.threadMessages}
          threadMessageId={threadMessageId}
        />
      ) : (
        <WorkspaceSummaryPanel
          activeRailItem={activeRailItem}
          apiStatus={apiStatus.status}
          channelsCount={data.channels.length}
          contactsCount={data.contacts.length}
          directConversations={data.directConversations}
          filesCount={data.files.length}
          notificationsUnread={notificationBadgeCount}
          workspaceName={data.selectedWorkspace?.name}
        />
      )}

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

function WorkspaceSectionPage({
  activeRailItem,
  apiStatus,
  canCreateChannel,
  channels,
  contacts,
  currentUser,
  files,
  friendSearchQuery,
  isCreatingDirectConversation,
  isLoadingChannels,
  isLoadingContacts,
  isLoadingFiles,
  isUpdatingProfile,
  onChannelSelect,
  onDownloadFile,
  onFriendSearchChange,
  onProfileSubmit,
  onSecondaryContactAction,
  onStartConversation,
  onThemeToggle,
  theme,
  workspaceId,
  workspaceName
}: {
  activeRailItem: RailItemId;
  apiStatus: string;
  canCreateChannel: boolean;
  channels: ChatChannel[];
  contacts: ContactResult[];
  currentUser: ChatUser;
  files: FileItem[];
  friendSearchQuery: string;
  isCreatingDirectConversation: boolean;
  isLoadingChannels: boolean;
  isLoadingContacts: boolean;
  isLoadingFiles: boolean;
  isUpdatingProfile: boolean;
  onChannelSelect: (channelId: string) => void;
  onDownloadFile: (file: FileItem) => void;
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
  workspaceName?: string;
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
        workspaceName={workspaceName}
      />
    );
  }

  if (activeRailItem === "channels") {
    return (
      <ChannelsDirectoryPage
        canCreateChannel={canCreateChannel}
        channels={channels}
        isLoading={isLoadingChannels}
        onChannelSelect={onChannelSelect}
        workspaceName={workspaceName}
      />
    );
  }

  if (activeRailItem === "files") {
    return <FilesPage files={files} isLoading={isLoadingFiles} onDownloadFile={onDownloadFile} workspaceName={workspaceName} />;
  }

  if (activeRailItem === "settings") {
    return (
      <SettingsPage
        apiStatus={apiStatus}
        currentUser={currentUser}
        isUpdatingProfile={isUpdatingProfile}
        onProfileSubmit={onProfileSubmit}
        onThemeToggle={onThemeToggle}
        theme={theme}
        workspaceName={workspaceName}
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
  workspaceId,
  workspaceName
}: {
  contacts: ContactResult[];
  isCreatingDirectConversation: boolean;
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onSecondaryAction: (contact: ContactResult) => void;
  onStartConversation: (contact: ContactResult) => void;
  query: string;
  workspaceId?: string;
  workspaceName?: string;
}) {
  const isSearching = query.trim().length >= 2;

  return (
    <div className="workspace-page contacts-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">{workspaceName ?? "Workspace"}</span>
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
              ? "Tạo hoặc chọn workspace trước khi mở hội thoại riêng."
              : isSearching
                ? "Không tìm thấy người dùng phù hợp với từ khóa này."
                : "Nhập email, tên đăng nhập hoặc số điện thoại để tìm bạn bè."
          }
          title={!workspaceId ? "Chưa có workspace" : isSearching ? "Không có kết quả" : "Tìm bạn bè để bắt đầu"}
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
  onChannelSelect,
  workspaceName
}: {
  canCreateChannel: boolean;
  channels: ChatChannel[];
  isLoading: boolean;
  onChannelSelect: (channelId: string) => void;
  workspaceName?: string;
}) {
  return (
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">{workspaceName ?? "Workspace"}</span>
          <h1>Kênh</h1>
          <p>Danh sách kênh được tải trực tiếp từ API backend.</p>
        </div>
        <Badge tone={canCreateChannel ? "green" : "orange"}>{canCreateChannel ? "Có quyền tạo kênh" : "Chỉ xem"}</Badge>
      </header>

      {isLoading ? (
        <PanelSkeleton />
      ) : channels.length ? (
        <div className="workspace-grid-list">
          {channels.map((channel) => (
            <button className="workspace-tile" key={channel.id} onClick={() => onChannelSelect(channel.id)} type="button">
              <span className={`channel-hash channel-hash--${channel.tone}`}>
                <Hash size={20} />
              </span>
              <strong>{channel.name}</strong>
              <p>{channel.description}</p>
              <small>{channel.memberCount} thành viên · {channel.unreadCount} chưa đọc</small>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState description="Tạo kênh ở panel bên trái khi tài khoản có quyền." title="Chưa có kênh" />
      )}
    </div>
  );
}

function FilesPage({
  files,
  isLoading,
  onDownloadFile,
  workspaceName
}: {
  files: FileItem[];
  isLoading: boolean;
  onDownloadFile: (file: FileItem) => void;
  workspaceName?: string;
}) {
  return (
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">{workspaceName ?? "Workspace"}</span>
          <h1>File</h1>
          <p>File gần đây được tải từ API lưu trữ của backend.</p>
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
        <EmptyState description="Backend chưa trả về file cho workspace này." title="Chưa có file" />
      )}
    </div>
  );
}

function SettingsPage({
  apiStatus,
  currentUser,
  isUpdatingProfile,
  onProfileSubmit,
  onThemeToggle,
  theme,
  workspaceName
}: {
  apiStatus: string;
  currentUser: ChatUser;
  isUpdatingProfile: boolean;
  onProfileSubmit: (input: {
    avatar_url?: string | null;
    display_name?: string;
    phone_number?: string | null;
  }) => void;
  onThemeToggle: () => void;
  theme: "dark" | "light";
  workspaceName?: string;
}) {
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
          <span className="workspace-page__eyebrow">{workspaceName ?? "Chưa có workspace"}</span>
          <h1>Cài đặt</h1>
          <p>Cấu hình trải nghiệm giao diện và trạng thái kết nối frontend.</p>
        </div>
        <Badge tone={apiStatus === "online" ? "green" : "orange"}>{apiStatus === "online" ? "API sẵn sàng" : "Đang kiểm tra API"}</Badge>
      </header>

      <div className="settings-grid">
        <section className="settings-card settings-card--profile">
          <div>
            <Avatar name={currentUser.name} src={currentUser.avatarUrl} status={currentUser.status} />
            <h2>Hồ sơ cá nhân</h2>
          </div>
          <form className="profile-form" onSubmit={handleSubmit}>
            <label>
              Tên hiển thị
              <input defaultValue={currentUser.name} name="display_name" placeholder="Tên của bạn" />
            </label>
            <label>
              Ảnh đại diện
              <input defaultValue={currentUser.avatarUrl ?? ""} name="avatar_url" placeholder="https://..." />
            </label>
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
            <h2>Bảo mật phiên</h2>
          </div>
          <p>Token đăng nhập được dùng cho API production và realtime theo cấu hình hiện tại.</p>
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
        <section className="settings-card">
          <div>
            <Cloud size={22} />
            <h2>API backend</h2>
          </div>
          <p>Frontend đang sử dụng endpoint production đã triển khai.</p>
        </section>
      </div>
    </div>
  );
}

function OperationalPage({ activeRailItem }: { activeRailItem: RailItemId }) {
  const pageConfig: Partial<Record<RailItemId, { description: string; icon: typeof Ticket; title: string }>> = {
    automation: {
      description: "Khu vực webhook, luồng tự động và module runner sẽ cần endpoint quản trị tương ứng từ backend.",
      icon: Workflow,
      title: "Automation"
    },
    bots: {
      description: "Trang bot đã sẵn sàng khung UI, chờ API bot token, bot profile và message webhook.",
      icon: Bot,
      title: "Bot"
    },
    tickets: {
      description: "Ticket nội bộ cần API ticket hoặc tích hợp hệ thống ticket trước khi thao tác production.",
      icon: Ticket,
      title: "Ticket"
    }
  };
  const config = pageConfig[activeRailItem] ?? {
    description: "Màn hình này đang chờ API backend tương ứng.",
    icon: Archive,
    title: "Chức năng"
  };
  const Icon = config.icon;

  return (
    <div className="workspace-page">
      <header className="workspace-page__header">
        <div>
          <span className="workspace-page__eyebrow">Chưa có dữ liệu giả</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <Badge tone="orange">Chờ API</Badge>
      </header>
      <section className="operational-empty">
        <Icon size={42} />
        <h2>Đã có khung giao diện</h2>
        <p>Khi backend bổ sung endpoint, trang này có thể gắn query/mutation theo cùng pattern đang dùng cho chat, file và thông báo.</p>
      </section>
    </div>
  );
}

function WorkspaceSummaryPanel({
  activeRailItem,
  apiStatus,
  channelsCount,
  contactsCount,
  directConversations,
  filesCount,
  notificationsUnread,
  workspaceName
}: {
  activeRailItem: RailItemId;
  apiStatus: string;
  channelsCount: number;
  contactsCount: number;
  directConversations: ChatWorkspaceData["directConversations"];
  filesCount: number;
  notificationsUnread: number;
  workspaceName?: string;
}) {
  const label = railItems.find((item) => item.id === activeRailItem)?.label ?? "Workspace";

  return (
    <aside className="detail-panel workspace-summary-panel" aria-label="Tóm tắt workspace">
      <header>
        <span>{workspaceName ?? "Chưa có workspace"}</span>
        <h2>{label}</h2>
        <p>Dữ liệu hiển thị từ API backend hiện có.</p>
      </header>

      <div className="summary-stat-grid">
        <article>
          <Users size={18} />
          <strong>{contactsCount}</strong>
          <span>Thành viên</span>
        </article>
        <article>
          <Hash size={18} />
          <strong>{channelsCount}</strong>
          <span>Kênh</span>
        </article>
        <article>
          <Bell size={18} />
          <strong>{notificationsUnread}</strong>
          <span>Chưa đọc</span>
        </article>
        <article>
          <FileText size={18} />
          <strong>{filesCount}</strong>
          <span>File</span>
        </article>
      </div>

      <section className="summary-card">
        <h3>Trạng thái API</h3>
        <Badge tone={apiStatus === "online" ? "green" : "orange"}>{apiStatus === "online" ? "Sẵn sàng" : "Đang kiểm tra"}</Badge>
      </section>

      <section className="summary-card">
        <h3>Hội thoại gần đây</h3>
        {directConversations.slice(0, 4).length ? (
          directConversations.slice(0, 4).map((conversation) => (
            <div className="summary-conversation" key={conversation.id}>
              <Avatar name={conversation.user.name} size="sm" src={conversation.user.avatarUrl} />
              <span>
                <strong>{conversation.user.name}</strong>
                <small>{conversation.lastMessage}</small>
              </span>
            </div>
          ))
        ) : (
          <p>Chưa có hội thoại riêng từ API.</p>
        )}
      </section>
    </aside>
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

const quickEmojis = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "✅", "🎉", "🤝", "😊", "💪"];

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
      <span />
      <span />
      <span />
    </div>
  );
}

function ChatHeader({
  channel
}: {
  channel: ChatChannel;
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
          <Button aria-label="Tìm kiếm" variant="icon">
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

function RealtimeStatusPill({ status }: { status: RealtimeConnectionStatus }) {
  const labels: Record<RealtimeConnectionStatus, string> = {
    connected: "Realtime đang kết nối",
    connecting: "Đang kết nối realtime",
    idle: "Realtime chờ phiên",
    offline: "Realtime ngoại tuyến",
    reconnecting: "Đang nối lại realtime"
  };
  const Icon = status === "connected" ? Wifi : WifiOff;

  return (
    <span className={`realtime-status realtime-status--${status}`}>
      <Icon size={16} />
      {labels[status]}
    </span>
  );
}

function PresenceStatusPill({ onlineCount }: { onlineCount: number }) {
  return (
    <span className="presence-status-pill">
      <Users size={16} />
      {onlineCount ? `${onlineCount} đang online` : "Đang đồng bộ hiện diện"}
    </span>
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
        <EmptyState description="Backend chưa trả về thông báo nào cho workspace này." title="Chưa có thông báo" />
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

  return (
    <div className="upload-queue" aria-label="Hàng đợi upload">
      {items.map((item) => (
        <article className={`upload-queue__item upload-queue__item--${item.status}`} key={item.id}>
          <span className="upload-queue__icon">
            {item.status === "attached" ? <CheckCircle2 size={16} /> : <Cloud size={16} />}
          </span>
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
  if (!messages.length) {
    return (
      <div className="message-timeline">
        {hasOlderMessages ? (
          <Button disabled={isLoadingOlderMessages} onClick={onLoadOlderMessages} size="sm" variant="secondary">
            {isLoadingOlderMessages ? "Đang tải..." : "Tải tin nhắn cũ"}
          </Button>
        ) : null}
        <EmptyState description="Tin nhắn từ backend sẽ xuất hiện tại đây." title="Kênh này chưa có tin nhắn" />
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
        <article className={message.isMine ? "message-row message-row--local" : "message-row"} key={message.id}>
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
            ) : (
              <p>{message.body}</p>
            )}
            {message.attachments?.length ? (
              <div className="attachment-list">
                {message.attachments.map((attachment) => (
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
                ))}
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
              <button className="reaction-add-button" onClick={() => onToggleReaction(message, "👍")} type="button">
                <Smile size={15} />
                Reaction
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function RightDetailPanel({
  activeTab,
  files,
  isLoading,
  isThreadLoading,
  mediaItems,
  onCloseThread,
  onFileSelect,
  onTabChange,
  pinnedMessages,
  threadMessageId,
  threadMessages
}: {
  activeTab: DetailTab;
  files: FileItem[];
  isLoading: boolean;
  isThreadLoading: boolean;
  mediaItems: MediaItem[];
  onCloseThread: () => void;
  onFileSelect: (file: FileItem) => void;
  onTabChange: (tab: DetailTab) => void;
  pinnedMessages: PinnedMessage[];
  threadMessageId: string | null;
  threadMessages: ChatMessage[];
}) {
  return (
    <aside className="detail-panel" aria-label="Thông tin kênh">
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
            <EmptyState description="Backend chưa trả về tin nhắn trong luồng này." title="Luồng trống" />
          )}
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
            <EmptyState description="Backend chưa trả về danh sách ghim cho kênh này." title="Chưa có tin ghim" />
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
                <span
                  aria-label={item.label}
                  className="media-file-thumb"
                  key={item.id}
                  role="img"
                  style={item.url ? { backgroundImage: `url(${item.url})` } : undefined}
                >
                  {!item.url ? item.name.slice(0, 2).toUpperCase() : null}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState description="Chưa có file ảnh nào từ API." title="Chưa có ảnh" />
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
            <EmptyState description="Danh sách file từ backend đang trống." title="Chưa có file" />
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
