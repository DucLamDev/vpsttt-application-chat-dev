"use client";

import { useCallback, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@webtui/api-client";
import type {
  Channel as ApiChannel,
  CreateDepartmentInput,
  CreateChannelInput,
  DirectConversation as ApiDirectConversation,
  FileObject,
  Message as ApiMessage,
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
  useMessageTimeline,
  type MessageSearchFilters
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
import { buildChatRoute, buildWorkspaceSectionRoute, directIdPrefix, directRouteRef, parseChatRoute } from "@/lib/chat-route";

const channelTones: ChannelTone[] = ["purple", "green", "orange", "red", "violet", "slate"];
const contactRefetchMs = 5_000;

export type SendMessagePayload = {
  body: string;
  uploads: UploadQueueItem[];
};

export type SendMessageResult = {
  failedUploadNames: string[];
  message: Awaited<ReturnType<typeof api.messages.send>>;
};

export type CreateChannelPayload = Pick<CreateChannelInput, "description" | "name" | "slug" | "type">;
export type CreateDepartmentPayload = Pick<CreateDepartmentInput, "description" | "name" | "parent_id" | "slug">;
type CreateDirectConversationMutationInput =
  | string
  | {
      participantId: string;
      workspaceId?: string;
    };

export type ChatWorkspaceDataOptions = {
  friendSearchQuery?: string;
  messageSearchQuery?: string;
  messageSearchFilters?: MessageSearchFilters;
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
  const parsedRoute = parseChatRoute(pathname);
  const legacyChannelId = searchParams.get("channel") ?? "";
  const friendSearchQuery = options.friendSearchQuery?.trim() ?? "";

  const channelsQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.channels.list(workspaceId),
    queryKey: queryKeys.channels.all(workspaceId),
    refetchInterval: contactRefetchMs
  });
  const channels = useMemo(
    () => (channelsQuery.data ?? []).map(mapChannel),
    [channelsQuery.data]
  );

  const notificationPresence = useNotificationPresence({
    currentUserId: currentUser.id,
    enabled: Boolean(workspaceId),
    workspaceId
  });

  const directConversationsQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.channels.directConversations(workspaceId),
    queryKey: queryKeys.channels.directConversations(workspaceId),
    refetchInterval: contactRefetchMs
  });
  const directConversationSummaries = useQueries({
    queries: (directConversationsQuery.data ?? []).map((conversation) => {
      const channelId = conversation.channel_id ?? conversation.id;
      return {
        enabled: Boolean(workspaceId && channelId && !conversation.last_message),
        queryFn: () => api.messages.list(workspaceId, channelId, { limit: 1 }),
        queryKey: ["direct-conversation-summary", workspaceId, channelId] as const,
        refetchInterval: contactRefetchMs,
        retry: 2,
        staleTime: 3_000
      };
    })
  });
  const directConversations = useMemo(
    () =>
      (directConversationsQuery.data ?? [])
        .map((item, index) =>
          mapDirectConversation(
            item,
            notificationPresence.presenceByUserId,
            currentUser.id,
            directConversationSummaries[index]?.data?.[0]
          )
        )
        .filter(Boolean) as DirectConversation[],
    [currentUser.id, directConversationSummaries, directConversationsQuery.data, notificationPresence.presenceByUserId]
  );
  const requestedChannelId = useMemo(() => {
    if (legacyChannelId) {
      return legacyChannelId;
    }
    const reference = parsedRoute?.targetRef;
    if (!reference) {
      return "";
    }
    if (parsedRoute?.kind === "channel") {
      return channels.find((channel) => channel.slug === reference || channel.id === reference)?.id ?? "";
    }
    if (parsedRoute?.kind === "dm") {
      const prefix = directIdPrefix(reference);
      return directConversations.find((conversation) => conversation.id === reference || conversation.id.startsWith(prefix))?.id ?? "";
    }
    return "";
  }, [channels, directConversations, legacyChannelId, parsedRoute?.kind, parsedRoute?.targetRef]);
  const membersWithPresence = useMemo(
    () => mapMembersWithPresence(workspaceContext.members, notificationPresence.presenceByUserId),
    [notificationPresence.presenceByUserId, workspaceContext.members]
  );

  const selectedDirectConversation = directConversations.find((conversation) => conversation.id === requestedChannelId);
  const selectedChannel =
    channels.find((channel) => channel.id === requestedChannelId) ??
    (selectedDirectConversation ? directConversationToChannel(selectedDirectConversation) : null);
  const selectedChannelId = requestedChannelId || "";
  const canAccessSelectedChannel = Boolean(
    selectedChannel && (selectedChannel.type === "direct" || selectedChannel.isMember)
  );

  const setSelectedChannelId = useCallback(
    (nextChannelId: string, nextWorkspaceId = workspaceId, requestedType?: "channel" | "direct") => {
      const workspace = workspaceContext.workspaces.find((item) => item.id === nextWorkspaceId);
      const workspaceRef = workspace?.slug || nextWorkspaceId;
      if (!workspaceRef) {
        return;
      }
      if (!nextChannelId) {
        router.replace(buildChatRoute(workspaceRef), { scroll: false });
        return;
      }
      const direct = directConversations.find((item) => item.id === nextChannelId);
      const channel = channels.find((item) => item.id === nextChannelId);
      const isDirect = requestedType === "direct" || Boolean(direct);
      const targetRef = isDirect
        ? directRouteRef(direct?.user.name ?? "hoi-thoai", nextChannelId)
        : channel?.slug || nextChannelId;
      router.replace(buildChatRoute(workspaceRef, isDirect ? "dm" : "channel", targetRef), { scroll: false });
    },
    [channels, directConversations, router, workspaceContext.workspaces, workspaceId]
  );
  const setWorkspaceSection = useCallback(
    (section?: string) => {
      const workspace = workspaceContext.workspaces.find((item) => item.id === workspaceId);
      const workspaceRef = workspace?.slug || workspaceId;
      if (!workspaceRef) return;
      router.replace(section ? buildWorkspaceSectionRoute(workspaceRef, section) : buildChatRoute(workspaceRef), { scroll: false });
    },
    [router, workspaceContext.workspaces, workspaceId]
  );

  useEffect(() => {
    if (legacyChannelId && requestedChannelId && workspaceId) {
      setSelectedChannelId(requestedChannelId, workspaceId);
    }
  }, [legacyChannelId, requestedChannelId, setSelectedChannelId, workspaceId]);

  const messageTimeline = useMessageTimeline({
    canManageMessages: workspaceContext.can("message.manage"),
    channelId: selectedChannelId,
    currentUser,
    enabled: Boolean(workspaceId && selectedChannelId && canAccessSelectedChannel),
    searchQuery: options.messageSearchQuery,
    searchFilters: options.messageSearchFilters,
    threadMessageId: options.threadMessageId,
    workspaceId
  });
  const realtime = useChannelRealtime({
    channelId: selectedChannelId,
    channelIds: [
      ...channels.filter((channel) => channel.isMember).map((channel) => channel.id),
      ...directConversations.map((conversation) => conversation.id)
    ],
    currentUserId: currentUser.id,
    enabled: Boolean(workspaceId),
    workspaceId
  });
  const selectedChannelWithMessages = selectedChannelId
    ? { ...(selectedChannel ?? placeholderChannel(selectedChannelId)), messages: messageTimeline.messages }
    : null;
  const managedChannelIds = channels.filter((channel) => channel.canManage).map((channel) => channel.id);
  const joinRequestQueries = useQueries({
    queries: managedChannelIds.map((channelId) => ({
      enabled: Boolean(workspaceId),
      queryFn: () => api.channels.joinRequests(workspaceId, channelId),
      queryKey: queryKeys.channels.joinRequests(workspaceId, channelId),
      refetchInterval: contactRefetchMs
    }))
  });
  const joinRequestsByChannelId = useMemo(
    () => new Map(managedChannelIds.map((channelId, index) => [channelId, joinRequestQueries[index]?.data ?? []])),
    [joinRequestQueries, managedChannelIds]
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
    queryKey: queryKeys.contacts.all,
    refetchInterval: contactRefetchMs
  });
  const contactRequestsQuery = useQuery({
    queryFn: () => api.contacts.requests({ status: "all" }),
    queryKey: queryKeys.contacts.requests("all"),
    refetchInterval: contactRefetchMs
  });
  const contacts = contactsQuery.data ?? [];
  const contactRequests = contactRequestsQuery.data ?? [];

  const filesQuery = useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => api.files.list(workspaceId),
    queryKey: queryKeys.files.all(workspaceId)
  });
  const files = useMemo(() => (filesQuery.data ?? []).map(mapFile), [filesQuery.data]);
  const canManageDepartments = workspaceContext.can("workspace.manage");
  const departmentsQuery = useQuery({
    enabled: Boolean(workspaceId && canManageDepartments),
    queryFn: () => api.departments.list(workspaceId),
    queryKey: queryKeys.departments.all(workspaceId),
    retry: false
  });
  const departments = departmentsQuery.data ?? [];
  const mediaItems = useMemo(
    () => {
      if (!canAccessSelectedChannel) {
        return [];
      }
      return messageTimeline.messages.flatMap((message) =>
        (message.attachments ?? [])
          .filter((attachment) => attachment.isImage)
          .map<MediaItem>((attachment) => ({
            id: attachment.fileId,
            label: attachment.name,
            name: attachment.name,
            url: attachment.previewUrl ?? attachment.url
          }))
      );
    },
    [canAccessSelectedChannel, messageTimeline.messages]
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

  const openPrivateSessionMutation = useMutation({
    mutationFn: (sourceChannelId: string) => {
      if (!workspaceId) {
        throw new Error("Chưa có workspace để mở phiên riêng tư.");
      }
      return api.channels.openPrivateSession(workspaceId, sourceChannelId);
    },
    onSuccess: async (channel) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) });
      setSelectedChannelId(channel.id, workspaceId, "channel");
    }
  });

  const requestChannelJoinMutation = useMutation({
    mutationFn: (channelId: string) => {
      if (!workspaceId) {
        throw new Error("Chưa có workspace để tham gia kênh.");
      }
      return api.channels.requestJoin(workspaceId, channelId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) });
    }
  });

  const inviteChannelMemberMutation = useMutation({
    mutationFn: ({ channelId, userId }: { channelId: string; userId: string }) =>
      api.channels.addMember(workspaceId, channelId, { user_id: userId }),
    onSuccess: async (_member, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.members(workspaceId, input.channelId) })
      ]);
    }
  });

  const approveChannelJoinMutation = useMutation({
    mutationFn: ({ channelId, userId }: { channelId: string; userId: string }) =>
      api.channels.approveJoinRequest(workspaceId, channelId, userId),
    onSuccess: async (_member, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.joinRequests(workspaceId, input.channelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) })
      ]);
    }
  });

  const rejectChannelJoinMutation = useMutation({
    mutationFn: ({ channelId, userId }: { channelId: string; userId: string }) =>
      api.channels.rejectJoinRequest(workspaceId, channelId, userId),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.channels.joinRequests(workspaceId, input.channelId) });
    }
  });

  const createDepartmentMutation = useMutation({
    mutationFn: (input: CreateDepartmentPayload) => {
      if (!workspaceId) {
        throw new Error("Chưa có workspace để tạo phòng ban.");
      }
      return api.departments.create(workspaceId, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.departments.all(workspaceId) });
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (input: SendMessagePayload): Promise<SendMessageResult> => {
      if (!workspaceId || !selectedChannelId) {
        throw new Error("Hãy chọn kênh trước khi gửi.");
      }

      const uploads = input.uploads.filter((item) => item.status === "queued" || item.status === "failed");
      const messageBody = input.body || uploadMessageFallback(uploads);
      const isVoiceMessage = Boolean(uploads.length && !input.body && uploads.every((upload) => upload.isAudio));
      const sentMessage = await api.messages.send(workspaceId, selectedChannelId, {
        body: messageBody,
        kind: isVoiceMessage ? "file" : "text",
        ...(isVoiceMessage ? { metadata: { message_type: "voice" } } : {})
      });

      const attachedFiles: NonNullable<ApiMessage["attachments"]> = [];
      const failedUploadNames: string[] = [];

      for (const [index, upload] of uploads.entries()) {
        try {
          useUploadStore.getState().markUploading(upload.id);
          const uploadedFile = await api.files.upload(workspaceId, {
            channel_id: selectedChannelId,
            file: upload.file,
            message_id: sentMessage.id,
            ...(upload.isAudio
              ? {
                  metadata: {
                    duration_seconds: upload.durationSeconds ?? 0,
                    media_type: "voice"
                  }
                }
              : {})
          });

          await api.files.attach(workspaceId, selectedChannelId, sentMessage.id, {
            file_id: uploadedFile.id,
            sort_order: index
          });

          attachedFiles.push({
            byte_size: uploadedFile.byte_size,
            file: uploadedFile,
            file_id: uploadedFile.id,
            id: `${sentMessage.id}-${uploadedFile.id}`,
            mime_type: uploadedFile.mime_type,
            name: uploadedFile.name ?? uploadedFile.file_name ?? uploadedFile.original_name,
            original_name: uploadedFile.original_name,
            size: uploadedFile.size,
            size_bytes: uploadedFile.size_bytes,
            url: uploadedFile.url ?? uploadedFile.download_url
          });

          useUploadStore.getState().markAttached(upload.id, sentMessage.id, uploadedFile.id);
        } catch (error) {
          failedUploadNames.push(upload.name);
          useUploadStore
            .getState()
            .markFailed(upload.id, error instanceof Error ? error.message : "Không upload được file.");
        }
      }

      if (uploads.length && !attachedFiles.length && !input.body) {
        await api.messages.delete(workspaceId, selectedChannelId, sentMessage.id).catch(() => undefined);
        throw new Error("Không tải được tin nhắn thoại. Bản ghi tạm đã được thu hồi; hãy thử lại.");
      }

      return {
        failedUploadNames,
        message: attachedFiles.length ? { ...sentMessage, attachments: attachedFiles } : sentMessage
      };
    },
    onMutate: async (input) => {
      if (!workspaceId || !selectedChannelId) {
        return undefined;
      }

      const uploads = input.uploads.filter((item) => item.status === "queued" || item.status === "failed");
      const body = input.body || uploadMessageFallback(uploads);
      if (!body) {
        return undefined;
      }

      const queryKey = messageTimelineKey(workspaceId, selectedChannelId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const optimisticMessage = createOptimisticMessage({
        attachments: uploads.map((upload) => uploadToOptimisticAttachment(upload)),
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
      queryClient.setQueryData<ApiDirectConversation[]>(
        queryKeys.channels.directConversations(workspaceId),
        (current) => updateDirectConversationLastMessage(current, selectedChannelId, result.message)
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.messages.channel(workspaceId, selectedChannelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.directConversations(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.files.messageAttachments(workspaceId, selectedChannelId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.files.all(workspaceId) })
      ]);
    }
  });

  const downloadMutation = useMutation({
    mutationFn: (file: FileItem) => api.files.download(workspaceId, file.id)
  });
  const downloadAttachment = useCallback(
    (fileId: string) => api.files.download(workspaceId, fileId),
    [workspaceId]
  );

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
    onSuccess: async (conversation, input) => {
      const targetWorkspaceId = typeof input === "string" ? workspaceId : input.workspaceId || workspaceId;
      if (!targetWorkspaceId) {
        return;
      }
      queryClient.setQueryData<ApiDirectConversation[]>(
        queryKeys.channels.directConversations(targetWorkspaceId),
        (current) => upsertDirectConversation(current, conversation)
      );
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
        .then(() => Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.channels.all(workspaceId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.channels.directConversations(workspaceId) })
        ]))
        .catch(() => undefined);
    },
    [queryClient, workspaceId]
  );

  useEffect(() => {
    const lastMessage = messageTimeline.messages.at(-1);
    if (workspaceId && selectedChannelId && lastMessage?.id && !lastMessage.isPending) {
      markChannelRead(selectedChannelId, lastMessage.id);
    }
  }, [markChannelRead, messageTimeline.messages, selectedChannelId, workspaceId]);

  return {
    ...workspaceContext,
    approveChannelJoinMutation,
    canAccessSelectedChannel,
    channels,
    channelsQuery,
    acceptContactRequestMutation,
    cancelContactRequestMutation,
    createChannelMutation,
    createDirectConversationMutation,
    createDepartmentMutation,
    directConversations,
    directConversationsQuery,
    downloadAttachment,
    downloadMutation,
    departments,
    departmentsQuery,
    contacts,
    contactsQuery,
    contactRequests,
    contactRequestsQuery,
    files,
    filesQuery,
    inviteChannelMemberMutation,
    joinRequestsByChannelId,
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
    openPrivateSessionMutation,
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
    setWorkspaceSection,
    searchUsers,
    searchUsersQuery,
    sendThreadMessageMutation: messageTimeline.sendThreadMessageMutation,
    rejectContactRequestMutation,
    rejectChannelJoinMutation,
    requestChannelJoinMutation,
    sendContactRequestMutation,
    threadMessages: messageTimeline.threadMessages,
    threadQuery: messageTimeline.threadQuery,
    editMessageMutation: messageTimeline.editMessageMutation,
    forwardMessageMutation: messageTimeline.forwardMessageMutation,
    deleteMessageMutation: messageTimeline.deleteMessageMutation,
    toggleReactionMutation: messageTimeline.toggleReactionMutation,
    unpinMessageMutation: messageTimeline.unpinMessageMutation,
    unreadNotificationsCount: notificationPresence.unreadNotificationsCount,
    updateProfileMutation,
    sendMessageMutation
  };
}

