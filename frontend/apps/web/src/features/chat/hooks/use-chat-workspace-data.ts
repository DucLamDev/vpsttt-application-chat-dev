"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@webtui/api-client";
import type {
  Channel as ApiChannel,
  CreateChannelInput,
  CreateWorkspaceInput,
  DirectConversation as ApiDirectConversation,
  FileObject,
  Notification as ApiNotification,
  WorkspaceMember
} from "@webtui/types";
import { api } from "@/lib/api";
import { useWorkspaceContext } from "@/features/workspace/hooks/use-workspace-context";
import { useChannelRealtime } from "./use-channel-realtime";
import {
  createOptimisticMessage,
  mergeMessageIntoTimeline,
  messageTimelineKey,
  useMessageTimeline
} from "./use-message-timeline";
import { useNotificationPresence } from "./use-notification-presence";
import type {
  ChannelTone,
  ChatChannel,
  ChatUser,
  DirectConversation,
  FileItem,
  MediaItem,
  NotificationItem,
  PresenceStatus
} from "../model/types";
import { useUploadStore, type UploadQueueItem } from "../stores/upload-store";

const channelTones: ChannelTone[] = ["purple", "green", "orange", "red", "violet", "slate"];

export type SendMessagePayload = {
  body: string;
  uploads: UploadQueueItem[];
};

export type SendMessageResult = {
  failedUploadNames: string[];
  message: Awaited<ReturnType<typeof api.messages.send>>;
};

export type CreateChannelPayload = Pick<CreateChannelInput, "description" | "name" | "slug" | "type">;
export type CreateWorkspacePayload = Pick<CreateWorkspaceInput, "description" | "name" | "slug">;
type CreateDirectConversationMutationInput =
  | string
  | {
      participantId: string;
      workspaceId?: string;
    };

export type ChatWorkspaceDataOptions = {
  friendSearchQuery?: string;
  messageSearchQuery?: string;
  threadMessageId?: string;
};

export { mapAuthUser } from "./use-message-timeline";

