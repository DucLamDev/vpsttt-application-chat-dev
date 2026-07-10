"use client";

import { create } from "zustand";

export type UploadQueueStatus = "queued" | "uploading" | "attached" | "failed";

export type UploadQueueItem = {
  error?: string;
  file: File;
  fileId?: string;
  id: string;
  messageId?: string;
  name: string;
  size: number;
  status: UploadQueueStatus;
};

type UploadQueueState = {
  items: UploadQueueItem[];
  addFiles: (files: File[]) => void;
  clearAttached: () => void;
  markAttached: (id: string, messageId: string, fileId: string) => void;
  markFailed: (id: string, error: string) => void;
  markUploading: (id: string) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
};

export const useUploadStore = create<UploadQueueState>((set) => ({
  addFiles: (files) =>
    set((state) => ({
      items: [
        ...state.items,
        ...files.map((file) => ({
          file,
          id: createUploadId(),
          name: file.name,
          size: file.size,
          status: "queued" as const
        }))
      ]
    })),
  clearAttached: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== "attached")
    })),
  items: [],
  markAttached: (id, messageId, fileId) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              error: undefined,
              fileId,
              messageId,
              status: "attached"
            }
          : item
      )
    })),
  markFailed: (id, error) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              error,
              status: "failed"
            }
          : item
      )
    })),
  markUploading: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              error: undefined,
              status: "uploading"
            }
          : item
      )
    })),
  remove: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id)
    })),
  retry: (id) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id
          ? {
              ...item,
              error: undefined,
              status: "queued"
            }
          : item
      )
    }))
}));

function createUploadId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