function uploadMessageFallback(uploads: UploadQueueItem[]): string {
  if (!uploads.length) {
    return "";
  }

  const imageCount = uploads.filter((upload) => upload.isImage).length;
  const audioCount = uploads.filter((upload) => upload.isAudio).length;

  if (audioCount === uploads.length) {
    return audioCount === 1 ? "Đã gửi tin nhắn thoại" : `Đã gửi ${audioCount} tin nhắn thoại`;
  }

  if (imageCount === uploads.length) {
    return imageCount === 1 ? "Đã gửi ảnh" : `Đã gửi ${imageCount} ảnh`;
  }

  if (uploads.length === 1) {
    return `Đã gửi file ${uploads[0].name}`;
  }

  return `Đã gửi ${uploads.length} file`;
}

function uploadToOptimisticAttachment(upload: UploadQueueItem): NonNullable<ApiMessage["attachments"]>[number] {
  return {
    byte_size: upload.size,
    file_id: upload.id,
    id: upload.id,
    mime_type: upload.file.type,
    name: upload.name,
    original_name: upload.name,
    size: upload.size,
    size_bytes: upload.size,
    url: upload.previewUrl
  };
}

function mapChannel(channel: ApiChannel, index: number): ChatChannel {
  return {
    canManage: Boolean(channel.can_manage),
    createdBy: channel.created_by ?? undefined,
    departmentId: channel.department_id ?? undefined,
    description: channel.description || "Chưa có mô tả",
    id: channel.id,
    isFavorite: Boolean(channel.is_favorite),
    isMember: Boolean(channel.is_member),
    membershipStatus: channel.membership_status ?? "none",
    privateSessionMode: Boolean(channel.private_session_mode),
    memberCount: channel.member_count ?? 0,
    messages: [],
    name: channel.name,
    relativeTime: formatConversationTime(channel.updated_at ?? channel.created_at),
    slug: channel.slug,
    tone: channelTones[index % channelTones.length],
    type: channel.type ?? channel.kind,
    unreadCount: channel.unread_count ?? 0
  };
}