export function useChatWorkspaceData(currentUser: ChatUser, options: ChatWorkspaceDataOptions = {}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceContext = useWorkspaceContext();
  const { workspaceId } = workspaceContext;
  const requestedChannelId = searchParams.get("channel") ?? "";
  const friendSearchQuery = options.friendSearchQuery?.trim() ?? "";

  const channelsQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.channels.list(workspaceId),
    queryKey: queryKeys.channels.all(workspaceId)
  });
  const channels = useMemo(
    () => (channelsQuery.data ?? []).map(mapChannel),
    [channelsQuery.data]
  );

  const selectedChannel =
    channels.find((channel) => channel.id === requestedChannelId) ?? channels[0] ?? null;
  const selectedChannelId = selectedChannel?.id ?? "";

  const setSelectedChannelId = useCallback(
    (nextChannelId: string, nextWorkspaceId = workspaceId) => {
      const nextParams = new URLSearchParams(searchParams.toString());

      if (nextWorkspaceId) {
        nextParams.set("workspace", nextWorkspaceId);
      }

      if (nextChannelId) {
        nextParams.set("channel", nextChannelId);
      } else {
        nextParams.delete("channel");
      }

      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, workspaceId]
  );

  useEffect(() => {
    if (channels.length && !requestedChannelId && selectedChannelId) {
      setSelectedChannelId(selectedChannelId);
    }
  }, [channels.length, requestedChannelId, selectedChannelId, setSelectedChannelId]);

  const messageTimeline = useMessageTimeline({
    canManageMessages: workspaceContext.can("message.manage"),
    channelId: selectedChannelId,
    currentUser,
    enabled: Boolean(workspaceId && selectedChannelId),
    searchQuery: options.messageSearchQuery,
    threadMessageId: options.threadMessageId,
    workspaceId
  });
  const realtime = useChannelRealtime({
    channelId: selectedChannelId,
    enabled: Boolean(workspaceId),
    workspaceId
  });
  const notificationPresence = useNotificationPresence({
    currentUserId: currentUser.id,
    enabled: Boolean(workspaceId),
    workspaceId
  });
  const selectedChannelWithMessages = selectedChannel ? { ...selectedChannel, messages: messageTimeline.messages } : null;

  const directConversationsQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.channels.directConversations(workspaceId),
    queryKey: queryKeys.channels.directConversations(workspaceId)
  });
  const directConversations = useMemo(
    () =>
      (directConversationsQuery.data ?? [])
        .map((item) => mapDirectConversation(item, notificationPresence.presenceByUserId))
        .filter(Boolean) as DirectConversation[],
    [directConversationsQuery.data, notificationPresence.presenceByUserId]
  );
  const membersWithPresence = useMemo(
    () => mapMembersWithPresence(workspaceContext.members, notificationPresence.presenceByUserId),
    [notificationPresence.presenceByUserId, workspaceContext.members]
  );
  const searchUsersQuery = useQuery({
    enabled: friendSearchQuery.length >= 2,
    queryFn: () => api.users.list({ limit: 25, q: friendSearchQuery, status: "active" }),
    queryKey: queryKeys.users.all(friendSearchQuery, "active")
  });
  const searchUsers = useMemo(
    () => (searchUsersQuery.data ?? []).filter((item) => item.id !== currentUser.id),
    [currentUser.id, searchUsersQuery.data]
  );
  const contactsQuery = useQuery({
    queryFn: () => api.contacts.list(),
    queryKey: queryKeys.contacts.all
  });
  const contactRequestsQuery = useQuery({
    queryFn: () => api.contacts.requests({ status: "all" }),
    queryKey: queryKeys.contacts.requests("all")
  });
  const contacts = contactsQuery.data ?? [];
  const contactRequests = contactRequestsQuery.data ?? [];

  const filesQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.files.list(workspaceId),
    queryKey: queryKeys.files.all(workspaceId)
  });
  const files = useMemo(() => (filesQuery.data ?? []).map(mapFile), [filesQuery.data]);
  const mediaItems = useMemo(
    () =>
      files
        .filter((file) => file.mimeType?.startsWith("image/"))
        .map<MediaItem>((file) => ({
          id: file.id,
          label: file.name,
          name: file.name,
          url: file.downloadUrl
        })),
    [files]
  );

  const createChannelMutation = useMutation({
    mutationFn: (input: CreateChannelPayload) => {
      if (!workspaceId) {
        throw new Error("Chưa có workspace để tạo kênh.");
      }

      return api.channels.create(workspaceId, input);
    },
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) });
      setSelectedChannelId(channel.id);
    }
  });

  const createWorkspaceMutation = useMutation({
    mutationFn: (input: CreateWorkspacePayload) => api.workspaces.create(input),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      workspaceContext.setWorkspaceId(workspace.id);
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (input: SendMessagePayload): Promise<SendMessageResult> => {
      if (!workspaceId || !selectedChannelId) {
        throw new Error("Hãy chọn kênh trước khi gửi.");
      }

      const uploads = input.uploads.filter((item) => item.status === "queued" || item.status === "failed");
      const messageBody =
        input.body ||
        (uploads.length === 1
          ? `Đã gửi file ${uploads[0].name}`
          : uploads.length > 1
            ? `Đã gửi ${uploads.length} file`
            : "");
      const sentMessage = await api.messages.send(workspaceId, selectedChannelId, {
        body: messageBody,
        kind: "text"
      });

      const failedUploadNames: string[] = [];

      for (const [index, upload] of uploads.entries()) {
        try {
          useUploadStore.getState().markUploading(upload.id);
          const uploadedFile = await api.files.upload(workspaceId, {
            channel_id: selectedChannelId,
            file: upload.file,
            message_id: sentMessage.id
          });

          await api.files.attach(workspaceId, selectedChannelId, sentMessage.id, {
            file_id: uploadedFile.id,
            sort_order: index
          });

          useUploadStore.getState().markAttached(upload.id, sentMessage.id, uploadedFile.id);
        } catch (error) {
          failedUploadNames.push(upload.name);
          useUploadStore
            .getState()
            .markFailed(upload.id, error instanceof Error ? error.message : "Không upload được file.");
        }
      }

      return {
        failedUploadNames,
        message: sentMessage
      };
    },
    onMutate: async (input) => {
      if (!workspaceId || !selectedChannelId) {
        return undefined;
      }

      const uploads = input.uploads.filter((item) => item.status === "queued" || item.status === "failed");
      const body =
        input.body ||
        (uploads.length === 1
          ? `Đã gửi file ${uploads[0].name}`
          : uploads.length > 1
            ? `Đã gửi ${uploads.length} file`
            : "");
      if (!body) {
        return undefined;
      }

      const queryKey = messageTimelineKey(workspaceId, selectedChannelId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimisticMessage = createOptimisticMessage({
        body,
        channelId: selectedChannelId,
        currentUser,
        workspaceId
      });

      mergeMessageIntoTimeline(queryClient, workspaceId, selectedChannelId, optimisticMessage);

      return {
        optimisticId: optimisticMessage.id,
        previous
      };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(messageTimelineKey(workspaceId, selectedChannelId), context.previous);
      }
    },
    onSuccess: async (result, _input, context) => {
      mergeMessageIntoTimeline(queryClient, workspaceId, selectedChannelId, result.message, context?.optimisticId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(workspaceId, selectedChannelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.files.messageAttachments(workspaceId, selectedChannelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.files.all(workspaceId) })
      ]);
    }
  });

  const downloadMutation = useMutation({
    mutationFn: (file: FileItem) => api.files.download(workspaceId, file.id)
  });

  const createDirectConversationMutation = useMutation({
    mutationFn: (input: CreateDirectConversationMutationInput) => {
      const participantId = typeof input === "string" ? input : input.participantId;
      const targetWorkspaceId = typeof input === "string" ? workspaceId : input.workspaceId || workspaceId;

      if (!targetWorkspaceId) {
        throw new Error("Chưa có workspace để tạo hội thoại riêng.");
      }

      return api.channels.createDirectConversation(targetWorkspaceId, {
        participant_ids: [participantId]
      });
    },
    onSuccess: async (_conversation, input) => {
      const targetWorkspaceId = typeof input === "string" ? workspaceId : input.workspaceId || workspaceId;
      if (!targetWorkspaceId) {
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.directConversations(targetWorkspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members(targetWorkspaceId) })
      ]);
    }
  });

  const invalidateContacts = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.requests("all") })
    ]);
  }, [queryClient]);

  const sendContactRequestMutation = useMutation({
    mutationFn: (userId: string) => api.contacts.sendRequest({ user_id: userId }),
    onSuccess: invalidateContacts
  });

  const acceptContactRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.contacts.acceptRequest(requestId),
    onSuccess: invalidateContacts
  });

  const rejectContactRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.contacts.rejectRequest(requestId),
    onSuccess: invalidateContacts
  });

  const cancelContactRequestMutation = useMutation({
    mutationFn: (requestId: string) => api.contacts.cancelRequest(requestId),
    onSuccess: invalidateContacts
  });

  const updateProfileMutation = useMutation({
    mutationFn: (input: {
      avatar_url?: string | null;
      display_name?: string;
      locale?: string;
      phone_number?: string | null;
      timezone?: string;
    }) => api.users.updateMe(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.me })
      ]);
    }
  });

  const markChannelRead = useCallback(
    (channelId: string, messageId?: string) => {
      if (!workspaceId) {
        return;
      }

      void api.channels
        .updateReadState(workspaceId, channelId, messageId ? { last_read_message_id: messageId } : {})
        .catch(() => undefined);
    },
    [workspaceId]
  );

  useEffect(() => {
    const lastMessage = messageTimeline.messages.at(-1);
    if (workspaceId && selectedChannelId && lastMessage?.id && !lastMessage.isPending) {
      markChannelRead(selectedChannelId, lastMessage.id);
    }
  }, [markChannelRead, messageTimeline.messages, selectedChannelId, workspaceId]);

  return {
    ...workspaceContext,
    channels,
    channelsQuery,
    acceptContactRequestMutation,
    cancelContactRequestMutation,
    createChannelMutation,
    createDirectConversationMutation,
    createWorkspaceMutation,
    directConversations,
    directConversationsQuery,
    downloadMutation,
    contacts,
    contactsQuery,
    contactRequests,
    contactRequestsQuery,
    files,
    filesQuery,
    hasOlderMessages: messageTimeline.hasOlderMessages,
    isLoadingOlderMessages: messageTimeline.isLoadingOlderMessages,
    loadOlderMessages: messageTimeline.loadOlderMessages,
    markChannelRead,
    mediaItems,
    members: membersWithPresence,
    messages: messageTimeline.messages,
    messagesQuery: messageTimeline.messagesQuery,
    messageSearchQuery: messageTimeline.searchQuery,
    messageSearchResults: messageTimeline.searchResults,
    markAllNotificationsReadMutation: notificationPresence.markAllNotificationsReadMutation,
    markNotificationReadMutation: notificationPresence.markNotificationReadMutation,
    notifications: notificationPresence.notifications.map(mapNotification),
    notificationsQuery: notificationPresence.notificationsQuery,
    presenceByUserId: notificationPresence.presenceByUserId,
    presenceQuery: notificationPresence.presenceQuery,
    pinnedMessages: messageTimeline.pinnedMessages,
    pinnedMessagesQuery: messageTimeline.pinnedMessagesQuery,
    pinMessageMutation: messageTimeline.pinMessageMutation,
    realtime,
    selectedChannel,
    selectedChannelId,
    selectedChannelWithMessages,
    setSelectedChannelId,
    searchUsers,
    searchUsersQuery,
    rejectContactRequestMutation,
    sendContactRequestMutation,
    threadMessages: messageTimeline.threadMessages,
    threadQuery: messageTimeline.threadQuery,
    editMessageMutation: messageTimeline.editMessageMutation,
    deleteMessageMutation: messageTimeline.deleteMessageMutation,
    toggleReactionMutation: messageTimeline.toggleReactionMutation,
    unpinMessageMutation: messageTimeline.unpinMessageMutation,
    unreadNotificationsCount: notificationPresence.unreadNotificationsCount,
    updateProfileMutation,
    sendMessageMutation
  };
}

