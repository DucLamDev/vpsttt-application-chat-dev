"use client";

import { useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData
} from "@tanstack/react-query";
import { queryKeys, type MessagePage } from "@webtui/api-client";
import type {
  AuthUser,
  FileAttachment,
  Message as ApiMessage,
  MessageAttachment,
  MessageAuthor
} from "@webtui/types";
import { api } from "@/lib/api";
import type { ChatMessage, ChatUser, MessageAttachmentItem } from "../model/types";
import {
  mergeMessageIntoTimeline,
  messageTimelineKey,
  removeMessageFromTimeline,
  sortMessagesAscending,
  uniqueMessages,
  updateMessageInPages
} from "../model/message-cache";

export {
  mergeMessageIntoTimeline,
  messageRoomName,
  messageTimelineKey,
  removeMessageFromTimeline
} from "../model/message-cache";

const timelineLimit = 50;
type MessageTimelineQueryKey = ReturnType<typeof messageTimelineKey>;

export type MessageTimelineOptions = {
  canManageMessages: boolean;
  channelId: string;
  currentUser: ChatUser;
  enabled?: boolean;
  searchQuery?: string;
  threadMessageId?: string;
  workspaceId: string;
};

export type EditMessagePayload = {
  body: string;
  messageId: string;
};

export type DeleteMessagePayload = {
  messageId: string;
};

export type ToggleReactionPayload = {
  emoji: string;
  messageId: string;
  reactedByMe?: boolean;
};