function mapDirectConversation(
  item: ApiDirectConversation,
  presenceByUserId: Map<string, { status?: string }>,
  currentUserId: string,
  latestMessage?: ApiMessage
): DirectConversation | null {
  const participant = item.user ?? item.participants?.find((member) => member.user_id !== currentUserId) ?? item.participants?.[0];

  if (!participant) {
    return null;
  }

  const lastMessage = item.last_message ?? latestMessage;

  return {
    id: item.channel_id ?? item.id,
    lastMessage: lastMessage?.body ?? "Chưa có tin nhắn",
    relativeTime: formatConversationTime(lastMessage?.created_at ?? lastMessage?.updated_at ?? item.updated_at),
    unreadCount: item.unread_count,
    user: {
      avatarUrl: participant.avatar_url ?? undefined,
      id: participant.user_id,
      name: displayName(participant),
      status: mapPresenceStatus(presenceByUserId.get(participant.user_id)?.status ?? participant.status)
    }
  };
}

function directConversationToChannel(conversation: DirectConversation): ChatChannel {
  return {
    canManage: false,
    departmentId: undefined,
    description: "Tin nhắn riêng",
    id: conversation.id,
    isFavorite: false,
    isMember: true,
    membershipStatus: "active",
    memberCount: 2,
    messages: [],
    name: conversation.user.name,
    relativeTime: conversation.relativeTime,
    slug: undefined,
    tone: "purple",
    type: "direct",
    unreadCount: conversation.unreadCount ?? 0
  };
}