function mapChannel(channel: ApiChannel, index: number): ChatChannel {
  return {
    description: channel.description || "Chưa có mô tả",
    id: channel.id,
    isFavorite: Boolean(channel.is_favorite),
    memberCount: channel.member_count ?? 0,
    messages: [],
    name: channel.name,
    tone: channelTones[index % channelTones.length],
    unreadCount: channel.unread_count ?? 0
  };
}

function mapDirectConversation(
  item: ApiDirectConversation,
  presenceByUserId: Map<string, { status?: string }>
): DirectConversation | null {
  const participant = item.user ?? item.participants?.[0];

  if (!participant) {
    return null;
  }

  return {
    id: item.channel_id ?? item.id,
    lastMessage: item.last_message?.body ?? "Chưa có tin nhắn",
    relativeTime: formatRelative(item.updated_at ?? item.last_message?.created_at),
    unreadCount: item.unread_count,
    user: {
      avatarUrl: participant.avatar_url ?? undefined,
      id: participant.user_id,
      name: displayName(participant),
      status: mapPresenceStatus(presenceByUserId.get(participant.user_id)?.status ?? participant.status)
    }
  };
}

function mapFile(file: FileObject): FileItem {
  const name = file.name ?? file.file_name ?? file.original_name ?? "File chưa đặt tên";
  const mimeType = file.mime_type;

  return {
    downloadUrl: file.download_url ?? file.url,
    id: file.id,
    mimeType,
    name,
    size: formatFileSize(file.byte_size ?? file.size_bytes ?? file.size),
    tone: mimeType?.includes("pdf") ? "red" : mimeType?.startsWith("image/") ? "green" : "slate",
    updatedAt: formatRelative(file.updated_at ?? file.created_at)
  };
}

function mapMembersWithPresence(
  members: WorkspaceMember[],
  presenceByUserId: Map<string, { status?: string }>
): WorkspaceMember[] {
  return members.map((member) => ({
    ...member,
    status: mapPresenceStatus(presenceByUserId.get(member.user_id)?.status ?? member.status)
  }));
}

function mapNotification(notification: ApiNotification): NotificationItem {
  return {
    body: notification.body,
    channelId: notification.channel_id ?? undefined,
    createdAt: formatRelative(notification.created_at),
    id: notification.id,
    isRead: Boolean(notification.read_at),
    messageId: notification.message_id ?? undefined,
    title: notification.title,
    type: notification.type
  };
}

function mapPresenceStatus(status?: string): PresenceStatus {
  if (status === "offline") {
    return "offline";
  }

  if (status === "away" || status === "busy") {
    return "busy";
  }

  return "online";
}

function displayName(
  user:
    | { display_name?: string; email?: string; username?: string }
    | null
    | undefined
): string {
  return user?.display_name || user?.username || user?.email || "Người dùng";
}

function formatRelative(value?: string): string {
  if (!value) {
    return "Không rõ";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function formatFileSize(size?: number): string {
  if (!size) {
    return "0 B";
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