export function useMessageTimeline({
  canManageMessages,
  channelId,
  currentUser,
  enabled = true,
  searchQuery = "",
  threadMessageId,
  workspaceId
}: MessageTimelineOptions) {
  const queryClient = useQueryClient();
  const timelineKey = messageTimelineKey(workspaceId, channelId);
  const cleanSearchQuery = searchQuery.trim();

  const messagesQuery = useInfiniteQuery<
    MessagePage,
    Error,
    InfiniteData<MessagePage>,
    MessageTimelineQueryKey,
    string | undefined
  >({
    enabled: Boolean(enabled && workspaceId && channelId),
    getNextPageParam: (lastPage) =>
      lastPage.meta.has_more ? lastPage.meta.next_cursor ?? lastPage.messages.at(-1)?.id : undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.messages.listPage(workspaceId, channelId, {
        before: typeof pageParam === "string" ? pageParam : undefined,
        limit: timelineLimit
      }),
    queryKey: timelineKey
  });

  const apiMessages = useMemo(
    () => sortMessagesAscending(uniqueMessages(messagesQuery.data?.pages.flatMap((page) => page.messages) ?? [])),
    [messagesQuery.data?.pages]
  );
  const attachmentMessageIds = useMemo(
    () => apiMessages.filter((message) => !message.id.startsWith("local-") && !message.deleted_at).map((message) => message.id),
    [apiMessages]
  );
  const attachmentsQuery = useQuery({
    enabled: Boolean(enabled && workspaceId && channelId && attachmentMessageIds.length),
    queryFn: () => loadMessageAttachments(workspaceId, channelId, attachmentMessageIds),
    queryKey: [...queryKeys.files.messageAttachments(workspaceId, channelId), attachmentMessageIds.join("|")] as const,
    staleTime: 15_000
  });
  const messages = useMemo(
    () =>
      apiMessages.map((message) =>
        mapMessage(withLoadedAttachments(message, attachmentsQuery.data?.get(message.id)), currentUser, canManageMessages)
      ),
    [apiMessages, attachmentsQuery.data, canManageMessages, currentUser]
  );
  const pinnedMessagesQuery = useQuery({
    enabled: Boolean(enabled && workspaceId && channelId),
    queryFn: () => api.messages.pins(workspaceId, channelId),
    queryKey: queryKeys.messages.pins(workspaceId, channelId),
    staleTime: 10_000
  });
  const pinnedMessages = useMemo(
    () =>
      sortMessagesAscending(uniqueMessages(pinnedMessagesQuery.data ?? [])).map((message) =>
        mapMessage(message, currentUser, canManageMessages)
      ),
    [canManageMessages, currentUser, pinnedMessagesQuery.data]
  );

  const threadQuery = useQuery({
    enabled: Boolean(enabled && workspaceId && channelId && threadMessageId),
    queryFn: () => api.messages.threadPage(workspaceId, channelId, threadMessageId ?? "", { limit: 50 }),
    queryKey: threadMessageId
      ? queryKeys.messages.thread(workspaceId, channelId, threadMessageId)
      : ["messages", workspaceId, channelId, "thread", "none"]
  });
  const threadMessages = useMemo(
    () =>
      sortMessagesAscending(uniqueMessages(threadQuery.data?.messages ?? [])).map((message) =>
        mapMessage(message, currentUser, canManageMessages)
      ),
    [canManageMessages, currentUser, threadQuery.data?.messages]
  );

  const searchQueryResult = useQuery({
    enabled: Boolean(enabled && workspaceId && cleanSearchQuery.length >= 2),
    queryFn: () => api.messages.searchPage(workspaceId, { limit: 20, q: cleanSearchQuery }),
    queryKey: queryKeys.messages.search(workspaceId, cleanSearchQuery)
  });
  const searchResults = useMemo(
    () =>
      sortMessagesAscending(uniqueMessages(searchQueryResult.data?.messages ?? [])).map((message) =>
        mapMessage(message, currentUser, canManageMessages)
      ),
    [canManageMessages, currentUser, searchQueryResult.data?.messages]
  );

  const editMessageMutation = useMutation({
    mutationFn: (input: EditMessagePayload) => api.messages.update(workspaceId, channelId, input.messageId, { body: input.body }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<InfiniteData<MessagePage>>(timelineKey);

      queryClient.setQueryData<InfiniteData<MessagePage>>(timelineKey, (current) =>
        updateMessageInPages(current, input.messageId, (message) => ({
          ...message,
          body: input.body,
          edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }))
      );

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(timelineKey, context.previous);
      }
    },
    onSuccess: (message) => {
      mergeMessageIntoTimeline(queryClient, workspaceId, channelId, message);
    }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (input: DeleteMessagePayload) => api.messages.delete(workspaceId, channelId, input.messageId),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: timelineKey });
      const previous = queryClient.getQueryData<InfiniteData<MessagePage>>(timelineKey);
      removeMessageFromTimeline(queryClient, workspaceId, channelId, input.messageId);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(timelineKey, context.previous);
      }
    }
  });

  const toggleReactionMutation = useMutation({
    mutationFn: async (input: ToggleReactionPayload) => {
      if (input.reactedByMe) {
        await api.messages.removeReaction(workspaceId, channelId, input.messageId, input.emoji);
        return null;
      }

      return api.messages.addReaction(workspaceId, channelId, input.messageId, { emoji: input.emoji });
    },
    onSuccess: (message) => {
      if (message) {
        mergeMessageIntoTimeline(queryClient, workspaceId, channelId, message);
      }
    }
  });

  const pinMessageMutation = useMutation({
    mutationFn: (messageId: string) => api.messages.pin(workspaceId, channelId, messageId),
    onSuccess: (message) => {
      mergeMessageIntoTimeline(queryClient, workspaceId, channelId, message);
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.pins(workspaceId, channelId) });
    }
  });

  const unpinMessageMutation = useMutation({
    mutationFn: (messageId: string) => api.messages.unpin(workspaceId, channelId, messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.messages.pins(workspaceId, channelId) });
    }
  });

  return {
    deleteMessageMutation,
    editMessageMutation,
    attachmentsQuery,
    hasOlderMessages: Boolean(messagesQuery.hasNextPage),
    isLoadingOlderMessages: messagesQuery.isFetchingNextPage,
    loadOlderMessages: () => messagesQuery.fetchNextPage(),
    messages,
    messagesQuery,
    pinnedMessages,
    pinnedMessagesQuery,
    pinMessageMutation,
    searchQuery: searchQueryResult,
    searchResults,
    threadMessages,
    threadQuery,
    toggleReactionMutation,
    unpinMessageMutation
  };
}

export function mapAuthUser(user: AuthUser | null): ChatUser {
  return {
    avatarUrl: user?.avatar_url ?? undefined,
    id: user?.id ?? "current-user",
    name: displayName(user),
    status: "online"
  };
}

async function loadMessageAttachments(
  workspaceId: string,
  channelId: string,
  messageIds: string[]
): Promise<Map<string, MessageAttachment[]>> {
  const entries = await Promise.all(
    messageIds.map(async (messageId) => {
      try {
        const attachments = await api.files.attachments(workspaceId, channelId, messageId);
        return [messageId, attachments.map(mapFileAttachmentToMessageAttachment)] as const;
      } catch {
        return [messageId, [] as MessageAttachment[]] as const;
      }
    })
  );

  return new Map(entries);
}

function withLoadedAttachments(message: ApiMessage, attachments?: MessageAttachment[]): ApiMessage {
  if (!attachments?.length) {
    return message;
  }

  return {
    ...message,
    attachments: message.attachments?.length ? message.attachments : attachments
  };
}