function placeholderChannel(channelId: string): ChatChannel {
  return {
    canManage: false,
    departmentId: undefined,
    description: "Tin nhắn riêng",
    id: channelId,
    isFavorite: false,
    isMember: true,
    membershipStatus: "active",
    memberCount: 2,
    messages: [],
    name: "Hội thoại",
    relativeTime: "",
    slug: undefined,
    tone: "purple",
    type: "direct",
    unreadCount: 0
  };
}

function upsertDirectConversation(
  current: ApiDirectConversation[] | undefined,
  conversation: ApiDirectConversation
): ApiDirectConversation[] {
  const nextId = conversation.channel_id ?? conversation.id;
  const list = current ?? [];

  if (!nextId) {
    return list;
  }

  const exists = list.some((item) => (item.channel_id ?? item.id) === nextId);
  if (!exists) {
    return [conversation, ...list];
  }

  return list.map((item) => ((item.channel_id ?? item.id) === nextId ? { ...item, ...conversation } : item));
}

function updateDirectConversationLastMessage(
  current: ApiDirectConversation[] | undefined,
  channelId: string,
  message: ApiMessage
): ApiDirectConversation[] | undefined {
  if (!current?.length || !channelId) {
    return current;
  }

  return current.map((conversation) => {
    const conversationChannelId = conversation.channel_id ?? conversation.id;
    if (conversationChannelId !== channelId) {
      return conversation;
    }

    return {
      ...conversation,
      last_message: message,
      updated_at: message.updated_at ?? message.created_at ?? conversation.updated_at
    };
  });
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

function formatConversationTime(value?: string): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round((startOfToday.getTime() - startOfMessageDay.getTime()) / 86_400_000);

  if (dayDifference === 0) {
    return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }
  if (dayDifference === 1) {
    return "Hôm qua";
  }
  if (dayDifference > 1 && dayDifference < 7) {
    return `${dayDifference} ngày`;
  }
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(date);
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