function mapFileAttachmentToMessageAttachment(attachment: FileAttachment): MessageAttachment {
  return {
    byte_size: attachment.file.byte_size,
    file: attachment.file,
    file_id: attachment.file_id,
    id: `${attachment.message_id}-${attachment.file_id}`,
    mime_type: attachment.file.mime_type,
    name: attachment.file.name ?? attachment.file.file_name ?? attachment.file.original_name,
    original_name: attachment.file.original_name,
    size: attachment.file.size,
    size_bytes: attachment.file.size_bytes,
    url: attachment.file.url
  };
}

export function mapMessage(
  message: ApiMessage,
  fallbackAuthor: ChatUser,
  canManageMessages = false
): ChatMessage {
  const author = mapMessageAuthor(message.author ?? message.user, fallbackAuthor, message.sender_id ?? message.author_id);
  const senderId = message.sender_id ?? message.author_id ?? author.id;
  const isOwner = senderId === fallbackAuthor.id || author.id === fallbackAuthor.id;
  const attachments = mapMessageAttachments(message.attachments);

  return {
    attachmentName: attachments[0]?.name,
    attachments,
    author,
    body: message.deleted_at ? "Tin nhắn đã bị xóa." : message.body,
    canDelete: isOwner || canManageMessages,
    canEdit: !message.deleted_at && (isOwner || canManageMessages),
    editedAt: message.edited_at ? formatTime(message.edited_at) : undefined,
    id: message.id,
    isDeleted: Boolean(message.deleted_at),
    isMine: isOwner,
    isLocal: message.id.startsWith("local-"),
    isPending: message.id.startsWith("local-"),
    rawChannelId: message.channel_id,
    rawCreatedAt: message.created_at ?? message.sent_at,
    rawSenderId: senderId,
    reactions: message.reactions?.map((reaction) => ({
      count: reaction.count ?? reaction.user_ids?.length ?? 0,
      emoji: reaction.emoji,
      reactedByMe: reaction.reacted_by_me
    })),
    sentAt: formatTime(message.created_at ?? message.sent_at)
  };
}

function mapMessageAttachments(attachments?: MessageAttachment[]): MessageAttachmentItem[] {
  return (attachments ?? [])
    .map((attachment, index) => {
      const file = attachment.file;
      const fileId = attachment.file_id ?? file?.id ?? attachment.id;

      if (!fileId) {
        return null;
      }

      const name =
        attachment.file_name ??
        attachment.name ??
        attachment.original_name ??
        file?.name ??
        file?.file_name ??
        file?.original_name ??
        "File đính kèm";
      const mimeType = attachment.mime_type ?? file?.mime_type;
      const size = attachment.byte_size ?? attachment.size_bytes ?? attachment.size ?? file?.byte_size ?? file?.size_bytes ?? file?.size;

      return {
        fileId,
        id: attachment.id ?? `${fileId}-${index}`,
        mimeType,
        name,
        size: formatFileSize(size),
        tone: fileTone(mimeType)
      };
    })
    .filter(Boolean) as MessageAttachmentItem[];
}

export function createOptimisticMessage(params: {
  body: string;
  channelId: string;
  currentUser: ChatUser;
  workspaceId: string;
}): ApiMessage {
  const now = new Date().toISOString();

  return {
    author: {
      avatar_url: params.currentUser.avatarUrl,
      display_name: params.currentUser.name,
      id: params.currentUser.id,
      status: params.currentUser.status
    },
    body: params.body,
    channel_id: params.channelId,
    created_at: now,
    id: `local-${Date.now()}`,
    kind: "text",
    sender_id: params.currentUser.id,
    updated_at: now,
    workspace_id: params.workspaceId
  };
}

function mapMessageAuthor(
  author: MessageAuthor | null | undefined,
  fallbackAuthor: ChatUser,
  senderId?: string | null
): ChatUser {
  if (!author) {
    return senderId && senderId !== fallbackAuthor.id
      ? {
          id: senderId,
          name: "Người dùng",
          status: "offline"
        }
      : fallbackAuthor;
  }

  return {
    avatarUrl: author.avatar_url ?? undefined,
    id: author.id,
    name: displayName(author),
    status: author.status === "busy" ? "busy" : author.status === "offline" ? "offline" : "online"
  };
}

function displayName(
  user:
    | Pick<AuthUser, "display_name" | "email" | "username">
    | MessageAuthor
    | { display_name?: string; email?: string; username?: string }
    | null
    | undefined
): string {
  return user?.display_name || user?.username || user?.email || "Người dùng";
}

function formatTime(value?: string): string {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatFileSize(size?: number): string | undefined {
  if (!size) {
    return undefined;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function fileTone(mimeType?: string): MessageAttachmentItem["tone"] {
  if (mimeType?.includes("pdf")) {
    return "red";
  }

  if (mimeType?.startsWith("image/")) {
    return "green";
  }

  return "slate";
}
